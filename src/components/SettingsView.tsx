import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SocialIcon, WordPressIcon, MinfinLogo } from './OfficialLogos';
import { 
  Settings, 
  Save, 
  ShieldCheck, 
  Key, 
  Globe, 
  Share2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Lock,
  Radio,
  Server
} from 'lucide-react';
import { SocialNetworkType, SocialAccount } from '../types';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, portals, syncAllPortals, user, showNotification } = useApp();

  const [formData, setFormData] = useState({ ...settings });
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = user.role === 'admin';

  const handleAccountChange = (network: SocialNetworkType, field: keyof SocialAccount, value: any) => {
    setFormData(prev => ({
      ...prev,
      officialAccounts: {
        ...prev.officialAccounts,
        [network]: {
          ...prev.officialAccounts[network],
          [field]: value
        }
      }
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateSettings(formData);
      setIsSaving(false);
      showNotification('Configuración institucional guardada en el servidor DTI.', 'success');
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#003876] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Parámetros de Servidor DTI
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Configuración de Integración
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#003876] mt-1">
            Configuración del Sistema y Cuentas Oficiales
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Administre las cuentas verificadas de redes sociales, parámetros de caché Transient API para WordPress y tokens de seguridad.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#003876] hover:bg-[#002d5e] active:bg-[#002247] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Configuración'}</span>
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Su rol actual ({user.role}) tiene permisos de solo lectura para la configuración del sistema.</span>
        </div>
      )}

      {/* Official Social Accounts Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase text-[#003876] border-b border-slate-100 pb-2">
          <Share2 className="w-4 h-4 text-[#0072ce]" />
          <span>Cuentas Institucionales Oficiales del MINFIN</span>
        </div>
        <p className="text-xs text-slate-600">
          Estas cuentas son utilizadas por el sistema para validar automáticamente los autores y enlaces en los 25 portales.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {(['x', 'facebook', 'instagram', 'youtube', 'linkedin', 'tiktok'] as SocialNetworkType[]).map((net) => {
            const acc = formData.officialAccounts[net];
            return (
              <div key={net} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <SocialIcon network={net} size={18} />
                    <span className="uppercase">{net}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verificada
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Usuario / Handle Oficial
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={acc?.handle || ''}
                    onChange={(e) => handleAccountChange(net, 'handle', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#003876]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    URL del Perfil Oficial
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={acc?.url || ''}
                    onChange={(e) => handleAccountChange(net, 'url', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#003876]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WordPress & Webhook Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Cache & Webhook Parameters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold uppercase text-[#003876] border-b border-slate-100 pb-2">
            <WordPressIcon size={16} />
            <span>Integración y Rendimiento WordPress</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Etiqueta de Shortcode Institucional:
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={formData.shortcodeTag}
              onChange={(e) => setFormData(prev => ({ ...prev, shortcodeTag: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-800"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Genera el shortcode <code className="bg-slate-100 px-1 rounded font-mono">[{formData.shortcodeTag} feed="..."]</code>
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Tiempo de Caché en Portales (Transient API - Segundos):
            </label>
            <select
              disabled={!canEdit}
              value={formData.apiCacheDurationSeconds}
              onChange={(e) => setFormData(prev => ({ ...prev, apiCacheDurationSeconds: Number(e.target.value) }))}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-medium"
            >
              <option value={60}>60 segundos (1 minuto - Mayor frescura)</option>
              <option value={300}>300 segundos (5 minutos - Recomendado)</option>
              <option value={600}>600 segundos (10 minutos)</option>
              <option value={1800}>1800 segundos (30 minutos)</option>
            </select>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Al modificar publicaciones, el webhook invalida la caché instantáneamente en los 25 portales.
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Clave Secreta de Webhook (HMAC-SHA256):
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                disabled={!canEdit}
                value={formData.webhookSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, webhookSecret: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-slate-800"
              />
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, webhookSecret: `minfin_sec_${Math.random().toString(36).substring(2, 15)}` }));
                  showNotification('Nueva clave secreta de webhook generada.', 'info');
                }}
                disabled={!canEdit}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-800 font-semibold cursor-pointer whitespace-nowrap"
              >
                Regenerar
              </button>
            </div>
          </div>
        </div>

        {/* Right: Authorized Whitelist Domains & Security */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold uppercase text-[#0c2340] border-b border-slate-100 pb-2">
            <ShieldCheck className="w-4 h-4 text-[#0072ce]" />
            <span>Dominios Autorizados (CORS & Whitelist)</span>
          </div>

          <p className="text-slate-600">
            Solo las solicitudes originadas desde dominios gubernamentales autorizados pueden consumir la API central de feeds:
          </p>

          <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800">
            {formData.allowedCorsDomains.map((d, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{d}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-700" />
              <span>Estado del Servidor DTI-MINFIN</span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Infraestructura en alta disponibilidad con balanceo de carga para los 25 portales institucionales.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
