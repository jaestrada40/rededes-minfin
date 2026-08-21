import React from 'react';

export const NETWORK_LABELS: Record<string, string> = {
  x: 'X (Twitter)',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  mixed: 'Multi-Red',
};

export function networkLabel(network: string): string {
  return NETWORK_LABELS[network] ?? network;
}

export const MinfinLogo: React.FC<{ className?: string; variant?: 'full' | 'compact' | 'white' | 'dark'; logoUrl?: string }> = ({
  className = 'h-10',
  variant = 'full',
  logoUrl
}) => {
  const isWhite = variant === 'white';
  const textColor = isWhite ? 'text-white' : 'text-[#0c2340]';
  const subTextColor = isWhite ? 'text-slate-200' : 'text-slate-600';
  const flagBlue = '#0072ce';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Institutional Escudo / Emblem */}
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo institucional"
          className="shrink-0 h-full w-auto max-w-full rounded-lg object-contain"
        />
      ) : (
        <div className="relative flex items-center justify-center shrink-0 h-full aspect-square rounded-lg bg-gradient-to-b from-[#0c2340] to-[#08182b] border border-blue-400/30 shadow-sm">
          <svg viewBox="0 0 100 100" className="w-[68%] h-[68%]" fill="none">
            {/* Simple institutional monogram: shield outline + MF */}
            <path
              d="M50 6 L88 18 V46 C88 68 72 84 50 94 C28 84 12 68 12 46 V18 Z"
              fill="none"
              stroke="#e2a03f"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M50 6 L88 18 V46 C88 68 72 84 50 94 C28 84 12 68 12 46 V18 Z"
              fill="#0072ce"
              fillOpacity="0.12"
            />
            <text
              x="50"
              y="60"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontWeight="800"
              fontSize="34"
              fill="#ffffff"
              letterSpacing="-1"
            >
              MF
            </text>
          </svg>
        </div>
      )}

      {variant !== 'compact' && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className={`text-[13px] font-black tracking-tight uppercase ${textColor}`}>
              MINISTERIO DE FINANZAS PÚBLICAS
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold tracking-wider uppercase ${subTextColor}`}>
              Gobierno de Guatemala
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#0072ce]" />
            <span className="text-[10px] font-medium tracking-normal text-blue-400">
              DTI
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const SocialIcon: React.FC<{
  network: string;
  className?: string;
  size?: number;
  colored?: boolean;
}> = ({ network, className = '', size = 18, colored = true }) => {
  const net = network.toLowerCase();

  if (net === 'x' || net === 'twitter') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${colored ? 'text-black' : ''} ${className}`}
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  if (net === 'facebook') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${colored ? 'text-[#1877F2]' : ''} ${className}`}
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }

  if (net === 'instagram') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${colored ? 'text-[#E4405F]' : ''} ${className}`}
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="3" />
      </svg>
    );
  }

  if (net === 'youtube') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${colored ? 'text-[#FF0000]' : ''} ${className}`}
      >
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }

  if (net === 'linkedin') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${colored ? 'text-[#0A66C2]' : ''} ${className}`}
      >
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    );
  }

  if (net === 'tiktok') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${colored ? 'text-[#000000]' : ''} ${className}`}
      >
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.02 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
  }

  // Mixed or generic
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
};

export const WordPressIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'text-[#21759b]',
  size = 20
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.07 18.847L7.4 8.765a6.49 6.49 0 0 1 3.53-.948c.84 0 1.643.155 2.383.435L9.62 18.064c.42.274.878.497 1.31.783zm6.657-6.945c0-1.758-.63-2.973-1.17-3.918-.72-1.17-1.395-2.16-1.395-3.33 0-1.305 1-2.52 2.385-2.52.105 0 .21.015.315.03A9.972 9.972 0 0 1 22 12c0 2.87-1.21 5.46-3.15 7.283l-1.263-6.381zm-9.98-7.38c.675 0 1.725.09 1.725.09.54.045.585.81.045.855 0 0-.54.045-1.125.09l3.585 10.665 2.16-6.48-1.545-4.185c-.51-.045-1-.09-1-.09-.54-.045-.495-.81.045-.855 0 0 1.08.09 1.725.09.675 0 1.755-.09 1.755-.09.54-.045.585.81.045.855 0 0-.54.045-1.125.09l3.54 10.53 1.005-3.375c.42-1.395.585-2.43.585-3.33 0-1.89-1.26-2.745-1.8-3.33-.72-.765-.855-1.44-.855-2.115 0-1.485 1.17-2.655 2.61-2.655.225 0 .435.03.645.075A10.02 10.02 0 0 0 12 2C6.99 2 2.835 5.67 2.13 10.455c.345-.045.72-.09 1.125-.09.54 0 1.35.045 1.35.045.54.045.495.81-.045.855 0 0-.54.045-1.125.09l3.585 10.665 2.25-6.75-1.74-4.815c-.495-.045-.96-.09-.96-.09-.54-.045-.51-.81.03-.855zM12 22a9.96 9.96 0 0 1-5.61-1.71l3.585-10.41 3.69 10.08A9.94 9.94 0 0 1 12 22z" />
  </svg>
);
