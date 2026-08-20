export type SocialNetworkType = 'x' | 'facebook' | 'instagram' | 'youtube' | 'linkedin' | 'tiktok';

export type FeedStatus = 'active' | 'draft' | 'paused';

export type UserRole = 'admin' | 'editor' | 'auditor' | 'viewer';

export interface SocialAccount {
  network: SocialNetworkType;
  handle: string;
  url: string;
  verified: boolean;
  name: string;
  description: string;
  avatarUrl: string;
}

export interface SocialPost {
  id: string; // Internal UUID
  network: SocialNetworkType;
  postId: string; // The specific social platform ID (e.g. 1892837461928472910)
  url: string; // Full original URL
  authorHandle: string;
  authorName: string;
  publishedAt: string;
  content: string;
  mediaType: 'text' | 'image' | 'video' | 'album' | 'carousel';
  mediaUrl?: string;
  mediaThumb?: string;
  videoDuration?: string;
  stats?: {
    views?: number;
    likes?: number;
    reposts?: number;
    comments?: number;
    shares?: number;
  };
  isValidated: boolean;
  order: number;
  addedAt: string;
  addedBy: string;
}

export interface Feed {
  id: string;
  slug: string; // e.g. "x-comunicados"
  name: string; // e.g. "X – Comunicados Oficiales"
  description: string;
  network: SocialNetworkType | 'mixed';
  status: FeedStatus;
  postIds: string[]; // List of post IDs in order
  assignedPortalIds: string[]; // List of WordPress portal IDs
  layoutDefault: 'grid' | 'list' | 'carousel' | 'single';
  maxItemsDefault: number;
  showMetrics: boolean;
  showMedia: boolean;
  autoRefreshMinutes: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface WordPressPortal {
  id: string;
  name: string; // e.g. "Portal Principal MINFIN"
  domain: string; // e.g. "minfin.gob.gt"
  category: 'Institucional' | 'Transparencia' | 'Finanzas' | 'Sistemas' | 'Direcciones';
  connectionStatus: 'connected' | 'syncing' | 'warning' | 'error';
  ipAddress: string;
  wpVersion: string;
  pluginVersion: string;
  lastSyncAt: string;
  tokenValid: boolean;
  webhookEnabled: boolean;
  description: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  action: string;
  module: 'Feeds' | 'Publicaciones' | 'Portales' | 'Seguridad' | 'Configuración' | 'MFA';
  feedAffected?: string;
  portalAffected?: string;
  ipAddress: string;
  result: 'Exitoso' | 'Advertencia' | 'Fallido';
  details?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar?: string;
  mfaEnabled: boolean;
  lastLogin: string;
}

export interface SystemSettings {
  institutionName: string;
  shortcodeTag: string; // default: "minfin_social_feed"
  apiCacheDurationSeconds: number;
  webhookSecret: string;
  autoInvalidateCache: boolean;
  allowedCorsDomains: string[];
  officialAccounts: Record<SocialNetworkType, SocialAccount>;
  contactSupportEmail: string;
  maintenanceMode: boolean;
}
