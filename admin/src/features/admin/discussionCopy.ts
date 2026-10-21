const fa = {
  title:'دیدگاه‌ها و پرسش‌ها', description:'مدیریت محتوای محصولات، کنترل نمایش و پاسخ رسمی فروشگاه.',
  kind:'نوع محتوا', review:'دیدگاه', question:'سؤال', answer:'پاسخ', product:'محصول', allProducts:'همه محصولات',
  visibility:'نمایش', all:'همه', visible:'نمایان', hidden:'مخفی', hide:'مخفی کردن', restore:'بازگردانی',
  reply:'پاسخ رسمی', send:'ثبت پاسخ', buyer:'خریدار', official:'پاسخ فروشگاه', empty:'محتوایی پیدا نشد.',
  loading:'در حال دریافت…', error:'عملیات انجام نشد؛ دوباره تلاش کنید.', limited:'حداکثر پنج ثبت محتوا در دقیقه مجاز است.',
  saved:'ذخیره شد.', retry:'تلاش مجدد', prev:'قبلی', next:'بعدی', working:'در حال ذخیره…', parent:'شناسه سؤال',
};
const en: typeof fa = {
  title:'Reviews & questions',description:'Moderate product content and publish official store answers.',kind:'Content type',review:'Review',question:'Question',answer:'Answer',product:'Product',allProducts:'All products',
  visibility:'Visibility',all:'All',visible:'Visible',hidden:'Hidden',hide:'Hide',restore:'Restore',reply:'Official answer',send:'Submit answer',buyer:'Verified buyer',official:'Store response',empty:'No content found.',
  loading:'Loading…',error:'Unable to complete the action. Please retry.',limited:'You may post five times per minute.',saved:'Saved.',retry:'Retry',prev:'Previous',next:'Next',working:'Saving…',parent:'Question ID',
};
/** Centralized moderation copy for both route directions. */
export function discussionAdminCopy(locale: 'fa' | 'en') { return locale === 'fa' ? fa : en; }
