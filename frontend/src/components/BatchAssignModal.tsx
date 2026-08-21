import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { WordPressIcon, SocialIcon } from './OfficialLogos';
import { X, CheckCircle2, AlertTriangle, Layers, Globe, ShieldCheck } from 'lucide-react';

interface BatchAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFeedId?: string | null;
}

export const BatchAssignModal: React.FC<BatchAssignModalProps> = ({ isOpen, onClose, initialFeedId }) => {
  const { feeds, portals, assignFeedToPortals, showNotification } = useApp();

  const [selectedFeedId, setSelectedFeedId] = useState<string>(initialFeedId || feeds[0]?.id || '');
  const [selectedPortalIds, setSelectedPortalIds] = useState<string[]>([]);
  const [showConfirmStep, setShowConfirmStep] = useState<boolean>(false);
  const [applying, setApplying] = useState(false);

  const currentFeed = feeds.find(f => f.id === selectedFeedId) || feeds[0];

  useEffect(() => {
    if (initialFeedId) {
      setSelectedFeedId(initialFeedId);
    }
  }, [initialFeedId, isOpen]);

  useEffect(() => {
    if (currentFeed) {
      setSelectedPortalIds(currentFeed.assignedPortalIds);
    }
  }, [selectedFeedId, currentFeed, isOpen]);

  if (!isOpen) return null;

  const handleTogglePortal = (id: string) => {
    setSelectedPortalIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedPortalIds.length === portals.length) {
      setSelectedPortalIds([]);
    } else {
      setSelectedPortalIds(portals.map(p => p.id));
    }
  };

  const handleApplyChanges = async () => {
    setApplying(true);
    try {
      await assignFeedToPortals(currentFeed.id, selectedPortalIds);
      setShowConfirmStep(false);
      onClose();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'No se pudo guardar la asignación de portales.', 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#003876] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#002d5e] text-white">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                Asignación de Feeds a Portales WordPress
              </h3>
              <p className="text-xs text-blue-100">
                Seleccione los sitios institucionales donde se distribuirá el feed
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

        {!showConfirmStep ? (
          /* Step 1: Selection */
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
            {/* Feed Selector */}
            <div>
              <label className="block font-bold text-slate-800 mb-1.5">
                Feed Institucional a Distribuir:
              </label>
              <select
                value={selectedFeedId}
                onChange={(e) => setSelectedFeedId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-semibold focus:outline-none focus:border-[#003876] cursor-pointer"
              >
                {feeds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.postIds.length} publicaciones)
                  </option>
                ))}
              </select>
            </div>

            {/* Portals Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold text-slate-800">
                  Portales WordPress Seleccionados ({selectedPortalIds.length} de {portals.length}):
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-[#003876] hover:underline cursor-pointer"
                >
                  {selectedPortalIds.length === portals.length ? 'Desmarcar todos' : 'Marcar todos los portales'}
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 max-h-56 overflow-y-auto space-y-1">
                {portals.map((p) => {
                  const isChecked = selectedPortalIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-100/70 border border-blue-300 text-[#003876] font-semibold' : 'hover:bg-white text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePortal(p.id)}
                          className="rounded text-[#003876] shrink-0"
                        />
                        <span className="truncate">{p.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">{p.domain}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Info notice */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px]">
              Al guardar, los portales seleccionados podrán mostrar este feed en los bloques con shortcode <code>[{currentFeed?.slug}]</code>. Cada portal cachea el contenido hasta 5 minutos, así que el cambio puede tardar en reflejarse.
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmStep(true)}
                className="px-5 py-2 bg-[#003876] hover:bg-[#002d5e] active:bg-[#002247] text-white rounded-lg font-bold shadow cursor-pointer"
              >
                Continuar a Confirmación →
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Formal Institutional Confirmation Modal */
          <div className="p-4 sm:p-6 space-y-4 text-xs">
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  Confirmación de Asignación Masiva
                </h4>
                <p className="text-amber-800 text-[11px] mt-1 leading-relaxed">
                  Está a punto de actualizar la distribución del feed <strong>"{currentFeed.name}"</strong> a <strong>{selectedPortalIds.length} portales institucionales</strong>.
                </p>
                <p className="text-amber-800 text-[11px] mt-1">
                  Los portales no seleccionados dejarán de mostrar este feed si tenían el shortcode insertado.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
              <div className="flex justify-between text-slate-700">
                <span>Feed:</span>
                <strong className="text-slate-900">{currentFeed.name}</strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Portales afectados:</span>
                <strong className="text-[#003876]">{selectedPortalIds.length} portales</strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Actualización en portales:</span>
                <span className="font-mono text-amber-700">Hasta 5 min (caché de WordPress)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowConfirmStep(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
              >
                ← Volver a modificar
              </button>
              <button
                type="button"
                onClick={handleApplyChanges}
                disabled={applying}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow cursor-pointer disabled:opacity-50"
              >
                {applying ? 'Guardando...' : 'Confirmar y Aplicar Cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
