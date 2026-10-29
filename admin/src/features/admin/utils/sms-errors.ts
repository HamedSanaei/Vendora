/** Maps allow-listed application errors to actionable copy without exposing carrier responses or credentials. */
export function smsErrorMessage(code: unknown, status: number | undefined, locale: 'fa' | 'en'): string {
  const messages: Record<string, [string, string]> = {
    SMS_SETTINGS_CHANGED: ['تنظیمات توسط درخواست دیگری تغییر کرده است؛ «دریافت مجدد» را بزنید و تغییرات را دوباره ذخیره کنید.', 'Settings changed. Reload and save your changes again.'],
    PHONE_OWNERSHIP_CONFLICT: ['این شماره برای چند حساب تأیید شده است؛ ابتدا مالکیت شماره را در حساب کاربران اصلاح کنید.', 'Resolve duplicate verified phone ownership first.'],
    SMS_NOT_CONFIGURED: ['تنظیمات پروایدر روی سرور کامل نیست. برای پارس‌گرین، کد پیش‌فرض به Signature و کد اختصاصی وندوراشاپ و پیام خدماتی علاوه بر آن به SenderNumber نیاز دارند.', 'Server provider settings are incomplete. ParsGreen legacy OTP needs Signature; branded OTP and service messages also need SenderNumber.'],
    SMS_AUTH_UNAVAILABLE: ['سرویس پیامک در تنظیمات ذخیره‌شده غیرفعال است؛ آن را فعال و تنظیمات را ذخیره کنید.', 'SMS is disabled in the saved settings. Enable it and save first.'],
    SMS_PROVIDER_UNAVAILABLE: ['پروایدر انتخاب‌شده روی سرور در دسترس نیست؛ پروایدر آماده را انتخاب و ذخیره کنید.', 'The selected provider is unavailable on this server. Select an available provider and save.'],
    SMS_VERIFIED_RECIPIENT_REQUIRED: ['حساب گیرنده شمارهٔ موبایل تأییدشده ندارد. برای تست، شمارهٔ حساب مدیر را در بخش «تأیید شمارهٔ همراه من» همین پنل تأیید کنید.', 'A verified recipient phone is required. Use Verify my mobile number in this panel first.'],
    INVALID_PHONE: ['شمارهٔ موبایل حساب معتبر نیست یا تأیید نشده است؛ شماره را در پروفایل حساب بررسی و تأیید کنید.', 'Check and verify a valid mobile number in the account profile.'],
    SMS_TEST_OWN_PHONE_ONLY: ['تست فقط به شمارهٔ تأییدشدهٔ حساب مدیر فعلی ارسال می‌شود؛ از بخش «تأیید شمارهٔ همراه من» همین پنل استفاده کنید.', 'Tests use only the current administrator’s verified phone. Verify it in this panel first.'],
    PHONE_REQUIRED: ['شمارهٔ همراهی برای این حساب ثبت نشده یا معتبر نیست؛ آن را در بخش کاربران ثبت کنید و شماره را دوباره دریافت کنید.', 'Save a valid mobile number for your account in Users, then reload your number.'],
    SEND_LIMIT: ['سهمیهٔ ارسال کد موقتاً به پایان رسیده است؛ تا پایان زمان انتظار دوباره ارسال نکنید.', 'The temporary code send quota is exhausted. Wait before resending.'],
    SMS_SEND_FAILED: ['دریافت پاسخ معتبر ارسال کد از سرویس پیامک تأیید نشد. گزارش ارسال را بررسی کنید؛ کلید، نوع و الگوی کد و دسترسی شبکهٔ سرور نیاز به بررسی دارند. ارسال دوبارهٔ فوری ممکن است هزینهٔ تکراری ایجاد کند.', 'The provider did not confirm a valid OTP send response. Check message history, server credentials, OTP type/template and connectivity before retrying.'],
    RESEND_WAIT: ['محدودیت ارسال کد فعال است؛ تا پایان زمان انتظار، دوباره درخواست نفرستید.', 'Wait for the code resend limit to expire before retrying.'],
    INVALID_CODE: ['کد واردشده صحیح نیست؛ همان کد دریافتی را دوباره بررسی کنید.', 'The entered code is incorrect. Check the received code.'],
    CODE_EXPIRED: ['کد منقضی یا قبلاً مصرف شده است؛ پس از پایان زمان انتظار، کد جدید درخواست کنید.', 'The code expired or was already used. Request another after the resend delay.'],
    CODE_ATTEMPT_LIMIT: ['تعداد تلاش تأیید کد از حد مجاز گذشته است؛ پس از پایان زمان انتظار، کد جدید درخواست کنید.', 'The verification attempt limit was reached. Wait before requesting another code.'],
    VERIFICATION_CONFLICT: ['درخواست هم‌زمان دیگری ثبت شده است؛ گزارش را بررسی کنید و بلافاصله ارسال را تکرار نکنید.', 'Another verification request conflicted. Check history before requesting another send.'],
    SMS_INVALID_SETTINGS: ['مقادیر تنظیمات معتبر نیستند؛ نوع کد پارس‌گرین، شناسهٔ الگو و آستانهٔ موجودی را بررسی کنید.', 'Check the OTP type, template ID and stock threshold values.'],
    SMS_INVALID_RECIPIENT: ['گیرندهٔ مدیریتی باید حساب Admin با شمارهٔ تأییدشده باشد؛ فهرست گیرندگان را بررسی کنید.', 'Administrator recipients must be Admin accounts with verified phones.'],
    SMS_INVALID_RULES: ['فهرست رویدادهای پیامک معتبر نیست؛ تنظیمات را دوباره دریافت کنید.', 'The SMS event list is invalid. Reload settings.'],
    SMS_INVALID_TEMPLATE: ['متن الگوی پیامک خالی، بیش از حد طولانی یا دارای متغیر پشتیبانی‌نشده است.', 'A template is empty, too long or contains unsupported variables.'],
    SMS_INVALID_TEXT: ['متن پیام خالی یا بیشتر از حداکثر مجاز پروایدر است.', 'The message is empty or exceeds the provider’s length limit.'],
    OTP_NOT_ALLOWED: ['این کد برای حساب یا عملیات فعلی قابل استفاده نیست.', 'This code cannot be used for the current account or operation.'],
    IDEMPOTENCY_KEY_REUSED: ['این درخواست با اطلاعات متفاوت قبلاً ثبت شده است؛ گزارش ارسال را پیش از اقدام دوباره بررسی کنید.', 'This request key was used with different data. Check history before retrying.'],
  };
  const index = locale === 'fa' ? 0 : 1;
  if (typeof code === 'string' && Object.hasOwn(messages, code)) return messages[code][index];
  if (status === 401) return locale === 'fa' ? 'نشست مدیریتی معتبر نیست؛ دوباره وارد پنل شوید.' : 'Sign in to the administration panel again.';
  if (status === 403) return locale === 'fa' ? 'این حساب اجازهٔ مدیریت پیامک را ندارد.' : 'This account cannot manage SMS.';
  if (status === 429) return locale === 'fa' ? 'تعداد درخواست‌ها از حد مجاز گذشته است؛ کمی صبر کنید و دوباره تلاش کنید.' : 'Too many requests. Wait before retrying.';
  if (status === 400) return locale === 'fa' ? 'اطلاعات درخواست معتبر نیست؛ مقادیر فرم و گیرنده را بررسی کنید.' : 'Check the form values and selected recipient.';
  return locale === 'fa' ? 'پاسخ معتبر از سرور دریافت نشد. اطلاعات فرم حفظ شده است؛ پیش از ارسال دوباره، گزارش ارسال را بررسی کنید.' : 'No valid server response was received. Your draft is preserved. Check message history before retrying.';
}
