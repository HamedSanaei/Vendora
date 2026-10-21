import { httpClient } from '../../../lib/api/httpClient';

export interface AdminDiscussion {
  id: string; productId: string; productTitle: string; kind: 'review' | 'question' | 'answer'; questionId: string | null;
  authorName: string; content: string; rating: number | null; isBuyer: boolean; isOfficial: boolean; isHidden: boolean; createdAtUtc: string;
}
export interface AdminDiscussionPage { items: AdminDiscussion[]; total: number; pageNumber: number; pageSize: number }
/** Loads a filtered moderation page through the shared authenticated client. */
export async function getDiscussions(params: {kind: string; productId?: string; hidden?: string; page: number}, signal: AbortSignal): Promise<AdminDiscussionPage> {
  return (await httpClient.get<AdminDiscussionPage>('/api/admin/discussions', {params, signal})).data;
}
/** Changes visibility only, never the user's text or authorship. */
export async function moderateDiscussion(entry: AdminDiscussion): Promise<void> {
  await httpClient.patch(`/api/admin/discussions/${entry.kind}/${entry.id}/visibility`, {hidden: !entry.isHidden});
}
/** The server derives official status from the administrator's role. */
export async function answerDiscussion(entry: AdminDiscussion, content: string): Promise<void> {
  await httpClient.post(`/api/products/${entry.productId}/discussion/questions/${entry.id}/answers`, {content});
}
