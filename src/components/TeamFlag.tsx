import React, { useState, useEffect } from 'react';
import {
  getTeamFlagUrl,
  getTeamFlagFallbackUrl,
  getCountryName,
  getCountryEmoji,
  normalizeCountryCode,
} from '../utils/flagHelper';

interface TeamFlagProps {
  flagValue?: string | null;
  countryName?: string;
  className?: string;
  isWinner?: boolean;
  alt?: string;
  title?: string;
  teamId?: number;
}

/**
 * Resilient, high-fidelity team country flag component.
 * - Handles standard rectangular flags and unique non-quadrilateral flags (Nepal).
 * - Multi-tier fallback: Primary CDN -> Secondary SVG CDN -> High-DPI FlagCDN -> Country Emoji badge.
 * - Reactive key binding ensures immediate DOM update without caching artifacts.
 */
export const TeamFlag: React.FC<TeamFlagProps> = ({
  flagValue,
  countryName: customCountryName,
  className = '',
  isWinner = false,
  alt,
  title,
  teamId,
}) => {
  const resolvedCountryName = customCountryName || getCountryName(flagValue);
  const primaryUrl = getTeamFlagUrl(flagValue);
  const fallbackUrl = getTeamFlagFallbackUrl(flagValue);
  const emoji = getCountryEmoji(flagValue);

  const [currentSrc, setCurrentSrc] = useState<string | null>(primaryUrl);
  const [hasError, setHasError] = useState<boolean>(false);

  // When flagValue prop changes, reset to primary URL immediately
  useEffect(() => {
    setCurrentSrc(primaryUrl);
    setHasError(false);
  }, [primaryUrl, flagValue]);

  if (!flagValue || !flagValue.trim()) {
    return null;
  }

  const normCode = normalizeCountryCode(flagValue);
  const isNepal = normCode === 'np' || flagValue.trim().toLowerCase() === 'np';

  const defaultBorderClasses = isWinner
    ? 'border border-[#FFD700] ring-1 ring-[#FFD700]/70'
    : 'border border-white/30 shadow-sm';

  const finalClass = className || `w-5 h-3.5 sm:w-6 sm:h-4 rounded-[2px] ${defaultBorderClasses}`;

  // If image loading failed completely, render the clean country emoji badge
  if (hasError || !currentSrc) {
    return (
      <span
        title={title || resolvedCountryName}
        aria-label={alt || resolvedCountryName}
        className={`inline-flex items-center justify-center select-none text-xs font-normal leading-none flex-shrink-0 ${finalClass} bg-[#0A1535]/80 overflow-hidden`}
      >
        {emoji || '🏳️'}
      </span>
    );
  }

  return (
    <img
      key={`${teamId || 'team'}-${flagValue}-${currentSrc}`}
      src={currentSrc}
      alt={alt || resolvedCountryName}
      title={title || resolvedCountryName}
      className={`flex-shrink-0 ${
        isNepal ? 'object-contain p-[0.5px] bg-slate-900/60' : 'object-cover'
      } ${finalClass}`}
      referrerPolicy="no-referrer"
      onError={() => {
        if (fallbackUrl && currentSrc !== fallbackUrl) {
          // Attempt secondary reliable CDN
          setCurrentSrc(fallbackUrl);
        } else {
          // Fallback to emoji badge
          setHasError(true);
        }
      }}
    />
  );
};
