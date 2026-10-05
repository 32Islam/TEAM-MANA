import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { AdminPanel } from './components/AdminPanel';
import { StreamLeaderboard } from './components/StreamLeaderboard';
import { PublicLeaderboard } from './components/PublicLeaderboard';
import { SettingsModal } from './components/SettingsModal';
import { SaveMatchPromptModal, PendingMatchSaveInfo, SaveMatchOptions } from './components/SaveMatchPromptModal';
import { AdminSessionLockShield } from './components/AdminSessionLockShield';
import { useAdminSessionLock } from './utils/adminSessionLock';
import { AdminPasswordGate } from './components/AdminPasswordGate';
import { useAdminAuth } from './utils/adminAuth';
import { UploadGameModal } from './components/UploadGameModal';
import { BackupReminderModal } from './components/BackupReminderModal';
import { AutoBackupHistoryModal } from './components/AutoBackupHistoryModal';
import {
  PlayerRawInfo,
  SavedMatch,
  TournamentConfig,
} from './types/pubg';
import {
  calculateMatchTeamScores,
  calculateTournamentStandings,
  validateMatchFullness,
  findDuplicateMatch,
  getMatchFingerprint,
  DEFAULT_CONFIG,
} from './utils/pubgCalculations';
import {
  loadSavedMatches,
  loadTournamentConfig,
  saveMatches,
  clearAllMatches,
  saveTournamentConfig,
  saveLastSnapshot,
  clearLastSnapshot,
  loadLastSnapshot,
  exportTournamentBackupJson,
  exportStandingsCsv,
  createAutoBackup,
  shouldShowBackupReminder,
  getLastExportTimestamp,
  getLastAutoBackupTimestamp,
} from './utils/storage';
import { fetchSpectatorApi, normalizeApiUrl, SpectatorFetchResult } from './utils/spectatorApi';
import { copyToClipboard } from './utils/clipboard';
import { getDriveAccessToken, uploadTournamentBackupToDrive } from './utils/googleDrive';

export default function App() {
  // Track fingerprint of saved matches to strictly avoid duplicate ingestion from API
  const lastSavedFingerprintRef = useRef<string>('');

  // Read query params and path for routing and OBS mode
  const queryParams = new URLSearchParams(window.location.search);
  const queryView = queryParams.get('view');
  const queryLayout = queryParams.get('layout') || queryParams.get('mode');
  const isObsParam =
    queryView === 'obs' ||
    queryView === 'top4' ||
    queryView === 'stage' ||
    queryView === 'side' ||
    queryView === 'teamstats' ||
    queryLayout === 'teamstats' ||
    queryLayout === 'squadstats' ||
    queryLayout === 'top4' ||
    queryLayout === 'latest4' ||
    queryLayout === 'top4hud' ||
    queryLayout === 'side' ||
    queryLayout === 'narrow' ||
    queryLayout === 'stage' ||
    queryLayout === 'fullscreen' ||
    queryLayout === 'wide' ||
    queryLayout === 'overlay';
  const isTransparentParam =
    queryParams.get('transparent') === '1' ||
    queryParams.get('transparent') === 'true';

  const checkInitialView = (): 'admin' | 'leaderboard' | 'public' => {
    if (typeof window === 'undefined') return 'leaderboard';
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'admin' || path === '/admin' || path.startsWith('/admin')) {
      return 'admin';
    }
    if (params.get('view') === 'public' || path === '/public' || path.startsWith('/public')) {
      return 'public';
    }
    return 'leaderboard';
  };

  const [currentView, setCurrentView] = useState<'admin' | 'leaderboard' | 'public'>(
    checkInitialView()
  );

  const [config, setConfig] = useState<TournamentConfig>(() => loadTournamentConfig());

  const isTransparentActive =
    isTransparentParam ||
    config.obsTheme === 'transparent';

  // Ensure document body & HTML are completely transparent when transparent mode is requested
  useEffect(() => {
    if (isTransparentActive) {
      document.documentElement.classList.add('obs-transparent');
      document.body.classList.add('obs-transparent');
      document.documentElement.style.backgroundColor = 'transparent';
      document.body.style.backgroundColor = 'transparent';
      const rootEl = document.getElementById('root');
      if (rootEl) {
        rootEl.classList.add('obs-transparent');
        rootEl.style.backgroundColor = 'transparent';
      }
    } else {
      document.documentElement.classList.remove('obs-transparent');
      document.body.classList.remove('obs-transparent');
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
      const rootEl = document.getElementById('root');
      if (rootEl) {
        rootEl.classList.remove('obs-transparent');
        rootEl.style.backgroundColor = '';
      }
    }
  }, [isTransparentActive]);

  // Administrator password authentication state
  const adminAuth = useAdminAuth();

  // Single-device admin concurrency lock: ensures only 1 device/tab operates the admin console alive once authenticated
  const isLockEnabled = config.enableSingleAdminLock !== false && currentView === 'admin' && adminAuth.isAuthenticated;
  const adminLock = useAdminSessionLock(isLockEnabled);

  const handleNavigateView = (view: 'admin' | 'leaderboard' | 'public') => {
    if (view !== 'admin') {
      setIsBackupReminderOpen(false);
      if (currentView === 'admin') {
        adminLock.releaseLock();
      }
    }
    setCurrentView(view);
    if (typeof window !== 'undefined' && window.history) {
      const targetPath = view === 'admin' ? '/admin' : view === 'public' ? '/?view=public' : '/';
      window.history.pushState(null, '', targetPath);
    }
  };

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const targetView = checkInitialView();
      if (targetView !== 'admin') {
        setIsBackupReminderOpen(false);
      }
      setCurrentView(targetView);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>(() => loadSavedMatches());
  const [activePlayers, setActivePlayers] = useState<PlayerRawInfo[]>([]);
  const [lastFrozenPlayers, setLastFrozenPlayers] = useState<PlayerRawInfo[] | null>(() => loadLastSnapshot());
  const [isApiConnected, setIsApiConnected] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [isGameFinished, setIsGameFinished] = useState<boolean>(false);

  // Prompt modal state: As requested, ask the admin before saving any game into tournament standings
  const [pendingMatchToSave, setPendingMatchToSave] = useState<PendingMatchSaveInfo | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isBackupReminderOpen, setIsBackupReminderOpen] = useState<boolean>(false);
  const [isAutoBackupVaultOpen, setIsAutoBackupVaultOpen] = useState<boolean>(false);
  const [lastExportTs, setLastExportTs] = useState<number | null>(() => getLastExportTimestamp());
  const [lastAutoBackupTs, setLastAutoBackupTs] = useState<number | null>(() => getLastAutoBackupTimestamp());
  const [previewOverlayLayout, setPreviewOverlayLayout] = useState<
    'main' | 'stage' | 'half' | 'overlay' | 'top4' | 'teamstats' | 'mvp'
  >('main');

  // Keep track of when local admin edits were made so polling doesn't overwrite immediate changes
  const lastLocalEditTimeRef = useRef<number>(0);

  // Sync tournament state with backend server so all remote OBS clients & casters share live games
  const pushStateToServer = useCallback((cfg?: TournamentConfig, matches?: SavedMatch[]) => {
    // If client is in OBS display mode, NEVER push to server to prevent overwriting server state
    if (isObsParam) return;
    const targetConfig = cfg || stateRef.current.config;
    const targetMatches = matches !== undefined ? matches : stateRef.current.savedMatches;
    const now = Date.now();
    lastLocalEditTimeRef.current = now;

    fetch('/api/tournament/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: targetConfig,
        savedMatches: targetMatches,
        lastUpdated: now,
      }),
    }).catch((err) => {
      console.warn('[Sync] Push to server failed:', err);
    });
  }, [isObsParam]);

  // Centralized state updater that persists to localStorage, dispatches BroadcastChannel, and pushes to server
  const updateTournamentState = useCallback((
    updater: {
      config?: TournamentConfig;
      matches?: SavedMatch[];
    },
    broadcast: boolean = true
  ) => {
    let nextConfig = stateRef.current.config;
    let nextMatches = stateRef.current.savedMatches;

    if (updater.config) {
      nextConfig = updater.config;
      setConfig(nextConfig);
      saveTournamentConfig(nextConfig);
    }

    if (updater.matches !== undefined) {
      nextMatches = updater.matches;
      setSavedMatches(nextMatches);
      saveMatches(nextMatches);
    }

    if (broadcast && !isObsParam) {
      pushStateToServer(nextConfig, nextMatches);
    }
  }, [isObsParam, pushStateToServer]);

  // Dedicated sync function with cache-busting query param to ensure OBS never receives stale cached data
  const syncTournamentState = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournament/state?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (!res.ok) return;
      const remote = await res.json();
      if (!remote) return;

      // Skip if local admin made edits within last 1.8 seconds to avoid race conditions
      if (!isObsParam && Date.now() - lastLocalEditTimeRef.current < 1800) {
        return;
      }

      // 1. Sync Saved Matches across all viewers & OBS
      if (Array.isArray(remote.savedMatches)) {
        const localMatches = stateRef.current.savedMatches;
        const localCount = localMatches.length;
        const remoteCount = remote.savedMatches.length;

        if (isObsParam) {
          // OBS is a display canvas: ALWAYS adopt exact server matches
          const localStr = JSON.stringify(localMatches);
          const remoteStr = JSON.stringify(remote.savedMatches);
          if (remoteStr !== localStr) {
            setSavedMatches(remote.savedMatches);
            saveMatches(remote.savedMatches);
          }
        } else {
          // Admin panel:
          if (remoteCount > localCount) {
            // Remote has more matches (e.g. added via upload or remote admin)
            setSavedMatches(remote.savedMatches);
            saveMatches(remote.savedMatches);
          } else if (localCount > remoteCount) {
            // Local admin has more matches (e.g. server restarted or cold container), seed server!
            pushStateToServer(stateRef.current.config, localMatches);
          } else {
            // Equal count: update if contents differ
            const localStr = JSON.stringify(localMatches);
            const remoteStr = JSON.stringify(remote.savedMatches);
            if (remoteStr !== localStr) {
              setSavedMatches(remote.savedMatches);
              saveMatches(remote.savedMatches);
            }
          }
        }
      } else if (!isObsParam && stateRef.current.savedMatches.length > 0) {
        // Seed server with local saved matches if server has no savedMatches array
        pushStateToServer(stateRef.current.config, stateRef.current.savedMatches);
      }

      // 2. Sync Tournament Config
      if (remote.config && typeof remote.config === 'object') {
        const curConfig = stateRef.current.config;
        const merged = { ...curConfig, ...remote.config };
        const curStr = JSON.stringify(curConfig);
        const mergedStr = JSON.stringify(merged);

        if (mergedStr !== curStr) {
  setConfig(merged);
}
      } else if (!isObsParam && !remote.config && stateRef.current.config) {
        pushStateToServer(stateRef.current.config, stateRef.current.savedMatches);
      }
    } catch {
      // Fallback
    }
  }, [isObsParam, pushStateToServer]);

  // Real-time SSE is kept for local Express development. Vercel uses the 2-second
  // database polling fallback below because serverless functions are not a persistent SSE server.
  useEffect(() => {
    const shouldUseSSE = import.meta.env.DEV || import.meta.env.VITE_ENABLE_SSE === 'true';
    if (!shouldUseSSE) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connectSSE = () => {
      if (!isMounted) return;
      try {
        eventSource = new EventSource('/api/tournament/events');

        eventSource.onmessage = (event) => {
          try {
            if (!event.data || event.data.startsWith(':')) return;
            const parsed = JSON.parse(event.data);
            if (!parsed) return;

            const remote = parsed.state || parsed;

            // 1. Sync Saved Matches immediately into React state
            if (Array.isArray(remote.savedMatches)) {
              const currentCount = stateRef.current.savedMatches.length;
              const remoteCount = remote.savedMatches.length;

              if (isObsParam || remoteCount >= currentCount) {
                const localStr = JSON.stringify(stateRef.current.savedMatches);
                const remoteStr = JSON.stringify(remote.savedMatches);
                if (remoteStr !== localStr) {
                  setSavedMatches(remote.savedMatches);
                  saveMatches(remote.savedMatches);
                }
              }
            }

            // 2. Sync Tournament Config immediately into React state
            if (remote.config && typeof remote.config === 'object') {
              const curConfig = stateRef.current.config;
              const merged = { ...curConfig, ...remote.config };
              const curStr = JSON.stringify(curConfig);
              const mergedStr = JSON.stringify(merged);
              if (mergedStr !== curStr) {
                setConfig(merged);
                saveTournamentConfig(merged);
              }
            }
          } catch (err) {
            console.warn('[SSE] Event parse error:', err);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isMounted) {
            reconnectTimeout = setTimeout(connectSSE, 3000);
          }
        };
      } catch (err) {
        console.warn('[SSE] Init failed:', err);
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [isObsParam]);

  // Periodic fallback polling with cache-busting
  useEffect(() => {
    syncTournamentState();
    const interval = setInterval(syncTournamentState, 2000);
    return () => clearInterval(interval);
  }, [syncTournamentState]);

  // Turso is now the authoritative persistent database. Browser localStorage remains a fast local cache.

  // Connection metadata & diagnostics
  const [connectionVia, setConnectionVia] = useState<'direct' | 'proxy'>('direct');
  const [connectionLatency, setConnectionLatency] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cross-tab and OBS sync via BroadcastChannel & storage events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pubg_tournament_matches_v1') {
        setSavedMatches(loadSavedMatches());
      } else if (e.key === 'pubg_tournament_config_v1') {
        setConfig(loadTournamentConfig());
      } else if (e.key === 'pubg_tournament_last_snapshot_v1') {
        setLastFrozenPlayers(loadLastSnapshot());
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Auto-heal and re-score any existing saved matches with updated placement engine
    const rawMatches = loadSavedMatches();
    if (rawMatches.length > 0) {
      let needsHeal = false;
      const healed = rawMatches.map((m) => {
        if (!m.playerSnapshots || m.playerSnapshots.length === 0) return m;
        const recalculated = calculateMatchTeamScores(m.playerSnapshots, config, true);
        const oldScores = m.teamScores || {};
        for (const k of Object.keys(recalculated)) {
          const numK = Number(k);
          if (
            !oldScores[numK] ||
            oldScores[numK].placement !== recalculated[numK].placement ||
            oldScores[numK].rankPoints !== recalculated[numK].rankPoints ||
            oldScores[numK].totalPoints !== recalculated[numK].totalPoints
          ) {
            needsHeal = true;
            break;
          }
        }
        return {
          ...m,
          teamScores: recalculated,
        };
      });

      if (needsHeal) {
        setSavedMatches(healed);
        saveMatches(healed);
      }
    }

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('pubg_tournament_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'MATCHES_UPDATED' || event.data?.type === 'MATCHES_RESET') {
            setSavedMatches(loadSavedMatches());
          } else if (event.data?.type === 'CONFIG_UPDATED') {
            setConfig(loadTournamentConfig());
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error', err);
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (bc) bc.close();
    };
  }, []);

  // Keep ref to avoid stale closure in polling timer
  const stateRef = useRef({
    config,
    isPolling,
    activePlayers,
    lastFrozenPlayers,
    savedMatches,
  });

  useEffect(() => {
    stateRef.current = {
      config,
      isPolling,
      activePlayers,
      lastFrozenPlayers,
      savedMatches,
    };
  }, [config, isPolling, activePlayers, lastFrozenPlayers, savedMatches]);

  // Polling loop for spectator API (e.g. https://main.yousery.tech/gettotalplayerlist)
  const pollSpectatorApi = useCallback(async () => {
    const { config: curConfig, isPolling: curPolling } = stateRef.current;
    if (!curPolling || curConfig.isPaused) return;

    try {
      const result = await fetchSpectatorApi(curConfig.apiUrl, 3500);
      setConnectionLatency(result.latencyMs);
      setConnectionVia(result.via);
      setLastSyncTime(new Date());

      if (result.success && result.data.length > 0) {
        // 1. Check if incoming live match is already saved in savedMatches
        const duplicateMatch = findDuplicateMatch(stateRef.current.savedMatches, result.data);
        if (duplicateMatch) {
          // The API server is currently returning data from a match that was ALREADY saved
          // (e.g. game ended, paused, or spectator waiting on end screen).
          // We DO NOT ingest this into activePlayers, preventing duplicate score and duplicated games!
          setIsApiConnected(true);
          setConnectionError(null);
          return;
        }

        // 2. Fresh live game is in progress!
        const list: PlayerRawInfo[] = result.data;
        setActivePlayers(list);
        setLastFrozenPlayers(list);
        saveLastSnapshot(list);
        setIsApiConnected(true);
        setConnectionError(null);

        // Check if only 1 team left alive (Winner winner chicken dinner)
        const aliveTeams = new Set(
          list.filter((p) => !p.bHasDied && p.health > 0).map((p) => p.teamId)
        );
        const totalTeamsCount = new Set(list.map((p) => p.teamId)).size;
        if (aliveTeams.size === 1 && totalTeamsCount > 1) {
          setIsGameFinished(true);
        } else {
          setIsGameFinished(false);
        }
      } else {
        // Either result.data is empty (server returned {} or 0 players) OR server gave no response / offline
        // In BOTH cases: NO GAMES ARE ALIVE right now!
        if (stateRef.current.activePlayers.length > 0) {
          // A game was active and just completed!
          const finishedSnapshot = stateRef.current.activePlayers;
          const fullness = validateMatchFullness(finishedSnapshot);
          const isDup = findDuplicateMatch(stateRef.current.savedMatches, finishedSnapshot);

          if (fullness.isFull && !isDup) {
            const nextNum = stateRef.current.savedMatches.filter((m) => !m.excludeFromLeaderboard).length + 1;
            const scores = calculateMatchTeamScores(finishedSnapshot, curConfig, true);
            const winner = Object.values(scores).find((s) => s.isWinner || s.placement === 1);

            // User Directive: "dont save file by your self askme every time on admin if i want to save the game"
            setPendingMatchToSave({
              players: finishedSnapshot,
              matchNumber: nextNum,
              reason: 'Game Concluded',
              winnerTeamName: winner?.teamName || `Team ${winner?.teamId || 'Winner'}`,
              totalKills: fullness.totalKills,
              playerCount: fullness.playerCount,
              teamCount: fullness.teamCount,
            });
            showToast(`🔔 Game #${nextNum} concluded! Awaiting admin confirmation to save.`);
          } else if (!fullness.isFull) {
            console.warn(`[PUBG] Completed game was not full: ${fullness.reason}`);
          } else if (isDup) {
            console.log(`[PUBG] Completed game already saved as Game #${isDup.matchNumber}. Duplicate prevented.`);
          }

          setActivePlayers([]);
          setLastFrozenPlayers(null);
          clearLastSnapshot();
          setIsGameFinished(false);
        }

        if (result.success && result.data.length === 0) {
          // Server is responsive and sent {} (idle/lobby/no game alive)
          setIsApiConnected(true);
          setConnectionError(null);
        } else {
          // Server gave no response or offline
          setIsApiConnected(false);
          setConnectionError(result.error || null);
        }
      }
    } catch (err) {
      if (stateRef.current.activePlayers.length > 0) {
        setActivePlayers([]);
        setIsGameFinished(false);
      }
      setIsApiConnected(false);
      setConnectionError(err instanceof Error ? err.message : String(err));
    }
  }, [updateTournamentState]);

  useEffect(() => {
    const interval = setInterval(pollSpectatorApi, config.pollInterval || 1500);
    pollSpectatorApi();
    return () => clearInterval(interval);
  }, [config.pollInterval, pollSpectatorApi]);

  // Unified refresh handler that performs BOTH fresh tournament state sync from server AND live spectator poll
  const handleManualRefresh = useCallback(async () => {
    await Promise.all([
      syncTournamentState(),
      pollSpectatorApi(),
    ]);
  }, [syncTournamentState, pollSpectatorApi]);

  // Quick link updater
  const handleUpdateApiUrl = (newUrl: string) => {
    const normalized = normalizeApiUrl(newUrl);
    const updated = { ...config, apiUrl: normalized };
    updateTournamentState({ config: updated });
    showToast(`Updated data source to ${normalized}`);
    handleTestConnection(normalized);
  };

  // Test link handler
  const handleTestConnection = async (targetUrl?: string): Promise<SpectatorFetchResult> => {
    const target = targetUrl || config.apiUrl;
    const result = await fetchSpectatorApi(target, 4500);
    setConnectionLatency(result.latencyMs);
    setConnectionVia(result.via);

    if (result.success) {
      setIsApiConnected(true);
      setConnectionError(null);
      setLastSyncTime(new Date());
      if (result.data.length > 0) {
        setActivePlayers(result.data);
        setLastFrozenPlayers(result.data);
        saveLastSnapshot(result.data);
        showToast(`🟢 Connected (${result.latencyMs}ms via ${result.via}) - Live Match Active (${result.data.length} players)`);
      } else {
        showToast(`🟢 Connected (${result.latencyMs}ms via ${result.via}) - Server returned {} • No game alive right now. Ready for upcoming game!`);
      }
    } else {
      setIsApiConnected(false);
      setConnectionError(result.error || 'Connection failed');
      showToast(`❌ Connection failed: ${result.error || 'Target unreachable'}`);
    }
    return result;
  };

  // Save current match into tournament record (Validates Fullness & Duplicates, then prompts Admin)
  const handleSaveCurrentMatch = () => {
    const snapshotToSave = activePlayers.length > 0 ? activePlayers : lastFrozenPlayers;
    if (!snapshotToSave || snapshotToSave.length === 0) {
      showToast('⚠️ No player data captured yet. Waiting for live game feed from API.');
      return;
    }

    // 1. Strict Fullness Validation: don't save game if it is not full
    const fullness = validateMatchFullness(snapshotToSave);
    if (!fullness.isFull) {
      showToast(`⚠️ Cannot save: ${fullness.reason}`);
      return;
    }

    // 2. Strict Duplicate Check: make sure there is no duplicate saved
    const duplicate = findDuplicateMatch(savedMatches, snapshotToSave);
    if (duplicate) {
      showToast(`⚠️ Duplicate prevented: This match is already saved as Game #${duplicate.matchNumber}!`);
      // Clear active live players so duplicate points are never displayed
      setActivePlayers([]);
      setLastFrozenPlayers(null);
      clearLastSnapshot();
      setIsGameFinished(false);
      return;
    }

    // 3. User Directive: "dont save file by your self askme every time on admin if i want to save the game"
    const matchNum = savedMatches.filter((m) => !m.excludeFromLeaderboard).length + 1;
    const teamScores = calculateMatchTeamScores(snapshotToSave, config, true);
    const winner = Object.values(teamScores).find((s) => s.isWinner || s.placement === 1);

    setPendingMatchToSave({
      players: snapshotToSave,
      matchNumber: matchNum,
      reason: 'Save Confirmation',
      winnerTeamName: winner?.teamName || `Team ${winner?.teamId || 'Winner'}`,
      totalKills: fullness.totalKills,
      playerCount: fullness.playerCount,
      teamCount: fullness.teamCount,
    });
  };

  // Called when Admin clicks "Yes, Save Game" in prompt modal or banner
  const handleConfirmSavePending = (options?: SaveMatchOptions) => {
    if (!pendingMatchToSave) return;
    const { players } = pendingMatchToSave;

    // Re-verify fullness and duplicates before final commit
    const fullness = validateMatchFullness(players);
    if (!fullness.isFull) {
      showToast(`⚠️ Cannot save: ${fullness.reason}`);
      setPendingMatchToSave(null);
      return;
    }

    const duplicate = findDuplicateMatch(savedMatches, players);
    if (duplicate) {
      showToast(`⚠️ Already saved as Game #${duplicate.matchNumber}! Duplicate prevented.`);
      setPendingMatchToSave(null);
      setActivePlayers([]);
      setLastFrozenPlayers(null);
      clearLastSnapshot();
      setIsGameFinished(false);
      return;
    }

    const matchNum = savedMatches.length + 1;
    const teamScores = calculateMatchTeamScores(players, config, true);

    const isExcluded = Boolean(options?.excludeFromLeaderboard);
    const newMatch: SavedMatch = {
      id: `match_${Date.now()}`,
      matchNumber: matchNum,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      playerSnapshots: JSON.parse(JSON.stringify(players)),
      teamScores,
      excludeFromLeaderboard: isExcluded,
      isExhibition: isExcluded,
      customLabel: options?.customLabel?.trim() || undefined,
    };

    const updated = [...savedMatches, newMatch];
    updateTournamentState({ matches: updated });

    // Automatic Backup between games: save snapshot immediately upon match save
    createAutoBackup(config, updated, 'game_saved');
    setLastAutoBackupTs(Date.now());

    // Google Drive Cloud Auto-Save after each match
    if (config.enableGoogleDriveAutoSave !== false && getDriveAccessToken()) {
      uploadTournamentBackupToDrive(config, updated)
        .then((file) => {
          showToast(`☁️ Auto-saved Match #${matchNum} to Google Drive: ${file.name}`);
        })
        .catch((err) => {
          console.warn('[Google Drive] Auto-backup failed:', err);
        });
    }

    // Store fingerprint to avoid spectator API immediately re-ingesting
    const fingerprint = getMatchFingerprint(players);
    lastSavedFingerprintRef.current = fingerprint;

    // Clear active live players so saved game is never duplicated with live data
    setActivePlayers([]);
    setLastFrozenPlayers(null);
    clearLastSnapshot();
    setIsGameFinished(false);
    setPendingMatchToSave(null);

    if (isExcluded) {
      showToast(`⭐ Game #${matchNum} saved as Special Game (Excluded from Tournament Standings).`);
    } else {
      showToast(`✅ Game #${matchNum} successfully saved! Standings synced to all viewers & OBS.`);
    }
  };

  const handleDiscardPending = () => {
    setPendingMatchToSave(null);
    showToast('Match save discarded.');
  };

  const handleAddUploadedMatches = (newMatches: SavedMatch[]) => {
    const allMatches = [...savedMatches];
    let addedCount = 0;

    for (const m of newMatches) {
      const isDup = findDuplicateMatch(allMatches, m.playerSnapshots);
      if (!isDup) {
        allMatches.push({
          ...m,
          matchNumber: allMatches.length + 1,
        });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      updateTournamentState({ matches: allMatches });
      createAutoBackup(config, allMatches, 'game_saved');
      setLastAutoBackupTs(Date.now());
    }
  };

  const handleRecalculateSavedMatches = () => {
    if (savedMatches.length === 0) {
      showToast('No saved games to recalculate.');
      return;
    }
    const updated = savedMatches.map((m) => {
      if (!m.playerSnapshots || m.playerSnapshots.length === 0) return m;
      const recomputed = calculateMatchTeamScores(m.playerSnapshots, config, true);
      // Preserve custom penalties & adjustments if any existed
      Object.keys(recomputed).forEach((tidStr) => {
        const tid = Number(tidStr);
        const existingTeamScore = m.teamScores?.[tid];
        if (existingTeamScore && existingTeamScore.penaltyPoints) {
          recomputed[tid].penaltyPoints = existingTeamScore.penaltyPoints;
          recomputed[tid].adjustmentReason = existingTeamScore.adjustmentReason;
          recomputed[tid].totalPoints = Math.max(0, recomputed[tid].totalPoints + existingTeamScore.penaltyPoints);
        }
      });
      return {
        ...m,
        teamScores: recomputed,
      };
    });
    updateTournamentState({ matches: updated });
    showToast(`🔄 Placements & points recalculated for all ${updated.length} saved games!`);
  };

  const handleDeleteMatch = (matchId: string) => {
    const match = savedMatches.find((m) => m.id === matchId);
    const matchNum = match?.matchNumber || '';
    const filtered = savedMatches.filter((m) => m.id !== matchId);
    // renumber matches cleanly
    const renumbered = filtered.map((m, idx) => ({ ...m, matchNumber: idx + 1 }));
    updateTournamentState({ matches: renumbered });
    createAutoBackup(config, renumbered, 'game_saved');
    setLastAutoBackupTs(Date.now());
    showToast(`Match ${matchNum ? `#${matchNum} ` : ''}deleted successfully.`);
  };

  const handleUpdateMatch = (updatedMatch: SavedMatch) => {
    const updated = savedMatches.map((m) => (m.id === updatedMatch.id ? updatedMatch : m));
    updateTournamentState({ matches: updated });
    createAutoBackup(config, updated, 'game_saved');
    setLastAutoBackupTs(Date.now());
    showToast(`✅ Game #${updatedMatch.matchNumber} scores, penalties & standings updated!`);
  };

  const handleMoveMatch = (matchId: string, direction: 'up' | 'down') => {
    const index = savedMatches.findIndex((m) => m.id === matchId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= savedMatches.length) return;
    const newMatches = [...savedMatches];
    const [moved] = newMatches.splice(index, 1);
    newMatches.splice(targetIndex, 0, moved);
    // Renumber matches cleanly to reflect their new sequence
    const renumbered = newMatches.map((m, idx) => ({ ...m, matchNumber: idx + 1 }));
    updateTournamentState({ matches: renumbered });
    createAutoBackup(config, renumbered, 'game_saved');
    setLastAutoBackupTs(Date.now());
    showToast(`Game #${moved.matchNumber} moved ${direction === 'up' ? 'up' : 'down'} successfully.`);
  };

  const handleClearAllMatches = () => {
    updateTournamentState({ matches: [] });
    clearAllMatches();
    fetch('/api/tournament/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    }).catch(() => {});
    showToast('All saved tournament games have been cleared.');
  };

  // Toggle polling / tournament pause
  const handleTogglePolling = () => {
    const nextPaused = !config.isPaused;
    const updated = { ...config, isPaused: nextPaused };
    updateTournamentState({ config: updated });
    setIsPolling(!nextPaused);
    if (nextPaused) {
      // Pause ends current game and stops taking data from API
      const targetSnapshot = activePlayers.length > 0 ? activePlayers : lastFrozenPlayers;
      if (targetSnapshot && targetSnapshot.length > 0) {
        // If this game was ALREADY saved in savedMatches, do NOT resurrect it into activePlayers
        // to avoid duplicating the score!
        const isAlreadySaved = findDuplicateMatch(savedMatches, targetSnapshot);
        if (isAlreadySaved) {
          setActivePlayers([]);
          setLastFrozenPlayers(null);
          clearLastSnapshot();
          setIsGameFinished(false);
        } else {
          const scores = calculateMatchTeamScores(targetSnapshot, updated, true);
          const winnerScore = Object.values(scores).find((s) => s.isWinner || s.placement === 1);
          const winnerTeamId = winnerScore?.teamId;

          const finalizedPlayers = targetSnapshot.map((p) => {
            if (p.teamId === winnerTeamId) {
              return { ...p, bHasDied: false, health: p.health > 0 ? p.health : 100, liveState: 0 };
            } else {
              return { ...p, bHasDied: true, health: 0, liveState: 2 };
            }
          });
          setActivePlayers(finalizedPlayers);
          setLastFrozenPlayers(finalizedPlayers);
          saveLastSnapshot(finalizedPlayers);
          setIsGameFinished(true);
        }
      }
      showToast('⏸️ Tournament PAUSED — Current game ended & API polling stopped.');
    } else {
      showToast('▶️ Tournament RESUMED — Ready for next game.');
    }
  };

  // Direct update for tournament name that propagates to all viewers and OBS
  const handleUpdateTournamentName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = { ...config, name: trimmed };
    updateTournamentState({ config: updated });
    showToast(`🏆 Tournament Name updated to "${trimmed}" (Synced to all viewers & OBS)`);
  };

  // Quick update for total tournament rounds
  const handleUpdateTotalMatches = (total: number) => {
    const safeTotal = Math.max(1, Math.min(50, total));
    const updated = { ...config, totalMatches: safeTotal };
    updateTournamentState({ config: updated });
    showToast(`🏆 Total Tournament Rounds set to ${safeTotal}.`);
  };

  // Config save
  const handleSaveConfig = (newConfig: TournamentConfig) => {
    updateTournamentState({ config: newConfig });
    setIsPolling(!newConfig.isPaused);
    showToast('Tournament configuration updated & synced across all viewers.');
  };

  // Periodic 10-Minute (or configured interval) Auto-Backup Timer
  useEffect(() => {
    if (isObsParam) return;

    const intervalMinutes = config.autoBackupIntervalMinutes || 10;
    const intervalMs = intervalMinutes * 60 * 1000;

    // Trigger initial snapshot if matches exist and no recent backup exists
    const lastTs = getLastAutoBackupTimestamp();
    if (savedMatches.length > 0 && (!lastTs || Date.now() - lastTs > intervalMs)) {
      const snap = createAutoBackup(config, savedMatches, 'daily');
      if (snap) setLastAutoBackupTs(snap.timestamp);
    }

    const timer = setInterval(() => {
      if (config.enableAutoBackup !== false && savedMatches.length > 0) {
        const snap = createAutoBackup(config, savedMatches, 'interval_10min');
        if (snap) setLastAutoBackupTs(snap.timestamp);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [config, savedMatches, isObsParam]);

  // Periodic check for unexported data reminder: ONLY in the admin panel AFTER putting the password
  useEffect(() => {
    // Strictly forbid showing on OBS views, public leaderboard, or before entering the admin password
    if (isObsParam || currentView !== 'admin' || !adminAuth.isAuthenticated) {
      setIsBackupReminderOpen(false);
      return;
    }

    const checkReminder = () => {
      // Re-verify current view, admin authentication, and lock state before showing
      if (currentView !== 'admin' || !adminAuth.isAuthenticated) return;
      if (config.enableSingleAdminLock !== false && adminLock.isLockedOut) return;

      const reminderHours = config.exportReminderHours || 2;
      if (shouldShowBackupReminder(savedMatches.length, reminderHours)) {
        setIsBackupReminderOpen(true);
      }
    };

    // Check shortly after putting password into admin panel (1.5s delay for smooth UI entrance)
    const initialCheck = setTimeout(checkReminder, 1500);
    // Periodically re-check every 2 minutes while in authenticated admin panel
    const intervalTimer = setInterval(checkReminder, 120000);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(intervalTimer);
    };
  }, [
    config.exportReminderHours,
    config.enableSingleAdminLock,
    savedMatches.length,
    isObsParam,
    currentView,
    adminAuth.isAuthenticated,
    adminLock.isLockedOut,
  ]);

  // JSON Export & Import
  const handleExportJson = () => {
    exportTournamentBackupJson(config, savedMatches);
    setLastExportTs(Date.now());
    showToast('💾 Tournament JSON backup downloaded!');
  };

  const handleExportCsv = () => {
    exportStandingsCsv(config, savedMatches);
    setLastExportTs(Date.now());
    showToast('📊 Tournament standings CSV exported!');
  };

  const handleRestoreFromAutoBackup = (restoredConfig: TournamentConfig, restoredMatches: SavedMatch[]) => {
    updateTournamentState({ config: restoredConfig, matches: restoredMatches });
    showToast(`✅ Successfully restored tournament from backup snapshot (${restoredMatches.length} matches)!`);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = evt.target?.result as string;
        const parsed = JSON.parse(raw);
        if (parsed.matches && Array.isArray(parsed.matches)) {
          const newCfg = parsed.config ? { ...config, ...parsed.config } : undefined;
          updateTournamentState({ matches: parsed.matches, config: newCfg });
          showToast(`Successfully imported tournament with ${parsed.matches.length} games.`);
        } else if (Array.isArray(parsed)) {
          updateTournamentState({ matches: parsed });
          showToast(`Imported ${parsed.length} matches.`);
        } else {
          showToast('Invalid JSON tournament structure.');
        }
      } catch {
        showToast('Error parsing JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePopoutObs = (
    layout: 'main' | 'half' | 'overlay' | 'wide' | 'top4' | 'teamstats' | 'elimination' | 'mvp' = 'main',
    scope?: 'latest' | 'all',
    variant?: 'fullscreen' | 'popup'
  ) => {
    let targetUrl = '/?view=obs&layout=' + layout;
    let windowName = 'PUBG_OBS_' + layout.toUpperCase();

    if (layout === 'main') {
      targetUrl = '/?view=obs&layout=main';
      windowName = 'PUBG_MAIN_LEADERBOARD';
    } else if (layout === 'half') {
      targetUrl = '/?view=obs&layout=half';
      windowName = 'PUBG_HALF_LEADERBOARD';
    } else if (layout === 'teamstats') {
      targetUrl = '/?view=obs&layout=teamstats&transparent=true';
    } else if (layout === 'top4') {
      targetUrl = '/?view=obs&layout=top4';
      windowName = 'PUBG_TOP4_OVERLAY';
    } else if (layout === 'wide') {
      targetUrl = '/?view=obs&layout=wide';
      windowName = 'PUBG_STAGE_LEADERBOARD';
    } else if (layout === 'elimination') {
      targetUrl = '/?view=obs&layout=elimination&preview=1';
      windowName = 'PUBG_ELIMINATION_ALERT';
    } else if (layout === 'mvp') {
      targetUrl = `/?view=obs&layout=mvp${scope ? `&scope=${scope}` : ''}${variant ? `&variant=${variant}` : ''}`;
      windowName = `PUBG_MVP_${(scope || 'LATEST').toUpperCase()}_${(variant || 'FULL').toUpperCase()}`;
    }

    const popWidth = variant === 'popup' ? 600 : 1920;
    const popHeight = variant === 'popup' ? 380 : 1080;

    window.open(
      targetUrl,
      windowName,
      `width=${popWidth},height=${popHeight},menubar=no,toolbar=no,location=no,status=no`
    );
  };

  // Calculate standings
  const { teamStandings, playerStandings } = calculateTournamentStandings(savedMatches, config);

  // If in clean OBS Browser Source mode (?view=obs)
  if (isObsParam) {
    return (
      <div className="w-full min-h-screen bg-transparent select-none overflow-x-hidden no-scrollbar">
        <StreamLeaderboard
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          teamStandings={teamStandings}
          playerStandings={playerStandings}
          onManualRefresh={handleManualRefresh}
          isStandaloneObs={true}
          onUpdateConfig={handleSaveConfig}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Outfit'] selection:bg-amber-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-amber-500/40 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Navbar on all browser views (Leaderboard and Admin) */}
      <Navbar
        currentView={currentView}
        setCurrentView={handleNavigateView}
        config={config}
        savedMatchCount={savedMatches.length}
        isApiConnected={isApiConnected}
        connectionVia={connectionVia}
        connectionLatency={connectionLatency}
        isAdminAuthenticated={adminAuth.isAuthenticated}
        onLockAdmin={() => {
          setIsBackupReminderOpen(false);
          adminAuth.logout();
          adminLock.releaseLock();
          showToast('🔒 Admin console locked.');
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBackupVault={() => setIsAutoBackupVaultOpen(true)}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        onImportJson={() => setIsUploadModalOpen(true)}
        onPopoutObs={handlePopoutObs}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative">
        {currentView === 'admin' ? (
          !adminAuth.isAuthenticated ? (
            <AdminPasswordGate
              onUnlock={adminAuth.login}
              onNavigateToLeaderboard={() => handleNavigateView('leaderboard')}
              showToast={showToast}
            />
          ) : config.enableSingleAdminLock !== false && adminLock.isLockedOut ? (
            <AdminSessionLockShield
              activeSession={adminLock.activeSession}
              currentDeviceName={adminLock.deviceName}
              onForceTakeover={adminLock.forceTakeover}
              onNavigateToLeaderboard={() => handleNavigateView('leaderboard')}
              onDisableLock={() => {
                const newCfg = { ...config, enableSingleAdminLock: false };
                updateTournamentState({ config: newCfg });
                showToast('Single-device admin lock disabled in settings.');
              }}
            />
          ) : (
            <AdminPanel
              config={config}
              activePlayers={activePlayers}
              lastFrozenPlayers={lastFrozenPlayers}
              savedMatches={savedMatches}
              isApiConnected={isApiConnected}
              isPolling={isPolling && !config.isPaused}
              isGameFinished={isGameFinished}
              connectionVia={connectionVia}
              connectionLatency={connectionLatency}
              connectionError={connectionError}
              lastSyncTime={lastSyncTime}
              pendingMatchToSave={pendingMatchToSave}
              onConfirmSavePending={handleConfirmSavePending}
              onDiscardPending={handleDiscardPending}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
              onOpenBackupVault={() => setIsAutoBackupVaultOpen(true)}
              onTogglePolling={handleTogglePolling}
              onForceRefresh={pollSpectatorApi}
              onSaveCurrentMatch={handleSaveCurrentMatch}
              onDeleteMatch={handleDeleteMatch}
              onMoveMatch={handleMoveMatch}
              onUpdateMatch={handleUpdateMatch}
              onClearAllMatches={handleClearAllMatches}
              onRecalculateMatches={handleRecalculateSavedMatches}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onUpdateApiUrl={handleUpdateApiUrl}
              onTestConnection={handleTestConnection}
              onUpdateTotalMatches={handleUpdateTotalMatches}
              onUpdateTournamentName={handleUpdateTournamentName}
              onUpdateConfig={handleSaveConfig}
              onRestoreBackup={handleRestoreFromAutoBackup}
              onLockAdmin={() => {
                setIsBackupReminderOpen(false);
                adminAuth.logout();
                adminLock.releaseLock();
                showToast('🔒 Admin console locked.');
              }}
              isBackupRecommended={shouldShowBackupReminder(savedMatches.length, config.exportReminderHours || 2)}
              onOpenBackupReminder={() => setIsBackupReminderOpen(true)}
            />
          )
        ) : currentView === 'public' ? (
          <PublicLeaderboard
            config={config}
            savedMatches={savedMatches}
            activePlayers={activePlayers}
            unifiedStandings={teamStandings}
            onManualRefresh={handleManualRefresh}
            onNavigateToAdmin={() => handleNavigateView('admin')}
          />
        ) : (
          <div className="relative w-full">
            {/* Quick Action Bar for Streamers/Operators */}
            <div className="bg-[#0b1322] border-b border-[#1b2b46] px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#00ff66] font-mono font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse" />
                  API INGESTION: ONLINE
                </span>
                <span className="text-gray-400 font-mono hidden md:inline truncate max-w-sm">
                  ({config.apiUrl})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-quick-public"
                  onClick={() => handleNavigateView('public')}
                  className="px-3 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-bold uppercase rounded flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  title="Open Dedicated Public Leaderboard & Team Stats"
                >
                  🌐 Public Leaderboard
                </button>
                <button
                  id="btn-quick-admin"
                  onClick={() => handleNavigateView('admin')}
                  className="px-3 py-1 bg-[#ffb800] hover:bg-[#ffc833] text-black font-bold uppercase rounded flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  {adminAuth.isAuthenticated ? '⚙ Admin Panel' : '🔒 Admin Panel'}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    id="btn-quick-copy-ingame-obs"
                    onClick={async () => {
                      const obsUrl = `${window.location.origin}/?view=obs&layout=overlay`;
                      await copyToClipboard(obsUrl);
                      showToast('📋 In-Game OBS Overlay Link copied to clipboard!');
                    }}
                    className="px-2.5 py-1 bg-[#121f35] hover:bg-[#1a2d4d] text-[#1a83c5] border border-[#1a83c544] font-bold uppercase rounded flex items-center gap-1.5 transition-colors"
                    title="Copy In-Game OBS Overlay Link"
                  >
                    📺 In-Game OBS
                  </button>
                  <button
                    onClick={() => handlePopoutObs('overlay')}
                    className="p-1 bg-[#121f35] hover:bg-[#1a2d4d] text-[#1a83c5] border border-[#1a83c544] rounded transition-colors"
                    title="Open In-Game OBS Overlay in Popout Window"
                  >
                    ↗
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id="btn-quick-copy-top4-obs"
                    onClick={async () => {
                      const top4Url = `${window.location.origin}/?view=obs&layout=top4`;
                      await copyToClipboard(top4Url);
                      showToast('📋 Top 4 Live HUD Overlay Link copied to clipboard!');
                    }}
                    className="px-2.5 py-1 bg-[#09221c] hover:bg-[#0f342b] text-[#00ff66] border border-[#00ff6644] font-bold uppercase rounded flex items-center gap-1.5 transition-colors"
                    title="Copy Top 4 Live HUD Overlay Link (Top Screen Banner)"
                  >
                    ⚡ Top 4 Live HUD
                  </button>
                  <button
                    onClick={() => handlePopoutObs('top4')}
                    className="p-1 bg-[#09221c] hover:bg-[#0f342b] text-[#00ff66] border border-[#00ff6644] rounded transition-colors"
                    title="Open Top 4 Live HUD Overlay in Popout Window"
                  >
                    ↗
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id="btn-quick-copy-stage-obs"
                    onClick={async () => {
                      const stageUrl = `${window.location.origin}/?view=obs&layout=wide`;
                      await copyToClipboard(stageUrl);
                      showToast('🏆 Between-Games Stage Leaderboard Link copied to clipboard!');
                    }}
                    className="px-2.5 py-1 bg-[#1e1a10] hover:bg-[#2e2615] text-[#ffb800] border border-[#ffb80044] font-bold uppercase rounded flex items-center gap-1.5 transition-colors"
                    title="Copy Between-Games Stage Leaderboard Link"
                  >
                    🏆 Between-Games Stage
                  </button>
                  <button
                    onClick={() => handlePopoutObs('wide')}
                    className="p-1 bg-[#1e1a10] hover:bg-[#2e2615] text-[#ffb800] border border-[#ffb80044] rounded transition-colors"
                    title="Open Between-Games Stage Leaderboard in Popout Window"
                  >
                    ↗
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id="btn-quick-copy-teamstats-obs"
                    onClick={async () => {
                      const teamStatsUrl = `${window.location.origin}/?view=obs&layout=teamstats&transparent=true`;
                      await copyToClipboard(teamStatsUrl);
                      showToast('📋 Team Stats OBS Overlay Link copied to clipboard!');
                    }}
                    className="px-2.5 py-1 bg-[#041935] hover:bg-[#07254f] text-[#00d2ff] border border-[#0099ff]/40 font-bold uppercase rounded flex items-center gap-1.5 transition-colors"
                    title="Copy Team Stats OBS Overlay Link (Left-Mid HUD)"
                  >
                    📊 Team Stats
                  </button>
                  <button
                    onClick={() => handlePopoutObs('teamstats')}
                    className="p-1 bg-[#041935] hover:bg-[#07254f] text-[#00d2ff] border border-[#0099ff]/40 rounded transition-colors"
                    title="Open Team Stats Overlay in Popout Window"
                  >
                    ↗
                  </button>
                </div>
              </div>
            </div>

            <StreamLeaderboard
              config={config}
              savedMatches={savedMatches}
              activePlayers={activePlayers}
              teamStandings={teamStandings}
              playerStandings={playerStandings}
              onManualRefresh={handleManualRefresh}
              onUpdateConfig={handleSaveConfig}
            />
          </div>
        )}
      </main>

      {/* Save Match Prompt Modal: As requested, ask the admin every time before saving a match */}
      {pendingMatchToSave && (
        <SaveMatchPromptModal
          pendingMatch={pendingMatchToSave}
          onConfirm={handleConfirmSavePending}
          onDiscard={handleDiscardPending}
        />
      )}

      {/* Upload Match Modal: Import games with fullness verification & duplicate protection */}
      <UploadGameModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        config={config}
        savedMatches={savedMatches}
        onAddUploadedMatches={handleAddUploadedMatches}
        showToast={showToast}
      />

      {/* Auto Backup History / Vault Modal */}
      <AutoBackupHistoryModal
        isOpen={isAutoBackupVaultOpen}
        onClose={() => setIsAutoBackupVaultOpen(false)}
        config={config}
        savedMatches={savedMatches}
        onRestoreBackup={handleRestoreFromAutoBackup}
      />

      {/* Periodic Backup & Data Loss Prevention Advisory Modal - ONLY in authenticated Admin Panel */}
      {currentView === 'admin' && adminAuth.isAuthenticated && (!config.enableSingleAdminLock || !adminLock.isLockedOut) && (
        <BackupReminderModal
          isOpen={isBackupReminderOpen}
          onClose={() => setIsBackupReminderOpen(false)}
          config={config}
          savedMatches={savedMatches}
          lastExportTimestamp={lastExportTs}
          lastAutoBackupTimestamp={lastAutoBackupTs}
          onExportSuccess={() => {
            setLastExportTs(Date.now());
            showToast('💾 Tournament backup successfully exported!');
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
