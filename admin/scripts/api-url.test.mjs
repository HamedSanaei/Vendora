import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveAdminApiBaseUrl } from '../src/lib/api/api-url.ts';

test('production defaults and relative roots follow either storefront domain without cross-origin requests', () => {
  for (const origin of ['https://vendorashop.ir', 'https://vendora.tofanservice.ir']) {
    for (const configured of [undefined, '', '  ', '/']) {
      assert.equal(resolveAdminApiBaseUrl(configured, origin, false), origin);
      assert.equal(new URL('/api/account/login', resolveAdminApiBaseUrl(configured, origin, false)).href, `${origin}/api/account/login`);
    }
  }
});

test('local development and deliberately separate API deployments remain supported', () => {
  assert.equal(resolveAdminApiBaseUrl(undefined, 'https://localhost:3001', true), 'http://localhost:5020');
  assert.equal(resolveAdminApiBaseUrl(' https://api.example.invalid/ ', 'https://vendorashop.ir', false), 'https://api.example.invalid');
});

test('production image and deployment use root-relative API base, not a legacy domain or doubled /api path', () => {
  const docker = readFileSync(new URL('../../deploy/docker/admin.Dockerfile', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(docker, /^ARG VITE_API_BASE_URL=\/$/m);
  assert.match(workflow, /^\s+VITE_API_BASE_URL=\/$/m);
  for (const file of ['../src/features/admin/utils/article-preview.ts', '../src/features/admin/components/rich-text/editor-content.ts']) {
    const code = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.ok(!code.includes('import.meta.env.VITE_API_BASE_URL'), 'Image handling reuses the resolved shared API base');
  }
});
