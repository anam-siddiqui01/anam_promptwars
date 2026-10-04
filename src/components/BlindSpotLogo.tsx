import React from 'react';

export type BlindSpotLogoSize = 'default' | 'small' | 'favicon' | number;

export interface BlindSpotLogoProps {
  size?: BlindSpotLogoSize;
  className?: string;
}

const SIZE_MAP: Record<'default' | 'small' | 'favicon', number> = {
  default: 22,
  small: 18,
  favicon: 16,
};

/**
 * Minimal proprietary brand mark for Blind Spot Mirror:
 * Two opposing curved arcs facing each other across a subtle central focal point,
 * evoking reflection, two sides of a premise, and seeing what is normally hidden.
 */
export const BlindSpotLogo: React.FC<BlindSpotLogoProps> = ({
  size = 'default',
  className = '',
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size];

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 text-[#172A2A] transition-colors duration-200 group-hover:text-[#6F8F86] ${className}`}
    >
      {/* Left primary arc (visible premise) */}
      <path
        d="M10.25 4.25C6.25 5.4 3.75 8.45 3.75 12C3.75 15.55 6.25 18.6 10.25 19.75"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Right mirrored arc (reflected blind spot) */}
      <path
        d="M13.75 4.25C17.75 5.4 20.25 8.45 20.25 12C20.25 15.55 17.75 18.6 13.75 19.75"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity="0.58"
      />
      {/* Central axis point */}
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
    </svg>
  );
};
