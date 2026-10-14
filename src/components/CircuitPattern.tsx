import React from 'react';

export const CircuitPattern: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Background soft ambient glowing spheres */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#BDEDFD]/50 blur-3xl" />
      <div className="absolute top-1/2 left-1/4 w-80 h-80 rounded-full bg-[#C9EAF7]/60 blur-3xl" />
      <div className="absolute -bottom-24 right-1/4 w-96 h-96 rounded-full bg-[#BDEDFD]/40 blur-3xl" />

      {/* Circuit lines SVG with light blue traces */}
      <svg
        className="absolute inset-0 w-full h-full opacity-40"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <defs>
          <linearGradient id="lightCircuitGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#087EE8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#27C5FF" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="lightCircuitGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#27C5FF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#C9EAF7" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Traces */}
        <path
          d="M0 120 H 180 L 230 170 H 420 L 460 210 H 700"
          stroke="url(#lightCircuitGrad1)"
          strokeWidth="1.25"
          strokeDasharray="4 2"
        />
        <path
          d="M60 0 V 160 L 100 200 V 420 L 140 460 H 350"
          stroke="url(#lightCircuitGrad2)"
          strokeWidth="1.25"
        />
        <path
          d="M200 600 H 380 L 430 550 H 650 L 700 600 H 900"
          stroke="url(#lightCircuitGrad1)"
          strokeWidth="1.2"
        />
        <path
          d="M80 850 H 260 L 310 800 H 520"
          stroke="url(#lightCircuitGrad2)"
          strokeWidth="1.25"
          strokeDasharray="6 3"
        />

        {/* Circuit nodes / test points */}
        <circle cx="180" cy="120" r="3.5" fill="#087EE8" />
        <circle cx="230" cy="170" r="2.5" fill="#27C5FF" />
        <circle cx="420" cy="170" r="3" fill="#087EE8" />
        <circle cx="100" cy="200" r="3" fill="#27C5FF" />
        <circle cx="140" cy="460" r="3.5" fill="#087EE8" />
        <circle cx="350" cy="460" r="2.5" fill="#27C5FF" />
        <circle cx="380" cy="600" r="3" fill="#087EE8" />
        <circle cx="430" cy="550" r="3" fill="#27C5FF" />
        <circle cx="650" cy="550" r="3.5" fill="#087EE8" />
        <circle cx="260" cy="850" r="3" fill="#27C5FF" />
        <circle cx="310" cy="800" r="3" fill="#087EE8" />
      </svg>
    </div>
  );
};
