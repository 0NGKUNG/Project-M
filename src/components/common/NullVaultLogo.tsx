import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * Minimalist geometric interpretation of the user's custom cipher/null mark:
 * - Pure circular orbit ring with concentric precision gaps
 * - Sharp diagonal lightning blade piercing through 45-degree angle
 * - Dual aerodynamic crescent calipers at the top and bottom poles
 */
export const NullVaultLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer subtle concentric arc / halo */}
      <circle
        cx="50"
        cy="50"
        r="32"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeOpacity="0.4"
      />

      {/* Main core circle ring */}
      <circle
        cx="50"
        cy="50"
        r="26"
        stroke="currentColor"
        strokeWidth="3.5"
      />

      {/* Top aerodynamic caliper eye */}
      <path
        d="M 33 22 C 40 18, 60 18, 67 22 C 61 24, 39 24, 33 22 Z"
        fill="currentColor"
      />
      <circle cx="50" cy="22" r="2.2" fill="#060608" />

      {/* Bottom aerodynamic caliper eye */}
      <path
        d="M 33 78 C 40 82, 60 82, 67 78 C 61 76, 39 76, 33 78 Z"
        fill="currentColor"
      />
      <circle cx="50" cy="78" r="2.2" fill="#060608" />

      {/* Dynamic piercing diagonal slash blade (with cybernetic serration) */}
      <path
        d="M 12 88 L 38 60 L 35 56 L 44 48 L 41 44 L 56 32 L 88 12 L 62 40 L 65 44 L 56 52 L 59 56 L 44 68 Z"
        fill="currentColor"
      />

      {/* Center core pulse accent */}
      <circle cx="50" cy="50" r="1.5" fill="#060608" />
    </svg>
  );
};
