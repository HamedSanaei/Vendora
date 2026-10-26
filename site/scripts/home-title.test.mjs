import assert from 'node:assert/strict';
import test from 'node:test';
import { homepageTitle } from '../src/lib/store-settings.ts';

test('empty homepage settings use the store name once instead of the repeated title template', () => {
  assert.equal(homepageTitle({}, 'fa'), 'وندورا');
  assert.equal(homepageTitle({nameFa:'کیف آوا',homeTitleFa:'  '}, 'fa'), 'کیف آوا');
});
test('Persian homepage uses the exact trimmed editorial title without appending the brand again', () => {
  assert.equal(homepageTitle({nameFa:'وندورا',homeTitleFa:'  خرید کیف از وندورا | تولید مستقیم  '},'fa'),'خرید کیف از وندورا | تولید مستقیم');
});
test('the Persian homepage override does not change English titles or brand identity', () => {
  const profile = {nameFa:'وندورا',nameEn:'Vendora Bags',homeTitleFa:'صفحه اصلی فارسی'};
  assert.equal(homepageTitle(profile,'en'),'Vendora Bags'); assert.equal(profile.nameFa,'وندورا');
});
