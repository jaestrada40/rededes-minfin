import { apiGet, apiPatch } from './client';
import { SocialNetworkType, SocialAccount } from '../types';

export interface BackendSystemSettings {
  id: string;
  logoUrl?: string;
  apiKeys?: Record<string, string>;
  institutionName: string;
  shortcodeTag: string;
  apiCacheDurationSeconds: number;
  webhookSecret?: string;
  autoInvalidateCache: boolean;
  allowedCorsDomains: string[];
  officialAccounts: Record<SocialNetworkType, SocialAccount>;
  contactSupportEmail: string;
  maintenanceMode: boolean;
  mfaRequired: boolean;
}

export function getSettings(): Promise<BackendSystemSettings> {
  return apiGet<BackendSystemSettings>('/settings');
}

export interface PublicBranding {
  logoUrl: string | null;
  institutionName: string;
}

export function getPublicBranding(): Promise<PublicBranding> {
  return apiGet<PublicBranding>('/public/branding');
}

export function updateSettings(input: Partial<BackendSystemSettings>): Promise<BackendSystemSettings> {
  return apiPatch<BackendSystemSettings>('/settings', input);
}
