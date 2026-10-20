import { resolveApiImageUrl } from '@/lib/http';
import './product-article.css';

interface ProductArticleProps {
  /** HTML from the sanitized full-product endpoint only; never a user-entered or query-string value. */
  content: string;
}

/** Displays server-sanitized product articles and legacy plain text without cropping embedded images. */
export function ProductArticle({ content }: ProductArticleProps) {
  if (!/<(?:p|h[2-4]|ul|ol|li|strong|b|em|i|u|s|a|img|blockquote|span|hr|br)\b[^>]*>/i.test(content))
    return <p className="vd-product-article whitespace-pre-wrap">{content}</p>;

  // Article storage keeps local image URLs portable across the separate API and storefront origins.
  const html = content.replace(/src="(\/uploads\/products\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp))"/gi,
    (_match, path: string) => `src="${resolveApiImageUrl(path)}"`);
  return <div className="vd-product-article" dangerouslySetInnerHTML={{ __html: html }} />;
}
