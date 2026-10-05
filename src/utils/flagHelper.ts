export interface CountryFlagInfo {
  code: string;
  name: string;
  emoji: string;
}

export const POPULAR_COUNTRIES: CountryFlagInfo[] = [
  { code: 'sa', name: 'Saudi Arabia', emoji: '🇸🇦' },
  { code: 'in', name: 'India', emoji: '🇮🇳' },
  { code: 'pk', name: 'Pakistan', emoji: '🇵🇰' },
  { code: 'ae', name: 'United Arab Emirates', emoji: '🇦🇪' },
  { code: 'kw', name: 'Kuwait', emoji: '🇰🇼' },
  { code: 'qa', name: 'Qatar', emoji: '🇶🇦' },
  { code: 'bh', name: 'Bahrain', emoji: '🇧🇭' },
  { code: 'om', name: 'Oman', emoji: '🇴🇲' },
  { code: 'eg', name: 'Egypt', emoji: '🇪🇬' },
  { code: 'jo', name: 'Jordan', emoji: '🇯🇴' },
  { code: 'iq', name: 'Iraq', emoji: '🇮🇶' },
  { code: 'tr', name: 'Turkey', emoji: '🇹🇷' },
  { code: 'bd', name: 'Bangladesh', emoji: '🇧🇩' },
  { code: 'np', name: 'Nepal', emoji: '🇳🇵' },
  { code: 'my', name: 'Malaysia', emoji: '🇲🇾' },
  { code: 'id', name: 'Indonesia', emoji: '🇮🇩' },
  { code: 'th', name: 'Thailand', emoji: '🇹🇭' },
  { code: 'vn', name: 'Vietnam', emoji: '🇻🇳' },
  { code: 'ph', name: 'Philippines', emoji: '🇵🇭' },
  { code: 'kr', name: 'South Korea', emoji: '🇰🇷' },
  { code: 'jp', name: 'Japan', emoji: '🇯🇵' },
  { code: 'cn', name: 'China', emoji: '🇨🇳' },
  { code: 'sg', name: 'Singapore', emoji: '🇸🇬' },
  { code: 'us', name: 'United States', emoji: '🇺🇸' },
  { code: 'gb', name: 'United Kingdom', emoji: '🇬🇧' },
  { code: 'ca', name: 'Canada', emoji: '🇨🇦' },
  { code: 'au', name: 'Australia', emoji: '🇦🇺' },
  { code: 'de', name: 'Germany', emoji: '🇩🇪' },
  { code: 'fr', name: 'France', emoji: '🇫🇷' },
  { code: 'ru', name: 'Russia', emoji: '🇷🇺' },
  { code: 'br', name: 'Brazil', emoji: '🇧🇷' },
  { code: 'ma', name: 'Morocco', emoji: '🇲🇦' },
  { code: 'dz', name: 'Algeria', emoji: '🇩🇿' },
  { code: 'tn', name: 'Tunisia', emoji: '🇹🇳' },
  { code: 'lb', name: 'Lebanon', emoji: '🇱🇧' },
  { code: 'ps', name: 'Palestine', emoji: '🇵🇸' },
  { code: 'ye', name: 'Yemen', emoji: '🇾🇪' },
  { code: 'sd', name: 'Sudan', emoji: '🇸🇩' },
  { code: 'sy', name: 'Syria', emoji: '🇸🇾' },
  { code: 'ua', name: 'Ukraine', emoji: '🇺🇦' },
  { code: 'pl', name: 'Poland', emoji: '🇵🇱' },
  { code: 'se', name: 'Sweden', emoji: '🇸🇪' },
  { code: 'no', name: 'Norway', emoji: '🇳🇴' },
  { code: 'dk', name: 'Denmark', emoji: '🇩🇰' },
  { code: 'fi', name: 'Finland', emoji: '🇫🇮' },
  { code: 'es', name: 'Spain', emoji: '🇪🇸' },
  { code: 'it', name: 'Italy', emoji: '🇮🇹' },
  { code: 'nl', name: 'Netherlands', emoji: '🇳🇱' },
  { code: 'ar', name: 'Argentina', emoji: '🇦🇷' },
  { code: 'cl', name: 'Chile', emoji: '🇨🇱' },
  { code: 'co', name: 'Colombia', emoji: '🇨🇴' },
  { code: 'mx', name: 'Mexico', emoji: '🇲🇽' },
  { code: 'za', name: 'South Africa', emoji: '🇿🇦' },
  { code: 'mn', name: 'Mongolia', emoji: '🇲🇳' },
  { code: 'kz', name: 'Kazakhstan', emoji: '🇰🇿' },
  { code: 'mm', name: 'Myanmar', emoji: '🇲🇲' },
  { code: 'lk', name: 'Sri Lanka', emoji: '🇱🇰' },
  { code: 'uz', name: 'Uzbekistan', emoji: '🇺🇿' },
];

/**
 * Normalizes any country input (2-letter ISO, full country name, or flag emoji) to a 2-letter ISO code.
 */
export function normalizeCountryCode(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  // Direct 2-letter ISO code
  if (trimmed.length === 2 && /^[a-z]{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Emoji to code conversion
  for (const c of POPULAR_COUNTRIES) {
    if (c.emoji === value.trim()) {
      return c.code;
    }
  }

  // Name match
  for (const c of POPULAR_COUNTRIES) {
    if (c.name.toLowerCase() === trimmed) {
      return c.code;
    }
  }

  // Common aliases
  if (trimmed === 'nepal') return 'np';
  if (trimmed === 'bangladesh') return 'bd';
  if (trimmed === 'india') return 'in';
  if (trimmed === 'pakistan') return 'pk';
  if (trimmed === 'saudi arabia' || trimmed === 'ksa') return 'sa';
  if (trimmed === 'uae' || trimmed === 'emirates') return 'ae';
  if (trimmed === 'usa' || trimmed === 'united states') return 'us';
  if (trimmed === 'uk' || trimmed === 'britain') return 'gb';

  return null;
}

/**
 * Returns a high-definition image URL for the team's country flag.
 * Supports:
 * 1. 2-letter ISO country code (e.g., 'sa', 'in', 'pk', 'np') -> FlagCDN 80px width crisp PNG
 *    Special handling for Nepal ('np') and non-quadrilateral flags to prevent cropping.
 * 2. Custom image URL (http:// or https://)
 * 3. Base64 data URL (data:image/...)
 */
export function getTeamFlagUrl(flagValue?: string | null): string | null {
  if (!flagValue) return null;
  const trimmed = flagValue.trim();
  if (!trimmed) return null;

  // Custom uploaded image or direct external URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }

  // Normalize code from 2-letter code, emoji, or name
  const normCode = normalizeCountryCode(trimmed);
  const code = normCode || trimmed.toLowerCase();

  // Special handling for Nepal:
  // Nepal has a unique non-quadrilateral double-pennant shape (80x98).
  // Standard CSS object-cover in a 3:2 card cuts off the top moon and bottom sun.
  // Using the official 3:2 framed vector flag ensures the complete double-triangle
  // pennant with crescent moon and 12-pointed sun displays beautifully and completely!
  if (code === 'np') {
    return 'https://purecatamphetamine.github.io/country-flag-icons/3x2/NP.svg';
  }

  if (code.length === 2 && /^[a-z]{2}$/.test(code)) {
    // High-fidelity vector SVG for infinite resolution and zero pixelation
    return `https://purecatamphetamine.github.io/country-flag-icons/3x2/${code.toUpperCase()}.svg`;
  }

  return null;
}

/**
 * Provides a secondary CDN fallback URL if the primary flag URL fails or is blocked.
 */
export function getTeamFlagFallbackUrl(flagValue?: string | null): string | null {
  if (!flagValue) return null;
  const trimmed = flagValue.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/')
  ) {
    return null;
  }

  const normCode = normalizeCountryCode(trimmed);
  const code = normCode || trimmed.toLowerCase();

  if (code === 'np') {
    return 'https://flagcdn.com/w160/np.png';
  }
  if (code.length === 2 && /^[a-z]{2}$/.test(code)) {
    // High-definition 160px crisp PNG fallback
    return `https://flagcdn.com/w160/${code}.png`;
  }
  return null;
}

/**
 * Resolves country display name from flag value or code.
 */
export function getCountryName(flagValue?: string | null): string {
  if (!flagValue) return '';
  const trimmed = flagValue.trim();
  const normCode = normalizeCountryCode(trimmed);
  if (normCode) {
    const match = POPULAR_COUNTRIES.find((c) => c.code === normCode);
    if (match) return match.name;
  }
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return 'Custom Flag';
  return trimmed.toUpperCase();
}

/**
 * Resolves country emoji if available.
 */
export function getCountryEmoji(flagValue?: string | null): string {
  if (!flagValue) return '';
  const trimmed = flagValue.trim();
  const normCode = normalizeCountryCode(trimmed);
  if (normCode) {
    const match = POPULAR_COUNTRIES.find((c) => c.code === normCode);
    if (match) return match.emoji;
  }
  if (trimmed.length <= 4 && /\p{Extended_Pictographic}/u.test(trimmed)) {
    return trimmed;
  }
  return '🏳️';
}

/**
 * Universally resolves the flag value for any team from config.teamFlags,
 * with intelligent fallback to country tags in the team's display name.
 */
export function resolveTeamFlagValue(
  teamId?: number | string | null,
  teamFlags?: Record<number | string, string>,
  teamName?: string | null
): string | null {
  if (teamId !== undefined && teamId !== null && teamFlags) {
    const directVal = teamFlags[teamId] || teamFlags[String(teamId)];
    if (directVal && typeof directVal === 'string' && directVal.trim()) {
      return directVal.trim();
    }
  }

  // Fallback: check if team name has a bracketed country code like [SA], [PK], (IN)
  if (teamName && typeof teamName === 'string') {
    const bracketMatch = teamName.match(/\[([A-Za-z]{2,3})\]|\(([A-Za-z]{2,3})\)/);
    if (bracketMatch) {
      const codeCandidate = bracketMatch[1] || bracketMatch[2];
      const normalized = normalizeCountryCode(codeCandidate);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

