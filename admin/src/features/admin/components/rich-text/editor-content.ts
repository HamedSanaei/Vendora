import Image from '@tiptap/extension-image';

export const articleLimit = 200_000;
const ownedImage = /^\/uploads\/products\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp)$/i;

/** Preserves legacy plain text (including literal angle brackets) when opening it in the HTML editor. */
export function editorContent(value: string): string {
  if (/<[a-zA-Z!/][^>]*>/.test(value)) return value;
  return value.split(/\r?\n/).map((line) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    return paragraph.outerHTML;
  }).join('');
}

/** Only owned raster images may be embedded; serialization keeps portable API-relative paths. */
export const ArticleImage = Image.extend({
  parseHTML() {
    return [{ tag: 'img[src]', getAttrs: (element) => ownedImage.test(element.getAttribute('src') ?? '') ? null : false }];
  },
  addNodeView() {
    return ({ node }) => {
      const image = document.createElement('img');
      const src = String(node.attrs.src ?? '');
      if (ownedImage.test(src)) image.src = new URL(src, new URL(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5020').origin).href;
      image.alt = String(node.attrs.alt ?? '');
      image.loading = 'lazy';
      image.draggable = true;
      return { dom: image };
    };
  },
});

/** Rejects executable, protocol-relative, and malformed link targets before they enter the document. */
export function isArticleLink(value: string): boolean {
  try { return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol); }
  catch { return false; }
}
