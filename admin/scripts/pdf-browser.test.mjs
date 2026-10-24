import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePdfPrintWindow as adminPrint } from '../src/lib/pdf-browser.ts';
import { preparePdfPrintWindow as customerPrint } from '../../site/src/lib/pdf-browser.ts';

for (const [name, prepare] of [['admin', adminPrint], ['customer', customerPrint]]) {
  test(`${name}: reserves PDF viewer synchronously within the user gesture and severs opener access`, () => {
    const viewer = { opener: { privatePage: true } };
    let opened = false;
    const result = prepare(() => { opened = true; return viewer; });
    assert.equal(opened, true);
    assert.equal(result, viewer);
    assert.equal(viewer.opener, null);
  });
  test(`${name}: blocked popups return an actionable failure rather than silent print success`, () => {
    assert.throws(() => prepare(() => null), { message: 'PDF_POPUP_BLOCKED' });
  });
}
