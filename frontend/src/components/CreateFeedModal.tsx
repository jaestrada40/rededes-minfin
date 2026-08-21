import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SocialIcon, WordPressIcon } from './OfficialLogos';
import { X, Plus, Save, Layers, Globe, CheckCircle2, AlertCircle } from 'lucide-react';
import { SocialNetworkType, FeedStatus, Feed } from '../types';

interface CreateFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  editFeedId?: string | null;
}

export const CreateFeedModal: React.FC<CreateFeedModalProps> = ({ isOpen, onClose, editFeedId }) => {
  const { feeds, portals, createFeed, updateFeed, settings, showNotification } = useApp();

  const editFeed = editFeedId ? feeds.find(f => f.id === editFeedId) : null;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [network, setNetwork] = useState<SocialNetworkType | 'mixed'>('x');
  const [status, setStatus] = useState<FeedStatus>('active');
  const [assignedPortalIds, setAssignedPortalIds] = useState<string[]>(['wp-01', 'wp-02', 'wp-03']);
  const [layoutDefault, setLayoutDefault] = useState<'grid' | 'list' | 'carousel' | 'single'>('grid');
  const [maxItemsDefault, setMaxItemsDefault] = useState<number>(6);
  const [showMetrics, setShowMetrics] = useState<boolean>(true);
  const [showMedia, setShowMedia] = useState<boolean>(true);
  const [autoSlug, setAutoSlug] = useState<boolean>(true);

  useEffect(() => {
    if (editFeed) {
      setName(editFeed.name);
      setSlug(editFeed.slug);
      setDescription(editFeed.description);
      setNetwork(editFeed.network);
      setStatus(editFeed.status);
      setAssignedPortalIds(editFeed.assignedPortalIds);
      setLayoutDefault(editFeed.layoutDefault);
      setMaxItemsDefault(editFeed.maxItemsDefault);
      setShowMetrics(editFeed.showMetrics);
      setShowMedia(editFeed.showMedia);
      setAutoSlug(false);
    } else {
      setName('');
      setSlug('');
      setDescription('');
      setNetwork('x');
      setStatus('active');
      setAssignedPortalIds(['wp-01', 'wp-02', 'wp-03', 'wp-04', 'wp-06']);
      setLayoutDefault('grid');
      setMaxItemsDefault(6);
      setShowMetrics(true);
      setShowMedia(true);
      setAutoSlug(true);
    }
  }, [editFeed, isOpen]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (autoSlug && !editFeed) {
      const generated = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generated);
    }
  };

  const handleSelectAllPortals = () => {
    if (assignedPortalIds.length === portals.length) {
      setAssignedPortalIds([]);
    } else {
      setAssignedPortalIds(portals.map(p => p.id));
    }
  };

  const handleTogglePortal = (id: string) => {
    setAssignedPortalIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showNotification('Por favor ingrese un nombre para el feed.', 'error');
      return;
    }

    if (!slug.trim()) {
      showNotification('Por favor ingrese un identificador (slug) válido para el shortcode.', 'error');
      return;
    }

    if (editFeed) {
      updateFeed(editFeed.id, {
        name,
        slug,
        description,
        network,
        status,
        assignedPortalIds,
        layoutDefault,
        maxItemsDefault,
        showMetrics,
        showMedia
      });
    } else {
      createFeed({
        name,
        slug,
        description,
        network,
        status,
        assignedPortalIds,
        layoutDefault,
        maxItemsDefault,
        showMetrics,
        showMedia
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#003876] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#002d5e] text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                {editFeed ? 'Editar Feed Institucional' : 'Crear Nuevo Feed Centralizado'}
              </h3>
              <p className="text-xs text-blue-100">
                Configure el identificador para la integración mediante shortcode en WordPress
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-blue-200 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Nombre del Feed *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: X – Comunicados Oficiales"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876] focus:bg-white"
              />
            </div>

            {/* Slug */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-800">
                  Slug (Identificador) *
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Shortcode: [{settings.shortcodeTag} feed="{slug || '...' }"]
                </span>
              </div>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  setAutoSlug(false);
                }}
                placeholder="x-comunicados"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-[#003876] font-semibold focus:outline-none focus:border-[#003876] focus:bg-white"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Descripción Institucional
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objetivo y contenido que se publicará en este feed..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876] focus:bg-white"
            />
          </div>

          {/* Social Network and Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Red Social Principal
              </label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 cursor-pointer focus:outline-none focus:border-[#003876]"
              >
                <option value="x">X (Twitter)</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
                <option value="mixed">Multi-Red (Mixto)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Estado del Feed
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FeedStatus)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 cursor-pointer focus:outline-none focus:border-[#003876]"
              >
                <option value="active">Activo (En línea en portales)</option>
                <option value="draft">Borrador (Solo visible en administrador)</option>
                <option value="paused">Pausado (Oculto temporalmente)</option>
              </select>
            </div>
          </div>

          {/* WordPress Portals Assignment Box */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <WordPressIcon size={16} />
                <span>Asignar a Portales WordPress ({assignedPortalIds.length} seleccionados)</span>
              </div>
              <button
                type="button"
                onClick={handleSelectAllPortals}
                className="text-[11px] font-bold text-[#003876] hover:underline cursor-pointer"
              >
                {assignedPortalIds.length === portals.length ? 'Desmarcar todos' : 'Seleccionar todos los portales'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1">
              {portals.map((p) => {
                const isSelected = assignedPortalIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 p-1.5 rounded text-[11px] cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-100/70 text-[#003876] font-semibold' : 'hover:bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTogglePortal(p.id)}
                      className="rounded text-[#003876]"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-[#003876] hover:bg-[#002d5e] active:bg-[#002247] text-white rounded-lg font-bold shadow transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{editFeed ? 'Guardar Cambios' : 'Crear Feed'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
