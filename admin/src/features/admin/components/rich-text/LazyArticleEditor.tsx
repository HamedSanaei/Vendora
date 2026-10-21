import { lazy, type ComponentProps } from 'react';
import { AdminErrorBoundary } from '../AdminErrorBoundary';

const ArticleEditor = lazy(() => import('./AdminRichTextEditor'));

/** Keeps a failed editor chunk local so product/category form state is not destroyed by the page boundary. */
export function LazyArticleEditor(props: ComponentProps<typeof ArticleEditor>) {
  return <AdminErrorBoundary inline><ArticleEditor {...props} /></AdminErrorBoundary>;
}
