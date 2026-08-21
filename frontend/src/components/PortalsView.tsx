import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { WordPressIcon, SocialIcon } from './OfficialLogos';
import { Pagination } from './Pagination';
import {
  Globe,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Sliders,
  ExternalLink,
  Radio,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Code,
  Zap,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { WordPressPortal } from '../types';

interface PortalsViewProps {
  onOpenBatchAssignModal: (feedId?: string) => void;
}

const PORTAL_CATEGORIES = ['Institucional', 'Transparencia', 'Finanzas', 'Sistemas', 'Direcciones'];

export const PortalsView: React.FC<PortalsViewProps> = ({ onOpenBatchAssignModal }) => {
  const {
    portals,
    feeds,
    settings,
    syncAllPortals,
    testPortalConnection,
    assignFeedToPortals,
    createPortal,
    updatePortal,
    deletePortal,
    requestConfirm,
    showNotification,
    user
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedPortalIds, setSelectedPortalIds] = useState<string[]>([]);
  const [testingPortalId, setTestingPortalId] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [showAssignDropdownForPortal, setShowAssignDropdownForPortal] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPortalId, setEditingPortalId] = useState<string | null>(null);
  const [deletingPortalId, setDeletingPortalId] = useState<string | null>(null);
  const EMPTY_PORTAL_FORM = {
    name: '',
    domain: '',
    category: 'Institucional',
    description: '',
    webhookEnabled: true
  };
  const [newPortal, setNewPortal] = useState(EMPTY_PORTAL_FORM);

  const openCreatePortal = () => {
    setEditingPortalId(null);
    setNewPortal(EMPTY_PORTAL_FORM);
    setIsCreateOpen(true);
  };

  const openEditPortal = (portal: WordPressPortal) => {
    setEditingPortalId(portal.id);
    setNewPortal({
      name: portal.name,
      domain: portal.domain,
      category: portal.category,
      description: portal.description,
      webhookEnabled: portal.webhookEnabled
    });
    setIsCreateOpen(true);
  };

  const canEdit = user.role === 'admin';

  const formatSyncDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-GT', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const handleSubmitPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortal.name.trim() || !newPortal.domain.trim()) return;
    if (editingPortalId) {
      await updatePortal(editingPortalId, newPortal);
    } else {
      await createPortal(newPortal);
    }
    setNewPortal(EMPTY_PORTAL_FORM);
    setEditingPortalId(null);
    setIsCreateOpen(false);
  };

  const handleDeletePortal = async (portalId: string) => {
    setDeletingPortalId(portalId);
    await deletePortal(portalId);
    setDeletingPortalId(null);
  };

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredPortals = portals.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const paginatedPortals = filteredPortals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleTestConnection = async (portalId: string) => {
    setTestingPortalId(portalId);
    await testPortalConnection(portalId);
    setTestingPortalId(null);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedPortalIds(filteredPortals.map(p => p.id));
    } else {
      setSelectedPortalIds([]);
    }
  };

  const handleToggleSelectPortal = (id: string) => {
    setSelectedPortalIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleCopyShortcode = (slug: string) => {
    const code = `[${settings.shortcodeTag} feed="${slug}"]`;
    navigator.clipboard.writeText(code);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const toggleFeedInPortal = (portalId: string, feedId: string) => {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;

    const newPortalIds = feed.assignedPortalIds.includes(portalId)
      ? feed.assignedPortalIds.filter(id => id !== portalId)
      : [...feed.assignedPortalIds, portalId];

    assignFeedToPortals(feedId, newPortalIds).catch((err) => {
      showNotification(err instanceof Error ? err.message : 'No se pudo actualizar la asignación.', 'error');
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 flex items-center gap-1.5">
              <WordPressIcon size={14} />
              <span>Red Institucional de Portales WordPress</span>
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {portals.length} {portals.length === 1 ? 'Dominio Gubernamental' : 'Dominios Gubernamentales'}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#003876] mt-1">
            Distribución Centralizada y Sincronización en Portales
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Asigne feeds a uno, varios o a todos los portales del Ministerio. Cualquier cambio en las publicaciones se propaga automáticamente sin intervenir los sitios web individuales.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {canEdit && (
            <button
              onClick={openCreatePortal}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Portal</span>
            </button>
          )}
          <button
            onClick={() => onOpenBatchAssignModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#003876] hover:bg-[#002d5e] active:bg-[#002247] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Asignación Masiva a Portales</span>
          </button>
        </div>
      </div>

      {/* Create/Edit Portal Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#003876] text-white p-4 sm:p-5 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold">
                {editingPortalId ? 'Editar Portal WordPress' : 'Registrar Nuevo Portal WordPress'}
              </h3>
              <button
                onClick={() => { setIsCreateOpen(false); setEditingPortalId(null); }}
                className="p-1 text-blue-200 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitPortal} className="p-4 sm:p-6 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre del Portal *</label>
                <input
                  required
                  value={newPortal.name}
                  onChange={(e) => setNewPortal({ ...newPortal, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
                  placeholder="Ej: Portal de Recursos Humanos"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Dominio *</label>
                <input
                  required
                  value={newPortal.domain}
                  onChange={(e) => setNewPortal({ ...newPortal, domain: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876] font-mono"
                  placeholder="ejemplo.minfin.gob.gt"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Categoría</label>
                <select
                  value={newPortal.category}
                  onChange={(e) => setNewPortal({ ...newPortal, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876] cursor-pointer"
                >
                  {PORTAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={newPortal.description}
                  onChange={(e) => setNewPortal({ ...newPortal, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876] resize-none"
                  rows={2}
                  placeholder="Breve descripción institucional del portal"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPortal.webhookEnabled}
                  onChange={(e) => setNewPortal({ ...newPortal, webhookEnabled: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="font-bold text-slate-700">Webhook habilitado</span>
              </label>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setEditingPortalId(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow cursor-pointer"
                >
                  {editingPortalId ? 'Guardar Cambios' : 'Registrar Portal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shortcode Documentation & Usage Guide Box */}
      <div className="bg-[#002754] border border-white/10 rounded-xl p-4 sm:p-5 text-white shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#001c3d] border border-white/10 text-emerald-300">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Integración de Shortcode en WordPress
              </h3>
              <p className="text-xs text-blue-100">
                Inserte el shortcode en cualquier página, entrada o bloque Gutenberg de los portales autorizados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-200">Ejemplo común:</span>
            <code className="text-xs font-mono bg-[#001c3d] text-emerald-300 px-3 py-1.5 rounded-lg border border-blue-900/60 select-all font-bold">
              [{settings.shortcodeTag} feed="{feeds[0]?.slug || 'slug-del-feed'}"]
            </code>
          </div>
        </div>

        {/* Available Feeds Shortcodes quick grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          {feeds.map((feed) => {
            const shortcode = `[${settings.shortcodeTag} feed="${feed.slug}"]`;
            const isCopied = copiedSlug === feed.slug;

            return (
              <div 
                key={feed.id} 
                className="bg-[#001c3d] border border-white/10 p-2.5 rounded-lg flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SocialIcon network={feed.network} size={14} />
                  <span className="font-semibold text-slate-200 truncate">{feed.name}</span>
                </div>
                <button
                  onClick={() => handleCopyShortcode(feed.slug)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-blue-100 rounded border border-white/10 text-[11px] font-mono flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Buscar portal por nombre o dominio..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003876] focus:bg-white"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-700 focus:outline-none focus:border-[#003876] cursor-pointer"
          >
            <option value="all">Todas las Categorías</option>
            <option value="Institucional">Institucional</option>
            <option value="Transparencia">Transparencia</option>
            <option value="Finanzas">Finanzas</option>
            <option value="Sistemas">Sistemas</option>
            <option value="Direcciones">Direcciones Técnicas</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>Mostrando <strong>{filteredPortals.length}</strong> de {portals.length} portales</span>
        </div>
      </div>

      {/* Portals Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#003876] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-bold">Portal WordPress</th>
                <th className="py-3 px-4 font-bold">Dominio Institucional</th>
                <th className="py-3 px-4 font-bold">Estado Conexión</th>
                <th className="py-3 px-4 font-bold">Feeds Asignados</th>
                <th className="py-3 px-4 font-bold">Última Sincronización</th>
                <th className="py-3 px-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedPortals.map((portal) => {
                const assignedFeeds = feeds.filter(f => f.assignedPortalIds.includes(portal.id));
                const isTesting = testingPortalId === portal.id;

                return (
                  <tr key={portal.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name & Category */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <WordPressIcon size={14} className="text-[#21759b]" />
                        <span>{portal.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Categoría: <span className="font-semibold text-slate-700">{portal.category}</span>
                      </div>
                      {portal.description && (
                        <div className="text-[10px] text-slate-400 mt-0.5 max-w-xs truncate" title={portal.description}>
                          {portal.description}
                        </div>
                      )}
                    </td>

                    {/* Domain */}
                    <td className="py-3.5 px-4">
                      <a
                        href={`https://${portal.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-700 hover:underline flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <span>{portal.domain}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    </td>

                    {/* Connection Status */}
                    <td className="py-3.5 px-4">
                      {portal.connectionStatus === 'connected' ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          <span>Conectado</span>
                        </div>
                      ) : portal.connectionStatus === 'syncing' ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                          <span>Sincronizando</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-800 border border-red-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                          <span>Sin conexión</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {portal.tokenValid ? 'Dominio verificado' : 'No se pudo verificar el dominio'}
                      </div>
                    </td>

                    {/* Assigned Feeds */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1 max-w-xs">
                        {assignedFeeds.length === 0 ? (
                          <span className="text-slate-400 text-[11px] italic">Sin feeds asignados</span>
                        ) : (
                          assignedFeeds.map(f => (
                            <span
                              key={f.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200"
                              title={f.name}
                            >
                              <SocialIcon network={f.network} size={10} />
                              <span className="truncate max-w-[80px]">{f.slug}</span>
                            </span>
                          ))
                        )}
                      </div>

                      {canEdit && (
                        <button
                          onClick={() => setShowAssignDropdownForPortal(portal.id)}
                          className="mt-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          + Modificar feeds
                        </button>
                      )}
                    </td>

                    {/* Last Sync */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      <div>{formatSyncDate(portal.lastSyncAt)}</div>
                      <div className={`text-[10px] ${portal.webhookEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {portal.webhookEnabled ? 'Webhook activo' : 'Webhook deshabilitado'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleTestConnection(portal.id)}
                          disabled={isTesting}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                          title="Probar token y conexión REST API"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin text-blue-600' : ''}`} />
                          <span>{isTesting ? 'Probando...' : 'Probar Ping'}</span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => openEditPortal(portal)}
                            className="p-1.5 text-slate-600 hover:text-[#003876] hover:bg-blue-50 rounded border border-slate-200 cursor-pointer"
                            title="Editar portal"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={async () => {
                              const ok = await requestConfirm(
                                `¿Eliminar el portal "${portal.name}"? Esta acción no se puede deshacer.`,
                                { title: 'Eliminar portal', confirmLabel: 'Eliminar', danger: true }
                              );
                              if (ok) handleDeletePortal(portal.id);
                            }}
                            disabled={deletingPortalId === portal.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                            title="Eliminar portal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredPortals.length} onPageChange={setPage} />
      </div>

      {/* Assign Feeds Modal */}
      {showAssignDropdownForPortal && (() => {
        const portal = portals.find(p => p.id === showAssignDropdownForPortal);
        if (!portal) return null;
        const assignedCount = feeds.filter(f => f.assignedPortalIds.includes(portal.id)).length;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
              <div className="bg-[#003876] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm sm:text-base font-bold">Feeds en "{portal.name}"</h3>
                  <p className="text-xs text-blue-100">{assignedCount} de {feeds.length} feeds asignados a este portal</p>
                </div>
                <button
                  onClick={() => setShowAssignDropdownForPortal(null)}
                  className="p-1 text-blue-200 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 sm:p-5 space-y-1.5 overflow-y-auto">
                {feeds.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No hay feeds creados todavía.</p>
                ) : (
                  feeds.map(feed => {
                    const isAssigned = feed.assignedPortalIds.includes(portal.id);
                    return (
                      <label
                        key={feed.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => toggleFeedInPortal(portal.id, feed.id)}
                          className="rounded text-blue-600"
                        />
                        <SocialIcon network={feed.network} size={14} />
                        <span className="text-xs text-slate-700 truncate flex-1">{feed.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{feed.slug}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end shrink-0">
                <button
                  onClick={() => setShowAssignDropdownForPortal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
