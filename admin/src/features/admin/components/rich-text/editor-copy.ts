import type { AdminLocale } from '../../i18n';

/** Localized labels shared by the article toolbar, image dialog, and validation states. */
export function getEditorCopy(locale: AdminLocale) {
  return locale === 'fa' ? {
    label: 'توضیحات محصول', help: 'مقالهٔ محصول را با عنوان، تصویر، لینک و فهرست بنویسید. تصاویر این بخش مستقل از گالری محصول هستند.',
    paragraph: 'متن عادی', heading: 'عنوان', font: 'فونت', size: 'اندازه متن', color: 'رنگ متن',
    bold: 'بولد', italic: 'ایتالیک', underline: 'زیرخط', strike: 'خط‌خورده', bullet: 'فهرست گلوله‌ای', ordered: 'فهرست شماره‌دار',
    quote: 'نقل‌قول', right: 'راست‌چین', center: 'وسط‌چین', left: 'چپ‌چین', justify: 'تراز دوطرفه',
    undo: 'بازگردانی', redo: 'انجام مجدد', clear: 'حذف قالب‌بندی', link: 'افزودن / ویرایش لینک', unlink: 'حذف لینک',
    image: 'افزودن تصویر', imageEdit: 'ویرایش متن تصویر', imageRemove: 'حذف تصویر انتخاب‌شده',
    imageHelp: 'تصویر JPG، PNG یا WebP تا ۵ مگابایت. برای دسترس‌پذیری، تصویر را کوتاه توصیف کنید.',
    alt: 'توضیح تصویر (متن جایگزین)', file: 'انتخاب تصویر', insert: 'آپلود و درج تصویر', apply: 'اعمال', cancel: 'انصراف',
    uploading: 'در حال آپلود تصویر…', uploadError: 'آپلود تصویر ناموفق بود. اتصال را بررسی کنید و دوباره تلاش کنید.',
    invalidImage: 'فقط تصویر JPG، PNG یا WebP تا ۵ مگابایت مجاز است.', requiredAlt: 'توضیح کوتاهی برای تصویر بنویسید.',
    url: 'نشانی لینک', invalidUrl: 'نشانی معتبر با https://، http:// یا mailto: وارد کنید.',
    characters: 'کاراکتر', limit: 'حجم مقاله از سقف ۲۰۰٬۰۰۰ کاراکتر قالب‌بندی‌شده بیشتر است؛ بخشی از محتوا را کوتاه کنید.',
    savedWithProduct: 'برای ذخیرهٔ مقاله، دکمهٔ «ذخیره» محصول را بزنید.',
  } : {
    label: 'Product description', help: 'Write a product article with headings, images, links, and lists. Article images are independent of the product gallery.',
    paragraph: 'Paragraph', heading: 'Heading', font: 'Font', size: 'Text size', color: 'Text color',
    bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough', bullet: 'Bullet list', ordered: 'Numbered list',
    quote: 'Blockquote', right: 'Align right', center: 'Align center', left: 'Align left', justify: 'Justify',
    undo: 'Undo', redo: 'Redo', clear: 'Clear formatting', link: 'Add / edit link', unlink: 'Remove link',
    image: 'Add image', imageEdit: 'Edit image description', imageRemove: 'Remove selected image',
    imageHelp: 'JPG, PNG, or WebP up to 5MB. Describe the image briefly for accessibility.',
    alt: 'Image description (alternative text)', file: 'Choose image', insert: 'Upload and insert', apply: 'Apply', cancel: 'Cancel',
    uploading: 'Uploading image…', uploadError: 'Image upload failed. Check your connection and try again.',
    invalidImage: 'Only JPG, PNG, or WebP images up to 5MB are allowed.', requiredAlt: 'Enter a short image description.',
    url: 'Link URL', invalidUrl: 'Enter a valid https://, http://, or mailto: URL.',
    characters: 'characters', limit: 'The article exceeds 200,000 formatted characters. Shorten part of the content.',
    savedWithProduct: 'Use the product Save button to save this article.',
  };
}
