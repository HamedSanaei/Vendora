const fa = {
  required: 'برای خرید و استفاده از خدمات، مشخصات ستاره‌دار را تکمیل و شماره همراه خود را تأیید کنید.',
  loading: 'در حال دریافت اطلاعات حساب…', retry: 'تلاش مجدد', firstName: 'نام *', lastName: 'نام خانوادگی *', email: 'ایمیل *', phone: 'شماره همراه *',
  invalid: 'نام، نام خانوادگی، ایمیل معتبر و شماره موبایل ایران را وارد کنید.', save: 'ذخیره اطلاعات', saving: 'در حال ذخیره…', saved: 'اطلاعات شما ذخیره شد.',
  phoneTitle: 'تأیید شماره همراه', verified: 'شماره همراه تأیید شده است', unverified: 'این شماره هنوز تأیید نشده است.',
  saveFirst: 'ابتدا اطلاعات و شماره همراه را ذخیره کنید.', send: 'ارسال کد تأیید', sending: 'در حال ارسال…', sent: 'کد به شماره همراه ذخیره‌شده ارسال شد.',
  code: 'کد تأیید پیامک‌شده', confirm: 'تأیید شماره', confirming: 'در حال بررسی…', wait: 'ثانیه تا ارسال مجدد', continue: 'ادامه',
  failed: 'عملیات انجام نشد. دوباره تلاش کنید.', smsUnavailable: 'سرویس پیامک در دسترس نیست؛ تأیید شماره انجام نشده است. بعداً دوباره تلاش کنید.',
  invalidCode: 'کد واردشده نادرست است.', expired: 'کد منقضی یا مصرف شده است؛ دوباره کد دریافت کنید.', limited: 'تعداد تلاش‌ها بیش از حد مجاز است؛ کمی صبر کنید.',
  conflict: 'اطلاعات هم‌زمان تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.', emailUsed: 'این ایمیل قبلاً استفاده شده است.', login: 'ورود به حساب',
};
const en: typeof fa = {
  required: 'Complete the required personal details and verify your mobile number before purchasing or using services.',
  loading: 'Loading your account…', retry: 'Retry', firstName: 'First name *', lastName: 'Last name *', email: 'Email *', phone: 'Mobile number *',
  invalid: 'Enter your first and last name, a valid email and an Iranian mobile number.', save: 'Save details', saving: 'Saving…', saved: 'Your details were saved.',
  phoneTitle: 'Verify mobile number', verified: 'Mobile number verified', unverified: 'This number is not verified yet.', saveFirst: 'Save your details and phone number first.',
  send: 'Send verification code', sending: 'Sending…', sent: 'A code was sent to your saved mobile number.', code: 'SMS verification code', confirm: 'Verify number', confirming: 'Verifying…',
  wait: 'seconds before resending', continue: 'Continue', failed: 'The operation failed. Please retry.', smsUnavailable: 'SMS is unavailable; your phone has not been verified. Please try again later.',
  invalidCode: 'The code is incorrect.', expired: 'The code expired or was used. Request another code.', limited: 'Too many attempts. Please wait.',
  conflict: 'Your details changed concurrently. Reload the page.', emailUsed: 'This email is already in use.', login: 'Sign in',
};
/** Centralized completion/phone-verification strings shared by existing account and commerce screens. */
export function profileCopy(locale: 'fa' | 'en') { return locale === 'fa' ? fa : en; }

/** Maps server validation codes to clear localized feedback, retaining drafts after failure. */
export function profileError(code: string, locale: 'fa' | 'en') {
  const t = profileCopy(locale);
  if (code.startsWith('SMS_')) return t.smsUnavailable;
  if (code === 'INVALID_CODE') return t.invalidCode;
  if (code === 'CODE_EXPIRED') return t.expired;
  if (['SEND_LIMIT', 'RESEND_WAIT', 'CODE_ATTEMPT_LIMIT'].includes(code)) return t.limited;
  if (code === 'VERIFICATION_CONFLICT') return t.conflict;
  if (code.includes('Email is already')) return t.emailUsed;
  if (code === 'PROFILE_NAME_REQUIRED') return t.invalid;
  return t.failed;
}
