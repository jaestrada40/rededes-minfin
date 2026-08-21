import React from 'react';
import { useApp } from '../context/AppContext';
import { SocialIcon, WordPressIcon } from './OfficialLogos';
import { 
  Rss, 
  Layers, 
  Globe, 
  Share2, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Copy, 
  Check,
  Zap,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

interface DashboardViewProps {
  onOpenCreateModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenCreateModal }) => {
  const { 
    feeds, 
    posts, 
    portals, 
    auditLogs, 
    settings, 
    openFeedDetail, 
    openFeedPreview, 
    setActiveTab 
  } = useApp();

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const activeFeeds = feeds.filter(f => f.status === 'active');
  const connectedPortals = portals.filter(p => p.connectionStatus === 'connected');
  const configuredNetworks = Object.keys(settings.officialAccounts).length;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Welcome & Institutional Hero Banner */}
      <div className="bg-gradient-to-r from-[#003876] via-[#002d5e] to-[#001f42] rounded-xl p-5 sm:p-6 text-white shadow-sm border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0072ce] text-white uppercase tracking-wider">
              Sistema Centralizado DTI
            </span>
            <span className="text-xs text-blue-200">
              Red Oficial del Gobierno de Guatemala
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            Administración y Distribución de Feeds Institucionales
          </h2>
          <p className="text-xs text-blue-100 max-w-2xl leading-relaxed">
            Centralice las publicaciones oficiales de redes sociales (X, Facebook, Instagram, YouTube, LinkedIn) y distribúyalas de forma instantánea a los portales web WordPress del MINFIN mediante shortcodes sin alterar la configuración de cada portal.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenCreateModal}
            id="btn-dashboard-create-feed"
            className="flex items-center gap-2 bg-[#0072ce] hover:bg-[#005fb0] active:bg-[#004f93] text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Feed</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Feeds Activos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Feeds Activos
            </div>
            <div className="text-2xl font-bold text-[#003876] mt-1">
              {activeFeeds.length}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              <span>100% operativos</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#003876]">
            <Rss className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Publicaciones Registradas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Publicaciones
            </div>
            <div className="text-2xl font-bold text-[#003876] mt-1">
              {posts.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              <span>Distribuidas en los feeds</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Portales WordPress */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Portales Conectados
            </div>
            <div className="text-2xl font-bold text-[#003876] mt-1">
              {connectedPortals.length} / 25
            </div>
            <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sincronización Webhook OK</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-[#003876]">
            <WordPressIcon size={22} />
          </div>
        </div>

        {/* Card 4: Redes Oficiales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Redes Configuradas
            </div>
            <div className="text-2xl font-bold text-[#003876] mt-1">
              {configuredNetworks}
            </div>
            <div className="text-[11px] text-[#0072ce] font-medium flex items-center gap-1 mt-0.5">
              <span>Cuentas oficiales MINFIN</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Share2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Section: Feeds Overview + WordPress Portals Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Feeds Catalog */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-[#003876] uppercase tracking-tight">
                Feeds Centralizados Activos
              </h3>
              <p className="text-xs text-slate-500">
                Administre publicaciones y su distribución automática hacia los portales
              </p>
            </div>
            <button
              onClick={() => setActiveTab('feeds')}
              className="text-xs font-semibold text-[#0072ce] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos ({feeds.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {feeds.slice(0, 5).map((feed) => {
              const shortcode = `[${settings.shortcodeTag} feed="${feed.slug}"]`;
              const isCopied = copiedId === feed.id;

              return (
                <div key={feed.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 shrink-0 mt-0.5">
                      <SocialIcon network={feed.network} size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {feed.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                          {feed.postIds.length} posts
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {feed.description}
                      </p>

                      {/* Shortcode snippet */}
                      <div className="mt-2 flex items-center gap-2">
                        <code className="text-[11px] font-mono bg-[#002754] text-emerald-300 px-2 py-0.5 rounded border border-blue-900/60">
                          {shortcode}
                        </code>
                        <button
                          onClick={() => handleCopy(shortcode, feed.id)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                          title="Copiar Shortcode"
                        >
                          {isCopied ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Copiado
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <Copy className="w-3 h-3" /> Copiar
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => openFeedPreview(feed.id)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                      title="Ver vista previa en WordPress"
                    >
                      Previsualizar
                    </button>
                    <button
                      onClick={() => openFeedDetail(feed.id)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#003876] hover:bg-[#002d5e] rounded-lg cursor-pointer transition-colors"
                    >
                      Gestionar Posts
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: WordPress Portals Status & Quick Activity */}
        <div className="space-y-6">
          {/* WordPress Sync Box */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2 font-bold text-xs uppercase text-[#003876]">
                <WordPressIcon size={16} />
                <span>Red de Portales MINFIN</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                {connectedPortals.length}/{portals.length} Online
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Todos los portales institucionales reciben actualizaciones automáticas en cuanto se agregan o quitan publicaciones.
            </p>

            <div className="space-y-2 text-xs">
              {portals.slice(0, 4).map((p) => (
                <div key={p.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                    <div className="text-[11px] text-blue-600 font-mono truncate">{p.domain}</div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {p.lastSyncAt}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveTab('portals')}
              className="w-full mt-3 text-center py-2 text-xs font-bold text-[#0072ce] hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 cursor-pointer"
            >
              Ver Portales y Asignaciones →
            </button>
          </div>

          {/* Quick Audit / Recent Changes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2 font-bold text-xs uppercase text-[#003876]">
                <Clock className="w-4 h-4 text-slate-600" />
                <span>Actividad Reciente (Auditoría)</span>
              </div>
              <button
                onClick={() => setActiveTab('audit')}
                className="text-[11px] text-blue-600 hover:underline cursor-pointer"
              >
                Ver Bitácora
              </button>
            </div>

            <div className="space-y-2.5">
              {auditLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="text-xs border-l-2 border-blue-500 pl-2.5 py-0.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {log.timestamp.split(' ')[1]}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 line-clamp-1">
                    {log.details || log.feedAffected || log.portalAffected}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Por: {log.userEmail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
