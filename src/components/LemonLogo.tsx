interface LemonLogoProps {
  size?: number;
  className?: string;
  rounded?: 'xl' | 'full' | 'lg';
}

export function LemonLogo({
  size = 36,
  className = '',
  rounded = 'xl',
}: LemonLogoProps) {
  const radiusClass =
    rounded === 'full' ? 'rounded-full' : rounded === 'lg' ? 'rounded-lg' : 'rounded-xl';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className={`shrink-0 ${radiusClass} ${className}`}
    >
      {/* Dark Citrus Vault Base */}
      <rect width="64" height="64" rx="16" fill="#141A10" />
      {/* Signature Golden Outer Ring */}
      <circle
        cx="32"
        cy="32"
        r="24.5"
        fill="none"
        stroke="#FACC15"
        strokeWidth="2.8"
      />
      {/* Leaf */}
      <path
        d="M 35 19 C 37 12.5 45.5 11.5 48.5 15.5 C 45.5 21 38.5 22 35 19 Z"
        fill="#22C55E"
      />
      <path
        d="M 36.2 18.2 C 39.5 16.4 43.2 15.6 46 15.8"
        stroke="#14532D"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lemon Body */}
      <g transform="rotate(-24 32 34)">
        {/* Tips */}
        <circle cx="15.5" cy="34" r="3.4" fill="#EAB308" />
        <circle cx="48.5" cy="34" r="3.4" fill="#EAB308" />
        {/* Main Fruit */}
        <ellipse cx="32" cy="34" rx="16" ry="11.6" fill="#FACC15" />
        {/* Inner Specular Highlight */}
        <path
          d="M 21.5 28.8 Q 32 23.6 42.5 28.8 Q 35.5 32.5 21.5 28.8 Z"
          fill="#FEF9C3"
          opacity="0.88"
        />
        {/* Subtle Bottom Warmth */}
        <path
          d="M 20 38.5 Q 32 43.5 44 38.5"
          stroke="#CA8A04"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.45"
        />
      </g>
    </svg>
  );
}
