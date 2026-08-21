import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import { SocialNetworkType } from '../types';

export interface BackendFeed {
  id: string;
  slug: string;
  name: string;
  description: string;
  network: string;
  status: string;
  layoutDefault: string;
  maxItemsDefault: number;
  showMetrics: boolean;
  showMedia: boolean;
  autoRefreshMinutes: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface BackendSocialPost {
  id: string;
  network: string;
  postId: string;
  url: string;
  authorHandle: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  publishedAt: string;
  content: string;
  mediaType: string;
  mediaUrl?: string;
  mediaThumb?: string;
  videoDuration?: string;
  stats?: Record<string, number>;
  isValidated: boolean;
  addedAt: string;
  addedBy: string;
}

export interface BackendWordPressPortal {
  id: string;
  name: string;
  domain: string;
  category: string;
  connectionStatus: string;
  lastSyncAt: string;
  tokenValid: boolean;
  webhookEnabled: boolean;
  description: string;
}

export interface BackendFeedDetail extends BackendFeed {
  posts: { feedId: string; postId: string; order: number; post: BackendSocialPost }[];
  portals: { feedId: string; portalId: string; portal: BackendWordPressPortal }[];
}

export function listFeeds(): Promise<BackendFeedDetail[]> {
  return apiGet<BackendFeedDetail[]>('/feeds');
}

export function getFeed(id: string): Promise<BackendFeedDetail> {
  return apiGet<BackendFeedDetail>(`/feeds/${id}`);
}

export function createFeed(input: {
  slug?: string;
  name: string;
  description: string;
  network: string;
  status?: string;
  layoutDefault?: string;
  maxItemsDefault?: number;
  showMetrics?: boolean;
  showMedia?: boolean;
  autoRefreshMinutes?: number;
}): Promise<BackendFeed> {
  return apiPost<BackendFeed>('/feeds', input);
}

export function updateFeed(id: string, input: Partial<Parameters<typeof createFeed>[0]>): Promise<BackendFeed> {
  return apiPatch<BackendFeed>(`/feeds/${id}`, input);
}

export function deleteFeed(id: string): Promise<void> {
  return apiDelete<void>(`/feeds/${id}`);
}

export function duplicateFeed(id: string): Promise<BackendFeed> {
  return apiPost<BackendFeed>(`/feeds/${id}/duplicate`);
}

export function addPostToFeed(
  feedId: string,
  input: {
    urlOrId: string;
    network: SocialNetworkType;
    customContent?: string;
    customMediaUrl?: string;
    customAuthorName?: string;
  },
): Promise<{ success: boolean; message: string; post?: BackendSocialPost }> {
  return apiPost(`/feeds/${feedId}/posts`, input);
}

export function removePostFromFeed(feedId: string, postId: string): Promise<void> {
  return apiDelete<void>(`/feeds/${feedId}/posts/${postId}`);
}

export function reorderFeedPosts(feedId: string, orderedPostIds: string[]): Promise<void> {
  return apiPatch<void>(`/feeds/${feedId}/posts/reorder`, { orderedPostIds });
}

export function updatePostContent(postId: string, content: string): Promise<BackendSocialPost> {
  return apiPatch<BackendSocialPost>(`/posts/${postId}`, { content });
}

export function deletePostPermanently(postId: string): Promise<void> {
  return apiDelete<void>(`/posts/${postId}`);
}
