import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Feed,
  SocialPost,
  WordPressPortal,
  AuditLogEntry,
  SystemSettings,
  UserProfile,
  SocialNetworkType
} from '../types';
import * as authApi from '../api/auth';
import * as feedsApi from '../api/feeds';
import * as portalsApi from '../api/portals';
import * as settingsApi from '../api/settings';
import * as auditApi from '../api/audit';
import * as usersApi from '../api/users';
import { ApiError, onSessionExpire } from '../api/client';
import { BackendFeedDetail, BackendSocialPost, BackendWordPressPortal } from '../api/feeds';

export type ActiveTab = 'dashboard' | 'feeds' | 'feed-detail' | 'portals' | 'preview' | 'users' | 'audit' | 'settings';

interface AppContextType {
  // Auth state
  isAuthenticated: boolean;
  isMfaVerified: boolean;
  authLoading: boolean;
  authError: string | null;
  user: UserProfile;
  login: (email: string, password: string) => Promise<{ requiresMfaSetup?: boolean; requiresMfaCode?: boolean } | null>;
  mfaSetupBegin: () => Promise<{ qrDataUrl: string } | null>;
  mfaSetupComplete: (code: string) => Promise<boolean>;
  mfaVerifyCode: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Navigation
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedFeedId: string | null;
  setSelectedFeedId: (id: string | null) => void;
  openFeedDetail: (feedId: string) => void;
  openFeedPreview: (feedId: string) => void;

  // Data
  feeds: Feed[];
  posts: SocialPost[];
  portals: WordPressPortal[];
  auditLogs: AuditLogEntry[];
  settings: SystemSettings;
  users: UserProfile[];

  // User Actions (admin only)
  createUser: (input: usersApi.CreateUserInput) => Promise<void>;
  updateUser: (userId: string, input: usersApi.UpdateUserInput) => Promise<void>;
  updateUserRole: (userId: string, role: string) => Promise<void>;
  setUserActive: (userId: string, isActive: boolean) => Promise<void>;
  resetUserMfa: (userId: string) => Promise<void>;
  changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<void>;

  // Feed Actions
  createFeed: (feedData: Partial<Feed>) => Promise<void>;
  updateFeed: (id: string, feedData: Partial<Feed>) => Promise<void>;
  deleteFeed: (id: string) => Promise<void>;
  duplicateFeed: (id: string) => Promise<void>;

  // Post Actions
  addPost: (feedId: string, postInput: { urlOrId: string; network: SocialNetworkType; customContent?: string; customMediaUrl?: string; customAuthorName?: string }) => Promise<{ success: boolean; message: string }>;
  removePostFromFeed: (feedId: string, postId: string) => Promise<void>;
  deletePostPermanently: (postId: string) => Promise<void>;
  reorderPostsInFeed: (feedId: string, startIndex: number, endIndex: number) => Promise<void>;
  updatePostContent: (postId: string, newContent: string) => Promise<void>;

  // Portal Actions
  assignFeedToPortals: (feedId: string, portalIds: string[]) => Promise<void>;
  batchAssignFeedToAllPortals: (feedId: string) => Promise<void>;
  syncAllPortals: () => Promise<void>;
  testPortalConnection: (portalId: string) => Promise<boolean>;
  createPortal: (input: portalsApi.CreatePortalInput) => Promise<void>;
  deletePortal: (portalId: string) => Promise<void>;

  // Settings
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;

  // Toast / System Notification
  notification: { message: string; type: 'success' | 'info' | 'warning' | 'error' } | null;
  showNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

  // Confirmation dialog (replaces window.confirm)
  requestConfirm: (message: string, options?: { title?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const EMPTY_USER: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'viewer',
  department: '',
  mfaEnabled: false,
  isActive: true,
  lastLogin: ''
};

function toFeed(bf: BackendFeedDetail): Feed {
  return {
    id: bf.id,
    slug: bf.slug,
    name: bf.name,
    description: bf.description,
    network: bf.network as SocialNetworkType | 'mixed',
    status: bf.status as Feed['status'],
    postIds: bf.posts.map(p => p.post.id),
    assignedPortalIds: bf.portals.map(p => p.portal.id),
    layoutDefault: bf.layoutDefault as Feed['layoutDefault'],
    maxItemsDefault: bf.maxItemsDefault,
    showMetrics: bf.showMetrics,
    showMedia: bf.showMedia,
    autoRefreshMinutes: bf.autoRefreshMinutes,
    createdAt: bf.createdAt,
    updatedAt: bf.updatedAt,
    updatedBy: bf.updatedBy
  };
}

function toPost(bp: BackendSocialPost, order: number): SocialPost {
  return {
    id: bp.id,
    network: bp.network as SocialNetworkType,
    postId: bp.postId,
    url: bp.url,
    authorHandle: bp.authorHandle,
    authorName: bp.authorName,
    publishedAt: bp.publishedAt,
    content: bp.content,
    mediaType: bp.mediaType as SocialPost['mediaType'],
    mediaUrl: bp.mediaUrl,
    mediaThumb: bp.mediaThumb,
    videoDuration: bp.videoDuration,
    stats: bp.stats,
    isValidated: bp.isValidated,
    order,
    addedAt: bp.addedAt,
    addedBy: bp.addedBy
  };
}

function collectPosts(backendFeeds: BackendFeedDetail[]): SocialPost[] {
  const map = new Map<string, SocialPost>();
  backendFeeds.forEach(bf => {
    bf.posts.forEach(fp => {
      if (!map.has(fp.post.id)) {
        map.set(fp.post.id, toPost(fp.post, fp.order));
      }
    });
  });
  return Array.from(map.values());
}

function toPortal(bp: BackendWordPressPortal): WordPressPortal {
  return {
    id: bp.id,
    name: bp.name,
    domain: bp.domain,
    category: bp.category as WordPressPortal['category'],
    connectionStatus: bp.connectionStatus as WordPressPortal['connectionStatus'],
    ipAddress: bp.ipAddress,
    wpVersion: bp.wpVersion,
    pluginVersion: bp.pluginVersion,
    lastSyncAt: bp.lastSyncAt,
    tokenValid: bp.tokenValid,
    webhookEnabled: bp.webhookEnabled,
    description: bp.description
  };
}

function toSettings(bs: settingsApi.BackendSystemSettings): SystemSettings {
  return {
    logoUrl: bs.logoUrl,
    apiKeys: bs.apiKeys,
    institutionName: bs.institutionName,
    shortcodeTag: bs.shortcodeTag,
    apiCacheDurationSeconds: bs.apiCacheDurationSeconds,
    webhookSecret: bs.webhookSecret ?? '',
    autoInvalidateCache: bs.autoInvalidateCache,
    allowedCorsDomains: bs.allowedCorsDomains,
    officialAccounts: bs.officialAccounts,
    contactSupportEmail: bs.contactSupportEmail,
    maintenanceMode: bs.maintenanceMode,
    mfaRequired: bs.mfaRequired
  };
}

function toAuditEntry(ba: auditApi.BackendAuditLog): AuditLogEntry {
  return {
    id: ba.id,
    timestamp: ba.timestamp,
    userEmail: ba.userEmail,
    userName: ba.userEmail.split('@')[0],
    userRole: ba.userRole as AuditLogEntry['userRole'],
    action: ba.action,
    module: ba.module as AuditLogEntry['module'],
    feedAffected: ba.entity === 'Feed' ? ba.entityId : undefined,
    portalAffected: ba.entity === 'WordPressPortal' ? ba.entityId : undefined,
    ipAddress: ba.ipAddress || '',
    result: ba.result as AuditLogEntry['result'],
    details: ba.details ? JSON.stringify(ba.details) : undefined
  };
}

const AUDIT_ROLES = ['admin', 'auditor'];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isMfaVerified, setIsMfaVerified] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const [pendingSetupToken, setPendingSetupToken] = useState<string | null>(null);
  const [pendingVerifyToken, setPendingVerifyToken] = useState<string | null>(null);
  const [pendingChallengeToken, setPendingChallengeToken] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);

  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [portals, setPortals] = useState<WordPressPortal[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    institutionName: '',
    shortcodeTag: '',
    apiCacheDurationSeconds: 0,
    webhookSecret: '',
    autoInvalidateCache: false,
    allowedCorsDomains: [],
    officialAccounts: {} as SystemSettings['officialAccounts'],
    contactSupportEmail: '',
    maintenanceMode: false,
    mfaRequired: true
  });

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  }, []);

  const [confirmState, setConfirmState] = useState<{ message: string; title?: string; confirmLabel?: string; danger?: boolean } | null>(null);
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);

  const requestConfirm = useCallback(
    (message: string, options?: { title?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> => {
      return new Promise((resolve) => {
        confirmResolveRef.current = resolve;
        setConfirmState({ message, ...options });
      });
    },
    []
  );

  const resolveConfirm = (result: boolean) => {
    confirmResolveRef.current?.(result);
    confirmResolveRef.current = null;
    setConfirmState(null);
  };

  const loadFeeds = useCallback(async () => {
    const backendFeeds = await feedsApi.listFeeds();
    setFeeds(backendFeeds.map(toFeed));
    setPosts(collectPosts(backendFeeds));
  }, []);

  const loadPortals = useCallback(async () => {
    const backendPortals = await portalsApi.listPortals();
    setPortals(backendPortals.map(toPortal));
  }, []);

  const loadSettings = useCallback(async () => {
    const backendSettings = await settingsApi.getSettings();
    setSettings(toSettings(backendSettings));
  }, []);

  const loadAuditLogs = useCallback(async (role: string) => {
    if (!AUDIT_ROLES.includes(role)) {
      setAuditLogs([]);
      return;
    }
    const backendLogs = await auditApi.listAuditLogs();
    setAuditLogs(backendLogs.map(toAuditEntry));
  }, []);

  const claimsRef = useRef<authApi.JwtClaims | null>(null);

  const loadUsers = useCallback(async () => {
    const allUsers = await usersApi.listUsers();
    setUsers(allUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as UserProfile['role'],
      department: u.department || '',
      mfaEnabled: u.mfaEnabled,
      isActive: u.isActive,
      lastLogin: u.lastLoginAt || ''
    })));

    const claims = claimsRef.current;
    if (claims) {
      const match = allUsers.find(u => u.id === claims.sub);
      setUser({
        id: claims.sub,
        name: match?.name || claims.email,
        email: claims.email,
        role: claims.role as UserProfile['role'],
        department: match?.department || '',
        mfaEnabled: match?.mfaEnabled ?? true,
        isActive: match?.isActive ?? true,
        lastLogin: match?.lastLoginAt || ''
      });
    }
  }, []);

  const onAuthenticated = useCallback(async (tokens: authApi.TokenPair) => {
    authApi.applyTokens(tokens);
    const claims = authApi.decodeAccessToken(tokens.accessToken);
    claimsRef.current = claims;
    setIsAuthenticated(true);
    setIsMfaVerified(true);
    setAuthError(null);
    await loadUsers();
    await Promise.all([loadFeeds(), loadPortals(), loadSettings(), loadAuditLogs(claims.role)]);
  }, [loadUsers, loadFeeds, loadPortals, loadSettings, loadAuditLogs]);

  useEffect(() => {
    onSessionExpire(() => {
      setIsAuthenticated(false);
      setIsMfaVerified(false);
      setUser(EMPTY_USER);
      showNotification('Sesión expirada. Inicie sesión nuevamente.', 'warning');
    });

    (async () => {
      try {
        const branding = await settingsApi.getPublicBranding();
        setSettings(prev => ({ ...prev, logoUrl: branding.logoUrl ?? undefined, institutionName: branding.institutionName }));
      } catch {
        // Non-fatal: login screen falls back to the default emblem.
      }

      const tokens = await authApi.restoreSession();
      if (tokens) {
        await onAuthenticated(tokens);
      }
      setAuthLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const result = await authApi.login(email, password);
      if (result.setupToken) setPendingSetupToken(result.setupToken);
      if (result.challengeToken) setPendingChallengeToken(result.challengeToken);
      return { requiresMfaSetup: result.requiresMfaSetup, requiresMfaCode: result.requiresMfaCode };
    } catch (e) {
      setAuthError(e instanceof ApiError ? e.message : 'No se pudo iniciar sesión.');
      return null;
    }
  };

  const mfaSetupBegin = async () => {
    if (!pendingSetupToken) return null;
    try {
      const result = await authApi.mfaSetup(pendingSetupToken);
      setPendingVerifyToken(result.verifyToken);
      return { qrDataUrl: result.qrDataUrl };
    } catch (e) {
      setAuthError(e instanceof ApiError ? e.message : 'No se pudo generar el código MFA.');
      return null;
    }
  };

  const mfaSetupComplete = async (code: string) => {
    if (!pendingVerifyToken) return false;
    try {
      const tokens = await authApi.mfaSetupVerify(pendingVerifyToken, code);
      setPendingSetupToken(null);
      setPendingVerifyToken(null);
      await onAuthenticated(tokens);
      showNotification('Autenticación institucional de dos factores completada.', 'success');
      return true;
    } catch (e) {
      setAuthError(e instanceof ApiError ? e.message : 'Código MFA inválido.');
      return false;
    }
  };

  const mfaVerifyCode = async (code: string) => {
    if (!pendingChallengeToken) return false;
    try {
      const tokens = await authApi.mfaVerify(pendingChallengeToken, code);
      setPendingChallengeToken(null);
      await onAuthenticated(tokens);
      showNotification('Autenticación institucional de dos factores completada.', 'success');
      return true;
    } catch (e) {
      setAuthError(e instanceof ApiError ? e.message : 'Código MFA inválido.');
      return false;
    }
  };

  const logout = async () => {
    await authApi.logout();
    setIsAuthenticated(false);
    setIsMfaVerified(false);
    setUser(EMPTY_USER);
    setFeeds([]);
    setPosts([]);
    setPortals([]);
    setAuditLogs([]);
    setUsers([]);
    claimsRef.current = null;
    showNotification('Sesión institucional cerrada.', 'info');
  };

  const openFeedDetail = (feedId: string) => {
    setSelectedFeedId(feedId);
    setActiveTab('feed-detail');
  };

  const openFeedPreview = (feedId: string) => {
    setSelectedFeedId(feedId);
    setActiveTab('preview');
  };

  const createFeed = async (feedData: Partial<Feed>) => {
    const { assignedPortalIds, ...rest } = feedData;
    const created = await feedsApi.createFeed({
      slug: rest.slug,
      name: rest.name || 'Nuevo Feed Institucional',
      description: rest.description || 'Feed centralizado para distribución en portales WordPress',
      network: rest.network || 'x',
      status: rest.status,
      layoutDefault: rest.layoutDefault,
      maxItemsDefault: rest.maxItemsDefault,
      showMetrics: rest.showMetrics,
      showMedia: rest.showMedia,
      autoRefreshMinutes: rest.autoRefreshMinutes
    });
    if (assignedPortalIds && assignedPortalIds.length > 0) {
      await portalsApi.assignFeedToPortals(created.id, assignedPortalIds);
    }
    await loadFeeds();
    showNotification(`Feed "${created.name}" creado con éxito. Shortcode: [${settings.shortcodeTag} feed="${created.slug}"]`, 'success');
  };

  const updateFeed = async (id: string, feedData: Partial<Feed>) => {
    const { assignedPortalIds, postIds, ...rest } = feedData;
    await feedsApi.updateFeed(id, rest);
    if (assignedPortalIds) {
      await portalsApi.assignFeedToPortals(id, assignedPortalIds);
    }
    await loadFeeds();
    showNotification('Configuración de feed guardada y sincronizada.', 'success');
  };

  const deleteFeed = async (id: string) => {
    const feed = feeds.find(f => f.id === id);
    await feedsApi.deleteFeed(id);
    await loadFeeds();
    showNotification(`Feed "${feed?.name || ''}" eliminado del sistema.`, 'warning');
  };

  const duplicateFeed = async (id: string) => {
    const copy = await feedsApi.duplicateFeed(id);
    await loadFeeds();
    showNotification(`Feed duplicado: "${copy.name}".`, 'info');
  };

  const addPost = async (feedId: string, postInput: { urlOrId: string; network: SocialNetworkType; customContent?: string; customMediaUrl?: string; customAuthorName?: string }) => {
    const result = await feedsApi.addPostToFeed(feedId, postInput);
    if (result.success) {
      await loadFeeds();
      const feed = feeds.find(f => f.id === feedId);
      showNotification(`Publicación agregada al feed${feed ? ` "${feed.name}"` : ''}.`, 'success');
    }
    return { success: result.success, message: result.message };
  };

  const removePostFromFeed = async (feedId: string, postId: string) => {
    await feedsApi.removePostFromFeed(feedId, postId);
    await loadFeeds();
    showNotification('Publicación eliminada del feed central y desvinculada de los portales.', 'info');
  };

  const deletePostPermanently = async (postId: string) => {
    await feedsApi.deletePostPermanently(postId);
    await loadFeeds();
    showNotification('Publicación eliminada permanentemente de la base de datos.', 'warning');
  };

  const reorderPostsInFeed = async (feedId: string, startIndex: number, endIndex: number) => {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;
    const newIds: string[] = Array.from(feed.postIds);
    const [removed] = newIds.splice(startIndex, 1);
    newIds.splice(endIndex, 0, removed);
    await feedsApi.reorderFeedPosts(feedId, newIds);
    await loadFeeds();
    showNotification('Nuevo orden de publicaciones guardado.', 'success');
  };

  const updatePostContent = async (postId: string, newContent: string) => {
    await feedsApi.updatePostContent(postId, newContent);
    await loadFeeds();
    showNotification('Contenido de publicación actualizado.', 'success');
  };

  const assignFeedToPortals = async (feedId: string, portalIds: string[]) => {
    await portalsApi.assignFeedToPortals(feedId, portalIds);
    await loadFeeds();
    showNotification(`Asignación guardada: Feed vinculado a ${portalIds.length} portales WordPress.`, 'success');
  };

  const batchAssignFeedToAllPortals = async (feedId: string) => {
    await portalsApi.assignFeedToAllPortals(feedId);
    await loadFeeds();
    showNotification('Feed asignado a todos los portales institucionales.', 'success');
  };

  const syncAllPortals = async () => {
    await portalsApi.syncAllPortals();
    await loadPortals();
    showNotification(`Sincronización global completada. Los ${portals.length} portales WordPress respondieron con éxito.`, 'success');
  };

  const testPortalConnection = async (portalId: string): Promise<boolean> => {
    const success = await portalsApi.testPortalConnection(portalId);
    await loadPortals();
    const portal = portals.find(p => p.id === portalId);
    if (success) {
      showNotification(`Conexión exitosa con ${portal?.name || 'el portal'} (${portal?.domain || ''}).`, 'success');
    }
    return success;
  };

  const createUser = async (input: usersApi.CreateUserInput) => {
    const created = await usersApi.createUser(input);
    await loadUsers();
    showNotification(`Usuario "${created.name}" creado con éxito.`, 'success');
  };

  const updateUser = async (userId: string, input: usersApi.UpdateUserInput) => {
    await usersApi.updateUser(userId, input);
    await loadUsers();
    showNotification('Datos del usuario actualizados.', 'success');
  };

  const updateUserRole = async (userId: string, role: string) => {
    await usersApi.updateUserRole(userId, role);
    await loadUsers();
    showNotification('Rol de usuario actualizado.', 'success');
  };

  const setUserActive = async (userId: string, isActive: boolean) => {
    await usersApi.setUserActive(userId, isActive);
    await loadUsers();
    showNotification(isActive ? 'Usuario reactivado.' : 'Usuario desactivado.', isActive ? 'success' : 'warning');
  };

  const resetUserMfa = async (userId: string) => {
    await usersApi.resetUserMfa(userId);
    await loadUsers();
    showNotification('MFA restablecido. El usuario deberá configurarlo de nuevo en su próximo inicio de sesión.', 'warning');
  };

  const changeOwnPassword = async (currentPassword: string, newPassword: string) => {
    await usersApi.changeOwnPassword(currentPassword, newPassword);
    showNotification('Contraseña actualizada correctamente.', 'success');
  };

  const createPortal = async (input: portalsApi.CreatePortalInput) => {
    const portal = await portalsApi.createPortal(input);
    await loadPortals();
    showNotification(`Portal "${portal.name}" registrado con éxito.`, 'success');
  };

  const deletePortal = async (portalId: string) => {
    const portal = portals.find(p => p.id === portalId);
    await portalsApi.deletePortal(portalId);
    await Promise.all([loadPortals(), loadFeeds()]);
    showNotification(`Portal "${portal?.name || ''}" eliminado del sistema.`, 'warning');
  };

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    await settingsApi.updateSettings(newSettings);
    await loadSettings();
    showNotification('Configuración institucional guardada.', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        isMfaVerified,
        authLoading,
        authError,
        user,
        login,
        mfaSetupBegin,
        mfaSetupComplete,
        mfaVerifyCode,
        logout,
        activeTab,
        setActiveTab,
        selectedFeedId,
        setSelectedFeedId,
        openFeedDetail,
        openFeedPreview,
        feeds,
        posts,
        portals,
        auditLogs,
        settings,
        users,
        createUser,
        updateUser,
        updateUserRole,
        setUserActive,
        resetUserMfa,
        changeOwnPassword,
        createFeed,
        updateFeed,
        deleteFeed,
        duplicateFeed,
        addPost,
        removePostFromFeed,
        deletePostPermanently,
        reorderPostsInFeed,
        updatePostContent,
        assignFeedToPortals,
        batchAssignFeedToAllPortals,
        syncAllPortals,
        testPortalConnection,
        createPortal,
        deletePortal,
        updateSettings,
        notification,
        showNotification,
        requestConfirm
      }}
    >
      {children}
      {confirmState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              {confirmState.title || 'Confirmar acción'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmState.message}</p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className={`px-4 py-2 text-white rounded-lg font-bold text-xs cursor-pointer ${
                  confirmState.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#003876] hover:bg-[#002d5e]'
                }`}
              >
                {confirmState.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
