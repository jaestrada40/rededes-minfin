import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Pagination } from './Pagination';
import { Users, Plus, UserCircle, Pencil, X, Search, Ban, CheckCircle2, ShieldOff, KeyRound } from 'lucide-react';
import { UserProfile, UserRole } from '../types';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador DTI',
  editor: 'Gestor de Contenido',
  auditor: 'Auditor de Control Interno',
  viewer: 'Consulta'
};

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-blue-100 text-blue-800 border-blue-300',
  editor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  auditor: 'bg-amber-100 text-amber-800 border-amber-300',
  viewer: 'bg-slate-100 text-slate-800 border-slate-300'
};

const PAGE_SIZE = 8;

type ModalMode = { kind: 'create' } | { kind: 'edit'; target: UserProfile } | null;

export const UsersView: React.FC = () => {
  const { user, users, requestConfirm, createUser, updateUser, updateUserRole, setUserActive, resetUserMfa, adminSetUserPassword } = useApp();

  const canEdit = user.role === 'admin';

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalMode>(null);
  const [saving, setSaving] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordResetError, setPasswordResetError] = useState('');

  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'viewer' as UserRole, department: '' });

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [users, searchTerm]);

  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreateModal = () => {
    setForm({ email: '', password: '', name: '', role: 'viewer', department: '' });
    setModal({ kind: 'create' });
  };

  const openEditModal = (target: UserProfile) => {
    setForm({ email: target.email, password: '', name: target.name, role: target.role, department: target.department });
    setShowPasswordReset(false);
    setNewPassword('');
    setNewPasswordConfirm('');
    setPasswordResetError('');
    setModal({ kind: 'edit', target });
  };

  const closeModal = () => setModal(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordResetError('');

    if (modal?.kind === 'edit' && showPasswordReset) {
      if (newPassword.length < 8) {
        setPasswordResetError('La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (newPassword !== newPasswordConfirm) {
        setPasswordResetError('Las contraseñas no coinciden.');
        return;
      }
    }

    setSaving(true);
    if (modal?.kind === 'create') {
      await createUser({ email: form.email, password: form.password, name: form.name, role: form.role, department: form.department || undefined });
    } else if (modal?.kind === 'edit') {
      const target = modal.target;
      if (form.name !== target.name || form.department !== target.department || form.email !== target.email) {
        await updateUser(target.id, { name: form.name, department: form.department, email: form.email });
      }
      if (form.role !== target.role) {
        await updateUserRole(target.id, form.role);
      }
      if (showPasswordReset && newPassword) {
        await adminSetUserPassword(target.id, newPassword);
      }
    }
    setSaving(false);
    closeModal();
  };

  const handleToggleActive = async (target: UserProfile) => {
    if (target.isActive) {
      const ok = await requestConfirm(
        `¿Desactivar la cuenta de "${target.name}"? No podrá iniciar sesión hasta que la reactive.`,
        { title: 'Desactivar usuario', confirmLabel: 'Desactivar', danger: true }
      );
      if (!ok) return;
    }
    await setUserActive(target.id, !target.isActive);
  };

  const handleResetMfa = async (target: UserProfile) => {
    const ok = await requestConfirm(
      `¿Restablecer el MFA de "${target.name}"? Deberá configurarlo de nuevo (escanear un nuevo código QR) en su próximo inicio de sesión. Úselo si perdió su dispositivo de autenticación.`,
      { title: 'Restablecer MFA', confirmLabel: 'Restablecer', danger: true }
    );
    if (ok) await resetUserMfa(target.id);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#003876] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1.5 w-fit">
              <Users className="w-3.5 h-3.5" />
              <span>Control de Acceso Institucional</span>
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#003876] mt-1">
            Usuarios y Roles
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Gestione las cuentas institucionales autorizadas y sus permisos de acceso al sistema.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre o correo..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003876] focus:bg-white"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#003876] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-bold">Usuario</th>
                <th className="py-3 px-4 font-bold">Departamento</th>
                <th className="py-3 px-4 font-bold">Rol</th>
                <th className="py-3 px-4 font-bold">Estado</th>
                {canEdit && <th className="py-3 px-4 font-bold text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="py-8 text-center text-slate-400">
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${!u.isActive ? 'opacity-60' : ''}`}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <UserCircle className="w-6 h-6 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{u.department || '—'}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${ROLE_BADGE[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-200 text-slate-600 border-slate-300">
                          <Ban className="w-3 h-3" /> Inactivo
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                            title="Editar usuario"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== user.id && (
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`p-1.5 rounded border cursor-pointer ${
                                u.isActive
                                  ? 'text-red-600 hover:text-red-800 hover:bg-red-50 border-slate-200'
                                  : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 border-slate-200'
                              }`}
                              title={u.isActive ? 'Desactivar usuario' : 'Reactivar usuario'}
                            >
                              {u.isActive ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {u.mfaEnabled && (
                            <button
                              onClick={() => handleResetMfa(u)}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded border border-slate-200 cursor-pointer"
                              title="Restablecer MFA (perdió su dispositivo)"
                            >
                              <ShieldOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredUsers.length} onPageChange={setPage} />
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#003876] text-white p-4 sm:p-5 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold">
                {modal.kind === 'create' ? 'Nuevo Usuario Institucional' : `Editar Usuario — ${modal.target.name}`}
              </h3>
              <button onClick={closeModal} className="p-1 text-blue-200 hover:text-white rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 text-xs">
              {modal.kind === 'create' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Correo Institucional *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
                      placeholder="usuario@minfin.gob.gt"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contraseña Temporal *</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Departamento</label>
                    <input
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
                    />
                  </div>
                </>
              )}

              {modal.kind === 'edit' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Correo Institucional</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono focus:outline-none focus:border-[#003876]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nombre Completo</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Departamento</label>
                    <input
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-[#003876]"
                    />
                  </div>

                  <div className="pt-1">
                    {!showPasswordReset ? (
                      <button
                        type="button"
                        onClick={() => setShowPasswordReset(true)}
                        className="flex items-center gap-1.5 text-[#003876] font-bold hover:underline cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Restablecer contraseña
                      </button>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-amber-800">
                            <KeyRound className="w-3.5 h-3.5" />
                            Nueva contraseña
                          </span>
                          <button
                            type="button"
                            onClick={() => { setShowPasswordReset(false); setNewPassword(''); setNewPasswordConfirm(''); setPasswordResetError(''); }}
                            className="text-amber-700 hover:text-amber-900 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="password"
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          className="w-full bg-white border border-amber-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-amber-500"
                        />
                        <input
                          type="password"
                          minLength={8}
                          value={newPasswordConfirm}
                          onChange={(e) => setNewPasswordConfirm(e.target.value)}
                          placeholder="Confirmar contraseña"
                          className="w-full bg-white border border-amber-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-amber-500"
                        />
                        {passwordResetError && (
                          <p className="text-red-600 font-semibold">{passwordResetError}</p>
                        )}
                        <p className="text-amber-700">El usuario cerrará sesión en todos sus dispositivos y deberá usar esta nueva contraseña.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 cursor-pointer focus:outline-none focus:border-[#003876]"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#003876] hover:bg-[#002d5e] text-white rounded-lg font-bold shadow cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : modal.kind === 'create' ? 'Crear Usuario' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
