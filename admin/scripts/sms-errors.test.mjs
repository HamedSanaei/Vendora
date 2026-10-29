import assert from 'node:assert/strict';
import test from 'node:test';
import { smsErrorMessage } from '../src/features/admin/utils/sms-errors.ts';

test('missing verified phones and missing provider settings have distinct actionable messages', () => {
  const phone = smsErrorMessage('SMS_VERIFIED_RECIPIENT_REQUIRED', 400, 'fa');
  assert.match(phone, /شمارهٔ موبایل تأییدشده ندارد/);
  assert.match(phone, /همین پنل/);
  assert.match(smsErrorMessage('SMS_TEST_OWN_PHONE_ONLY', 400, 'fa'), /مدیر فعلی/);
  assert.match(smsErrorMessage('SMS_NOT_CONFIGURED', 503, 'fa'), /SenderNumber/);
  assert.notEqual(phone, smsErrorMessage('SMS_NOT_CONFIGURED', 503, 'fa'));
});

test('provider acceptance failures never claim that nothing was sent or suggest immediate retries', () => {
  const text = smsErrorMessage('SMS_SEND_FAILED', 503, 'fa');
  assert.match(text, /گزارش ارسال/);
  assert.match(text, /هزینهٔ تکراری/);
  assert.match(smsErrorMessage('SMS_SEND_FAILED', 503, 'en'), /before retrying/);
});

test('only known application codes are displayed; arbitrary provider/error bodies remain private', () => {
  for (const value of ['secret-carrier-response', { key: 'private-signature' }, null, '__proto__', 'constructor']) {
    const text = smsErrorMessage(value, 500, 'fa');
    assert.match(text, /پاسخ معتبر از سرور/);
    assert.doesNotMatch(text, /secret|private|signature|constructor|__proto__/);
  }
  assert.match(smsErrorMessage(undefined, 401, 'fa'), /دوباره وارد/);
  assert.match(smsErrorMessage(undefined, 403, 'en'), /cannot manage SMS/);
  assert.match(smsErrorMessage(undefined, 429, 'en'), /Wait/);
});
