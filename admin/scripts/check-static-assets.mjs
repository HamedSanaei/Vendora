import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = mkdtempSync(path.join(tmpdir(), 'vendora-admin-assets-'));
const container = `vendora-admin-assets-qa-${randomUUID().slice(0, 8)}`;
let started = false;

/** Runs Docker without a shell so mount paths and request paths cannot become shell syntax. */
function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, {encoding: 'utf8', timeout: 60_000});
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!allowFailure && result.status !== 0) throw new Error(output || result.error?.message || 'Docker failed');
  return output;
}

try {
  const source = readFileSync(path.join(root, 'deploy/docker/admin.Dockerfile'), 'utf8');
  const config = source.match(/COPY <<"EOF" \/etc\/nginx\/conf\.d\/default\.conf\r?\n([\s\S]*?)\r?\nEOF/)[1];
  const configPath = path.join(temporary, 'default.conf');
  writeFileSync(configPath, config);
  const dist = path.join(root, 'admin/dist');
  const asset = readdirSync(path.join(dist, 'assets')).find(name => /^index-.*\.js$/.test(name));
  assert.ok(asset, 'Build the admin application before testing nginx');
  docker(['run', '--rm', '-d', '--name', container, '--network', 'none',
    '--mount', `type=bind,source=${configPath},target=/etc/nginx/conf.d/default.conf,readonly`,
    '--mount', `type=bind,source=${dist},target=/usr/share/nginx/html,readonly`, 'nginx:1.27-alpine']);
  started = true;
  docker(['exec', container, 'nginx', '-t']);

  /** Reads real nginx status/headers inside the isolated container, never contacting production. */
  function request(url, expectedStatus) {
    const output = docker(['exec', container, 'curl', '-sS', '-D', '-', '-o', '/dev/null', `http://127.0.0.1${url}`]);
    assert.match(output, new RegExp(`HTTP/1\\.1 ${expectedStatus}\\b`), output);
    return output;
  }
  for (const route of ['/index.html', '/fa/admin/products/example/edit', '/en/admin/category']) {
    const response = request(route, 200);
    assert.match(response, /Content-Type: text\/html/i);
    assert.match(response, /Cache-Control: no-store/i);
  }
  const js = request(`/assets/${asset}`, 200);
  assert.match(js, /Content-Type: (?:application|text)\/javascript/i);
  assert.match(js, /Cache-Control: public, max-age=31536000, immutable/i);
  for (const missing of ['/assets/Editor-old-missing.js', '/assets/Editor-old-missing.css']) {
    const response = request(missing, 404);
    assert.match(response, /Cache-Control: no-store/i);
    assert.doesNotMatch(response, /immutable/i);
  }
  request('/healthz', 200);
  console.log('PASS: nginx syntax, HTML no-store, immutable real JS, uncached missing JS/CSS 404, health probe.');
} finally {
  if (started) docker(['rm', '-f', container], true);
  rmSync(temporary, {recursive: true, force: true});
}
