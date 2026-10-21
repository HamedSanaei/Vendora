import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminErrorCopy, isAdminModuleLoadError, recoverAdminError } from '../src/features/admin/utils/module-load-error.ts';

test('recognizes browser-specific dynamic import and CSS preload errors', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://example.invalid/admin/assets/Editor-old.js',
    'Importing a module script failed.',
    'error loading dynamically imported module: /admin/assets/old.js',
    'Unable to preload CSS for /admin/assets/Editor-old.css',
    'Loading chunk 123 failed.',
  ]) assert.equal(isAdminModuleLoadError(new TypeError(message)), true, message);
  assert.equal(isAdminModuleLoadError({ message: 'Importing a module script failed.' }), true);
});

test('does not reload for API, validation, or ordinary rendering errors', () => {
  for (const error of [new Error('Failed to fetch'), new Error('Request failed with status code 404'), new Error('Invalid product'), null, {}, 'Importing a module script failed.']) {
    assert.equal(isAdminModuleLoadError(error), false);
  }
});

test('a confirmed stale module recovery reloads, never retries the cached rejected lazy component', () => {
  const calls = [];
  recoverAdminError(new Error('Failed to fetch dynamically imported module: /old.js'), {
    confirmReload: () => { calls.push('confirm'); return true; },
    reload: () => calls.push('reload'), retry: () => calls.push('retry'),
  });
  assert.deepEqual(calls, ['confirm', 'reload']);
});

test('cancelling reload preserves the form and does not trigger a reload loop', () => {
  const calls = [];
  recoverAdminError(new Error('Unable to preload CSS for /old.css'), {
    confirmReload: () => { calls.push('confirm'); return false; },
    reload: () => calls.push('reload'), retry: () => calls.push('retry'),
  });
  assert.deepEqual(calls, ['confirm']);
});

test('ordinary errors retry in place without discarding application state', () => {
  const calls = [];
  recoverAdminError(new Error('Temporary rendering issue'), {
    confirmReload: () => { calls.push('confirm'); return true; },
    reload: () => calls.push('reload'), retry: () => calls.push('retry'),
  });
  assert.deepEqual(calls, ['retry']);
});

test('fallback translations work without the React Router and never confuse partial locale names', () => {
  assert.equal(adminErrorCopy('/fa/admin/products/new').direction, 'rtl');
  assert.equal(adminErrorCopy('/en/admin/products/new').direction, 'ltr');
  assert.equal(adminErrorCopy('/english/admin').direction, 'rtl');
  assert.match(adminErrorCopy('/fa/admin').reloadWarning, /ذخیره‌نشده/);
});
