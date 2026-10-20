/** Shared editable fields; an omitted object preserves previously saved metadata. */
export interface SeoInput {
  title?: string | null; description?: string | null; focusKeyphrase?: string | null; relatedKeyphrases?: string | null;
  canonicalUrl?: string | null; index: boolean; follow: boolean; socialTitle?: string | null; socialDescription?: string | null; socialImageUrl?: string | null;
}
export interface SeoDto { fields: SeoInput; score: number | null; analysisVersion: string | null }
export interface SeoDraft { kind: 'product' | 'category'; id?: string; name: string; slug: string; content?: string; seo: SeoInput; images?: Array<{url: string; alt?: string | null}> }
export interface SeoAnalysis { score: number; version: string; effectiveTitle: string; effectiveDescription: string;
  checks: Array<{code: string; message: string; points: number; maximum: number; state: string}>;
  readability: {words: number; sentences: number; longSentences: number; longParagraphs: number}; technicalWarnings: string[] }
export interface SeoSuggestion { title?: string | null; description?: string | null; content?: string | null; advice: string[] }
export interface SiteSeoSettings { siteName: string; siteUrl: string; titleTemplate: string; isIndexingEnabled: boolean; defaultDescription?: string | null; logoUrl?: string | null; socialProfiles?: string | null }
export interface SeoRedirect { id?: string; sourcePath: string; targetPath: string; statusCode: number; isActive: boolean }
export const emptySeo: SeoInput = { index: true, follow: true };
