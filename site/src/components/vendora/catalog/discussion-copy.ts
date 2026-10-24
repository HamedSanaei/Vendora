const fa = {
  completeProfile: 'پیش از ثبت محتوا، اطلاعات حساب و تأیید شماره همراه را تکمیل کنید.',
  questions: 'پرسش‌وپاسخ', answers: 'پاسخ‌ها', reviews: 'دیدگاه‌ها', review: 'دیدگاه شما', question: 'سؤال شما', answer: 'پاسخ شما',
  login: 'برای ثبت دیدگاه، سؤال یا پاسخ وارد حساب خود شوید.', loginButton: 'ورود به حساب',
  send: 'ثبت', save: 'ذخیره تغییرات', sending: 'در حال ثبت…', saved: 'با موفقیت ثبت شد.',
  buyer: 'خریدار', official: 'پاسخ فروشگاه', stars: 'امتیاز شما', noRating: 'بدون امتیاز',
  buyerOnly: 'امتیازدهی پس از پرداخت تأییدشده و تحویل این کالا فعال می‌شود؛ بدون خرید هم می‌توانید دیدگاه بنویسید.',
  hidden: 'دیدگاه شما توسط مدیر از نمایش عمومی خارج شده است؛ ویرایش باعث انتشار مجدد نمی‌شود.',
  empty: 'هنوز محتوایی ثبت نشده است؛ اولین نفر باشید.', loading: 'در حال دریافت…',
  error: 'دریافت اطلاعات ناموفق بود.', retry: 'تلاش مجدد', prev: 'قبلی', next: 'بعدی',
  reply: 'نمایش پاسخ‌ها و ثبت پاسخ', close: 'بستن پاسخ‌ها', required: 'لطفاً متن را وارد کنید.',
  failed: 'ثبت انجام نشد؛ متن شما حفظ شده است. دوباره تلاش کنید.', unauthorized: 'برای ادامه دوباره وارد حساب شوید.',
  limited: 'در هر دقیقه حداکثر پنج بار می‌توانید محتوا ثبت کنید؛ کمی صبر کنید.', forbidden: 'امتیازدهی فقط برای خریدار واجدشرایط مجاز است.',
  outOf: 'از ۵', ratingCount: 'امتیاز', reviewCount: 'دیدگاه',
};
const en: typeof fa = {
  completeProfile: 'Complete your account details and verify your mobile number before posting.',
  questions: 'Questions & answers', answers: 'Answers', reviews: 'Reviews', review: 'Your review', question: 'Your question', answer: 'Your answer',
  login: 'Sign in to post a review, question or answer.', loginButton: 'Sign in', send: 'Submit', save: 'Save changes', sending: 'Submitting…', saved: 'Saved successfully.',
  buyer: 'Verified buyer', official: 'Store response', stars: 'Your rating', noRating: 'No rating',
  buyerOnly: 'Rating is available after verified payment and delivery. You may still write a review without purchasing.',
  hidden: 'Your review is hidden by a moderator. Editing does not republish it.', empty: 'Nothing posted yet. Be the first.', loading: 'Loading…',
  error: 'Unable to load content.', retry: 'Retry', prev: 'Previous', next: 'Next', reply: 'View answers and reply', close: 'Close answers', required: 'Please enter some text.',
  failed: 'Unable to save. Your text has been preserved. Please retry.', unauthorized: 'Please sign in again.', limited: 'You may post five times per minute. Please wait.', forbidden: 'Only eligible buyers can rate.',
  outOf: 'out of 5', ratingCount: 'ratings', reviewCount: 'reviews',
};
/** Centralized discussion strings shared by forms, badges, feedback and pagination. */
export function discussionCopy(locale: 'fa' | 'en') { return locale === 'fa' ? fa : en; }
