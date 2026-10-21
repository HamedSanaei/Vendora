/** Identifies module/CSS chunk failures without treating ordinary API/network errors as stale builds. */
export function isAdminModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message
    : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : '';
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload css|loading (?:css )?chunk .+ failed/i.test(message);
}

interface RecoveryActions {
  confirmReload: () => boolean;
  reload: () => void;
  retry: () => void;
}

/** A rejected React.lazy import is cached: explicit, confirmed page reload replaces the stale module graph. */
export function recoverAdminError(error: unknown, actions: RecoveryActions): void {
  if (isAdminModuleLoadError(error)) {
    if (actions.confirmReload()) actions.reload();
  } else actions.retry();
}

const fa = {
  direction: 'rtl' as const,
  pageTitle: 'فایل‌های پنل مدیریت بارگذاری نشدند',
  editorTitle: 'ویرایشگر متن بارگذاری نشد',
  genericTitle: 'نمایش این بخش با مشکل روبه‌رو شد',
  loadDescription: 'ممکن است نسخهٔ پنل هنگام باز بودن این صفحه تغییر کرده باشد یا اتصال شبکه قطع شده باشد. اتصال را بررسی و نسخهٔ تازهٔ صفحه را بارگذاری کنید.',
  inlineDescription: 'اطلاعات بقیهٔ فرم حفظ شده است. پیش از بارگذاری مجدد، تغییرات ثبت‌نشده را ذخیره یا کپی کنید.',
  runtimeDescription: 'لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید.',
  reload: 'بارگذاری نسخهٔ تازهٔ پنل', retry: 'تلاش مجدد',
  confirmReload: 'بله، بارگذاری مجدد', cancel: 'انصراف',
  reloadWarning: 'با بارگذاری مجدد، تغییرات ذخیره‌نشدهٔ این صفحه از دست می‌روند. ادامه می‌دهید؟',
};
const en = {
  direction: 'ltr' as const,
  pageTitle: 'Admin files could not be loaded', editorTitle: 'The text editor could not be loaded',
  genericTitle: 'This section could not be displayed',
  loadDescription: 'The admin version may have changed while this page was open, or the network may be unavailable. Check your connection and load the current page version.',
  inlineDescription: 'The rest of your form is preserved. Save or copy unsaved changes before reloading.',
  runtimeDescription: 'Please try again. Contact support if the problem persists.',
  reload: 'Load current admin version', retry: 'Try again',
  confirmReload: 'Yes, reload', cancel: 'Cancel',
  reloadWarning: 'Reloading will discard unsaved changes on this page. Continue?',
};

/** Reads locale from the URL even when the router or the application shell has failed. */
export function adminErrorCopy(pathname: string) { return /^\/en(?:\/|$)/.test(pathname) ? en : fa; }
