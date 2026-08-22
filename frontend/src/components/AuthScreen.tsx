import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Lock, Mail, KeyRound, AlertCircle, ArrowRight, CheckCircle2, RefreshCw, Eye, EyeOff } from 'lucide-react';

type Step = 'login' | 'mfa-setup' | 'mfa-verify';

// Escudo institucional de respaldo (badge "Acceso seguro" y fallback si no
// hay logo subido en Configuración).
const ShieldIcon: React.FC<{ small?: boolean; className?: string }> = ({ small = false, className = '' }) => (
  <svg
    viewBox="0 0 64 72"
    fill="none"
    className={`${small ? 'w-[30px] h-[34px]' : 'w-[150px] h-[168px]'} shrink-0 ${className}`}
    aria-hidden="true"
  >
    <path
      d="M32 3 57 12v20c0 17.2-10.5 29.7-25 37C17.5 61.7 7 49.2 7 32V12L32 3Z"
      fill="rgba(7,28,64,0.2)"
      stroke="#c99a43"
      strokeWidth="2.4"
    />
    <text x="32" y="41" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">MF</text>
  </svg>
);

// Ilustración decorativa del edificio institucional del MINFIN (Centro Cívico),
// de fondo en el panel de marca — se ve tanto en login como en los pasos de MFA
// porque comparten el mismo panel.
export const AuthScreen: React.FC = () => {
  const { login, mfaSetupBegin, mfaSetupComplete, mfaVerifyCode, authError, settings } = useApp();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [mfaCode, setMfaCode] = useState<string>('');
  const [step, setStep] = useState<Step>('login');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    if (result?.requiresMfaSetup) {
      const setup = await mfaSetupBegin();
      if (setup) {
        setQrDataUrl(setup.qrDataUrl);
        setStep('mfa-setup');
      }
    } else if (result?.requiresMfaCode) {
      setStep('mfa-verify');
    }
    setLoading(false);
  };

  const handleMfaSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await mfaSetupComplete(mfaCode);
    setLoading(false);
  };

  const handleMfaVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await mfaVerifyCode(mfaCode);
    setLoading(false);
  };

  const stepCopy: Record<Step, { title: string; subtitle: string }> = {
    login: { title: 'Bienvenido', subtitle: 'Ingrese con sus credenciales institucionales.' },
    'mfa-setup': { title: 'Configure su MFA', subtitle: 'Escanee el código y confirme con su app de autenticación.' },
    'mfa-verify': { title: 'Verificación en dos pasos', subtitle: 'Ingrese el código de su app de autenticación.' }
  };

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(380px,42%)_1fr] bg-white font-sans text-[#102754]">
      {/* Brand panel */}
      <section
        aria-label="Ministerio de Finanzas Públicas"
        className="relative overflow-hidden grid place-items-center p-8 sm:p-12 lg:p-16 text-white min-h-[280px] lg:min-h-0"
        style={{
          backgroundColor: '#0c2a5a',
          backgroundImage: "url('/minfin-login-background.png')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-[#0c2a5a]/35 pointer-events-none" />
        <div className="relative z-[1] w-full max-w-[500px] text-center lg:text-left">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt="Logo institucional"
              className="mx-auto lg:mx-0 h-[150px] w-auto max-w-full object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
            />
          ) : (
            <ShieldIcon className="mx-auto lg:mx-0" />
          )}
          <p className="mt-6 sm:mt-10 mb-3 sm:mb-4 font-bold text-xs sm:text-[0.84rem] tracking-[0.15em] uppercase text-white">
            Ministerio de Finanzas Públicas
          </p>
          <h1 className="m-0 font-extrabold leading-[0.98] tracking-[-0.055em] text-[2.55rem] sm:text-[3.5rem] lg:text-[4.75rem]">
            Gestor<br />Centralizado
          </h1>
          <span className="block w-12 h-[3px] my-5 sm:my-7 mx-auto lg:mx-0 rounded-full bg-[#c99a43]" />
          <p className="max-w-[380px] mx-auto lg:mx-0 text-[0.93rem] sm:text-[1.08rem] leading-relaxed text-white/90">
            Plataforma institucional para la gestión de redes sociales.
          </p>
        </div>
      </section>

      {/* Access panel */}
      <section className="flex flex-col min-w-0 bg-white">
        <div className="flex flex-1 w-[calc(100%-2.5rem)] sm:w-[min(100%-3rem,510px)] mx-auto py-10 sm:py-16 lg:py-[clamp(48px,10vh,120px)] flex-col justify-center">
          <div className="flex items-center gap-2.5 w-max max-w-full px-3.5 py-2.5 border border-[#d9e0eb] rounded-[9px] text-[#42547a] text-[0.84rem] font-semibold">
            <ShieldIcon small />
            <span>Acceso seguro · Red Gubernamental MINFIN</span>
          </div>

          <header className="my-8 sm:my-14 text-center lg:text-left">
            <h2 className="m-0 mb-2.5 font-extrabold tracking-[-0.05em] text-[2.35rem] sm:text-[3.25rem]">
              {stepCopy[step].title}
            </h2>
            <p className="m-0 text-[#627292] text-[0.94rem] sm:text-[1.03rem]">
              {stepCopy[step].subtitle}
            </p>
          </header>

          {authError && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {step === 'login' && (
            <form onSubmit={handleLoginSubmit} className="grid gap-2.5">
              <label htmlFor="email" className="mt-2.5 font-bold text-[0.92rem]">Correo institucional</label>
              <div className="relative flex items-center h-[58px] sm:h-[62px] border border-[#d9e0eb] rounded-[9px] bg-white transition-colors focus-within:border-[#2c5b9f] focus-within:ring-4 focus-within:ring-[#0c2a5a]/10">
                <Mail className="w-5 h-5 ml-4 mr-3 text-[#61769e] shrink-0" strokeWidth={1.7} />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@minfin.gob.gt"
                  autoComplete="email"
                  className="w-full h-full min-w-0 border-0 outline-none text-[#102754] text-sm bg-transparent placeholder:text-[#8c9ab4] pr-4"
                />
              </div>

              <label htmlFor="password" className="mt-2.5 font-bold text-[0.92rem]">Contraseña única DTI</label>
              <div className="relative flex items-center h-[58px] sm:h-[62px] border border-[#d9e0eb] rounded-[9px] bg-white transition-colors focus-within:border-[#2c5b9f] focus-within:ring-4 focus-within:ring-[#0c2a5a]/10">
                <Lock className="w-5 h-5 ml-4 mr-3 text-[#61769e] shrink-0" strokeWidth={1.7} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                  className="w-full h-full min-w-0 border-0 outline-none text-[#102754] text-sm bg-transparent placeholder:text-[#8c9ab4]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="grid place-items-center w-[52px] sm:w-[58px] h-full text-[#61769e] cursor-pointer shrink-0"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.8} /> : <Eye className="w-5 h-5" strokeWidth={1.8} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-3 h-[58px] sm:h-[62px] mt-5 border border-[#0c2a5a] rounded-[9px] text-white font-bold text-sm cursor-pointer bg-[#0c2a5a] shadow-[0_10px_18px_rgba(12,42,90,0.17)] transition-all hover:bg-[#163c78] hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validando credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'mfa-setup' && (
            <form onSubmit={handleMfaSetupSubmit} className="grid gap-4">
              <div className="p-3.5 bg-[#edf3ff] border border-[#d9e0eb] rounded-lg text-xs text-[#1e4c99]">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Configuración inicial de MFA</span>
                </div>
                <p className="text-[#42547a]">
                  Escanee el código QR con su aplicación de autenticación (Google Authenticator, Authy) y luego ingrese el código de 6 dígitos generado.
                </p>
              </div>

              {qrDataUrl && (
                <div className="flex justify-center">
                  <img src={qrDataUrl} alt="Código QR de configuración MFA" className="rounded-lg border border-[#d9e0eb] bg-white p-2 w-48 h-48" />
                </div>
              )}

              <div>
                <label className="block font-bold text-[0.92rem] mb-1.5">Código de 6 dígitos</label>
                <div className="relative flex items-center h-[58px] sm:h-[62px] border border-[#d9e0eb] rounded-[9px] bg-white transition-colors focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10">
                  <KeyRound className="w-5 h-5 ml-4 mr-3 text-[#61769e] shrink-0" strokeWidth={1.7} />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="000000"
                    className="w-full h-full min-w-0 border-0 outline-none text-center text-lg font-mono tracking-widest text-emerald-700 font-bold bg-transparent placeholder:text-slate-300 pr-4"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="flex items-center justify-center gap-2 h-[58px] sm:h-[62px] border border-emerald-600 rounded-[9px] text-white font-bold text-sm cursor-pointer bg-emerald-600 shadow-[0_10px_18px_rgba(4,120,87,0.17)] transition-all hover:bg-emerald-700 hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verificando token seguro...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar y acceder al panel</span>
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'mfa-verify' && (
            <form onSubmit={handleMfaVerifySubmit} className="grid gap-4">
              <div className="p-3.5 bg-[#edf3ff] border border-[#d9e0eb] rounded-lg text-xs text-[#1e4c99]">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Autenticación de dos factores (MFA)</span>
                </div>
                <p className="text-[#42547a]">
                  Ingrese el código de 6 dígitos de su aplicación de autenticación.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[0.92rem] mb-1.5">Código de 6 dígitos</label>
                <div className="relative flex items-center h-[58px] sm:h-[62px] border border-[#d9e0eb] rounded-[9px] bg-white transition-colors focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10">
                  <KeyRound className="w-5 h-5 ml-4 mr-3 text-[#61769e] shrink-0" strokeWidth={1.7} />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="000000"
                    className="w-full h-full min-w-0 border-0 outline-none text-center text-lg font-mono tracking-widest text-emerald-700 font-bold bg-transparent placeholder:text-slate-300 pr-4"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="flex items-center justify-center gap-2 h-[58px] sm:h-[62px] border border-emerald-600 rounded-[9px] text-white font-bold text-sm cursor-pointer bg-emerald-600 shadow-[0_10px_18px_rgba(4,120,87,0.17)] transition-all hover:bg-emerald-700 hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verificando token seguro...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Acceder al panel de control</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className="text-center text-xs text-[#627292] hover:text-[#102754] py-1.5 cursor-pointer"
                >
                  ← Volver a ingresar correo institucional
                </button>
              </div>
            </form>
          )}

          <a
            className="self-center mt-8 text-[#174894] font-bold text-[0.94rem] no-underline hover:underline"
            href="mailto:soporte.dti@minfin.gob.gt"
          >
            ¿Necesita ayuda?
          </a>
        </div>

        <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-8 px-6 sm:px-[clamp(24px,5vw,76px)] py-6 border-t border-[#e5eaf1] bg-[#f7f9fc] text-[#506180] text-xs leading-relaxed">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <ShieldIcon small />
            <span>
              <strong className="text-[#0c2a5a]">Ministerio de Finanzas Públicas</strong><br />Gobierno de Guatemala
            </span>
          </div>
          <address className="not-italic text-left sm:text-right">
            8a. Avenida 20-59, Zona 1, Centro Cívico, Ciudad de Guatemala<br />PBX: (502) 2374-3000
          </address>
        </footer>
      </section>
    </main>
  );
};
