import { lazy } from 'react';

/** Loads the editor engine only when a product form needs it; the caller supplies Suspense. */
export const LazyArticleEditor = lazy(() => import('./AdminRichTextEditor'));
