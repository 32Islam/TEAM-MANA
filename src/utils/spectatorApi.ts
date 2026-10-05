import { PubgApiResponse, PlayerRawInfo } from '../types/pubg';

export interface SpectatorFetchResult {
  success: boolean;
  data: PlayerRawInfo[];
  rawResponse?: PubgApiResponse | Record<string, unknown>;
  latencyMs: number;
  via: 'direct' | 'proxy';
  error?: string;
  statusCode?: number;
  urlUsed: string;
  isIdleOrEmpty: boolean; // true when server returns {} or empty list (no game alive)
}

export const DEFAULT_API_URL = 'https://main.yousery.tech/gettotalplayerlist';

/**
 * Normalizes an API URL entered by user:
 * - Defaults to https://main.yousery.tech/gettotalplayerlist
 * - Prepend https:// if protocol missing
 * - Appends /gettotalplayerlist if no path or only root slash
 * - Adds ngrok-skip-browser-warning query param for ngrok hosts
 */
export function normalizeApiUrl(inputUrl?: string): string {
  let url = (inputUrl || '').trim();
  if (
    !url ||
    url.includes('127.0.0.1') ||
    url.includes('localhost') ||
    url.includes('throwing-trapezoid') ||
    url.includes('api.yousery.tech')
  ) {
    return DEFAULT_API_URL;
  }

  // Prepend protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);

    // If pathname is empty or just '/', default to /gettotalplayerlist
    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = '/gettotalplayerlist';
    }

    // If it is an ngrok URL, ensure ngrok-skip-browser-warning parameter is present
    if (parsed.hostname.includes('ngrok')) {
      parsed.searchParams.set('ngrok-skip-browser-warning', 'true');
    }

    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Robust fetch for PUBG Spectator API:
 * 1. For remote/ngrok URLs from a browser or OBS, routes via /api/proxy-spectator
 *    to completely bypass browser CORS barriers & ngrok interstitials.
 * 2. Directly attempts endpoint with fallbacks if proxy unavailable.
 */
export async function fetchSpectatorApi(
  targetUrl?: string,
  timeoutMs = 4000
): Promise<SpectatorFetchResult> {
  const normalized = normalizeApiUrl(targetUrl);
  const startTime = performance.now();

  // Helper to validate and extract player list
  const extractPlayerList = (json: unknown): { list: PlayerRawInfo[]; isIdle: boolean } | null => {
    if (!json || typeof json !== 'object') return null;
    if (Array.isArray(json)) {
      return { list: json as PlayerRawInfo[], isIdle: json.length === 0 };
    }
    const obj = json as Record<string, unknown>;
    const possibleArrayKeys = [
      'playerInfoList',
      'PlayerInfoList',
      'totalPlayerList',
      'TotalPlayerList',
      'playerList',
      'PlayerList',
      'players',
      'data',
    ];
    for (const key of possibleArrayKeys) {
      if (Array.isArray(obj[key])) {
        return { list: obj[key] as PlayerRawInfo[], isIdle: (obj[key] as PlayerRawInfo[]).length === 0 };
      }
    }
    // Also check if any key in obj is an array of objects
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        return { list: obj[key] as PlayerRawInfo[], isIdle: (obj[key] as unknown[]).length === 0 };
      }
    }
    // When spectator tool is connected but in lobby, between matches, or finished, it responds with {}
    if (typeof json === 'object') {
      return { list: [], isIdle: true };
    }
    return null;
  };

  // When in browser/OBS environment and fetching an ngrok or remote URL,
  // prefer proxy first because ngrok tunnels lack CORS headers (causing browser fetch rejection).
  const isNgrokOrRemote = normalized.includes('ngrok') || !normalized.includes('127.0.0.1');

  if (isNgrokOrRemote && typeof window !== 'undefined') {
    try {
      const proxyUrl = `/api/proxy-spectator?url=${encodeURIComponent(normalized)}`;
      const proxyController = new AbortController();
      const proxyTimeoutId = setTimeout(() => proxyController.abort(), timeoutMs);

      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: proxyController.signal,
      });

      clearTimeout(proxyTimeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (proxyResponse.ok) {
        const proxyJson = await proxyResponse.json();
        const extracted = extractPlayerList(proxyJson);
        if (extracted !== null) {
          return {
            success: true,
            data: extracted.list,
            rawResponse: proxyJson as PubgApiResponse,
            latencyMs,
            via: 'proxy',
            statusCode: proxyResponse.status,
            urlUsed: normalized,
            isIdleOrEmpty: extracted.isIdle,
          };
        }
      }
    } catch {
      // Fallback to direct attempt below
    }
  }

  // Direct Fetch Attempt (or fallback)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };

    const response = await fetch(normalized, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${response.statusText || 'Error'})`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Server returned HTML warning page instead of JSON');
    }

    const json = await response.json();
    const extracted = extractPlayerList(json);

    if (extracted !== null) {
      return {
        success: true,
        data: extracted.list,
        rawResponse: json as PubgApiResponse,
        latencyMs,
        via: 'direct',
        statusCode: response.status,
        urlUsed: normalized,
        isIdleOrEmpty: extracted.isIdle,
      };
    } else {
      throw new Error('Server returned non-object response format');
    }
  } catch (directErr: unknown) {
    const directErrorMessage = directErr instanceof Error ? directErr.message : String(directErr);
    // If not tried proxy yet, try proxy fallback
    try {
      const proxyStartTime = performance.now();
      const proxyUrl = `/api/proxy-spectator?url=${encodeURIComponent(normalized)}`;

      const proxyController = new AbortController();
      const proxyTimeoutId = setTimeout(() => proxyController.abort(), timeoutMs);

      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: proxyController.signal,
      });

      clearTimeout(proxyTimeoutId);
      const proxyLatencyMs = Math.round(performance.now() - proxyStartTime);

      if (proxyResponse.ok) {
        const proxyJson = await proxyResponse.json();
        const extracted = extractPlayerList(proxyJson);
        if (extracted !== null) {
          return {
            success: true,
            data: extracted.list,
            rawResponse: proxyJson as PubgApiResponse,
            latencyMs: proxyLatencyMs,
            via: 'proxy',
            statusCode: proxyResponse.status,
            urlUsed: normalized,
            isIdleOrEmpty: extracted.isIdle,
          };
        }
      }
    } catch {
      // Ignored
    }

    const totalLatency = Math.round(performance.now() - startTime);
    return {
      success: false,
      data: [],
      latencyMs: totalLatency,
      via: 'direct',
      error: `Could not reach spectator stream: ${directErrorMessage}`,
      urlUsed: normalized,
      isIdleOrEmpty: true,
    };
  }
}
