import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Feed, 
  SocialPost, 
  WordPressPortal, 
  AuditLogEntry, 
  SystemSettings, 
  UserProfile, 
  UserRole,
  SocialNetworkType 
} from '../types';
import { 
  INITIAL_USER, 
  INITIAL_FEEDS, 
  INITIAL_POSTS, 
  INITIAL_PORTALS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_SETTINGS 
} from '../data/initialData';

export type ActiveTab = 'dashboard' | 'feeds' | 'feed-detail' | 'portals' | 'preview' | 'audit' | 'settings';

interface AppContextType {
  // Auth state
  isAuthenticated: boolean;
  isMfaVerified: boolean;
  user: UserProfile;
  login: (email: string, pass: string) => boolean;
  verifyMfa: (code: string) => boolean;
  logout: () => void;
  switchRole: (newRole: UserRole) => void;

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

  // Feed Actions
  createFeed: (feedData: Partial<Feed>) => Feed;
  updateFeed: (id: string, feedData: Partial<Feed>) => void;
  deleteFeed: (id: string) => void;
  duplicateFeed: (id: string) => void;

  // Post Actions
  addPost: (feedId: string, postInput: { urlOrId: string; network: SocialNetworkType; customContent?: string }) => { success: boolean; message: string; post?: SocialPost };
  removePostFromFeed: (feedId: string, postId: string) => void;
  reorderPostsInFeed: (feedId: string, startIndex: number, endIndex: number) => void;
  updatePostContent: (postId: string, newContent: string) => void;

  // Portal Actions
  assignFeedToPortals: (feedId: string, portalIds: string[]) => void;
  batchAssignFeedToAllPortals: (feedId: string) => void;
  syncAllPortals: () => Promise<void>;
  testPortalConnection: (portalId: string) => Promise<boolean>;

  // Settings
  updateSettings: (newSettings: Partial<SystemSettings>) => void;

  // Audit
  logAudit: (action: string, module: AuditLogEntry['module'], details?: string, feedAffected?: string, portalAffected?: string, result?: 'Exitoso' | 'Advertencia' | 'Fallido') => void;

  // Toast / System Notification
  notification: { message: string; type: 'success' | 'info' | 'warning' | 'error' } | null;
  showNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isMfaVerified, setIsMfaVerified] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>('feed-01');

  const [feeds, setFeeds] = useState<Feed[]>(() => {
    const saved = localStorage.getItem('minfin_feeds_data');
    return saved ? JSON.parse(saved) : INITIAL_FEEDS;
  });

  const [posts, setPosts] = useState<SocialPost[]>(() => {
    const saved = localStorage.getItem('minfin_posts_data');
    return saved ? JSON.parse(saved) : INITIAL_POSTS;
  });

  const [portals, setPortals] = useState<WordPressPortal[]>(() => {
    const saved = localStorage.getItem('minfin_portals_data');
    return saved ? JSON.parse(saved) : INITIAL_PORTALS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem('minfin_audit_data');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('minfin_settings_data');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('minfin_feeds_data', JSON.stringify(feeds));
  }, [feeds]);

  useEffect(() => {
    localStorage.setItem('minfin_posts_data', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem('minfin_portals_data', JSON.stringify(portals));
  }, [portals]);

  useEffect(() => {
    localStorage.setItem('minfin_audit_data', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('minfin_settings_data', JSON.stringify(settings));
  }, [settings]);

  const showNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const logAudit = (
    action: string, 
    module: AuditLogEntry['module'], 
    details?: string, 
    feedAffected?: string, 
    portalAffected?: string, 
    result: 'Exitoso' | 'Advertencia' | 'Fallido' = 'Exitoso'
  ) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const newEntry: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      timestamp: formattedDate,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action,
      module,
      feedAffected,
      portalAffected,
      ipAddress: '190.85.120.104',
      result,
      details
    };

    setAuditLogs(prev => [newEntry, ...prev]);
  };

  const login = (email: string) => {
    if (!email.includes('@')) return false;
    setIsAuthenticated(true);
    setIsMfaVerified(false);
    return true;
  };

  const verifyMfa = (code: string) => {
    if (code.length === 6) {
      setIsMfaVerified(true);
      logAudit('Inicio de sesión MFA exitoso', 'MFA', 'Código de 6 dígitos validado en sistema DTI-MINFIN');
      showNotification('Autenticación institucional de dos factores completada.', 'success');
      return true;
    }
    return false;
  };

  const logout = () => {
    logAudit('Cierre de sesión de usuario', 'Seguridad', 'Sesión cerrada por el usuario');
    setIsAuthenticated(false);
    setIsMfaVerified(false);
    showNotification('Sesión institucional cerrada.', 'info');
  };

  const switchRole = (newRole: UserRole) => {
    const roleNames: Record<UserRole, string> = {
      admin: 'Administrador DTI',
      editor: 'Gestor de Contenido',
      auditor: 'Auditor de Control Interno',
      viewer: 'Consulta'
    };
    setUser(prev => ({ ...prev, role: newRole }));
    logAudit(`Cambio de rol de sesión a ${newRole.toUpperCase()}`, 'Seguridad', `Rol activo cambiado a: ${roleNames[newRole]}`);
    showNotification(`Rol cambiado a ${roleNames[newRole]}`, 'info');
  };

  const openFeedDetail = (feedId: string) => {
    setSelectedFeedId(feedId);
    setActiveTab('feed-detail');
  };

  const openFeedPreview = (feedId: string) => {
    setSelectedFeedId(feedId);
    setActiveTab('preview');
  };

  // Helper to extract social post ID from URL
  const extractPostIdAndDetails = (input: string, network: SocialNetworkType) => {
    const trimmed = input.trim();
    let postId = trimmed;
    let url = trimmed;

    if (network === 'x') {
      const match = trimmed.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i);
      if (match) {
        postId = match[2];
        url = `https://x.com/${match[1]}/status/${postId}`;
      } else if (/^\d+$/.test(trimmed)) {
        postId = trimmed;
        url = `https://x.com/MinfinGT/status/${trimmed}`;
      }
    } else if (network === 'instagram') {
      const match = trimmed.match(/(?:instagram\.com)\/(?:p|reel)\/([A-Za-z0-9_-]+)/i);
      if (match) {
        postId = match[1];
        url = `https://www.instagram.com/p/${postId}/`;
      }
    } else if (network === 'youtube') {
      const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
      if (match) {
        postId = match[1];
        url = `https://www.youtube.com/watch?v=${postId}`;
      }
    } else if (network === 'facebook') {
      const match = trimmed.match(/facebook\.com\/(?:.+)\/(?:posts|videos|reel)\/([A-Za-z0-9_-]+)/i) || trimmed.match(/pfbid([A-Za-z0-9]+)/);
      if (match) {
        postId = match[1] || match[0];
      }
    } else if (network === 'linkedin') {
      const match = trimmed.match(/activity:(\d+)/) || trimmed.match(/urn:li:activity:(\d+)/) || trimmed.match(/\/posts\/([A-Za-z0-9_-]+)/);
      if (match) {
        postId = match[1];
      }
    }

    return { postId, url };
  };

  const createFeed = (feedData: Partial<Feed>): Feed => {
    const slug = feedData.slug || (feedData.name ? feedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `feed-${Date.now()}`);
    const newFeed: Feed = {
      id: `feed-${Date.now()}`,
      slug,
      name: feedData.name || 'Nuevo Feed Institucional',
      description: feedData.description || 'Feed centralizado para distribución en portales WordPress',
      network: feedData.network || 'x',
      status: feedData.status || 'active',
      postIds: feedData.postIds || [],
      assignedPortalIds: feedData.assignedPortalIds || ['wp-01', 'wp-02'],
      layoutDefault: feedData.layoutDefault || 'grid',
      maxItemsDefault: feedData.maxItemsDefault || 6,
      showMetrics: feedData.showMetrics !== undefined ? feedData.showMetrics : true,
      showMedia: feedData.showMedia !== undefined ? feedData.showMedia : true,
      autoRefreshMinutes: feedData.autoRefreshMinutes || 5,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      updatedBy: user.email
    };

    setFeeds(prev => [newFeed, ...prev]);
    logAudit('Creó nuevo feed institucional', 'Feeds', `Slug: ${slug} (${newFeed.name})`, newFeed.name, `${newFeed.assignedPortalIds.length} portales asignados`);
    showNotification(`Feed "${newFeed.name}" creado con éxito. Shortcode: [${settings.shortcodeTag} feed="${slug}"]`, 'success');
    return newFeed;
  };

  const updateFeed = (id: string, feedData: Partial<Feed>) => {
    setFeeds(prev => prev.map(f => {
      if (f.id === id) {
        const updated = {
          ...f,
          ...feedData,
          updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          updatedBy: user.email
        };
        logAudit('Actualizó configuración de feed', 'Feeds', `Feed: ${updated.name}`, updated.name, `${updated.assignedPortalIds.length} portales`);
        return updated;
      }
      return f;
    }));
    showNotification('Configuración de feed guardada y sincronizada.', 'success');
  };

  const deleteFeed = (id: string) => {
    const feed = feeds.find(f => f.id === id);
    if (!feed) return;

    setFeeds(prev => prev.filter(f => f.id !== id));
    logAudit('Eliminó feed institucional', 'Feeds', `Se eliminó el feed: ${feed.name} (${feed.slug})`, feed.name, `${feed.assignedPortalIds.length} portales desvinculados`, 'Advertencia');
    showNotification(`Feed "${feed.name}" eliminado del sistema.`, 'warning');
  };

  const duplicateFeed = (id: string) => {
    const target = feeds.find(f => f.id === id);
    if (!target) return;

    const copySlug = `${target.slug}-copia-${Math.floor(Math.random() * 1000)}`;
    const copy: Feed = {
      ...target,
      id: `feed-${Date.now()}`,
      slug: copySlug,
      name: `${target.name} (Copia)`,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      updatedBy: user.email
    };

    setFeeds(prev => [copy, ...prev]);
    logAudit('Duplicó feed existente', 'Feeds', `Copia generada: ${copySlug}`, copy.name);
    showNotification(`Feed duplicado: "${copy.name}".`, 'info');
  };

  const addPost = (feedId: string, postInput: { urlOrId: string; network: SocialNetworkType; customContent?: string }) => {
    const targetFeed = feeds.find(f => f.id === feedId);
    if (!targetFeed) {
      return { success: false, message: 'Feed no encontrado.' };
    }

    const { postId, url } = extractPostIdAndDetails(postInput.urlOrId, postInput.network);

    if (!postId) {
      return { success: false, message: 'No se pudo identificar un ID o URL válida.' };
    }

    // Check if post already exists in memory or generate new
    let existingPost = posts.find(p => p.postId === postId && p.network === postInput.network);
    let postToLink: SocialPost;

    if (existingPost) {
      postToLink = existingPost;
    } else {
      const networkAccounts = settings.officialAccounts[postInput.network];
      const newPostId = `post-${postInput.network}-${Date.now()}`;
      
      const sampleContents: Record<SocialNetworkType, string> = {
        x: postInput.customContent || `🇬🇹 #MINFINInforma | Publicación oficial de @MinfinGT sobre finanzas públicas, ejecución presupuestaria y modernización del Estado.`,
        facebook: postInput.customContent || `Reunión de coordinación técnica en el Ministerio de Finanzas Públicas con autoridades para el fortalecimiento institucional.`,
        instagram: postInput.customContent || `Boletín visual oficial del Ministerio de Finanzas Públicas de Guatemala. Conoce más en minfin.gob.gt #Transparencia`,
        youtube: postInput.customContent || `Transmisión oficial del MINFIN: Capacitaciones en sistemas de gestión financiera pública.`,
        linkedin: postInput.customContent || `El Ministerio de Finanzas Públicas comparte oportunidades de desarrollo profesional y novedades del sector hacendario.`,
        tiktok: postInput.customContent || `Cápsula educativa MINFIN sobre cómo se distribuye el presupuesto de la nación.`
      };

      const sampleImages: Record<SocialNetworkType, string> = {
        x: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80',
        facebook: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1000&q=80',
        instagram: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1000&q=80',
        youtube: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80',
        linkedin: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1000&q=80',
        tiktok: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1000&q=80'
      };

      postToLink = {
        id: newPostId,
        network: postInput.network,
        postId: postId,
        url: url,
        authorHandle: networkAccounts?.handle || '@MinfinGT',
        authorName: networkAccounts?.name || 'Ministerio de Finanzas Públicas',
        publishedAt: 'Hoy · Reciente',
        content: sampleContents[postInput.network],
        mediaType: postInput.network === 'youtube' ? 'video' : 'image',
        mediaUrl: postInput.network !== 'youtube' ? sampleImages[postInput.network] : undefined,
        mediaThumb: postInput.network === 'youtube' ? sampleImages.youtube : undefined,
        videoDuration: postInput.network === 'youtube' ? '18:30' : undefined,
        stats: {
          views: 4500,
          likes: 280,
          reposts: 45,
          comments: 12
        },
        isValidated: true,
        order: targetFeed.postIds.length + 1,
        addedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        addedBy: user.email
      };

      setPosts(prev => [postToLink, ...prev]);
    }

    // Add to feed if not already in postIds
    if (!targetFeed.postIds.includes(postToLink.id)) {
      const updatedPostIds = [postToLink.id, ...targetFeed.postIds];
      setFeeds(prev => prev.map(f => {
        if (f.id === feedId) {
          return {
            ...f,
            postIds: updatedPostIds,
            updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
            updatedBy: user.email
          };
        }
        return f;
      }));

      logAudit(
        'Agregó publicación a feed',
        'Publicaciones',
        `ID: ${postId} de ${postInput.network.toUpperCase()} incorporado exitosamente`,
        targetFeed.name,
        `${targetFeed.assignedPortalIds.length} portales WordPress actualizados automáticamente`
      );

      showNotification(`Publicación ${postId} agregada al feed. Los ${targetFeed.assignedPortalIds.length} portales asignados se actualizaron en tiempo real.`, 'success');
      return { success: true, message: 'Publicación agregada con éxito.', post: postToLink };
    } else {
      return { success: false, message: 'La publicación ya se encuentra registrada en este feed.' };
    }
  };

  const removePostFromFeed = (feedId: string, postId: string) => {
    const feed = feeds.find(f => f.id === feedId);
    const post = posts.find(p => p.id === postId);
    if (!feed) return;

    setFeeds(prev => prev.map(f => {
      if (f.id === feedId) {
        return {
          ...f,
          postIds: f.postIds.filter(id => id !== postId),
          updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          updatedBy: user.email
        };
      }
      return f;
    }));

    logAudit(
      'Eliminó publicación del feed',
      'Publicaciones',
      `Publicación ID: ${post?.postId || postId} removida`,
      feed.name,
      `${feed.assignedPortalIds.length} portales sincronizados`
    );

    showNotification('Publicación eliminada del feed central y desvinculada de los portales.', 'info');
  };

  const reorderPostsInFeed = (feedId: string, startIndex: number, endIndex: number) => {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;

    const newIds = Array.from(feed.postIds);
    const [removed] = newIds.splice(startIndex, 1);
    newIds.splice(endIndex, 0, removed);

    setFeeds(prev => prev.map(f => {
      if (f.id === feedId) {
        return {
          ...f,
          postIds: newIds,
          updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          updatedBy: user.email
        };
      }
      return f;
    }));

    logAudit('Reordenó publicaciones', 'Feeds', `Nueva secuencia de orden establecida en feed: ${feed.name}`, feed.name);
    showNotification('Nuevo orden de publicaciones guardado.', 'success');
  };

  const updatePostContent = (postId: string, newContent: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, content: newContent };
      }
      return p;
    }));
    logAudit('Editó contenido de publicación', 'Publicaciones', `Publicación ID: ${postId} modificada`);
    showNotification('Contenido de publicación actualizado.', 'success');
  };

  const assignFeedToPortals = (feedId: string, portalIds: string[]) => {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;

    setFeeds(prev => prev.map(f => {
      if (f.id === feedId) {
        return {
          ...f,
          assignedPortalIds: portalIds,
          updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          updatedBy: user.email
        };
      }
      return f;
    }));

    logAudit(
      'Asignó feed a portales WordPress',
      'Portales',
      `Se actualizaron los portales asignados (${portalIds.length} portales)`,
      feed.name,
      `${portalIds.length} portales`
    );

    showNotification(`Asignación guardada: Feed vinculado a ${portalIds.length} portales WordPress.`, 'success');
  };

  const batchAssignFeedToAllPortals = (feedId: string) => {
    const allPortalIds = portals.map(p => p.id);
    assignFeedToPortals(feedId, allPortalIds);
  };

  const syncAllPortals = async () => {
    setPortals(prev => prev.map(p => ({ ...p, connectionStatus: 'syncing' })));
    
    // Simulate webhook triggers to all 25 WordPress portals
    await new Promise(resolve => setTimeout(resolve, 800));

    setPortals(prev => prev.map(p => ({
      ...p,
      connectionStatus: 'connected',
      lastSyncAt: 'Justo ahora',
      tokenValid: true
    })));

    logAudit(
      'Sincronización global ejecutada',
      'Portales',
      'Webhook de invalidación de caché enviado a los 25 portales institucionales (HTTP 200 OK)',
      undefined,
      '25/25 Portales en línea'
    );

    showNotification('Sincronización global completada. Los 25 portales WordPress respondieron con éxito.', 'success');
  };

  const testPortalConnection = async (portalId: string): Promise<boolean> => {
    const portal = portals.find(p => p.id === portalId);
    if (!portal) return false;

    setPortals(prev => prev.map(p => p.id === portalId ? { ...p, connectionStatus: 'syncing' } : p));
    await new Promise(resolve => setTimeout(resolve, 600));

    setPortals(prev => prev.map(p => p.id === portalId ? { ...p, connectionStatus: 'connected', lastSyncAt: 'Justo ahora' } : p));

    logAudit(
      'Prueba de conexión con portal',
      'Portales',
      `Test de ping y token REST API en dominio: ${portal.domain}`,
      undefined,
      portal.name
    );

    showNotification(`Conexión exitosa con ${portal.name} (${portal.domain}). Plugin v2.4.1 activo.`, 'success');
    return true;
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    logAudit('Actualizó configuración del sistema', 'Configuración', 'Parámetros institucionales modificados');
    showNotification('Configuración institucional guardada.', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        isMfaVerified,
        user,
        login,
        verifyMfa,
        logout,
        switchRole,
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
        createFeed,
        updateFeed,
        deleteFeed,
        duplicateFeed,
        addPost,
        removePostFromFeed,
        reorderPostsInFeed,
        updatePostContent,
        assignFeedToPortals,
        batchAssignFeedToAllPortals,
        syncAllPortals,
        testPortalConnection,
        updateSettings,
        logAudit,
        notification,
        showNotification
      }}
    >
      {children}
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
