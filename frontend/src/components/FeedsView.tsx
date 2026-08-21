import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SocialIcon, WordPressIcon } from './OfficialLogos';
import { 
  Plus, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  Eye, 
  Layers, 
  Globe, 
  MoreHorizontal, 
  CopyCheck, 
  Trash2, 
  SlidersHorizontal,
  ArrowUpDown,
  ExternalLink
} from 'lucide-react';
import { SocialNetworkType, FeedStatus } from '../types';

interface FeedsViewProps {
  onOpenCreateModal: (editFeedId?: string) => void;
  onOpenAssignModal: (feedId: string) => void;
}

export const FeedsView: React.FC<FeedsViewProps> = ({ onOpenCreateModal, onOpenAssignModal }) => {
  const {
    feeds,
    posts,
    portals,
    settings,
    deleteFeed,
    duplicateFeed,
    openFeedDetail,
    openFeedPreview,
    requestConfirm,
    user
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [networkFilter, setNetworkFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [portalFilter, setPortalFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canEdit = user.role === 'admin' || user.role === 'editor';

  const handleCopyShortcode = (shortcode: string, feedId: string) => {
    navigator.clipboard.writeText(shortcode);
    setCopiedId(feedId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredFeeds = feeds.filter(feed => {
    const matchesSearch = 
      feed.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesNetwork = networkFilter === 'all' || feed.network === networkFilter;
    const matchesStatus = statusFilter === 'all' || feed.status === statusFilter;
    const matchesPortal = portalFilter === 'all' || feed.assignedPortalIds.includes(portalFilter);

    return matchesSearch && matchesNetwork && matchesStatus && matchesPortal;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Title and Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Administración Central
            </span>
            <span className="text-xs text-slate-500">
              Total: {feeds.length} feeds configurados
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#003876] mt-1">
            Gestor Centralizado de Feeds Embebidos
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Cree, configure y distribuya feeds oficiales de redes sociales hacia los portales web WordPress institucionales del MINFIN.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => onOpenCreateModal()}
            id="btn-create-new-feed"
            className="flex items-center justify-center gap-2 bg-[#003876] hover:bg-[#002d5e] active:bg-[#002247] text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Feed</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o slug..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003876] focus:bg-white"
            />
          </div>

          {/* Network Filter */}
          <div>
            <select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-700 focus:outline-none focus:border-[#003876] focus:bg-white cursor-pointer"
            >
              <option value="all">Todas las Redes Sociales</option>
              <option value="x">X (Twitter)</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="linkedin">LinkedIn</option>
              <option value="tiktok">TikTok</option>
              <option value="mixed">Multi-Red (Mixto)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-700 focus:outline-none focus:border-[#003876] focus:bg-white cursor-pointer"
            >
              <option value="all">Todos los Estados</option>
              <option value="active">Activos</option>
              <option value="draft">Borradores</option>
              <option value="paused">Pausados</option>
            </select>
          </div>

          {/* Portal Filter */}
          <div>
            <select
              value={portalFilter}
              onChange={(e) => setPortalFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-700 focus:outline-none focus:border-[#003876] focus:bg-white cursor-pointer"
            >
              <option value="all">Filtrar por Portal Asignado (25)</option>
              {portals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Feeds Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#003876] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-bold">Nombre del Feed & Slug</th>
                <th className="py-3 px-4 font-bold">Red Social</th>
                <th className="py-3 px-4 font-bold text-center">Publicaciones</th>
                <th className="py-3 px-4 font-bold">Portales Asignados</th>
                <th className="py-3 px-4 font-bold">Shortcode WordPress</th>
                <th className="py-3 px-4 font-bold">Estado</th>
                <th className="py-3 px-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredFeeds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No se encontraron feeds con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredFeeds.map((feed) => {
                  const shortcode = `[${settings.shortcodeTag} feed="${feed.slug}"]`;
                  const isCopied = copiedId === feed.id;

                  return (
                    <tr key={feed.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Slug */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs">
                          {feed.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          slug: <span className="text-[#003876] font-semibold">{feed.slug}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Actualizado: {feed.updatedAt.split(' ')[0]}
                        </div>
                      </td>

                      {/* Network */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <SocialIcon network={feed.network} size={16} />
                          <span className="capitalize">
                            {feed.network === 'mixed' ? 'Multi-Red' : feed.network}
                          </span>
                        </div>
                      </td>

                      {/* Posts Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {feed.postIds.length}
                        </span>
                      </td>

                      {/* Assigned Portals */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {feed.assignedPortalIds.length} de {portals.length}
                          </span>
                          <button
                            onClick={() => onOpenAssignModal(feed.id)}
                            className="text-[10px] text-[#003876] hover:underline font-semibold cursor-pointer"
                          >
                            Asignar
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                          {feed.assignedPortalIds.length > 0 && feed.assignedPortalIds.length === portals.length
                            ? 'Asignado a todos los portales'
                            : `${feed.assignedPortalIds.length} portales vinculados`}
                        </div>
                      </td>

                      {/* Shortcode */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] font-mono bg-[#002754] text-emerald-300 px-2 py-1 rounded border border-blue-900/60 select-all">
                            {shortcode}
                          </code>
                          <button
                            onClick={() => handleCopyShortcode(shortcode, feed.id)}
                            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200 cursor-pointer"
                            title="Copiar shortcode"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {feed.status === 'active' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Activo
                          </span>
                        )}
                        {feed.status === 'draft' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            Borrador
                          </span>
                        )}
                        {feed.status === 'paused' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Pausado
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openFeedDetail(feed.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#003876] hover:bg-[#002d5e] rounded transition-colors cursor-pointer"
                            title="Administrar posts del feed"
                          >
                            Publicaciones ({feed.postIds.length})
                          </button>
                          
                          <button
                            onClick={() => openFeedPreview(feed.id)}
                            className="p-1.5 text-slate-600 hover:text-[#003876] hover:bg-blue-50 rounded border border-slate-200 cursor-pointer"
                            title="Ver vista previa en WordPress"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canEdit && (
                            <>
                              <button
                                onClick={() => duplicateFeed(feed.id)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                                title="Duplicar feed"
                              >
                                <CopyCheck className="w-3.5 h-3.5" />
                              </button>
                              
                              <button
                                onClick={() => onOpenCreateModal(feed.id)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                                title="Editar configuración de feed"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={async () => {
                                  const ok = await requestConfirm(
                                    `¿Confirma que desea eliminar el feed "${feed.name}"? Los portales dejarán de mostrar este contenido.`,
                                    { title: 'Eliminar feed', confirmLabel: 'Eliminar', danger: true }
                                  );
                                  if (ok) deleteFeed(feed.id);
                                }}
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-slate-200 cursor-pointer"
                                title="Eliminar feed"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
