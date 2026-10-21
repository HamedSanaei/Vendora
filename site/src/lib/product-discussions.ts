import { http } from './http';

export interface DiscussionEntry {
  id: string; productId: string; productTitle: string; kind: 'review' | 'question' | 'answer'; questionId: string | null;
  authorName: string; content: string; rating: number | null; isBuyer: boolean; isOfficial: boolean; isHidden: boolean; createdAtUtc: string;
}
export interface DiscussionPage { items: DiscussionEntry[]; total: number; pageNumber: number; pageSize: number }
export interface MyReview { canRate: boolean; review: DiscussionEntry | null }
/** Reads only public content; query cancellation prevents stale product/page responses. */
export async function getDiscussion(product: string, kind: string, page: number, questionId?: string, signal?: AbortSignal): Promise<DiscussionPage> {
  return (await http.get<DiscussionPage>(`/products/${product}/discussion`, { params: { kind, page, questionId }, signal })).data;
}
/** Reads the authenticated author's review and server-derived purchase eligibility. */
export async function getMyReview(product: string, token: string, signal?: AbortSignal): Promise<MyReview> {
  return (await http.get<MyReview>(`/products/${product}/discussion/me`, { headers: { Authorization: `Bearer ${token}` }, signal })).data;
}
/** Sends only text/rating; author, buyer and official flags are never client inputs. */
export async function saveDiscussion(product: string, token: string, kind: 'review' | 'question' | 'answer', content: string, rating?: number | null, question?: string): Promise<void> {
  const path = `/products/${product}/discussion/${kind === 'review' ? 'review' : kind === 'question' ? 'questions' : `questions/${question}/answers`}`;
  const config = { headers: { Authorization: `Bearer ${token}` } };
  if (kind === 'review') await http.put(path, { content, rating }, config);
  else await http.post(path, { content }, config);
}
