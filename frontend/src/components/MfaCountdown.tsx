import React, { useEffect, useState } from 'react';

const TOTP_PERIOD_SECONDS = 30;

function secondsLeftInWindow(): number {
  const epoch = Math.floor(Date.now() / 1000);
  return TOTP_PERIOD_SECONDS - (epoch % TOTP_PERIOD_SECONDS);
}

// Cuenta regresiva de los segundos que le quedan de vigencia al código TOTP
// actual (rota cada 30s, igual que Google Authenticator/Authy) — para que el
// usuario sepa si le da tiempo de escribirlo o si debe esperar el siguiente.
export const MfaCountdown: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [secondsLeft, setSecondsLeft] = useState(secondsLeftInWindow);

  useEffect(() => {
    const interval = setInterval(() => setSecondsLeft(secondsLeftInWindow()), 1000);
    return () => clearInterval(interval);
  }, []);

  const low = secondsLeft <= 5;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative w-4 h-4 shrink-0">
        <svg viewBox="0 0 20 20" className="w-4 h-4 -rotate-90">
          <circle cx="10" cy="10" r="8" fill="none" strokeWidth="3" className="stroke-slate-200" />
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 8}
            strokeDashoffset={2 * Math.PI * 8 * (1 - secondsLeft / TOTP_PERIOD_SECONDS)}
            className={low ? 'stroke-red-500 transition-[stroke-dashoffset] duration-1000 linear' : 'stroke-emerald-500 transition-[stroke-dashoffset] duration-1000 linear'}
          />
        </svg>
      </div>
      <span className={`text-[11px] font-mono font-semibold tabular-nums ${low ? 'text-red-600' : 'text-slate-500'}`}>
        El código cambia en {secondsLeft}s
      </span>
    </div>
  );
};
