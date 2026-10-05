import React from 'react';

interface VirtuocityLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  customUrl?: string;
  glow?: boolean;
}

export const VirtuocityLogo: React.FC<VirtuocityLogoProps> = ({
  className = '',
  size = 'md',
  customUrl,
  glow = true,
}) => {
  const [imgError, setImgError] = React.useState(false);

  // Height mappings based on size
  const sizeClasses = {
    sm: 'h-8 max-w-[140px]',
    md: 'h-12 max-w-[220px]',
    lg: 'h-16 sm:h-20 max-w-[320px]',
    xl: 'h-24 sm:h-28 max-w-[440px]',
    hero: 'h-28 sm:h-36 md:h-44 max-w-[580px]',
  }[size];

  const logoSrc = customUrl || '/virtuocity-logo.svg';

  React.useEffect(() => {
    setImgError(false);
  }, [logoSrc]);

  if (!imgError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center select-none ${
          glow ? 'drop-shadow-sm' : ''
        } ${className}`}
      >
        <img
          src={logoSrc}
          alt="Virtuocity Battleground Qatar 2026 Logo"
          className={`w-auto object-contain transition-transform duration-200 hover:scale-[1.02] ${sizeClasses}`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Inline SVG High-Fidelity Vector Fallback
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${
        glow ? 'drop-shadow-[0_0_18px_rgba(241, 34, 62,0.35)]' : ''
      } ${className}`}
    >
      <svg
        viewBox="0 0 1000 440"
        className={`w-auto object-contain ${sizeClasses}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="redGradFallback" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f5435c" />
            <stop offset="50%" stopColor="#f1223e" />
            <stop offset="100%" stopColor="#d1142e" />
          </linearGradient>

          <linearGradient id="blueGradFallback" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2ba5ec" />
            <stop offset="50%" stopColor="#1a83c5" />
            <stop offset="100%" stopColor="#136ca3" />
          </linearGradient>

          <linearGradient id="silverGradFallback" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#dce1e8" />
            <stop offset="60%" stopColor="#b4bac4" />
            <stop offset="100%" stopColor="#969da8" />
          </linearGradient>
        </defs>

        {/* Top: VIRTUOCITY */}
        <path id="virtuocityPathFallback" d="M 180 82 Q 500 102 820 82" fill="none" stroke="none" />
        <text fill="url(#silverGradFallback)">
          <textPath
            href="#virtuocityPathFallback"
            startOffset="50%"
            textAnchor="middle"
            fontFamily="'Rajdhani', 'Impact', sans-serif"
            fontWeight="900"
            fontSize="80"
            letterSpacing="0.14em"
          >
            VIRTUOCITY
          </textPath>
        </text>

        {/* Middle: BATTLE in Red */}
        <g transform="scale(1, 1.45)">
          <text
            x="245"
            y="195"
            fontSize="172"
            fill="url(#redGradFallback)"
            fontFamily="'Rajdhani', 'Impact', sans-serif"
            fontWeight="900"
            letterSpacing="-0.02em"
            textAnchor="middle"
            transform="rotate(-3, 245, 195)"
          >
            BATTLE
          </text>
          {/* Middle: GROUND in Blue */}
          <text
            x="755"
            y="195"
            fontSize="172"
            fill="url(#blueGradFallback)"
            fontFamily="'Rajdhani', 'Impact', sans-serif"
            fontWeight="900"
            letterSpacing="-0.02em"
            textAnchor="middle"
            transform="rotate(3, 755, 195)"
          >
            GROUND
          </text>
        </g>

        {/* Bottom: QATAR 2026 */}
        <path id="qatarPathFallback" d="M 220 405 Q 500 375 780 405" fill="none" stroke="none" />
        <text fill="url(#silverGradFallback)">
          <textPath
            href="#qatarPathFallback"
            startOffset="50%"
            textAnchor="middle"
            fontFamily="'Rajdhani', 'Impact', sans-serif"
            fontWeight="900"
            fontSize="84"
            letterSpacing="0.12em"
          >
            QATAR 2026
          </textPath>
        </text>
      </svg>
    </div>
  );
};
