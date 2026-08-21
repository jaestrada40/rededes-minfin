import React from 'react';
import { useApp, ActiveTab } from '../context/AppContext';
import {
  LayoutDashboard,
  Rss,
  Layers,
  Globe,
  Eye,
  ShieldAlert,
  Settings,
  Radio,
  Users
} from 'lucide-react';

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const MfLogo: React.FC<{ small?: boolean; logoUrl?: string }> = ({ small = false, logoUrl }) => {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Logo institucional"
        className={`${small ? 'w-10 h-10' : 'w-16 h-16'} object-contain rounded-[10px] shrink-0`}
      />
    );
  }
  return (
    <div
      className={`grid place-items-center shrink-0 ${small ? 'w-10 h-10 text-base' : 'w-16 h-16 text-2xl'} border-2 border-[#c99a43] rounded-[10px] text-white font-extrabold tracking-[-0.07em] bg-[#04183a]/35`}
    >
      MF
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpenMobile, onCloseMobile }) => {
  const { activeTab, setActiveTab, feeds, portals, settings } = useApp();

  const activeFeedsCount = feeds.filter(f => f.status === 'active').length;
  const connectedPortalsCount = portals.filter(p => p.connectionStatus === 'connected').length;

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'feeds', label: 'Gestión de Feeds', icon: <Rss className="w-5 h-5" />, badge: activeFeedsCount },
    { id: 'feed-detail', label: 'Registro de Publicaciones', icon: <Layers className="w-5 h-5" /> },
    { id: 'portals', label: 'Portales WordPress', icon: <Globe className="w-5 h-5" />, badge: `${connectedPortalsCount}/${portals.length}` },
    { id: 'preview', label: 'Vista Previa Embebida', icon: <Eye className="w-5 h-5" /> },
    { id: 'users', label: 'Usuarios y Roles', icon: <Users className="w-5 h-5" /> },
    { id: 'audit', label: 'Auditoría y Trazabilidad', icon: <ShieldAlert className="w-5 h-5" /> },
    { id: 'settings', label: 'Configuración DTI', icon: <Settings className="w-5 h-5" /> }
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
        className={`fixed lg:sticky top-0 left-0 h-screen w-80 flex flex-col text-[#f4f8ff] bg-[#0c2a5a] shadow-[2px_0_16px_rgba(3,18,45,0.12)] z-50 transition-transform duration-200 ease-in-out overflow-y-auto ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <header
          className="relative flex items-center gap-4 min-h-[164px] px-6 py-7 border-b border-[#c7daf8]/20 shrink-0"
          style={{ background: 'linear-gradient(135deg, #103a73, #0c2a5a 65%)' }}
        >
          <div
            className="absolute right-0 top-0 w-[48%] h-full opacity-10 pointer-events-none"
            style={{ background: 'repeating-linear-gradient(135deg, transparent 0 27px, #d9e9ff 28px 29px, transparent 30px 58px)' }}
          />
          <div className="relative z-10 flex items-center gap-4">
            <MfLogo logoUrl={settings.logoUrl} />
            <div>
              <h1 className="m-0 mb-2 text-[1.38rem] font-bold leading-[1.1] tracking-[-0.035em]">
                Gestor de<br />Redes Sociales
              </h1>
              <span className="inline-flex items-center gap-1.5 text-[#7fe2aa] text-[0.76rem] font-bold">
                <Radio className="w-3 h-3 animate-pulse" /> Sincronizado
              </span>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="px-4 pt-7 pb-3 flex-1" aria-label="Módulos administrativos">
          <p className="mx-2.5 mb-3.5 text-[#a8bddc] text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
            Módulos administrativos
          </p>
          <ul className="grid gap-0.5 m-0 p-0 list-none">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    id={`nav-btn-${item.id}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex items-center gap-3.5 w-full min-h-[43px] px-2.5 rounded-lg text-left text-[0.88rem] cursor-pointer transition-colors ${
                      isActive
                        ? 'text-white font-bold bg-[#194881] shadow-[inset_3px_0_0_#c99a43]'
                        : 'text-[#dce8fb] hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="w-5 h-5 shrink-0">{item.icon}</span>
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {item.badge !== undefined && (
                      <b
                        className={`min-w-[26px] px-1.5 py-0.5 rounded-lg text-[0.69rem] font-extrabold text-center not-italic ${
                          isActive ? 'bg-white/15 text-[#e7f0ff]' : 'bg-[#031a42]/40 text-[#e7f0ff]'
                        }`}
                      >
                        {item.badge}
                      </b>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <footer className="grid gap-1.5 mt-auto px-6 py-4 border-t border-[#c7daf8]/20 bg-[#081f45] text-[#a8bddc] text-[0.66rem] leading-relaxed shrink-0">
          <span>Versión 2.4.1-prod</span>
          <span>© 2026 Ministerio de Finanzas Públicas</span>
        </footer>
      </aside>
    </>
  );
};
