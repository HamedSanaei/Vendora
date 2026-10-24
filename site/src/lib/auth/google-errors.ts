/** Localizes safe Google/API failures without echoing credentials, provider internals or personal data. */
export function googleErrorMessage(message: string, status: number | undefined, locale: 'fa' | 'en'): string {
  const fa = locale === 'fa';
  if (message === 'GOOGLE_ACCOUNT_LINK_REQUIRED') return fa ? 'این ایمیل قبلاً ثبت شده است. ابتدا با رمز عبور وارد شوید، سپس Google را در امنیت حساب متصل کنید.' : 'Sign in with your existing password, then link Google in account security.';
  if (message === 'GOOGLE_NOT_CONFIGURED') return fa ? 'ورود گوگل روی سرور تنظیم نشده است. لطفاً با پشتیبانی تماس بگیرید.' : 'Google sign-in is not configured on the server. Contact support.';
  if (message === 'GOOGLE_TOKEN_INVALID') return fa ? 'تأیید هویت گوگل معتبر نیست یا منقضی شده است؛ دوباره حساب Google را انتخاب کنید.' : 'Google verification is invalid or expired. Select your Google account again.';
  if (message === 'GOOGLE_UNAVAILABLE' || !status) return fa ? 'ارتباط با سرویس ورود برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.' : 'The sign-in service could not be reached. Check your connection and retry.';
  if (message === 'Account is locked.') return fa ? 'حساب شما موقتاً قفل شده است؛ بعداً دوباره تلاش کنید.' : 'Your account is temporarily locked. Try again later.';
  return fa ? 'ورود با Google انجام نشد. دوباره تلاش کنید.' : 'Google sign-in failed. Please try again.';
}
