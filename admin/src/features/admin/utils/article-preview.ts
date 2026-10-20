/** Resolves only sanitized, locally owned article images for a read-only AI preview on the separate admin origin. */
export function articlePreviewHtml(html: string): string {
  const origin = new URL(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5020').origin;
  return html.replace(/src="(\/uploads\/products\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp))"/gi,
    (_match, path: string) => `src="${new URL(path,origin).href}"`);
}
