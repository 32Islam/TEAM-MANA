import { AutoBackupItem, PlayerRawInfo, SavedMatch, TournamentConfig } from '../types/pubg';
import { DEFAULT_CONFIG, calculateTournamentStandings } from './pubgCalculations';

const STORAGE_KEYS = {
  CONFIG: 'pubg_tournament_config_v1',
  MATCHES: 'pubg_tournament_matches_v1',
  LAST_SNAPSHOT: 'pubg_tournament_last_snapshot_v1',
  AUTO_BACKUPS: 'pubg_tournament_auto_backups_v1',
  LAST_MANUAL_EXPORT: 'pubg_tournament_last_manual_export_v1',
  LAST_AUTO_BACKUP_TIME: 'pubg_tournament_last_auto_backup_time_v1',
  BACKUP_REMINDER_SNOOZE: 'pubg_tournament_backup_reminder_snooze_v1',
};

/**
 * Frees up browser local storage space by purging temporary caches and trimming legacy backups
 */
export function freeStorageSpace() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_SNAPSHOT);
  } catch {}
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTO_BACKUPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Keep at most 2 backups and strip heavy player snapshots
        const trimmed = parsed.slice(0, 2).map((item: any) => ({
          ...item,
          matches: (item.matches || []).map((m: any) => ({
            ...m,
            playerSnapshots: [],
          })),
        }));
        localStorage.setItem(STORAGE_KEYS.AUTO_BACKUPS, JSON.stringify(trimmed));
      }
    }
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTO_BACKUPS);
    } catch {}
  }
}

// Proactive startup cleanup to rescue users whose localStorage has legacy bloated backups
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    const rawBackups = localStorage.getItem(STORAGE_KEYS.AUTO_BACKUPS);
    if (rawBackups && (rawBackups.length > 80000 || rawBackups.includes('data:image'))) {
      freeStorageSpace();
    }
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTO_BACKUPS);
    } catch {}
  }
}

export function loadTournamentConfig(): TournamentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Auto-migrate old default tournament names and add logoUrl if missing
      if (!parsed.name || parsed.name === 'PUBG ESPORTS CHAMPIONSHIP') {
        parsed.name = DEFAULT_CONFIG.name;
      }
      if (!parsed.logoUrl) {
        parsed.logoUrl = DEFAULT_CONFIG.logoUrl;
      }
      if (parsed.hideBetweenGamesLogo === undefined) {
        parsed.hideBetweenGamesLogo = true;
      }
      if (
        !parsed.apiUrl ||
        parsed.apiUrl.includes('127.0.0.1') ||
        parsed.apiUrl.includes('localhost') ||
        parsed.apiUrl.includes('your-tunnel') ||
        parsed.apiUrl.includes('throwing-trapezoid') ||
        parsed.apiUrl.includes('api.yousery.tech')
      ) {
        parsed.apiUrl = DEFAULT_CONFIG.apiUrl;
      }
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load tournament config from localStorage', e);
  }
  return DEFAULT_CONFIG;
}

let sharedBroadcastChannel: BroadcastChannel | null = null;

export function getTournamentBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!sharedBroadcastChannel) {
    try {
      sharedBroadcastChannel = new BroadcastChannel('pubg_tournament_channel');
    } catch {
      sharedBroadcastChannel = null;
    }
  }
  return sharedBroadcastChannel;
}

export function notifyConfigUpdated(config: TournamentConfig) {
  // 1. Send via persistent BroadcastChannel for other tabs / windows
  const bc = getTournamentBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage({ type: 'CONFIG_UPDATED', config, timestamp: Date.now() });
    } catch (err) {
      console.warn('BroadcastChannel postMessage failed:', err);
    }
  }

  // 2. Dispatch immediate CustomEvent for the current window components
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('pubg_config_changed', { detail: config }));
    } catch {}
  }
}

export function notifyMatchesUpdated(matches: SavedMatch[]) {
  const bc = getTournamentBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage({ type: 'MATCHES_UPDATED', matches, timestamp: Date.now() });
    } catch (err) {
      console.warn('BroadcastChannel postMessage matches failed:', err);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('pubg_matches_changed', { detail: matches }));
    } catch {}
  }
}

function persistStateToTurso(config: TournamentConfig, matches: SavedMatch[]) {
  if (typeof window === 'undefined') return;

  try {
    fetch('/api/tournament/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        savedMatches: matches,
        lastUpdated: Date.now(),
      }),
    }).catch((err) => {
      console.warn('[Turso] Background persistence failed:', err);
    });
  } catch (err) {
    console.warn('[Turso] Could not start background persistence:', err);
  }
}

export function saveTournamentConfig(config: TournamentConfig) {
  try {
    const serialized = JSON.stringify(config);

    // localStorage is only a small client-side cache.
    // Large tournament data should be persisted through Turso.
    const MAX_LOCAL_CONFIG_SIZE = 500_000; // ~500 KB

    if (serialized.length <= MAX_LOCAL_CONFIG_SIZE) {
      localStorage.setItem(
        STORAGE_KEYS.CONFIG,
        serialized
      );
    } else {
      console.warn(
        `[Storage] Tournament config is too large for localStorage (${Math.round(
          serialized.length / 1024
        )} KB). Skipping localStorage cache.`
      );

      // Remove any old oversized cached config.
      try {
        localStorage.removeItem(STORAGE_KEYS.CONFIG);
      } catch {}
    }
  } catch (e) {
    console.warn(
      'Failed to save tournament config to localStorage',
      e
    );
  }

  // Keep the existing in-app notification behavior.
  notifyConfigUpdated(config);

  // IMPORTANT:
  // Do NOT persist to Turso here.
  // Server persistence is handled centrally by App.tsx.
}

export function loadSavedMatches(): SavedMatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MATCHES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to load matches from localStorage', e);
  }
  return [];
}

export function saveMatches(matches: SavedMatch[]) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.MATCHES,
      JSON.stringify(matches)
    );
  } catch (e: any) {
    if (
      e?.name === 'QuotaExceededError' ||
      (e?.message &&
        String(e.message).toLowerCase().includes('quota'))
    ) {
      freeStorageSpace();

      try {
        localStorage.setItem(
          STORAGE_KEYS.MATCHES,
          JSON.stringify(matches)
        );
      } catch (retryErr) {
        console.warn(
          'Could not save matches due to browser storage limits',
          retryErr
        );
      }
    } else {
      console.warn(
        'Failed to save matches to localStorage',
        e
      );
    }
  }

  notifyMatchesUpdated(matches);
}

export function clearAllMatches() {
  const emptyMatches: SavedMatch[] = [];

  try {
    // 1. Clear localStorage
    localStorage.setItem(
      STORAGE_KEYS.MATCHES,
      JSON.stringify(emptyMatches)
    );

    // 2. Notify the app immediately
    notifyMatchesUpdated(emptyMatches);

    // 3. Notify other browser tabs/windows
    const bc = getTournamentBroadcastChannel();

    if (bc) {
      try {
        bc.postMessage({
          type: 'MATCHES_RESET',
          timestamp: Date.now(),
        });
      } catch {}
    }

    // 4. Notify listeners in this window
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('pubg_matches_changed', {
            detail: emptyMatches,
          })
        );
      } catch {}
    }

    // 5. Persist the EMPTY state to the server/Turso
    fetch('/api/tournament/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: loadTournamentConfig(),
        savedMatches: emptyMatches,
        lastUpdated: Date.now(),
      }),
    }).catch((err) => {
      console.warn(
        '[Turso] Failed to persist cleared matches:',
        err
      );
    });

  } catch (e) {
    console.warn('Failed to clear matches', e);
  }
}

export function loadLastSnapshot(): PlayerRawInfo[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_SNAPSHOT);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to load last snapshot', e);
  }
  return null;
}

export function saveLastSnapshot(snapshot: PlayerRawInfo[]) {
  try {
    const json = JSON.stringify(snapshot);
    // Keep snapshot bounded to avoid filling quota
    if (json.length < 50000) {
      localStorage.setItem(STORAGE_KEYS.LAST_SNAPSHOT, json);
    }
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEYS.LAST_SNAPSHOT);
    } catch {}
  }
}

export function clearLastSnapshot() {
  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_SNAPSHOT);
  } catch (e) {
    console.warn('Failed to clear last snapshot', e);
  }
}

export function exportTournamentBackupJson(config: TournamentConfig, matches: SavedMatch[]) {
  recordManualExportTimestamp();
  const exportPayload = {
    app: 'PUBG Spectator Tournament System',
    exportedAt: new Date().toISOString(),
    config,
    matches,
  };
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportPayload, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `pubg_tournament_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportSingleMatchJson(match: SavedMatch) {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(match, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `pubg_match_${match.matchNumber}_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Escapes a field for standard CSV compliance (RFC 4180)
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts tournament cumulative standings into a downloadable CSV file for external reporting
 */
export function exportStandingsCsv(config: TournamentConfig, matches: SavedMatch[]) {
  recordManualExportTimestamp();
  const { teamStandings, playerStandings } = calculateTournamentStandings(matches, config);

  const lines: string[] = [];

  // Metadata Header
  lines.push(`Tournament,${escapeCsv(config.name)}`);
  lines.push(`Date Exported,${escapeCsv(new Date().toLocaleString())}`);
  lines.push(`Games Played,${matches.length}`);
  lines.push(`Total Planned Games,${config.totalMatches || 5}`);
  lines.push(`Mode,${escapeCsv(config.mode)}`);
  lines.push('');

  // Section 1: Team Standings
  lines.push('=== TOURNAMENT TEAM STANDINGS ===');
  lines.push([
    'Rank',
    'Team ID',
    'Team Name',
    'WWCD (Chicken Dinners)',
    'Matches Played',
    'Total Kills',
    'Placement Points',
    'Kill Points',
    'Score Adjustments',
    'Total Points',
    'Roster',
  ].map(escapeCsv).join(','));

  teamStandings.forEach((team, idx) => {
    const rank = idx + 1;
    const rosterNames = team.roster.map((r) => r.playerName).join('; ');
    lines.push([
      rank,
      team.teamId,
      team.teamName,
      team.wins || 0,
      team.matchesPlayed,
      team.totalKills,
      team.totalPlacementPoints,
      team.totalKillPoints,
      team.totalPenaltyPoints || 0,
      team.totalPoints,
      rosterNames,
    ].map(escapeCsv).join(','));
  });

  lines.push('');

  // Section 2: Player Rankings (Top Fraggers)
  if (playerStandings.length > 0) {
    lines.push('=== INDIVIDUAL PLAYER STATS ===');
    lines.push([
      'Rank',
      'Player Name',
      'Team Name',
      'Matches Played',
      'Total Kills',
      'Total Damage',
      'Avg Kills',
      'Avg Damage',
    ].map(escapeCsv).join(','));

    playerStandings.forEach((player, idx) => {
      const rank = idx + 1;
      lines.push([
        rank,
        player.playerName,
        player.teamName,
        player.matchesPlayed,
        player.totalKills,
        player.totalDamage,
        player.avgKills ?? 0,
        player.avgDamage ?? 0,
      ].map(escapeCsv).join(','));
    });
  }

  const csvContent = lines.join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanName = (config.name || 'PUBG_Tournament')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();

  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute('download', `${cleanName}_standings_${Date.now()}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Records the timestamp of when a manual file export was triggered
 */
export function recordManualExportTimestamp(): number {
  const now = Date.now();
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_MANUAL_EXPORT, now.toString());
    // Clear snooze because user completed an export
    localStorage.removeItem(STORAGE_KEYS.BACKUP_REMINDER_SNOOZE);
  } catch (e) {
    console.error('Failed to record manual export timestamp', e);
  }
  return now;
}

export function getLastManualExportTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_MANUAL_EXPORT);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (!isNaN(ts)) return ts;
    }
  } catch (e) {
    console.error('Failed to get last manual export timestamp', e);
  }
  return null;
}

export const getLastExportTimestamp = getLastManualExportTimestamp;

export function getLastAutoBackupTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_AUTO_BACKUP_TIME);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (!isNaN(ts)) return ts;
    }
  } catch (e) {
    console.error('Failed to get last auto backup timestamp', e);
  }
  return null;
}

/**
 * Sanitizes config and matches for auto backups to prevent exceeding browser localStorage quota
 */
function sanitizeBackupPayload(config: TournamentConfig, matches: SavedMatch[]): {
  sanitizedConfig: TournamentConfig;
  sanitizedMatches: SavedMatch[];
} {
  // Strip large media assets from backup config (they are already safely stored in pubg_tournament_config_v1)
  const sanitizedConfig = { ...config };
  delete sanitizedConfig.teamSquadPics;
  delete sanitizedConfig.logoUrl;

  // Strip huge raw telemetry payloads from playerSnapshots, keeping teamScores and rank data intact
  const sanitizedMatches = matches.map((m) => {
    const clone: SavedMatch = {
      ...m,
      playerSnapshots: [], // Omit bulky raw telemetry to keep rolling backups under 20KB total
    };
    return clone;
  });

  return { sanitizedConfig, sanitizedMatches };
}

/**
 * Loads all automatic rolling backups stored in browser local storage
 */
export function loadAutoBackups(): AutoBackupItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTO_BACKUPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load auto backups', e);
  }
  return [];
}

/**
 * Creates an automatic snapshot backup of tournament data with quota protection
 */
export function createAutoBackup(
  config: TournamentConfig,
  matches: SavedMatch[],
  trigger: 'interval_10min' | 'game_saved' | 'daily' | 'manual' = 'interval_10min'
): AutoBackupItem | null {
  try {
    const now = Date.now();
    const { sanitizedConfig, sanitizedMatches } = sanitizeBackupPayload(config, matches);

    const backupItem: AutoBackupItem = {
      id: `backup_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      dateStr: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      trigger,
      matchCount: sanitizedMatches.length,
      config: sanitizedConfig,
      matches: sanitizedMatches,
    };

    const existing = loadAutoBackups();
    // Keep at most 2 rolling auto-backups with sanitized payload
    const cleanedExisting = existing.slice(0, 1).map((b) => ({
      ...b,
      config: b.config ? sanitizeBackupPayload(b.config, []).sanitizedConfig : b.config,
      matches: (b.matches || []).map((m) => ({ ...m, playerSnapshots: [] })),
    }));

    let updated = [backupItem, ...cleanedExisting];

    // Progressive quota-aware save loop
    let saved = false;
    while (!saved && updated.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEYS.AUTO_BACKUPS, JSON.stringify(updated));
        saved = true;
      } catch (err: any) {
        // Free space from temporary snapshot cache if present
        try {
          localStorage.removeItem(STORAGE_KEYS.LAST_SNAPSHOT);
        } catch {}

        if (updated.length > 1) {
          // Keep only the single latest backup
          updated = [backupItem];
        } else {
          try {
            console.warn('[AutoBackup] LocalStorage constrained, cleared legacy auto-backups.');
            localStorage.removeItem(STORAGE_KEYS.AUTO_BACKUPS);
          } catch {}
          break;
        }
      }
    }

    if (saved) {
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_AUTO_BACKUP_TIME, now.toString());
      } catch {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pubg_auto_backup_saved', { detail: { backup: backupItem } })
        );
      }
    }

    return backupItem;
  } catch (e) {
    console.warn('Auto backup skipped safely due to storage limits', e);
    return null;
  }
}

export function deleteAutoBackup(backupId: string) {
  try {
    const existing = loadAutoBackups();
    const filtered = existing.filter((b) => b.id !== backupId);
    localStorage.setItem(STORAGE_KEYS.AUTO_BACKUPS, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to delete auto backup', e);
  }
}

export function clearAutoBackups() {
  try {
    localStorage.removeItem(STORAGE_KEYS.AUTO_BACKUPS);
  } catch (e) {
    console.warn('Failed to clear auto backups', e);
  }
}

/**
 * Snoozes the data protection export reminder popup
 */
export function snoozeBackupReminder(hours: number = 1) {
  try {
    const snoozeUntil = Date.now() + hours * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEYS.BACKUP_REMINDER_SNOOZE, snoozeUntil.toString());
  } catch (e) {
    console.warn('Failed to snooze backup reminder', e);
  }
}

/**
 * Checks whether the user should be prompted to download an external JSON backup
 */
export function shouldShowBackupReminder(
  savedMatchesCount: number,
  reminderHours: number = 2
): boolean {
  if (savedMatchesCount === 0) return false;

  try {
    const snooze = localStorage.getItem(STORAGE_KEYS.BACKUP_REMINDER_SNOOZE);
    if (snooze) {
      const snoozeTs = parseInt(snooze, 10);
      if (!isNaN(snoozeTs) && Date.now() < snoozeTs) {
        return false;
      }
    }

    const lastExport = getLastManualExportTimestamp();
    // If never exported and matches exist, or last export is older than reminderHours (e.g. 2 hours)
    if (!lastExport) {
      return true;
    }

    const diffHours = (Date.now() - lastExport) / (1000 * 60 * 60);
    return diffHours >= reminderHours;
  } catch {
    return false;
  }
}

export type ObsOverlayTarget =
  | 'overlay'
  | 'narrow'
  | 'wide'
  | 'top4'
  | 'teamstats'
  | 'teamstats_popup'
  | 'elimination'
  | 'mvp'
  | 'all';

export interface ObsTestTriggerPayload {
  type: 'OBS_TEST_TRIGGER';
  targetOverlay: ObsOverlayTarget;
  durationSeconds: number; // e.g. 20
  teamId?: number;
  placement?: number;
  timestamp: number;
  useDemoData?: boolean;
}

/**
 * Sends a targeted test signal to a specific OBS overlay.
 * Only the specified overlay receives and activates this test, preventing unwanted cross-overlay triggering.
 */
export function triggerObsOverlayTest(
  targetOverlay: ObsOverlayTarget,
  durationSeconds: number = 20,
  extra?: { teamId?: number; placement?: number; useDemoData?: boolean }
) {
  const payload: ObsTestTriggerPayload = {
    type: 'OBS_TEST_TRIGGER',
    targetOverlay,
    durationSeconds: durationSeconds > 0 ? durationSeconds : 20,
    teamId: extra?.teamId,
    placement: extra?.placement,
    timestamp: Date.now(),
    useDemoData: extra?.useDemoData ?? true,
  };

  try {
    localStorage.setItem(`pubg_test_trigger_${targetOverlay}`, JSON.stringify(payload));
    localStorage.setItem('pubg_last_obs_test_trigger', JSON.stringify(payload));
    if (targetOverlay === 'elimination') {
      localStorage.setItem('pubg_test_elim_trigger', JSON.stringify({
        teamId: extra?.teamId || 1,
        teamName: 'TWISTED MINDS',
        placement: 9,
        kills: 6,
        damage: 1340,
        timestamp: Date.now(),
      }));
    }
  } catch {}

  const bc = getTournamentBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage(payload);
    } catch {}
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('OBS_TEST_TRIGGER', { detail: payload }));
    } catch {}

    // Send HTTP POST to server to broadcast via SSE to all OBS browser sources
    try {
      fetch('/api/tournament/obs-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {}
  }
}

/**
 * Universal subscriber for OBS overlays that reliably receives test trigger signals
 * across intra-window CustomEvents, BroadcastChannel, cross-tab LocalStorage storage events,
 * and Server-Sent Events (SSE) from the server.
 */
export function subscribeToObsTestTrigger(
  targetOverlay: ObsOverlayTarget | 'all',
  onTrigger: (payload: ObsTestTriggerPayload) => void
): () => void {
  const overlayGroupMap: Record<string, string[]> = {
    overlay: ['overlay', 'narrow', 'ingame', 'side'],
    narrow: ['overlay', 'narrow', 'ingame', 'side'],
    top4: ['top4', 'latest4', 'top4hud'],
    wide: ['wide', 'stage', 'between_games', 'between-games', 'fullscreen'],
    stage: ['wide', 'stage', 'between_games', 'between-games', 'fullscreen'],
    teamstats: ['teamstats', 'teamstats_popup', 'teamstats_small', 'team_stats', 'squadstats'],
    teamstats_popup: ['teamstats', 'teamstats_popup', 'teamstats_small', 'team_stats', 'squadstats'],
    elimination: ['elimination', 'elim', 'eliminated', 'killalert'],
    mvp: ['mvp', 'match_mvp', 'tournament_mvp'],
  };

  const isMatch = (payload: any): boolean => {
    if (!payload || payload.type !== 'OBS_TEST_TRIGGER') return false;
    if (targetOverlay === 'all' || payload.targetOverlay === 'all') return true;
    if (payload.targetOverlay === targetOverlay) return true;

    const group = overlayGroupMap[targetOverlay];
    if (group && group.includes(payload.targetOverlay)) {
      return true;
    }
    const reverseGroup = overlayGroupMap[payload.targetOverlay];
    if (reverseGroup && reverseGroup.includes(targetOverlay)) {
      return true;
    }
    return false;
  };

  const handleMessage = (data: any) => {
    if (isMatch(data)) {
      onTrigger(data);
    }
  };

  // 1. Intra-window CustomEvent
  const handleCustomEvent = (e: any) => {
    handleMessage(e?.detail);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('OBS_TEST_TRIGGER' as any, handleCustomEvent);
  }

  // 2. BroadcastChannel
  const bc = getTournamentBroadcastChannel();
  const handleBcMessage = (event: MessageEvent) => {
    handleMessage(event.data);
  };
  if (bc) {
    bc.addEventListener('message', handleBcMessage);
  }

  // 3. Cross-tab LocalStorage storage event (OBS CEF / separate tabs)
  const handleStorage = (e: StorageEvent) => {
    if (
      e.key &&
      (e.key === 'pubg_last_obs_test_trigger' ||
        e.key.startsWith('pubg_test_trigger_') ||
        e.key === `pubg_test_trigger_${targetOverlay}` ||
        e.key === 'pubg_test_trigger_all')
    ) {
      if (e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleMessage(parsed);
        } catch {}
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  // 4. Server-Sent Events (SSE)
  let es: EventSource | null = null;
  try {
    if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
      es = new EventSource('/api/tournament/events');
      es.onmessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          handleMessage(parsed);
        } catch {}
      };
    }
  } catch {}

  // 5. Initial active check on mount
  try {
    const raw =
      localStorage.getItem(`pubg_test_trigger_${targetOverlay}`) ||
      localStorage.getItem('pubg_last_obs_test_trigger');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        isMatch(parsed) &&
        parsed.timestamp &&
        Date.now() - parsed.timestamp < (parsed.durationSeconds || 20) * 1000
      ) {
        onTrigger(parsed);
      }
    }
  } catch {}

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('OBS_TEST_TRIGGER' as any, handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    }
    if (bc) {
      bc.removeEventListener('message', handleBcMessage);
    }
    if (es) {
      es.close();
    }
  };
}


