import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Menu,
  Search,
  RefreshCw,
  Bell,
  User,
  LogOut,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Radio,
  KeyRound,
  X
} from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const {
    user,
    logout,
    syncAllPortals,
    activeTab,
    portals,
    notification,
    changeOwnPassword
  } = useApp();

  const [isSyncing, setIsSyncing] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setChangingPassword(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      closePasswordModal();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleGlobalSync = async () => {
    setIsSyncing(true);
    await syncAllPortals();
    setIsSyncing(false);
  };

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Panel Principal y Resumen Operativo';
      case 'feeds': return 'Catálogo y Gestión de Feeds';
      case 'feed-detail': return 'Registro y Administración de Publicaciones';
      case 'portals': return 'Distribución en Portales WordPress (25)';
      case 'preview': return 'Simulador de Vista Previa Embebida';
      case 'audit': return 'Auditoría, Trazabilidad y Seguridad';
      case 'settings': return 'Configuración Institucional y Cuentas Oficiales';
      default: return 'Gestor Centralizado de Redes Sociales';
    }
  };

  const roleLabels: Record<UserRole, { title: string; color: string }> = {
    admin: { title: 'Administrador DTI', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    editor: { title: 'Gestor de Contenido', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    auditor: { title: 'Auditor de Control', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    viewer: { title: 'Solo Consulta', color: 'bg-slate-100 text-slate-800 border-slate-300' }
  };

  return (
    <>
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-xs">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>MINFIN</span>
              <span>/</span>
              <span className="text-[#003876] font-semibold">DTI Redes</span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-[#003876] tracking-tight">
              {getBreadcrumbTitle()}
            </h1>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick sync button */}
          <button
            onClick={handleGlobalSync}
            disabled={isSyncing}
            id="btn-sync-all-portals"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#003876] text-white hover:bg-[#002d5e] active:bg-[#002247] transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Envía una señal de invalidación de caché a los portales WordPress"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-300' : ''}`} />
            <span>{isSyncing ? 'Sincronizando Portales...' : 'Sincronizar Portales'}</span>
          </button>

          {/* Portal Health Badge */}
          {portals.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{portals.filter(p => p.connectionStatus === 'connected').length}/{portals.length} Portales OK</span>
            </div>
          )}

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-600 hover:text-[#003876] hover:bg-slate-100 rounded-lg relative cursor-pointer"
              title="Notificaciones del sistema"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0072ce]" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 text-xs">
                <div className="font-bold text-[#003876] border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                  <span>Notificaciones Institucionales</span>
                  <span className="text-[10px] text-[#0072ce] font-semibold">Al día</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2 rounded bg-blue-50/70 border border-blue-100 text-blue-900">
                    <p className="font-medium text-[11px]">Sincronización automática activa</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Los portales institucionales están consumiendo feeds vía REST API con caché de 300s.</p>
                  </div>
                  <div className="p-2 rounded bg-emerald-50/70 border border-emerald-100 text-emerald-900">
                    <p className="font-medium text-[11px]">Certificados TLS vigentes</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Tokens y webhooks validados en dominio minfin.gob.gt.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User & Role Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-left transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#003876] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user.name.split(' ')[1]?.[0] || 'J'}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                  {user.name}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {roleLabels[user.role].title}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 text-xs">
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900">{user.name}</div>
                  <div className="text-slate-500 text-[11px] font-mono">{user.email}</div>
                  <div className="mt-1">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${roleLabels[user.role].color}`}>
                      {roleLabels[user.role].title}
                    </span>
                  </div>
                </div>

                <div className="px-2 pt-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowPasswordModal(true);
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Cambiar Contraseña</span>
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded text-red-600 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión Institucional</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Toast Notification */}
      {notification && (
        <div className="mt-2.5 p-2.5 rounded-lg text-xs font-medium flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-1 transition-all bg-[#003876] text-white border border-white/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <span className="text-[10px] text-blue-200 font-mono">DTI-MINFIN</span>
        </div>
      )}
    </header>

    {showPasswordModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-sm w-full">
          <div className="bg-[#003876] text-white p-4 flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              <span>Cambiar Contraseña</span>
            </h3>
            <button onClick={closePasswordModal} className="p-1 text-blue-200 hover:text-white rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleChangePassword} className="p-4 space-y-3 text-xs">
            {passwordError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Contraseña Actual</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nueva Contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={closePasswordModal}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={changingPassword}
                className="px-4 py-2 bg-[#003876] hover:bg-[#002d5e] text-white rounded-lg font-bold shadow cursor-pointer disabled:opacity-50"
              >
                {changingPassword ? 'Guardando...' : 'Cambiar Contraseña'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
};
