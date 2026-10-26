import { apiBaseUrl } from '../../../lib/api/httpClient';

/** Resolves only sanitized, locally owned article images for a read-only AI preview on the separate admin origin. */
export function articlePreviewHtml(html: string): string {
  const origin = new URL(apiBaseUrl).origin;
  return html.replace(/src="(\/uploads\/products\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp))"/gi,
    (_match, path: string) => `src="${new URL(path,origin).href}"`);
}
