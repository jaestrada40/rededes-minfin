import { apiGet, apiPatch, apiPost, apiDelete } from './client';
import { BackendWordPressPortal } from './feeds';

export function listPortals(): Promise<BackendWordPressPortal[]> {
  return apiGet<BackendWordPressPortal[]>('/portals');
}

export interface CreatePortalInput {
  name: string;
  domain: string;
  category: string;
  description: string;
  webhookEnabled?: boolean;
}

export function createPortal(input: CreatePortalInput): Promise<BackendWordPressPortal> {
  return apiPost<BackendWordPressPortal>('/portals', input);
}

export function updatePortal(id: string, input: Partial<CreatePortalInput>): Promise<BackendWordPressPortal> {
  return apiPatch<BackendWordPressPortal>(`/portals/${id}`, input);
}

export function deletePortal(id: string): Promise<void> {
  return apiDelete<void>(`/portals/${id}`);
}

export function assignFeedToPortals(feedId: string, portalIds: string[]): Promise<void> {
  return apiPatch<void>(`/feeds/${feedId}/portals`, { portalIds });
}

export function assignFeedToAllPortals(feedId: string): Promise<void> {
  return apiPost<void>(`/feeds/${feedId}/portals/assign-all`);
}

export function syncAllPortals(): Promise<void> {
  return apiPost<void>('/portals/sync-all');
}

export function testPortalConnection(portalId: string): Promise<boolean> {
  return apiPost<boolean>(`/portals/${portalId}/test-connection`);
}
