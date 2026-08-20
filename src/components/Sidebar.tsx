import React from 'react';
import { useApp, ActiveTab } from '../context/AppContext';
import { MinfinLogo, WordPressIcon } from './OfficialLogos';
import { 
  LayoutDashboard, 
  Rss, 
  Layers, 
  Globe, 
  Eye, 
  ShieldAlert, 
  Settings, 
  ExternalLink,
  Copy,
  Check,
  Radio,
  Share2
} from 'lucide-react';

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpenMobile, onCloseMobile }) => {
  const { activeTab, setActiveTab, feeds, portals, settings, selectedFeedId } = useApp();
  const [copiedShortcode, setCopiedShortcode] = React.useState(false);

  const activeFeedsCount = feeds.filter(f => f.status === 'active').length;
  const connectedPortalsCount = portals.filter(p => p.connectionStatus === 'connected').length;

  const currentFeed = feeds.find(f => f.id === selectedFeedId) || feeds[0];
  const sampleShortcode = `[${settings.shortcodeTag} feed="${currentFeed?.slug || 'x-comunicados'}"]`;

  const copyShortcode = () => {
    navigator.clipboard.writeText(sampleShortcode);
    setCopiedShortcode(true);
    setTimeout(() => setCopiedShortcode(false), 2000);
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      id: 'dashboard',
      label: 'Panel Principal',
      icon: <LayoutDashboard className="w-4 h-4" />
    },
    {
      id: 'feeds',
      label: 'Gestión de Feeds',
      icon: <Rss className="w-4 h-4" />,
      badge: activeFeedsCount
    },
    {
      id: 'feed-detail',
      label: 'Registro de Publicaciones',
      icon: <Layers className="w-4 h-4" />
    },
    {
      id: 'portals',
      label: 'Portales WordPress',
      icon: <Globe className="w-4 h-4" />,
      badge: `${connectedPortalsCount}/25`
    },
    {
      id: 'preview',
      label: 'Vista Previa Embebida',
      icon: <Eye className="w-4 h-4" />
    },
    {
      id: 'audit',
      label: 'Auditoría y Trazabilidad',
      icon: <ShieldAlert className="w-4 h-4" />
    },
    {
      id: 'settings',
      label: 'Configuración DTI',
      icon: <Settings className="w-4 h-4" />
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      <aside
        id="minfin-admin-sidebar"
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-[#003876] border-r border-[#002d5e] flex flex-col justify-between text-slate-100 z-50 transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top: Institutional Brand */}
        <div className="flex flex-col border-b border-white/10 bg-[#002754] px-4 py-4.5">
          <div className="flex items-center justify-between">
            <MinfinLogo variant="white" className="h-10" />
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-100">
            <span className="font-semibold tracking-wide uppercase">Gestor de Redes Sociales</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> Sincronizado
            </span>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200/80 px-3 mb-2">
            Módulos Administrativos
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0072ce] text-white shadow-sm font-semibold'
                    : 'text-blue-100 hover:bg-[#002d5e] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-white' : 'text-blue-200'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#002754] text-blue-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Quick WordPress Shortcode Box */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="p-3 bg-[#002754] rounded-lg border border-white/10 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] text-blue-100">
                <div className="flex items-center gap-1.5 font-semibold">
                  <WordPressIcon size={14} className="text-blue-300" />
                  <span>Shortcode Activo</span>
                </div>
                <span className="text-[10px] text-blue-200 font-mono">WordPress</span>
              </div>
              <div className="p-1.5 bg-[#001c3d] rounded border border-blue-900/50 text-[11px] font-mono text-emerald-300 break-all select-all flex items-center justify-between gap-1">
                <span>{sampleShortcode}</span>
                <button
                  onClick={copyShortcode}
                  title="Copiar shortcode"
                  className="p-1 text-blue-200 hover:text-white rounded hover:bg-white/10 cursor-pointer shrink-0"
                >
                  {copiedShortcode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-blue-200/80 leading-tight">
                Péguelo en cualquier entrada, página o widget de los 25 portales.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: Institutional Footer & Portal Link */}
        <div className="p-3 border-t border-white/10 bg-[#002754] text-[11px] text-blue-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-blue-300 text-[10px]">Versión 2.4.1-prod</span>
            <a
              href="https://www.minfin.gob.gt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-300 hover:text-white transition-colors text-[10px]"
            >
              <span>minfin.gob.gt</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="text-[10px] text-blue-300/80 border-t border-white/10 pt-1.5 leading-tight">
            © 2026 Ministerio de Finanzas Públicas
          </div>
        </div>
      </aside>
    </>
  );
};
