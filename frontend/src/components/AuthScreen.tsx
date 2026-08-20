import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MinfinLogo } from './OfficialLogos';
import { ShieldCheck, Lock, Mail, KeyRound, AlertCircle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { UserRole } from '../types';

export const AuthScreen: React.FC = () => {
  const { isMfaVerified, login, verifyMfa, user, switchRole } = useApp();

  const [email, setEmail] = useState<string>('jmorales@minfin.gob.gt');
  const [password, setPassword] = useState<string>('••••••••••••');
  const [mfaCode, setMfaCode] = useState<string>('582914');
  const [step, setStep] = useState<'login' | 'mfa'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(45);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      if (!email.toLowerCase().includes('@minfin.gob.gt') && !email.toLowerCase().includes('@')) {
        setError('Debe ingresar una cuenta de correo institucional válida (@minfin.gob.gt).');
        return;
      }
      login(email, password);
      setStep('mfa');
    }, 500);
  };

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      const success = verifyMfa(mfaCode);
      if (!success) {
        setError('El código ingresado es incorrecto o ha expirado. Ingrese un código de 6 dígitos.');
      }
    }, 450);
  };

  const handleFillDemoCode = (code: string) => {
    setMfaCode(code);
  };

  return (
    <div className="min-h-screen bg-[#081726] flex flex-col justify-between items-center text-slate-100 p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background Subtle Institutional Grid & Watermark */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#0072ce]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-[#0c2340]/60 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner with official badge */}
      <header className="w-full max-w-5xl flex items-center justify-between py-2 border-b border-slate-800/80 z-10">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Acceso Seguro Restringido · Red Gubernamental MINFIN</span>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          TLS 1.3 / IP: 190.85.120.104
        </div>
      </header>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md my-auto py-6 z-10">
        <div className="bg-[#0f243a] border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
          {/* Card Header with Logo */}
          <div className="bg-[#0c1e30] border-b border-slate-700/60 px-6 py-6 text-center">
            <div className="flex justify-center mb-3">
              <MinfinLogo variant="white" className="h-12" />
            </div>
            <h1 className="text-base font-bold text-white tracking-tight uppercase">
              Gestor Centralizado de Redes Sociales
            </h1>
            <p className="text-xs text-blue-300/80 mt-1">
              Dirección de Tecnologías de la Información (DTI)
            </p>
          </div>

          {/* Form Step */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {step === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Correo Institucional
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@minfin.gob.gt"
                      className="w-full bg-[#081726] border border-slate-600 rounded-lg py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Solo cuentas oficiales @minfin.gob.gt autorizadas.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Contraseña Única DTI
                    </label>
                    <span className="text-[11px] text-blue-400 hover:underline cursor-pointer">
                      ¿Olvidó contraseña?
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#081726] border border-slate-600 rounded-lg py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-[#0072ce] hover:bg-[#005fb0] active:bg-[#004f93] text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-md text-sm cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Validando credenciales...</span>
                      </>
                    ) : (
                      <>
                        <span>Continuar a Verificación MFA</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div className="p-3 bg-blue-950/40 border border-blue-800/50 rounded-lg text-xs text-blue-200">
                  <div className="flex items-center gap-2 font-semibold text-blue-300 mb-1">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span>Autenticación de Dos Factores (MFA)</span>
                  </div>
                  <p>
                    Hemos enviado un código de verificación de 6 dígitos al correo institucional <strong className="text-white">{email}</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Código de 6 Dígitos
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="582914"
                      className="w-full bg-[#081726] border border-slate-600 rounded-lg py-2.5 pl-10 pr-3 text-center text-lg font-mono tracking-widest text-emerald-400 font-bold placeholder:text-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                    <span>Reenviar código en {timer}s</span>
                    <button
                      type="button"
                      onClick={() => handleFillDemoCode('582914')}
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      Autocompletar código
                    </button>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-md text-sm cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verificando token seguro...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Acceder al Panel de Control</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('login')}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1.5 cursor-pointer"
                  >
                    ← Volver a ingresar correo institucional
                  </button>
                </div>
              </form>
            )}

            {/* Role Demo Switcher for testing all permission layers */}
            <div className="mt-6 pt-4 border-t border-slate-700/60 text-xs">
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Simular Rol Institucional:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['admin', 'editor', 'auditor', 'viewer'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => switchRole(r)}
                    className={`py-1.5 px-2 text-[11px] rounded font-medium border text-center transition-all cursor-pointer ${
                      user.role === r
                        ? 'bg-blue-600/30 border-blue-400 text-blue-200 font-bold'
                        : 'bg-[#081726]/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {r === 'admin' && 'Administrador DTI'}
                    {r === 'editor' && 'Gestor de Contenido'}
                    {r === 'auditor' && 'Auditor de Control'}
                    {r === 'viewer' && 'Solo Consulta'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional Legal Footer */}
      <footer className="w-full max-w-5xl py-4 border-t border-slate-800/80 text-center text-xs text-slate-400 z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          <strong>Ministerio de Finanzas Públicas</strong> · Gobierno de Guatemala
        </div>
        <div className="text-[11px] text-slate-400">
          8a. Avenida 20-59, Zona 1, Centro Cívico, Ciudad de Guatemala · PBX: (502) 2374-3000
        </div>
      </footer>
    </div>
  );
};
