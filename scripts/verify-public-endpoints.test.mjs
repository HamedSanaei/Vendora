import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const bash = process.env.BASH_BIN ?? (process.platform === 'win32'
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');

/** Convert Windows fixture paths to Git Bash paths without shell interpolation. */
function bashPath(value) {
  return value.replaceAll('\\', '/').replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
}

/** Exercise the real health script with isolated curl/sleep doubles, never a server. */
function runCheck(responses, origin = 'https://store.example') {
  const directory = mkdtempSync(path.join(tmpdir(), 'vendora-health-'));
  try {
    writeFileSync(path.join(directory, 'responses'), `${responses.join('\n')}\n`);
    writeFileSync(path.join(directory, 'curl'), [
      '#!/usr/bin/env bash',
      'set -eu',
      'count=0',
      'if [ -f "$TEST_STATE/count" ]; then read -r count < "$TEST_STATE/count"; fi',
      'count=$((count + 1))',
      'echo "$count" > "$TEST_STATE/count"',
      'printf \'%s\\n\' "$@" >> "$TEST_STATE/arguments"',
      'response="$(sed -n "${count}p" "$TEST_STATE/responses")"',
      'response="${response:-200:0}"',
      'printf \'%s 192.0.2.1\' "${response%:*}"',
      'exit "${response#*:}"',
      '',
    ].join('\n'));
    writeFileSync(path.join(directory, 'sleep'), '#!/usr/bin/env bash\necho "$1" >> "$TEST_STATE/sleeps"\n');
    chmodSync(path.join(directory, 'curl'), 0o755);
    chmodSync(path.join(directory, 'sleep'), 0o755);
    const result = spawnSync(bash, ['-c',
      'export PATH="$1:$PATH"; export TEST_STATE="$1"; bash "$2" "$3"',
      'health-test', bashPath(directory), bashPath(path.join(root, 'scripts/verify-public-endpoints.sh')), origin,
    ], { encoding: 'utf8', timeout: 15000 });
    assert.ifError(result.error);
    const read = (name) => {
      try { return readFileSync(path.join(directory, name), 'utf8'); }
      catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
    };
    return { ...result, calls: Number(read('count') || 0), arguments: read('arguments'), sleeps: read('sleeps') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('all three public endpoints require 2xx; redirects follow HTTPS with bounded requests', () => {
  const result = runCheck(['200:0', '200:0', '200:0']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls, 3);
  assert.equal(result.sleeps, '');
  for (const endpoint of ['/healthz', '/', '/fa/admin']) {
    assert.ok(result.arguments.includes(`https://store.example${endpoint}\n`));
  }
  for (const option of ['--fail', '--location', '--max-redirs\n5', '--proto\n=https',
    '--proto-redir\n=https', '--connect-timeout\n5', '--max-time\n20', '--retry\n0']) {
    assert.ok(result.arguments.includes(option), option);
  }
  assert.doesNotMatch(result.arguments, /--insecure|--location-trusted/);
});

test('runner-only Cloudflare 525 after healthy healthz retries the failing route', () => {
  const result = runCheck(['200:0', '525:22', '525:22', '200:0', '200:0']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls, 5);
  assert.equal(result.sleeps, '5\n5\n');
  assert.match(result.stderr, /HTTP 525, curl 22, edge 192\.0\.2\.1/);
});

test('persistent 525 fails after exactly six attempts and never checks later routes', () => {
  const result = runCheck(Array(6).fill('525:22'));
  assert.equal(result.status, 1);
  assert.equal(result.calls, 6);
  assert.equal(result.sleeps, '5\n'.repeat(5));
  assert.match(result.stderr, /Retry budget exhausted/);
  assert.doesNotMatch(result.arguments, /https:\/\/store\.example\/fa\/admin/);
});

test('transient HTTP, DNS, refused connections and timeouts recover', () => {
  for (const response of ['408:22', '429:22', '500:22', '502:22', '503:22', '504:22',
    '520:22', '521:22', '522:22', '523:22', '524:22', '000:6', '000:7', '000:28',
    '000:35', '000:52', '000:55', '000:56']) {
    const result = runCheck([response, '200:0']);
    assert.equal(result.status, 0, `${response}: ${result.stderr}`);
    assert.equal(result.calls, 4, response);
    assert.equal(result.sleeps, '5\n', response);
  }
});

test('permanent HTTP and certificate errors fail immediately, never weakening TLS', () => {
  for (const response of ['400:22', '401:22', '403:22', '404:22', '526:22', '000:60', '000:77', '000:3']) {
    const result = runCheck([response]);
    assert.equal(result.status, 1, response);
    assert.equal(result.calls, 1, response);
    assert.equal(result.sleeps, '', response);
  }
});

test('an unfollowed redirect or network failure with a 2xx code is not healthy', () => {
  for (const response of ['307:0', '200:56']) {
    const result = runCheck(Array(6).fill(response));
    assert.equal(result.status, 1, response);
    assert.doesNotMatch(result.stdout, /Passed:/);
  }
});

test('only HTTPS origins are accepted before curl runs', () => {
  for (const origin of ['', 'http://store.example', 'https://user:secret@store.example', 'https://store.example?key=secret']) {
    const result = runCheck([], origin);
    assert.equal(result.status, 2);
    assert.equal(result.calls, 0);
    assert.doesNotMatch(result.stderr, /user:secret|key=secret/);
  }
});

test('both deploy gates use the same checker and summaries distinguish server and runner results', () => {
  const deploy = readFileSync(path.join(root, 'scripts/deploy-production.sh'), 'utf8');
  const workflow = readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  const ci = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /^  PUBLIC_ORIGIN: https:\/\/vendorashop\.ir$/m);
  assert.ok(workflow.includes("deploy-production.sh '$SHA' '${PUBLIC_ORIGIN#https://}'"));
  assert.ok(deploy.includes('PUBLIC_HOST="${2:-${VENDORA_PUBLIC_HOST:-vendorashop.ir}}"'));
  assert.ok(deploy.includes('bash "$DEPLOY_DIR/scripts/verify-public-endpoints.sh" "https://$PUBLIC_HOST"'));
  assert.ok(workflow.includes('bash scripts/verify-public-endpoints.sh "$PUBLIC_ORIGIN"'));
  assert.ok(workflow.includes("steps.public-check.conclusion || 'skipped'"));
  assert.ok(workflow.includes("steps.deploy.conclusion == 'success' && 'Passed'"));
  for (const pipeline of [workflow, ci]) assert.ok(pipeline.includes('node --test scripts/verify-public-endpoints.test.mjs'));
  assert.ok(workflow.includes('needs: [backend, admin, site, deployment-checks]'));
});
