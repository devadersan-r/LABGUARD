import React from 'react';

interface TrueguardLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

export const TrueguardLogo: React.FC<TrueguardLogoProps> = ({
  size = 'md',
  showTagline = false,
  theme = 'dark',
  className = '',
}) => {
  const iconDimensions = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
  const titleSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';
  const isLight = theme === 'light';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* High-fidelity Shield with Lock Vector */}
      <div className={`relative ${iconDimensions} flex items-center justify-center shrink-0`}>
        {/* Glowing backdrop */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-[#087EE8]/30 via-[#27C5FF]/30 to-transparent blur-md" />
        
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-md"
        >
          {/* Outer Shield Outline */}
          <path
            d="M24 4L7 11V22C7 33 14.5 42.5 24 45C33.5 42.5 41 33 41 22V11L24 4Z"
            fill="url(#shieldGrad)"
            stroke="#27C5FF"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          
          {/* Inner Shield Facet Line */}
          <path
            d="M24 7V42C31.5 39.8 38 31.8 38 22V12.5L24 7Z"
            fill="#FFFFFF"
            fillOpacity="0.08"
          />
          
          {/* Lock Shackle */}
          <path
            d="M19 22V18C19 15.2386 21.2386 13 24 13C26.7614 13 29 15.2386 29 18V22"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          
          {/* Lock Body */}
          <rect
            x="17"
            y="22"
            width="14"
            height="11"
            rx="2.5"
            fill="#06264A"
            stroke="#27C5FF"
            strokeWidth="1.5"
          />
          
          {/* Keyhole */}
          <circle cx="24" cy="26.5" r="1.5" fill="#27C5FF" />
          <path d="M24 27.5V30" stroke="#27C5FF" strokeWidth="1.5" strokeLinecap="round" />

          {/* Gradients */}
          <defs>
            <linearGradient id="shieldGrad" x1="7" y1="4" x2="41" y2="45" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0866D4" />
              <stop offset="0.6" stopColor="#082F61" />
              <stop offset="1" stopColor="#06264A" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-extrabold tracking-tight ${titleSize} ${
              isLight ? 'text-[#082F61]' : 'text-white'
            }`}
          >
            LAB<span className="text-[#087EE8]">GUARD</span>
          </span>
        </div>
        {showTagline && (
          <span
            className={`text-xs font-semibold tracking-wider uppercase ${
              isLight ? 'text-[#58758D]' : 'text-[#27C5FF]'
            }`}
          >
            Secure · Verify · Trust
          </span>
        )}
      </div>
    </div>
  );
};

export const LabguardLogo = TrueguardLogo;
