import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl, apiImageUrl } from '../src/lib/api-url.ts';
import { googleErrorMessage } from '../src/lib/auth/google-errors.ts';

test('public storefront uses its current origin without baking a former hostname into requests', () => {
  for (const origin of ['https://vendorashop.ir', 'https://www.vendorashop.ir', 'https://vendora.tofanservice.ir']) {
    assert.equal(new URL(`${apiUrl('/api')}/account/google`, origin).origin, origin);
  }
});
test('server rendering uses the private API while preserving absolute development deployments', () => {
  assert.equal(apiUrl('/api', 'http://vendora-api:8080'), 'http://vendora-api:8080/api');
  assert.equal(apiUrl('https://old.invalid', 'http://vendora-api:8080/api/'), 'http://vendora-api:8080/api');
  assert.equal(apiUrl('http://localhost:5020/'), 'http://localhost:5020/api');
  assert.equal(apiUrl('http://localhost:5020/api/'), 'http://localhost:5020/api');
  assert.equal(apiUrl('/api/'), '/api');
});
test('uploads remain public same-origin paths, never private Docker URLs', () => {
  assert.equal(apiImageUrl('/uploads/products/bag.webp', '/api'), '/uploads/products/bag.webp');
  assert.equal(apiImageUrl('uploads/products/bag.webp', '/api'), '/uploads/products/bag.webp');
  assert.equal(apiImageUrl('/uploads/products/bag.webp', 'http://localhost:5020/api'), 'http://localhost:5020/uploads/products/bag.webp');
  assert.equal(apiImageUrl('https://cdn.example.invalid/bag.webp', '/api'), 'https://cdn.example.invalid/bag.webp');
});

test('Google feedback distinguishes network/configuration/linking failures and never echoes provider contents', () => {
  assert.match(googleErrorMessage('GOOGLE_NOT_CONFIGURED', 400, 'en'), /not configured/);
  assert.match(googleErrorMessage('GOOGLE_TOKEN_INVALID', 400, 'en'), /invalid or expired/);
  assert.match(googleErrorMessage('', undefined, 'en'), /could not be reached/);
  assert.match(googleErrorMessage('GOOGLE_ACCOUNT_LINK_REQUIRED', 400, 'en'), /existing password/);
  assert.doesNotMatch(googleErrorMessage('private-provider-details', 500, 'fa'), /private-provider-details/);
});
