import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Play,
  Pause,
  Save,
  Download,
  Trash2,
  AlertTriangle,
  Users,
  Trophy,
  Sparkles,
  Settings,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HelpCircle,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Tv,
  Upload,
  Layers,
  Edit3,
  FileSpreadsheet,
  ShieldCheck,
  History,
  Monitor,
  Maximize2,
  Minimize2,
  ChevronRight,
  HardDrive,
  RotateCcw,
  FileText,
  Database,
  UploadCloud,
  Target,
  User,
  Lock,
  ShieldAlert,
  Skull,
  Crown,
  Cloud,
} from 'lucide-react';
import {
  AutoBackupItem,
  PlayerRawInfo,
  SavedMatch,
  TeamMatchScore,
  TournamentConfig,
} from '../types/pubg';
import { getTeamColor, calculateTournamentStandings } from '../utils/pubgCalculations';
import {
  exportSingleMatchJson,
  exportStandingsCsv,
  exportTournamentBackupJson,
  loadAutoBackups,
  createAutoBackup,
  deleteAutoBackup,
  clearAutoBackups,
  triggerObsOverlayTest,
} from '../utils/storage';
import {
  signInWithGoogleDrive,
  logoutGoogleDrive,
  getDriveAccessToken,
  uploadTournamentBackupToDrive,
  findOrCreateTournamentFolder,
  listDriveTournamentBackups,
  initDriveAuth,
} from '../utils/googleDrive';
import { normalizeApiUrl } from '../utils/spectatorApi';
import { PendingMatchSaveInfo } from './SaveMatchPromptModal';
import { LogoUploadSlot } from './LogoUploadSlot';
import { EditMatchScoresModal } from './EditMatchScoresModal';
import { QuickEditMatchItem } from './QuickEditMatchItem';
import { TournamentProgressBar } from './TournamentProgressBar';
import { TeamsPicsAdmin } from './TeamsPicsAdmin';
import { TeamStatsAdmin } from './TeamStatsAdmin';
import { PlayerPortraitsAdmin } from './PlayerPortraitsAdmin';
import { TeamDetailsModal } from './TeamDetailsModal';
import { UnifiedTeamStanding } from './StreamLeaderboard';
import { SCORING_PRESETS, DEFAULT_CONFIG } from '../utils/pubgCalculations';
import { TeamFlag } from './TeamFlag';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { copyToClipboard } from '../utils/clipboard';

interface AdminPanelProps {
  config: TournamentConfig;
  activePlayers: PlayerRawInfo[];
  lastFrozenPlayers: PlayerRawInfo[] | null;
  savedMatches: SavedMatch[];
  isApiConnected: boolean;
  isPolling: boolean;
  isGameFinished: boolean;
  connectionVia?: 'direct' | 'proxy';
  connectionLatency?: number;
  connectionError?: string | null;
  lastSyncTime?: Date | null;
  pendingMatchToSave?: PendingMatchSaveInfo | null;
  onConfirmSavePending?: () => void;
  onDiscardPending?: () => void;
  onOpenUploadModal?: () => void;
  onOpenBackupVault?: () => void;
  onTogglePolling: () => void;
  onForceRefresh?: () => void;
  onSaveCurrentMatch: () => void;
  onDeleteMatch: (id: string) => void;
  onMoveMatch?: (matchId: string, direction: 'up' | 'down') => void;
  onUpdateMatch?: (updatedMatch: SavedMatch) => void;
  onClearAllMatches?: () => void;
  onRecalculateMatches?: () => void;
  onOpenSettings: () => void;
  onUpdateApiUrl: (url: string) => void;
  onTestConnection: (url?: string) => Promise<any>;
  onUpdateTotalMatches?: (total: number) => void;
  onUpdateTournamentName?: (name: string) => void;
  onUpdateConfig?: (cfg: TournamentConfig) => void;
  onRestoreBackup?: (restoredConfig: TournamentConfig, restoredMatches: SavedMatch[]) => void;
  onLockAdmin?: () => void;
  isBackupRecommended?: boolean;
  onOpenBackupReminder?: () => void;
}

export type AdminTab = 'matches' | 'broadcast' | 'teams' | 'admin' | 'all';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  config,
  activePlayers,
  lastFrozenPlayers,
  savedMatches,
  isApiConnected,
  isPolling,
  isGameFinished,
  connectionVia = 'direct',
  connectionLatency = 0,
  connectionError = null,
  lastSyncTime = null,
  pendingMatchToSave = null,
  onConfirmSavePending,
  onDiscardPending,
  onOpenUploadModal,
  onOpenBackupVault,
  onTogglePolling,
  onForceRefresh,
  onSaveCurrentMatch,
  onDeleteMatch,
  onMoveMatch,
  onUpdateMatch,
  onClearAllMatches,
  onRecalculateMatches,
  onOpenSettings,
  onUpdateApiUrl,
  onTestConnection,
  onUpdateTotalMatches,
  onUpdateTournamentName,
  onUpdateConfig,
  onRestoreBackup,
  onLockAdmin,
  isBackupRecommended = false,
  onOpenBackupReminder,
}) => {
  const normalizeTab = (raw: string | null): AdminTab => {
    if (!raw) return 'matches';
    if (raw === 'games' || raw === 'leaderboard' || raw === 'matches') return 'matches';
    if (raw === 'broadcast' || raw === 'teamstats') return 'broadcast';
    if (raw === 'teams' || raw === 'teampics' || raw === 'portraits') return 'teams';
    if (raw === 'admin' || raw === 'backup') return 'admin';
    if (raw === 'all') return 'all';
    return 'matches';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab) return normalizeTab(urlTab);
      const saved = localStorage.getItem('pubg_admin_active_tab');
      if (saved) return normalizeTab(saved);
    }
    return 'matches';
  });

  // Sub-tabs for clean, un-duplicated views within each primary section
  const [matchesSubTab, setMatchesSubTab] = useState<'live' | 'saved' | 'standings'>('live');
  const [broadcastSubTab, setBroadcastSubTab] = useState<'overlays' | 'teamstats' | 'guide'>('overlays');
  const [teamsSubTab, setTeamsSubTab] = useState<'rosters' | 'pics' | 'portraits'>('rosters');
  const [adminSubTab, setAdminSubTab] = useState<'settings' | 'api' | 'points' | 'backup' | 'danger'>('settings');
  const [inspectTeamDetails, setInspectTeamDetails] = useState<UnifiedTeamStanding | null>(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

  const handleTabChange = (rawTab: string) => {
    let targetTab: AdminTab = 'matches';
    if (rawTab === 'games' || rawTab === 'live') {
      targetTab = 'matches';
      setMatchesSubTab('live');
    } else if (rawTab === 'saved') {
      targetTab = 'matches';
      setMatchesSubTab('saved');
    } else if (rawTab === 'leaderboard' || rawTab === 'standings') {
      targetTab = 'matches';
      setMatchesSubTab('standings');
    } else if (rawTab === 'teamstats') {
      targetTab = 'broadcast';
      setBroadcastSubTab('teamstats');
    } else if (rawTab === 'broadcast' || rawTab === 'overlays') {
      targetTab = 'broadcast';
      setBroadcastSubTab('overlays');
    } else if (rawTab === 'guide') {
      targetTab = 'broadcast';
      setBroadcastSubTab('guide');
    } else if (rawTab === 'teams' || rawTab === 'rosters') {
      targetTab = 'teams';
      setTeamsSubTab('rosters');
    } else if (rawTab === 'teampics' || rawTab === 'pics') {
      targetTab = 'teams';
      setTeamsSubTab('pics');
    } else if (rawTab === 'portraits') {
      targetTab = 'teams';
      setTeamsSubTab('portraits');
    } else if (rawTab === 'backup') {
      targetTab = 'admin';
      setAdminSubTab('backup');
    } else if (rawTab === 'admin' || rawTab === 'settings') {
      targetTab = 'admin';
      setAdminSubTab('settings');
    } else if (rawTab === 'api') {
      targetTab = 'admin';
      setAdminSubTab('api');
    } else if (rawTab === 'points') {
      targetTab = 'admin';
      setAdminSubTab('points');
    } else if (rawTab === 'danger') {
      targetTab = 'admin';
      setAdminSubTab('danger');
    } else {
      targetTab = normalizeTab(rawTab);
    }
    setActiveTab(targetTab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pubg_admin_active_tab', targetTab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', targetTab);
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    }
  };

  const [selectedMatchForDetails, setSelectedMatchForDetails] = useState<SavedMatch | null>(null);
  const [matchToEdit, setMatchToEdit] = useState<SavedMatch | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<SavedMatch | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const [isGlobalQuickEditMode, setIsGlobalQuickEditMode] = useState(false);
  const [isBroadcastHudMode, setIsBroadcastHudMode] = useState(false);
  const [quickEditMatchIds, setQuickEditMatchIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [inputUrl, setInputUrl] = useState(config.apiUrl);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success?: boolean; text?: string } | null>(null);
  const [showNgrokHelp, setShowNgrokHelp] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tournamentNameInput, setTournamentNameInput] = useState(config.name || 'PUBG MOBILE CHAMPIONSHIP');
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  useEffect(() => {
    setTournamentNameInput(config.name || 'PUBG MOBILE CHAMPIONSHIP');
  }, [config.name]);

  const handleSaveTournamentTitle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = tournamentNameInput.trim();
    if (!trimmed) return;
    if (onUpdateTournamentName) {
      onUpdateTournamentName(trimmed);
    } else if (onUpdateConfig) {
      onUpdateConfig({ ...config, name: trimmed });
    }
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2500);
  };

  const handleCopyLink = async (key: string, textToCopy: string) => {
    await copyToClipboard(textToCopy);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  // OBS targeted test duration (e.g. 10s, 20s, 30s, 60s)
  const [obsTestDuration, setObsTestDuration] = useState<number>(20);

  // Google Drive Cloud Sync state & handlers
  const [driveUser, setDriveUser] = useState<any>(null);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveStatusMsg, setDriveStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = initDriveAuth(
      (user) => {
        setDriveUser(user);
      },
      () => {
        setDriveUser(null);
      }
    );
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleSignInGoogleDrive = async () => {
    try {
      setIsDriveLoading(true);
      setDriveStatusMsg(null);
      const res = await signInWithGoogleDrive();
      setDriveUser(res.user);
      setDriveStatusMsg(`✓ Connected to Google Drive as ${res.user.email}`);
    } catch (err: any) {
      setDriveStatusMsg(`❌ Failed to connect: ${err?.message || 'Authentication error'}`);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleManualDriveBackup = async () => {
    try {
      setIsDriveLoading(true);
      setDriveStatusMsg(null);
      const file = await uploadTournamentBackupToDrive(config, savedMatches);
      setDriveStatusMsg(`✓ Uploaded tournament backup to Google Drive: ${file.name}`);
    } catch (err: any) {
      setDriveStatusMsg(`❌ Upload failed: ${err?.message || 'Upload error'}`);
    } finally {
      setIsDriveLoading(false);
    }
  };

  // Rolling auto-backups state & Vault
  const [autoBackupsList, setAutoBackupsList] = useState<AutoBackupItem[]>(() => loadAutoBackups());
  const refreshAutoBackups = () => {
    setAutoBackupsList(loadAutoBackups());
  };

  useEffect(() => {
    const onStorageOrBackupUpdate = () => {
      refreshAutoBackups();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pubg_auto_backup_created', onStorageOrBackupUpdate);
      window.addEventListener('storage', onStorageOrBackupUpdate);
      return () => {
        window.removeEventListener('pubg_auto_backup_created', onStorageOrBackupUpdate);
        window.removeEventListener('storage', onStorageOrBackupUpdate);
      };
    }
  }, []);

  // Upload Tournament Backup state
  const backupFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isBackupDragActive, setIsBackupDragActive] = useState(false);
  const [backupFileState, setBackupFileState] = useState<{
    file: File;
    matches: SavedMatch[];
    config?: TournamentConfig;
    dateExported?: string;
  } | null>(null);
  const [backupUploadError, setBackupUploadError] = useState<string | null>(null);
  const [backupUploadSuccess, setBackupUploadSuccess] = useState<string | null>(null);
  const [confirmRestoreModal, setConfirmRestoreModal] = useState<{
    title: string;
    message: string;
    confirmButtonText: string;
    onConfirm: () => void;
  } | null>(null);

  const handleBackupFileSelect = (file: File) => {
    setBackupUploadError(null);
    setBackupUploadSuccess(null);

    if (!file.name.toLowerCase().endsWith('.json')) {
      setBackupUploadError('Please select a valid .json tournament backup file.');
      setBackupFileState(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        let extractedMatches: SavedMatch[] = [];
        let extractedConfig: TournamentConfig | undefined = undefined;
        let dateExported: string | undefined = undefined;

        if (parsed && typeof parsed === 'object') {
          if (parsed.exportedAt) {
            dateExported = parsed.exportedAt;
          }
          if (parsed.config && typeof parsed.config === 'object') {
            extractedConfig = { ...config, ...parsed.config };
          }
          if (Array.isArray(parsed.matches)) {
            extractedMatches = parsed.matches;
          } else if (Array.isArray(parsed)) {
            if (parsed.length > 0 && ('playerSnapshots' in parsed[0] || 'teamScores' in parsed[0])) {
              extractedMatches = parsed as SavedMatch[];
            }
          } else if (parsed.playerSnapshots && Array.isArray(parsed.playerSnapshots)) {
            extractedMatches = [parsed as SavedMatch];
          }
        }

        if (extractedMatches.length === 0 && !extractedConfig) {
          setBackupUploadError('No valid tournament matches or configuration found in this JSON file.');
          setBackupFileState(null);
          return;
        }

        setBackupFileState({
          file,
          matches: extractedMatches,
          config: extractedConfig,
          dateExported,
        });
      } catch (err: any) {
        setBackupUploadError(`Failed to parse JSON file: ${err?.message || 'Invalid syntax'}`);
        setBackupFileState(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestoreBackup = (mode: 'replace' | 'append') => {
    if (!backupFileState) return;

    if (mode === 'replace') {
      const doReplace = () => {
        // Create an emergency pre-restore snapshot so no data is ever lost
        createAutoBackup(config, savedMatches, 'manual');
        const configToApply = backupFileState.config ? { ...config, ...backupFileState.config } : config;
        const matchesToApply = backupFileState.matches;

        if (onRestoreBackup) {
          onRestoreBackup(configToApply, matchesToApply);
        } else if (onUpdateConfig) {
          onUpdateConfig(configToApply);
        }

        setBackupUploadSuccess(`Successfully restored tournament from backup (${matchesToApply.length} games loaded)!`);
        setBackupFileState(null);
        refreshAutoBackups();
        setTimeout(() => setBackupUploadSuccess(null), 5000);
      };

      if (savedMatches.length > 0) {
        setConfirmRestoreModal({
          title: 'Replace Current Tournament?',
          message: `Restoring this backup will replace your current ${savedMatches.length} recorded match${savedMatches.length > 1 ? 'es' : ''} with the ${backupFileState.matches.length} matches from "${backupFileState.file.name}". A safety snapshot will be created in your vault automatically.`,
          confirmButtonText: 'Yes, Replace Tournament',
          onConfirm: () => {
            setConfirmRestoreModal(null);
            doReplace();
          },
        });
      } else {
        doReplace();
      }
    } else {
      // Append mode
      const renumbered = backupFileState.matches.map((m, idx) => ({
        ...m,
        id: `match_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        matchNumber: savedMatches.length + idx + 1,
      }));
      const merged = [...savedMatches, ...renumbered];

      if (onRestoreBackup) {
        onRestoreBackup(config, merged);
      }
      setBackupUploadSuccess(`Appended ${renumbered.length} games to current tournament! (Total: ${merged.length} games)`);
      setBackupFileState(null);
      refreshAutoBackups();
      setTimeout(() => setBackupUploadSuccess(null), 5000);
    }
  };

  const handleCreateManualSnapshot = () => {
    const item = createAutoBackup(config, savedMatches, 'manual');
    if (item) {
      refreshAutoBackups();
      setBackupUploadSuccess(`Manual backup snapshot created (${savedMatches.length} matches saved)!`);
      setTimeout(() => setBackupUploadSuccess(null), 4000);
    }
  };

  const handleRestoreVaultSnapshot = (item: AutoBackupItem) => {
    setConfirmRestoreModal({
      title: 'Restore Vault Snapshot?',
      message: `Restore tournament state from snapshot created at ${item.dateStr} (${item.matchCount} matches)? Current unsaved changes will be replaced.`,
      confirmButtonText: 'Yes, Restore Snapshot',
      onConfirm: () => {
        setConfirmRestoreModal(null);
        createAutoBackup(config, savedMatches, 'manual'); // safety checkpoint
        if (onRestoreBackup) {
          onRestoreBackup(item.config, item.matches);
        }
        setBackupUploadSuccess(`Restored tournament from snapshot (${item.dateStr})!`);
        setTimeout(() => setBackupUploadSuccess(null), 4000);
      },
    });
  };

  const totalTournamentMatches = config.totalMatches || 5;
  const rankedSavedMatches = useMemo(
    () => savedMatches.filter((m) => !m.excludeFromLeaderboard),
    [savedMatches]
  );
  const completedRankedCount = rankedSavedMatches.length;
  const isTournamentEnded =
    Boolean(config.isPaused) ||
    Boolean(config.isTournamentConcluded) ||
    (completedRankedCount >= totalTournamentMatches && completedRankedCount > 0);
  const upcomingMatchNumber = completedRankedCount + 1;

  useEffect(() => {
    setInputUrl(config.apiUrl);
  }, [config.apiUrl]);

  const handleApplyUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalized = normalizeApiUrl(inputUrl);
    setInputUrl(normalized);
    onUpdateApiUrl(normalized);
  };

  const handleQuickTest = async () => {
    const normalized = normalizeApiUrl(inputUrl);
    setInputUrl(normalized);
    setIsTestingUrl(true);
    setTestFeedback(null);
    try {
      const res = await onTestConnection(normalized);
      if (res.success) {
        setTestFeedback({
          success: true,
          text: `Success! Latency: ${res.latencyMs}ms (${res.data.length} players found via ${res.via})`,
        });
      } else {
        setTestFeedback({
          success: false,
          text: res.error || 'Connection failed',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestFeedback({
        success: false,
        text: msg,
      });
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handlePresetYousery = () => {
    const defaultUrl = 'https://main.yousery.tech/gettotalplayerlist';
    setInputUrl(defaultUrl);
    onUpdateApiUrl(defaultUrl);
  };

  const handlePresetLocal = () => {
    const local = 'http://127.0.0.1:10086/getplayerlist';
    setInputUrl(local);
    onUpdateApiUrl(local);
  };

  const displayedPlayers = activePlayers.length > 0 ? activePlayers : (lastFrozenPlayers || []);

  let aliveCount = 0;
  let deadCount = 0;
  let totalMatchKills = 0;
  const aliveTeamsSet = new Set<number>();
  const allTeamsMap: Record<number, { teamId: number; teamName: string; players: PlayerRawInfo[]; totalKills: number }> = {};

  displayedPlayers.forEach((p) => {
    const isAlive = !p.bHasDied && p.health > 0;
    if (isAlive) {
      aliveCount++;
      aliveTeamsSet.add(p.teamId);
    } else {
      deadCount++;
    }
    totalMatchKills += (p.killNum || 0);

    if (!allTeamsMap[p.teamId]) {
      allTeamsMap[p.teamId] = {
        teamId: p.teamId,
        teamName: p.teamName || `Team ${p.teamId}`,
        players: [],
        totalKills: 0,
      };
    }
    allTeamsMap[p.teamId].players.push(p);
    allTeamsMap[p.teamId].totalKills += (p.killNum || 0);
  });

  const teamList = Object.values(allTeamsMap).sort((a, b) => {
    const aliveA = a.players.filter((p) => !p.bHasDied && p.health > 0).length;
    const aliveB = b.players.filter((p) => !p.bHasDied && p.health > 0).length;
    if (aliveB !== aliveA) return aliveB - aliveA;
    return b.totalKills - a.totalKills;
  });

  const filteredTeams = teamList.filter((team) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTeam = team.teamName.toLowerCase().includes(q);
      const matchPlayer = team.players.some((p) => p.playerName.toLowerCase().includes(q));
      return matchTeam || matchPlayer;
    }
    return true;
  });

  const nextGameNumber = savedMatches.length + 1;

  // Calculate cumulative tournament standings and WWCD wins across all saved games
  const tournamentStandings = React.useMemo(() => {
    return calculateTournamentStandings(savedMatches, config).teamStandings;
  }, [savedMatches, config]);

  const teamWinsMap = React.useMemo(() => {
    const map: Record<number, number> = {};
    tournamentStandings.forEach((t) => {
      map[t.teamId] = t.wins || 0;
    });
    return map;
  }, [tournamentStandings]);

  const totalTournamentWWCDs = React.useMemo(() => {
    return tournamentStandings.reduce((sum, t) => sum + (t.wins || 0), 0);
  }, [tournamentStandings]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Broadcast HUD / Stream Command Deck Overlay Banner if enabled */}
      {isBroadcastHudMode && (
        <div className="sticky top-2 z-50 bg-[#0B0E14]/95 border-2 border-[#FFB800] rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFB800] flex items-center justify-center text-black font-bold flex-shrink-0 shadow-md shadow-[#FFB800]/30 animate-pulse">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-rajdhani uppercase tracking-wider text-[#FFB800]">
                    BROADCAST COMMAND HUD ACTIVE
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold font-mono">
                    LIVE PRODUCTION VIEW
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Minimalist high-contrast operator view. Fullscreen ready for secondary broadcast monitors.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTabChange('leaderboard')}
                className="px-3.5 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#2A3B5A] text-[#FFB800] font-bold font-rajdhani text-xs uppercase tracking-wider transition-colors border border-[#334155]"
              >
                Show Standings
              </button>
              <button
                type="button"
                onClick={() => setIsBroadcastHudMode(false)}
                className="px-4 py-1.5 rounded-xl bg-[#FFB800] hover:bg-[#FFA500] text-black font-bold font-rajdhani text-xs uppercase tracking-wider shadow-md shadow-[#FFB800]/20 flex items-center gap-1.5"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit HUD</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament Lifecycle & Completion Progress Bar */}
      <TournamentProgressBar
        config={config}
        savedMatches={savedMatches}
        onUpdateTotalMatches={onUpdateTotalMatches}
        onOpenMatchScorecard={(m) => setSelectedMatchForDetails(m)}
      />

      {/* Top Banner: Control Hub & Save Action */}
      <div className="bg-[#121824]/95 border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Status and API details */}
          <div className="space-y-1.5">
            <h2 className="text-[#FFB800] text-xs font-bold font-rajdhani tracking-widest uppercase">
              Control Panel & Live Session
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-2xl tracking-wide text-white font-rajdhani uppercase">
                Active Match Operations
              </span>
              <span className="bg-[#1E293B] text-[#FFB800] font-bold font-rajdhani px-3 py-0.5 rounded-lg text-sm tracking-wider border border-[#334155] tabular-nums">
                GAME #{nextGameNumber}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-rajdhani">
              <span className="flex items-center gap-1.5">
                <span className="font-bold uppercase text-[11px] text-slate-500">Active Link:</span>
                <code className="text-[#1a83c5] font-mono bg-[#0B0E14] px-2.5 py-0.5 rounded-lg border border-[#1E293B] max-w-[260px] truncate block">
                  {config.apiUrl}
                </code>
              </span>
              <span>&bull;</span>
              <span>MODE: <strong className="text-white uppercase font-bold">{config.mode || 'SQUAD'}</strong></span>
              <span>&bull;</span>
              <span>POLL: <strong className="text-emerald-400 font-mono">{config.pollInterval}ms</strong></span>
            </div>
          </div>

          {/* Right: Primary Save and Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Quick Rounds Adjuster */}
            <div className="flex items-center gap-1.5 bg-[#0B0E14] px-3 py-1.5 rounded-xl border border-[#1E293B]" title="Quick edit tournament rounds">
              <span className="text-[11px] font-bold uppercase font-rajdhani text-slate-400">Rounds:</span>
              <button
                type="button"
                onClick={() => onUpdateTotalMatches?.(Math.max(1, totalTournamentMatches - 1))}
                className="w-6 h-6 rounded-lg bg-[#1E293B] hover:bg-[#2A3B5A] text-white font-bold flex items-center justify-center text-xs transition-colors"
                title="Decrease total rounds"
              >
                -
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="font-bold text-base font-rajdhani tabular-nums text-[#FFB800] px-1 hover:underline"
                title="Click to change rounds in Settings"
              >
                {totalTournamentMatches}
              </button>
              <button
                type="button"
                onClick={() => onUpdateTotalMatches?.(totalTournamentMatches + 1)}
                className="w-6 h-6 rounded-lg bg-[#1E293B] hover:bg-[#2A3B5A] text-white font-bold flex items-center justify-center text-xs transition-colors"
                title="Increase total rounds"
              >
                +
              </button>
            </div>

            {/* Polling / Tournament Pause Toggle */}
            <button
              id="btn-toggle-polling"
              onClick={onTogglePolling}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider border transition-all ${
                config.isPaused || !isPolling
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-[#FFB800]/15 hover:bg-[#FFB800]/25 text-[#FFB800] border-[#FFB800]/40'
              }`}
              title={config.isPaused || !isPolling ? 'Click to resume upcoming games' : 'Click to pause — marks no more upcoming games'}
            >
              {config.isPaused || !isPolling ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>RESUME GAMES</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>PAUSE GAMES</span>
                </>
              )}
            </button>

            {/* Upload Game Button */}
            {onOpenUploadModal && (
              <button
                id="btn-open-upload-modal"
                type="button"
                onClick={onOpenUploadModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#1a83c5]/20 hover:text-[#1a83c5] hover:border-[#1a83c5]/50 text-slate-200 text-xs font-bold font-rajdhani uppercase tracking-wider border border-[#334155] transition-all"
                title="Upload match JSON file"
              >
                <Upload className="w-3.5 h-3.5 text-[#1a83c5]" />
                <span>UPLOAD JSON</span>
              </button>
            )}

            {/* Settings */}
            <button
              id="btn-open-settings"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#2A3B5A] text-white text-xs font-bold font-rajdhani uppercase tracking-wider border border-[#334155] transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-[#FFB800]" />
              <span>SETTINGS</span>
            </button>

            {/* Prominent Save Match Button */}
            <button
              id="btn-save-current-match"
              onClick={onSaveCurrentMatch}
              disabled={displayedPlayers.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF5200] text-white font-bold text-xs font-rajdhani uppercase tracking-wider shadow-lg shadow-[#FF5200]/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <Save className="w-4 h-4" />
              <span>SAVE CURRENT GAME #{nextGameNumber}</span>
            </button>
          </div>
        </div>

        {/* 5-Second Freeze / Game End Alert Card */}
        {(!isApiConnected && lastFrozenPlayers && lastFrozenPlayers.length > 0) && (
          <div className="mt-4 p-4 rounded-xl bg-[#162032] border border-[#FFB800] text-[#FFB800] text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-[#FFB800]/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFB800]/20 flex items-center justify-center text-[#FFB800] flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm font-rajdhani uppercase tracking-wider">
                  Game Completed &bull; Spectate 5s Timeout Captured
                </h4>
                <p className="text-slate-300 text-xs mt-0.5">
                  The API closed, but the final snapshot of <strong>{lastFrozenPlayers.length} players</strong> has been frozen in cache. Click <strong>"Save Current Game"</strong> to commit into tournament database.
                </p>
              </div>
            </div>
            <button
              onClick={onSaveCurrentMatch}
              className="px-4 py-2 rounded-xl bg-[#FF5200] hover:brightness-110 text-white font-bold text-xs font-rajdhani uppercase tracking-wider whitespace-nowrap flex-shrink-0 shadow-lg shadow-[#FF5200]/30"
            >
              SAVE GAME #{nextGameNumber} NOW
            </button>
          </div>
        )}

        {/* Tournament Phase & Upcoming Game Banner */}
        {config.isPaused ? (
          <div className="mt-4 p-4 rounded-xl bg-[#162032] border border-[#FFB800]/60 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-[#FFB800]/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFB800]/20 flex items-center justify-center text-[#FFB800] flex-shrink-0">
                <Pause className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <span>Tournament Paused &bull; No More Upcoming Games</span>
                  <span className="bg-[#FFB800] text-black font-bold text-[10px] px-2 py-0.5 rounded font-rajdhani uppercase">
                    STANDINGS LOCKED
                  </span>
                </h4>
                <p className="text-slate-300 text-xs mt-0.5">
                  You pressed <strong>PAUSE</strong>, which marks <strong>no more upcoming games</strong>. The stream leaderboard is displaying official Final Standings ({completedRankedCount} of {totalTournamentMatches} rounds played).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onTogglePolling}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Resume Upcoming Games</span>
              </button>
              <button
                onClick={onOpenSettings}
                className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#2A3B5A] text-white font-bold text-xs font-rajdhani uppercase tracking-wider transition-all whitespace-nowrap"
              >
                Edit Rounds ({totalTournamentMatches})
              </button>
            </div>
          </div>
        ) : isTournamentEnded ? (
          <div className="mt-4 p-4 rounded-xl bg-[#162032] border border-[#FFB800]/60 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFB800]/20 flex items-center justify-center text-[#FFB800] flex-shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <span>Tournament Concluded &bull; All {completedRankedCount} Matches Completed</span>
                  <span className="bg-[#FFB800] text-black font-bold text-[10px] px-2 py-0.5 rounded font-rajdhani uppercase">
                    FINAL RESULTS
                  </span>
                </h4>
                <p className="text-slate-300 text-xs mt-0.5">
                  All {totalTournamentMatches} tournament matches have concluded. Overall standings and champions are locked in the unified stream leaderboard.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onOpenSettings}
                className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#2A3B5A] text-white font-bold text-xs font-rajdhani uppercase tracking-wider transition-all whitespace-nowrap"
              >
                Edit Rounds ({totalTournamentMatches})
              </button>
            </div>
          </div>
        ) : displayedPlayers.length === 0 && (
          <div className="mt-4 p-4 rounded-xl bg-[#0E1420] border border-[#1a83c5]/30 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1a83c5]/20 flex items-center justify-center text-[#1a83c5] flex-shrink-0">
                <Clock className="w-5 h-5 text-[#1a83c5]" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <span>No Game Alive &bull; Upcoming Game #{upcomingMatchNumber} Getting Ready</span>
                  <span className="bg-[#1a83c5]/20 text-[#1a83c5] border border-[#1a83c5]/40 font-bold text-[10px] px-2 py-0.5 rounded font-rajdhani uppercase">
                    {completedRankedCount} / {totalTournamentMatches} ROUNDS
                  </span>
                </h4>
                <p className="text-slate-300 text-xs mt-0.5">
                  Server responded with <code className="text-[#1a83c5] font-mono">{'{}'}</code> (or spectator client in lobby). Next game will automatically stream once players drop.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onForceRefresh && (
                <button
                  type="button"
                  onClick={onForceRefresh}
                  className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#2A3B5A] text-slate-300 text-xs font-bold font-rajdhani uppercase transition-all whitespace-nowrap flex items-center gap-1"
                  title="Check if live game dropped"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Check Feed</span>
                </button>
              )}
              <button
                onClick={onOpenSettings}
                className="px-3.5 py-2 rounded-xl bg-[#1a83c5]/20 hover:bg-[#1a83c5]/30 text-[#1a83c5] border border-[#1a83c5]/40 font-bold text-xs font-rajdhani uppercase tracking-wider transition-all whitespace-nowrap"
              >
                Edit Rounds ({totalTournamentMatches})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Match Prompt Banner (Ask Admin Before Saving) */}
      {pendingMatchToSave && (
        <div
          id="banner-pending-match-prompt"
          className="p-4 rounded-2xl bg-[#1A1608] border-2 border-[#FFB800] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl shadow-[#FFB800]/20 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFB800] flex items-center justify-center text-black font-bold flex-shrink-0 shadow-md">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase bg-[#FFB800] text-black px-2 py-0.5 rounded">
                  APPROVAL REQUIRED
                </span>
                <h3 className="text-base font-bold font-rajdhani tracking-wider text-[#FFB800] uppercase">
                  Game #{pendingMatchToSave.matchNumber} Finished & Awaiting Save!
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Winner: <strong className="text-[#10B981]">{pendingMatchToSave.winnerTeamName}</strong> &bull; {pendingMatchToSave.playerCount} Players ({pendingMatchToSave.teamCount} Teams) &bull; {pendingMatchToSave.totalKills} Kills &bull; Full Lobby Verified
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 self-end sm:self-auto flex-shrink-0">
            {onDiscardPending && (
              <button
                type="button"
                onClick={onDiscardPending}
                className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#2A3B5A] text-slate-300 hover:text-white text-xs font-bold font-rajdhani uppercase tracking-wider transition-colors"
              >
                Discard
              </button>
            )}
            {onConfirmSavePending && (
              <button
                type="button"
                onClick={onConfirmSavePending}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold font-rajdhani uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Game #{pendingMatchToSave.matchNumber}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Backup Recommended Notification Banner (Only visible in authenticated Admin Panel) */}
      {isBackupRecommended && (
        <div
          id="banner-backup-recommended"
          className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#1A1608] to-[#121824] border border-amber-500/40 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/10 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-md">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                  DATA ADVISORY
                </span>
                <h3 className="text-base font-bold font-rajdhani tracking-wider text-amber-400 uppercase">
                  Tournament Backup Recommended
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                You have {savedMatches.length} match{savedMatches.length !== 1 ? 'es' : ''} saved in cache. Export a .json backup file to ensure tournament safety.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                exportTournamentBackupJson(config, savedMatches);
                setBackupUploadSuccess('💾 Tournament JSON backup downloaded!');
                setTimeout(() => setBackupUploadSuccess(null), 4000);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Backup</span>
            </button>
            {onOpenBackupReminder && (
              <button
                type="button"
                onClick={onOpenBackupReminder}
                className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#2A3B5A] text-slate-200 text-xs font-bold font-rajdhani uppercase tracking-wider transition-all cursor-pointer border border-[#334155]"
              >
                View Advisory
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Stats Cache Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#121824]/90 border border-[#1E293B] rounded-2xl p-4 shadow-lg backdrop-blur-md">
          <span className="text-[11px] font-bold text-slate-400 font-rajdhani uppercase tracking-widest block mb-1">
            Teams Alive
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-rajdhani tabular-nums text-emerald-400">
              {aliveTeamsSet.size}/{teamList.length}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-bold font-rajdhani">TEAMS</span>
          </div>
        </div>

        <div className="bg-[#121824]/90 border border-[#1E293B] rounded-2xl p-4 shadow-lg backdrop-blur-md">
          <span className="text-[11px] font-bold text-slate-400 font-rajdhani uppercase tracking-widest block mb-1">
            Players Alive
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-rajdhani tabular-nums text-emerald-400">
              {aliveCount}
            </span>
            <span className="text-xs text-slate-400 font-rajdhani tabular-nums">/ {displayedPlayers.length} IN GAME</span>
          </div>
        </div>

        <div className="bg-[#121824]/90 border border-[#1E293B] rounded-2xl p-4 shadow-lg backdrop-blur-md">
          <span className="text-[11px] font-bold text-slate-400 font-rajdhani uppercase tracking-widest block mb-1">
            Total Game Kills
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-rajdhani tabular-nums text-[#FF5200]">
              {totalMatchKills}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-bold font-rajdhani">KILLS</span>
          </div>
        </div>

        <div className="bg-[#121824]/90 border border-[#1E293B] rounded-2xl p-4 shadow-lg backdrop-blur-md">
          <span className="text-[11px] font-bold text-slate-400 font-rajdhani uppercase tracking-widest block mb-1">
            Total Games Saved
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-rajdhani tabular-nums text-[#FFB800]">
              {savedMatches.length < 10 ? `0${savedMatches.length}` : savedMatches.length}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-bold font-rajdhani">MATCHES</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation Hub - Responsive & Fully Visible on PC & Mobile */}
      <div className="sticky top-2 z-30 bg-[#121824]/95 backdrop-blur-xl border border-[#1e293b] rounded-2xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.7)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Main Primary Tabs (Organized into 4 Core Sections) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 1. Live Game & Matches Tab */}
            <button
              id="tab-btn-matches"
              type="button"
              onClick={() => handleTabChange('matches')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-heading font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'matches'
                  ? 'bg-[#ffb800] text-black shadow-lg shadow-[#ffb800]/25'
                  : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#172132]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live Game & Matches</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-telemetry tabular-nums ${
                activeTab === 'matches'
                  ? 'bg-black/20 text-black font-bold'
                  : isApiConnected && displayedPlayers.length > 0
                  ? 'bg-[rgba(16,185,129,0.15)] text-[#10b981] border border-[rgba(16,185,129,0.35)] animate-pulse'
                  : 'bg-[#0f1622] text-[#94a3b8] border border-[#1e293b]'
              }`}>
                {displayedPlayers.length > 0 ? `${aliveCount} Alive` : `${savedMatches.length} Saved`}
              </span>
            </button>

            {/* 2. Broadcast & OBS Tab (Unified Overlays + Team Stats Control) */}
            <button
              id="tab-btn-broadcast"
              type="button"
              onClick={() => handleTabChange('broadcast')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-heading font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'broadcast'
                  ? 'bg-[#38bdf8] text-black shadow-lg shadow-[#38bdf8]/25'
                  : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#172132]'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>Broadcast & OBS</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-telemetry ${
                activeTab === 'broadcast'
                  ? 'bg-black/20 text-black font-bold'
                  : 'bg-[#0f1622] text-[#38bdf8] border border-[rgba(56,189,248,0.35)]'
              }`}>
                Overlays & Stats
              </span>
            </button>

            {/* 3. Teams & Rosters Tab (Team Directory, Flags, Squad Pics & Portraits) */}
            <button
              id="tab-btn-teams"
              type="button"
              onClick={() => handleTabChange('teams')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-heading font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'teams'
                  ? 'bg-[#10b981] text-black shadow-lg shadow-[#10b981]/25'
                  : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#172132]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Teams & Rosters</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-telemetry tabular-nums ${
                activeTab === 'teams'
                  ? 'bg-black/20 text-black font-bold'
                  : 'bg-[#0f1622] text-[#94a3b8] border border-[#1e293b]'
              }`}>
                {tournamentStandings.length > 0 ? `${tournamentStandings.length} Teams` : `${teamList.length} Teams`}
              </span>
            </button>

            {/* 4. Admin & Setup Tab (Settings, Point System, Backups & API) */}
            <button
              id="tab-btn-admin"
              type="button"
              onClick={() => handleTabChange('admin')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-heading font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-[#ffb800] text-black shadow-lg shadow-[#ffb800]/25'
                  : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#172132]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Admin & Setup</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-telemetry ${
                activeTab === 'admin'
                  ? 'bg-black/20 text-black font-bold'
                  : 'bg-[#0f1622] text-[#ffb800] border border-[rgba(255,184,0,0.35)]'
              }`}>
                Setup & Settings
              </span>
            </button>
          </div>

          {/* Right Actions: Broadcast HUD toggle & Direct Settings */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-[#1e293b] flex-shrink-0 ml-auto sm:ml-0">
            {/* Broadcast HUD Mode Button */}
            <button
              id="btn-toggle-broadcast-hud"
              type="button"
              onClick={() => setIsBroadcastHudMode((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-heading font-black uppercase tracking-wider transition-all cursor-pointer border ${
                isBroadcastHudMode
                  ? 'bg-[#ffb800] text-black border-[#ffb800] shadow-md shadow-[#ffb800]/20'
                  : 'bg-[#172132] text-[#38bdf8] hover:bg-[rgba(56,189,248,0.2)] border-[#334155]'
              }`}
              title="Toggle Distraction-Free Broadcast HUD Command Mode"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>{isBroadcastHudMode ? 'Exit HUD' : 'Broadcast HUD'}</span>
            </button>

            <button
              id="tab-btn-all"
              type="button"
              onClick={() => handleTabChange('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-heading font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#334155] text-white border border-[#475569]'
                  : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#172132]'
              }`}
              title="Show all sections together on one page"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Views</span>
            </button>

            {onOpenSettings && (
              <button
                id="btn-nav-settings"
                type="button"
                onClick={onOpenSettings}
                className="flex items-center gap-1 px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-heading font-black uppercase text-[#ffb800] hover:text-[#ffc933] hover:bg-[rgba(255,184,0,0.15)] border border-[rgba(255,184,0,0.35)] transition-all cursor-pointer"
                title="Open Tournament Settings Dialog"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}

            {onLockAdmin && (
              <button
                id="btn-lock-admin-console"
                type="button"
                onClick={onLockAdmin}
                className="flex items-center gap-1 px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold font-rajdhani uppercase text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/50 border border-red-800/60 transition-all cursor-pointer shadow-sm"
                title="Lock Admin Console immediately (password required to re-enter)"
              >
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">Lock Console</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Sub-Navigation Bar for Current Tab */}
      {activeTab === 'matches' && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B0E14] border border-[#1E293B] p-2 rounded-2xl shadow-md">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMatchesSubTab('live')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                matchesSubTab === 'live'
                  ? 'bg-[#10b981] text-black shadow-md shadow-[#10b981]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>🔴 Live Game Operations</span>
              {displayedPlayers.length > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/20 text-black font-mono">
                  {aliveCount} Alive
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMatchesSubTab('saved')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                matchesSubTab === 'saved'
                  ? 'bg-[#ffb800] text-black shadow-md shadow-[#ffb800]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>🏆 Saved Match Records ({savedMatches.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMatchesSubTab('standings')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                matchesSubTab === 'standings'
                  ? 'bg-[#38bdf8] text-black shadow-md shadow-[#38bdf8]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>📊 Standings Summary ({tournamentStandings.length} Teams)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Active Match Section
            </span>
          </div>
        </div>
      )}

      {activeTab === 'broadcast' && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B0E14] border border-[#1E293B] p-2 rounded-2xl shadow-md">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBroadcastSubTab('overlays')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                broadcastSubTab === 'overlays'
                  ? 'bg-[#38bdf8] text-black shadow-md shadow-[#38bdf8]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>📺 Overlays & Direct URLs</span>
            </button>

            <button
              type="button"
              onClick={() => setBroadcastSubTab('teamstats')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                broadcastSubTab === 'teamstats'
                  ? 'bg-[#ffb800] text-black shadow-md shadow-[#ffb800]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>📊 Team Stats Control Hub</span>
            </button>

            <button
              type="button"
              onClick={() => setBroadcastSubTab('guide')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                broadcastSubTab === 'guide'
                  ? 'bg-[#10b981] text-black shadow-md shadow-[#10b981]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>📐 Resolution & Alpha CSS Guide</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#38bdf8] font-mono hidden sm:inline">
              OBS Master Overlays Deck
            </span>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B0E14] border border-[#1E293B] p-2 rounded-2xl shadow-md">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTeamsSubTab('rosters')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                teamsSubTab === 'rosters'
                  ? 'bg-[#10b981] text-black shadow-md shadow-[#10b981]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>👥 Team Directory & Rosters</span>
            </button>

            <button
              type="button"
              onClick={() => setTeamsSubTab('pics')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                teamsSubTab === 'pics'
                  ? 'bg-[#38bdf8] text-black shadow-md shadow-[#38bdf8]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>🖼️ Team Logos, Flags & Squad Photos</span>
            </button>

            <button
              type="button"
              onClick={() => setTeamsSubTab('portraits')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                teamsSubTab === 'portraits'
                  ? 'bg-[#ffb800] text-black shadow-md shadow-[#ffb800]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>👤 Player Portraits & UIDs</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#10b981] font-mono hidden sm:inline">
              Teams & Rosters Inspection
            </span>
          </div>
        </div>
      )}

      {activeTab === 'admin' && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B0E14] border border-[#1E293B] p-2 rounded-2xl shadow-md">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAdminSubTab('settings')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                adminSubTab === 'settings'
                  ? 'bg-[#ffb800] text-black shadow-md shadow-[#ffb800]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>⚙️ Tournament Settings & Logo</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminSubTab('api')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                adminSubTab === 'api'
                  ? 'bg-[#38bdf8] text-black shadow-md shadow-[#38bdf8]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>📡 Spectator API Ingestion</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminSubTab('points')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                adminSubTab === 'points'
                  ? 'bg-[#10b981] text-black shadow-md shadow-[#10b981]/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>🎯 Scoring & Point System</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminSubTab('backup')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                adminSubTab === 'backup'
                  ? 'bg-emerald-400 text-black shadow-md shadow-emerald-400/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-[#162032]'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>💾 Backups & Google Drive</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminSubTab('danger')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                adminSubTab === 'danger'
                  ? 'bg-[#FF5200] text-white shadow-md shadow-[#FF5200]/20 font-black'
                  : 'text-red-400 hover:bg-red-500/10'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>⚠️ Reset & Data Safety</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#ffb800] font-mono hidden sm:inline">
              Tournament Admin Console
            </span>
          </div>
        </div>
      )}

      {/* TAB VIEWS: DYNAMIC CONTENT BASED ON ACTIVE TAB */}
      {((activeTab === 'matches' && (matchesSubTab === 'saved' || activeTab === 'all')) || activeTab === 'all') && (
        <div className="space-y-4">
          <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            {/* Tactical top glowing hairline accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFB800] to-transparent opacity-40" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#1E293B]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                    TOURNAMENT ARCHIVE
                  </span>
                  <span className="text-slate-400 text-xs font-mono">
                    Official Match Records
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#FFB800]" />
                  Saved Games ({savedMatches.length})
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {savedMatches.length > 0 && (
                  <button
                    id="btn-toggle-quick-edit-mode"
                    type="button"
                    onClick={() => setIsGlobalQuickEditMode((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider transition-all border shadow-sm cursor-pointer ${
                      isGlobalQuickEditMode
                        ? 'bg-[#FFB800] text-black border-[#FFB800] shadow-[#FFB800]/25 font-extrabold animate-pulse'
                        : 'bg-[#1E293B] hover:bg-[#FFB800]/20 text-[#FFB800] border-[#334155]'
                    }`}
                    title="Toggle Quick Edit mode to edit team names & player kills inline directly in the list"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Quick Edit {isGlobalQuickEditMode ? 'ON' : 'Mode'}</span>
                  </button>
                )}
                {onOpenBackupVault && (
                  <button
                    type="button"
                    onClick={onOpenBackupVault}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider bg-[#1a83c5]/10 hover:bg-[#1a83c5]/25 text-[#1a83c5] hover:text-white border border-[#1a83c5]/30 transition-all shadow-sm cursor-pointer"
                    title="Open Auto-Backup Vault"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Vault</span>
                  </button>
                )}
                {savedMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => exportStandingsCsv(config, savedMatches)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider bg-[#00FF66]/10 hover:bg-[#00FF66]/25 text-[#00FF66] hover:text-white border border-[#00FF66]/30 transition-all shadow-sm cursor-pointer"
                    title="Export tournament standings as CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                )}
                {onOpenUploadModal && (
                  <button
                    type="button"
                    onClick={onOpenUploadModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider bg-[#1E293B] hover:bg-[#334155] text-slate-200 border border-[#334155] transition-all shadow-sm cursor-pointer"
                    title="Upload match JSON file"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#1a83c5]" />
                    <span>Upload</span>
                  </button>
                )}
                {savedMatches.length > 0 && onRecalculateMatches && (
                  <button
                    type="button"
                    onClick={onRecalculateMatches}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider bg-[#1E293B] hover:bg-[#1a83c5]/20 text-[#1a83c5] border border-[#1a83c5]/30 transition-all cursor-pointer"
                    title="Recalculate all saved games with current placement rules"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Recalculate</span>
                  </button>
                )}
                {savedMatches.length > 0 && onClearAllMatches && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearAll(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider bg-[#FF5200]/10 hover:bg-[#FF5200] text-[#FF5200] hover:text-white border border-[#FF5200]/30 transition-all cursor-pointer"
                    title="Clear all saved games and reset tournament"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Edit Banner Indicator */}
            {isGlobalQuickEditMode && (
              <div className="flex items-center justify-between bg-[#FFB800]/10 border border-[#FFB800]/30 px-3.5 py-2.5 rounded-xl text-xs text-[#FFB800] mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>⚡ Quick Edit Mode Active:</strong> Edit team names and player kill counts directly below. Standings and rankings update automatically in real-time.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGlobalQuickEditMode(false)}
                  className="text-xs font-bold font-rajdhani uppercase tracking-wider underline hover:text-white px-2 py-0.5 ml-2 cursor-pointer flex-shrink-0"
                >
                  Exit Quick Edit
                </button>
              </div>
            )}

            {savedMatches.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-[#1E293B] rounded-2xl p-6 bg-[#0B0E14]/80">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="text-sm font-bold font-rajdhani uppercase tracking-wider text-slate-300">No games saved yet</p>
                <p className="text-xs text-slate-400 mt-1 mb-4 max-w-sm mx-auto">
                  Once a match concludes on the live spectator feed, click &quot;Save Current Game&quot; to lock in official placements &amp; kills into tournament standings.
                </p>
                {onOpenUploadModal && (
                  <button
                    type="button"
                    onClick={onOpenUploadModal}
                    className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#1a83c5]/20 hover:text-[#1a83c5] text-slate-200 border border-[#334155] text-xs font-bold font-rajdhani uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#1a83c5]" />
                    <span>Upload Game JSON</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {savedMatches.map((m, index) => (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: -20, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        scale: 0.94,
                        y: -14,
                        transition: { duration: 0.22, ease: 'easeOut' },
                      }}
                      transition={{
                        layout: {
                          type: 'spring',
                          stiffness: 350,
                          damping: 30,
                        },
                        opacity: { duration: 0.24 },
                        y: { type: 'spring', stiffness: 400, damping: 30 },
                        scale: { duration: 0.24 },
                      }}
                    >
                      <QuickEditMatchItem
                        match={m}
                        config={config}
                        isQuickEditActive={isGlobalQuickEditMode || Boolean(quickEditMatchIds[m.id])}
                        onToggleQuickEdit={() => {
                          setQuickEditMatchIds((prev) => ({
                            ...prev,
                            [m.id]: !(isGlobalQuickEditMode || prev[m.id]),
                          }));
                        }}
                        onUpdateMatch={onUpdateMatch}
                        onDeleteMatch={(id) => {
                          const match = savedMatches.find((sm) => sm.id === id);
                          if (match) setMatchToDelete(match);
                          else onDeleteMatch(id);
                        }}
                        onOpenScorecard={(match) => setSelectedMatchForDetails(match)}
                        onOpenFullEditModal={(match) => setMatchToEdit(match)}
                        onMoveUp={onMoveMatch && index > 0 ? () => onMoveMatch(m.id, 'up') : undefined}
                        onMoveDown={
                          onMoveMatch && index < savedMatches.length - 1
                            ? () => onMoveMatch(m.id, 'down')
                            : undefined
                        }
                        isFirst={index === 0}
                        isLast={index === savedMatches.length - 1}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}

      {((activeTab === 'matches' && (matchesSubTab === 'live' || activeTab === 'all')) || activeTab === 'games' || activeTab === 'all') && (
        <div className="space-y-6">
          <div className="space-y-4">
          <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-[#1E293B]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-[#FF5200]/15 text-[#FF5200] border border-[#FF5200]/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                    SPECTATOR FEED
                  </span>
                  <span className="text-slate-400 text-xs font-mono">
                    Real-Time Telemetry
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#FF5200]" />
                  Active Roster &amp; Health Matrix
                </h3>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter player or team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0B0E14] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFB800] w-52 transition-all font-mono"
                />
              </div>
            </div>

            {/* Team Roster Cards */}
            {filteredTeams.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-[#1E293B] rounded-2xl bg-[#0B0E14]/80 p-6">
                <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-bold font-rajdhani uppercase tracking-wider text-slate-300">No active player telemetry</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Waiting for players to enter the match from {config.apiUrl}. As soon as a game starts and players drop, rosters will update here in real time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTeams.map((team) => {
                  const color = getTeamColor(team.teamId);
                  const aliveTeamMembers = team.players.filter((p) => !p.bHasDied && p.health > 0).length;
                  const isTeamEliminated = aliveTeamMembers === 0;

                  return (
                    <div
                      key={team.teamId}
                      className={`rounded-2xl border p-4 transition-all ${
                        isTeamEliminated
                          ? 'bg-[#0B0E14]/50 border-[#1E293B] opacity-50'
                          : 'bg-[#0B0E14] border-[#1E293B] hover:border-[#334155] shadow-lg'
                      }`}
                    >
                      {/* Team Header */}
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#1E293B]">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white font-rajdhani uppercase tracking-wider">
                            {team.teamName}
                          </span>
                          {teamWinsMap[team.teamId] ? (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/40 font-mono flex items-center gap-1 shadow-xs"
                              title={`${teamWinsMap[team.teamId]} Tournament Chicken Dinner(s)`}
                            >
                              🍗 {teamWinsMap[team.teamId]} WWCD
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[#1a83c5] font-bold font-mono tracking-wider">
                            {team.totalKills} KILLS
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border font-mono ${
                              isTeamEliminated
                                ? 'text-[#FF5200] bg-[#FF5200]/10 border-[#FF5200]/30'
                                : 'text-[#00FF66] bg-[#00FF66]/10 border-[#00FF66]/30'
                            }`}
                          >
                            {isTeamEliminated ? 'ELIMINATED' : `${aliveTeamMembers}/${team.players.length} ALIVE`}
                          </span>
                        </div>
                      </div>

                      {/* Player List */}
                      <div className="space-y-2">
                        {team.players.map((p) => {
                          const isDead = p.bHasDied || p.health <= 0;
                          const hpPct = Math.max(0, Math.min(100, (p.health / (p.healthMax || 100)) * 100));

                          return (
                            <div
                              key={p.uId}
                              className={`flex items-center justify-between text-xs p-2 rounded-xl transition-colors ${
                                isDead ? 'text-slate-600 bg-[#0B0E14]' : 'text-slate-200 bg-[#121824]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold truncate max-w-[130px] font-mono" title={p.playerName}>
                                  {p.playerName}
                                </span>
                                {p.isFiring && !isDead && (
                                  <span className="text-[#FFB800] text-[11px] animate-pulse" title="Firing weapon">
                                    🔥
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 flex-shrink-0">
                                {/* HP Bar */}
                                {!isDead ? (
                                  <div className="w-18 flex flex-col items-end">
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      {p.health} HP
                                    </span>
                                    <div className="w-full h-1.5 bg-[#1E293B] rounded-full overflow-hidden mt-0.5">
                                      <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{
                                          width: `${hpPct}%`,
                                          backgroundColor:
                                            hpPct < 25 ? '#FF5200' : hpPct < 60 ? '#FFB800' : '#00FF66',
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-[#FF5200] font-bold font-mono">
                                    DEAD
                                  </span>
                                )}

                                {/* Kills */}
                                <div className="text-right w-12 font-mono">
                                  <span className="font-bold text-[#1a83c5]">{p.killNum || 0}</span>
                                  <span className="text-[9px] text-slate-500 ml-0.5 font-bold">K</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
      {/* Live Data Source / ngrok Link Control Hub */}
      <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${
              isApiConnected
                ? displayedPlayers.length > 0
                  ? 'bg-[#00FF66] shadow-[0_0_12px_#00FF66] animate-pulse'
                  : 'bg-[#1a83c5] shadow-[0_0_12px_#1a83c5]'
                : 'bg-[#FF5200] shadow-[0_0_12px_#FF5200]'
            }`} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white font-rajdhani uppercase tracking-wider">
                  Live Data Ingestion Source &bull; {inputUrl.includes('ngrok') ? 'ngrok Tunnel' : 'Spectator API'}
                </h3>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                  isApiConnected
                    ? displayedPlayers.length > 0
                      ? 'text-[#00FF66] bg-[#00FF66]/10 border-[#00FF66]/30'
                      : 'text-[#1a83c5] bg-[#1a83c5]/10 border-[#1a83c5]/30'
                    : 'text-[#FF5200] bg-[#FF5200]/10 border-[#FF5200]/30'
                }`}>
                  {isApiConnected
                    ? displayedPlayers.length > 0
                      ? `ONLINE (${connectionLatency}ms • ${connectionVia.toUpperCase()})`
                      : 'STANDBY • NO GAME ALIVE ({})'
                    : 'OFFLINE / WAITING'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isApiConnected
                  ? displayedPlayers.length > 0
                    ? `Receiving real-time game telemetry • ${displayedPlayers.length} players detected (${aliveCount} alive in ${aliveTeamsSet.size} teams)`
                    : `Server reachable & returned {} • No game currently alive. Upcoming Game #${savedMatches.length + 1} will stream once players drop.`
                  : 'Enter your live spectator API URL or ngrok link below to stream real player coordinates and kills.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={handlePresetYousery}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider bg-[#00FF66]/10 hover:bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/30 transition-all cursor-pointer"
              title="Set to primary tournament API: https://main.yousery.tech/gettotalplayerlist"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>main.yousery.tech</span>
            </button>
            <button
              type="button"
              onClick={handlePresetLocal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider bg-[#1E293B] hover:bg-[#334155] text-slate-300 border border-[#334155] transition-all cursor-pointer"
              title="Reset to local 127.0.0.1:10086"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>127.0.0.1</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNgrokHelp(!showNgrokHelp)}
              className="p-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-400 hover:text-white border border-[#334155] cursor-pointer"
              title="How to run ngrok locally"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick URL Input Bar */}
        <form onSubmit={handleApplyUrl} className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://main.yousery.tech/gettotalplayerlist"
              className="w-full bg-[#0B0E14] border border-[#1E293B] focus:border-[#FFB800] rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none placeholder-slate-600 transition-colors"
            />
            {inputUrl.includes('ngrok') && (
              <span className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-[#1a83c5] bg-[#1a83c5]/10 px-2 py-0.5 rounded border border-[#1a83c5]/30 pointer-events-none">
                NGROK LINK
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#FFB800] hover:brightness-110 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider shadow-md shadow-[#FFB800]/20 transition-all cursor-pointer"
            >
              Apply Link
            </button>
            <button
              type="button"
              onClick={handleQuickTest}
              disabled={isTestingUrl}
              className="px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-bold text-xs font-rajdhani uppercase tracking-wider border border-[#334155] flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingUrl ? 'animate-spin text-[#FFB800]' : ''}`} />
              <span>{isTestingUrl ? 'Pinging...' : 'Test Ping'}</span>
            </button>
            {onForceRefresh && (
              <button
                type="button"
                onClick={onForceRefresh}
                className="px-3.5 py-2.5 rounded-xl bg-[#1a83c5]/10 hover:bg-[#1a83c5]/20 text-[#1a83c5] font-bold text-xs font-rajdhani uppercase tracking-wider border border-[#1a83c5]/30 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Force poll real data immediately"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh Data</span>
              </button>
            )}
          </div>
        </form>

        {/* Live Test Feedback Banner */}
        {testFeedback && (
          <div
            className={`mt-3 p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              testFeedback.success
                ? 'bg-[#00FF66]/10 border-[#00FF66]/30 text-[#00FF66]'
                : 'bg-[#FF5200]/10 border-[#FF5200]/30 text-[#FF5200]'
            }`}
          >
            <div className="flex items-center gap-2">
              {testFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="font-mono">{testFeedback.text}</span>
            </div>
            <button
              onClick={() => setTestFeedback(null)}
              className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Connection Error Diagnostic Banner (when offline) */}
        {!isApiConnected && connectionError && (
          <div className="mt-3 p-3.5 rounded-xl bg-[#FF5200]/10 border border-[#FF5200]/30 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-[#FF5200] font-bold font-rajdhani uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Connection Notice: {connectionError}</span>
            </div>
            <p className="text-slate-300 text-[11px] pl-6">
              If running ngrok, ensure you ran <code className="text-[#1a83c5] bg-black/60 px-1.5 py-0.5 rounded font-mono">ngrok http 10086</code> and your PUBG spectator tool is actively running.
            </p>
          </div>
        )}

        {/* Expandable ngrok Instructions */}
        {showNgrokHelp && (
          <div className="mt-4 p-4 rounded-xl bg-[#0B0E14] border border-[#1a83c5]/30 text-xs text-slate-300 space-y-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between text-[#1a83c5] font-bold font-rajdhani uppercase tracking-wider text-xs">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                How to stream data from your local PUBG spectator tool via ngrok:
              </span>
              <button
                onClick={() => setShowNgrokHelp(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 font-sans">
              <li>
                Start your local PUBG spectator program (it runs at <code className="text-[#FFB800] font-mono">http://127.0.0.1:10086/getplayerlist</code>).
              </li>
              <li>
                Open your terminal/command prompt and run:
                <div className="my-1.5 p-2 rounded-lg bg-black font-mono text-[#00FF66] flex items-center justify-between">
                  <span>ngrok http 10086</span>
                </div>
              </li>
              <li>
                ngrok will display a <strong>Forwarding</strong> URL, for example: <code className="text-[#1a83c5] font-mono">https://c82d-xx-xx.ngrok-free.app</code>.
              </li>
              <li>
                Paste that link into the field above and click <strong>"Apply Link"</strong>. The app automatically bypasses ngrok browser warning pages and proxies requests seamlessly!
              </li>
            </ol>
          </div>
        )}
      </div>

        </div>
      )}

      {/* Dedicated Section: Tournament Standings & WWCD Leaderboard */}
      {((activeTab === 'matches' && (matchesSubTab === 'standings' || activeTab === 'all')) || activeTab === 'leaderboard' || activeTab === 'all') && (
        <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                LEADERBOARD &amp; WWCD
              </span>
              <span className="text-slate-400 text-xs font-mono">
                Overall Standings
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#FFB800]" />
              Tournament Standings &amp; WWCD Tracker
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live cumulative scores, total kills, and Winner Winner Chicken Dinner (WWCD) match victories across all recorded games.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onOpenBackupVault && (
              <button
                id="btn-open-backup-vault"
                type="button"
                onClick={onOpenBackupVault}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1a83c5]/10 hover:bg-[#1a83c5]/25 text-[#1a83c5] hover:text-white border border-[#1a83c5]/30 font-bold text-xs font-rajdhani uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                title="Open Automatic Backup Vault (10-minute & between-game rolling snapshots)"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Backup Vault</span>
              </button>
            )}
            <button
              id="btn-export-standings-json"
              type="button"
              onClick={() => exportTournamentBackupJson(config, savedMatches)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFB800]/10 hover:bg-[#FFB800]/25 text-[#FFB800] hover:text-white border border-[#FFB800]/30 font-bold text-xs font-rajdhani uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              title="Download complete tournament JSON backup file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              id="btn-export-standings-csv"
              type="button"
              onClick={() => exportStandingsCsv(config, savedMatches)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00FF66]/10 hover:bg-[#00FF66]/25 text-[#00FF66] hover:text-white border border-[#00FF66]/30 font-bold text-xs font-rajdhani uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              title="Download complete tournament standings and player rankings as a CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <div className="px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-[#1E293B] text-xs font-mono text-slate-300 flex items-center gap-1.5">
              <span className="text-[#FFB800]">🍗</span>
              <span className="text-slate-400">TOTAL WWCDS:</span>
              <span className="text-[#FFB800] font-bold">{totalTournamentWWCDs} DINNERS</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-[#1E293B] text-xs font-mono text-slate-300">
              <span className="text-slate-400 mr-1">GAMES:</span>
              <span className="text-[#1a83c5] font-bold">{completedRankedCount}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-white font-bold">{totalTournamentMatches}</span>
            </div>
          </div>
        </div>

        {/* Official Competition Tie Breaker Rules Notice */}
        <div className="mt-3 py-2 px-3 bg-[#0B0E14]/90 border border-[#1E293B] rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#FFB800]/15 border border-[#FFB800]/30 text-[#FFB800] font-bold text-[10px] uppercase font-rajdhani tracking-wider">
              Official Tie Breakers
            </span>
            <span className="text-slate-300">Standings ties resolved by:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-mono text-slate-300">
            <span><strong className="text-[#FFB800]">(a)</strong> WWCD Wins</span>
            <span className="text-slate-600">→</span>
            <span><strong className="text-[#1a83c5]">(b)</strong> Place Pts</span>
            <span className="text-slate-600">→</span>
            <span><strong className="text-[#00FF66]">(c)</strong> Total Kills</span>
            <span className="text-slate-600">→</span>
            <span><strong className="text-purple-400">(d)</strong> Recent Match Placement</span>
          </div>
        </div>

        {tournamentStandings.length === 0 ? (
          <div className="text-center py-12 text-slate-500 border border-dashed border-[#1E293B] rounded-2xl mt-4 bg-[#0B0E14]/80 p-6">
            <Trophy className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-bold font-rajdhani uppercase tracking-wider text-slate-300">No Saved Tournament Games Yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              As soon as you save completed games from the live feed or upload match JSONs, team standings and Winner Winner Chicken Dinner (WWCD) counts will automatically be tracked here.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-[#1E293B] text-xs font-rajdhani font-bold uppercase tracking-wider bg-[#0B0E14]">
                  <th className="py-3 px-3"># Rank</th>
                  <th className="py-3 px-3">Team Name</th>
                  <th className="py-3 px-3 text-center">WWCD (Wins)</th>
                  <th className="py-3 px-3 text-center">Games</th>
                  <th className="py-3 px-3 text-center">Total Kills</th>
                  <th className="py-3 px-3 text-center">Place Pts</th>
                  {tournamentStandings.some((t) => Boolean(t.totalPenaltyPoints)) && (
                    <th className="py-3 px-3 text-center">Adjust</th>
                  )}
                  <th className="py-3 px-3 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {tournamentStandings.map((team, idx) => {
                  const rank = idx + 1;
                  const color = getTeamColor(team.teamId);
                  const hasWWCD = (team.wins || 0) > 0;

                  return (
                    <tr
                      key={team.teamId}
                      className={`hover:bg-[#1E293B]/40 transition-colors ${
                        rank === 1
                          ? 'bg-[#FFB800]/5'
                          : rank === 2
                          ? 'bg-[#E2E8F0]/5'
                          : rank === 3
                          ? 'bg-[#CD7F32]/5'
                          : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-bold text-sm">
                          {rank === 1 ? (
                            <span className="px-2.5 py-0.5 rounded-md bg-[#FFB800] text-black shadow-sm flex items-center gap-1 font-extrabold font-mono">
                              <Trophy className="w-3.5 h-3.5 fill-current" /> #1
                            </span>
                          ) : rank === 2 ? (
                            <span className="px-2.5 py-0.5 rounded-md bg-[#E2E8F0] text-black shadow-sm font-extrabold font-mono">
                              #2
                            </span>
                          ) : rank === 3 ? (
                            <span className="px-2.5 py-0.5 rounded-md bg-[#CD7F32] text-white shadow-sm font-extrabold font-mono">
                              #3
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-sm px-1.5">
                              #{rank}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Team Name */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <TeamFlag
                            flagValue={resolveTeamFlagValue(team.teamId, config.teamFlags, team.teamName)}
                            teamId={team.teamId}
                            isWinner={rank === 1}
                            className={`w-5 h-3.5 object-cover rounded-[2px] shadow-sm flex-shrink-0 ${
                              rank === 1 ? 'border border-[#FFB800]' : 'border border-slate-600'
                            }`}
                          />
                          <span className="font-extrabold text-white text-sm font-rajdhani uppercase tracking-wide">
                            {team.teamName}
                          </span>
                        </div>
                      </td>

                      {/* WWCD (Wins) */}
                      <td className="py-3 px-3 text-center">
                        {hasWWCD ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/40 font-bold font-mono text-xs shadow-sm">
                            <span>🍗</span>
                            <span>{team.wins} {team.wins === 1 ? 'WWCD' : 'WWCDS'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Games Played */}
                      <td className="py-3 px-3 text-center font-mono text-slate-300">
                        {team.matchesPlayed} <span className="text-slate-500 text-[10px]">GP</span>
                      </td>

                      {/* Total Kills */}
                      <td className="py-3 px-3 text-center font-mono text-[#1a83c5] font-bold text-sm">
                        {team.totalKills}
                      </td>

                      {/* Placement Pts */}
                      <td className="py-3 px-3 text-center font-mono text-[#FFB800] font-bold">
                        {team.totalPlacementPoints}
                      </td>

                      {/* Adjustment (if applicable) */}
                      {tournamentStandings.some((t) => Boolean(t.totalPenaltyPoints)) && (
                        <td className="py-3 px-3 text-center font-mono text-xs">
                          {team.totalPenaltyPoints ? (
                            <span
                              className={`font-semibold px-1.5 py-0.5 rounded ${
                                team.totalPenaltyPoints < 0
                                  ? 'bg-[#FF5200]/20 text-[#FF5200] border border-[#FF5200]/40'
                                  : 'bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40'
                              }`}
                            >
                              {team.totalPenaltyPoints > 0 ? `+${team.totalPenaltyPoints}` : team.totalPenaltyPoints}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      )}

                      {/* Total Points */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-extrabold text-base text-[#FFB800]">
                          {team.totalPoints} <span className="text-xs text-slate-400 font-rajdhani uppercase">PTS</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      )}

      {/* Broadcast & Production Access Hub (OBS Link & Admin Panel URL) */}
      {((activeTab === 'broadcast' && (broadcastSubTab === 'overlays' || broadcastSubTab === 'guide' || activeTab === 'all')) || activeTab === 'all') && (
        <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-[#1a83c5]/15 text-[#1a83c5] border border-[#1a83c5]/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                STREAM PRODUCTION
              </span>
              <span className="text-slate-400 text-xs font-mono">
                OBS Overlays &amp; Feeds
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
              <Tv className="w-5 h-5 text-[#1a83c5]" />
              Production Links &amp; OBS Overlays Hub
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy distinct links for your OBS Browser Sources. <strong>Link 1</strong> is for live in-game matches, and <strong>Link 2</strong> is for intermissions between games.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const overlayUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=overlay`;
                handleCopyLink('obs-ingame-quick', overlayUrl);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#1a83c5] hover:brightness-110 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-[#1a83c5]/20 cursor-pointer"
              title="Copy In-Game OBS Overlay URL"
            >
              {copiedKey === 'obs-ingame-quick' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === 'obs-ingame-quick' ? 'In-Game URL Copied!' : 'Copy In-Game Link'}
            </button>
            <button
              onClick={() => {
                const stageUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=wide`;
                handleCopyLink('obs-stage-quick', stageUrl);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#FFB800] hover:brightness-110 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-[#FFB800]/20 cursor-pointer"
              title="Copy Between-Games Stage Leaderboard URL"
            >
              {copiedKey === 'obs-stage-quick' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === 'obs-stage-quick' ? 'Stage URL Copied!' : 'Copy Stage Link (Between Games)'}
            </button>
            <button
              onClick={() => {
                const adminUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/admin`;
                handleCopyLink('admin', adminUrl);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-200 border border-[#334155] font-bold text-xs font-rajdhani uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copy direct Admin Panel link"
            >
              {copiedKey === 'admin' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === 'admin' ? 'Admin URL Copied!' : 'Copy Admin Link'}
            </button>
          </div>
        </div>

        {/* Test on OBS Duration Controller */}
        <div className="bg-[#121824] border border-[#1E293B] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs mt-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white font-rajdhani uppercase tracking-wider">
              OBS Test Trigger Duration:
            </span>
            <span className="text-slate-400 text-[11px]">
              Controls how many seconds overlays remain visible when triggering tests on live OBS
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            {[10, 20, 30, 60].map((dur) => (
              <button
                key={dur}
                type="button"
                onClick={() => setObsTestDuration(dur)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  obsTestDuration === dur
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                    : 'bg-[#1E293B] text-slate-300 hover:bg-[#334155]'
                }`}
              >
                {dur}s {dur === 20 ? '(Default)' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Overlay Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4 text-xs font-mono">
          {/* Card 1: In-Game OBS Overlay (Compact HUD) */}
          <div className="bg-[#0B0E14] border border-[#1E293B] rounded-2xl p-4 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <Tv className="w-4 h-4 text-[#1a83c5]" />
                  <span className="text-[12px] font-bold text-[#1a83c5] font-rajdhani uppercase tracking-wider">
                    1. In-Game Leaderboard
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#00FF66] bg-[#00FF66]/10 border border-[#00FF66]/30 px-2 py-0.5 rounded-lg font-mono">
                  DURING MATCHES
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mb-2">
                Full esports leaderboard with team standings and squad health meters for stream sides.
              </p>

              {/* Recommended OBS Dimensions Box */}
              <div className="bg-[#121824] border border-[#1a83c5]/30 rounded-xl p-2.5 mb-3 text-[11px] font-mono space-y-1">
                <div className="text-[10px] font-bold text-[#1a83c5] font-rajdhani uppercase tracking-wider flex items-center justify-between">
                  <span>Recommended OBS Size:</span>
                  <span className="bg-[#1a83c5]/15 px-1.5 py-0.2 rounded text-[10px]">~1:2.45 Ratio</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Width × Height:</span>
                  <span className="text-white font-bold bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">440 × 1080 px</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>For 720p canvas:</span>
                  <span className="text-slate-300 font-mono">350 × 720 px</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Screen Position:</span>
                  <span className="text-[#00FF66]">Left or Right edge</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold tracking-wider">Standard URL:</div>
                <p className="text-[11px] text-slate-200 break-all bg-[#121824] p-2.5 rounded-xl border border-[#1E293B] select-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?view=obs&layout=overlay` : '/?view=obs&layout=overlay'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <a
                    href="/?view=obs&layout=overlay&preview=true&demo=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview Overlay
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      triggerObsOverlayTest('overlay', obsTestDuration);
                      setCopiedKey('test-overlay-sent');
                      setTimeout(() => setCopiedKey(null), 3000);
                    }}
                    className="text-[10px] text-[#38bdf8] hover:text-white flex items-center gap-1 font-sans cursor-pointer font-bold bg-[#38bdf8]/15 hover:bg-[#38bdf8]/30 px-2 py-0.5 rounded border border-[#38bdf8]/40 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" /> {copiedKey === 'test-overlay-sent' ? '✓ Sent to OBS!' : `Send Test (${obsTestDuration}s)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerObsOverlayTest('overlay', 5, { teamId: 1, placement: 9 });
                      triggerObsOverlayTest('narrow', 5, { teamId: 1, placement: 9 });
                      triggerObsOverlayTest('elimination', 5, { teamId: 1, placement: 9 });
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('TRIGGER_ELIMINATION_ANIMATION', { detail: { placement: 9 } }));
                        try {
                          localStorage.setItem('pubg_test_elim_trigger', JSON.stringify({ timestamp: Date.now(), placement: 9 }));
                        } catch {}
                      }
                      setCopiedKey('test-elim-triggered');
                      setTimeout(() => setCopiedKey(null), 3000);
                    }}
                    className="text-[10px] text-[#ff4763] hover:text-[#ff758a] flex items-center gap-1 font-sans cursor-pointer font-bold bg-[#ff4763]/10 hover:bg-[#ff4763]/20 px-2 py-0.5 rounded border border-[#ff4763]/30 transition-colors"
                    title="Simulate team getting eliminated with side wipe saying '#9 Eliminated!'"
                  >
                    <Skull className="w-3 h-3" /> {copiedKey === 'test-elim-triggered' ? '✓ Triggered!' : 'Test Elim Wipe'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=overlay`;
                    handleCopyLink('obs-ingame-card', url);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1a83c5] hover:brightness-110 text-black text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer flex-shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey === 'obs-ingame-card' ? '✓ Copied' : 'Copy Link'}
                </button>
              </div>
              {/* Alpha Transparent Sub-option */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span>Transparent Alpha BG:</span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=overlay&transparent=true`;
                    handleCopyLink('obs-ingame-alpha', url);
                  }}
                  className="text-[#FF5200] hover:underline font-bold font-mono cursor-pointer"
                >
                  {copiedKey === 'obs-ingame-alpha' ? '✓ Alpha Copied' : 'Copy Alpha URL'}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Latest 4 Teams Overlay (Wide Top-of-Screen HUD) */}
          <div className="bg-[#0B0E14] border border-[#00FF66]/30 rounded-2xl p-4 flex flex-col justify-between shadow-md ring-1 ring-[#00FF66]/20">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#00FF66]" />
                  <span className="text-[12px] font-bold text-[#00FF66] font-rajdhani uppercase tracking-wider">
                    2. Latest 4 Teams (Top HUD)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#1a83c5] bg-[#1a83c5]/10 border border-[#1a83c5]/30 px-2 py-0.5 rounded-lg font-mono">
                  TOP SCREEN BAR
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mb-2">
                Wide horizontal top overlay showing the final 4 surviving teams with dynamic player health. Stays active in background and automatically appears when 4 teams remain. When a team wins, displays WWCD.
              </p>

              {/* Recommended OBS Dimensions Box */}
              <div className="bg-[#121824] border border-[#00FF66]/30 rounded-xl p-2.5 mb-3 text-[11px] font-mono space-y-1">
                <div className="text-[10px] font-bold text-[#00FF66] font-rajdhani uppercase tracking-wider flex items-center justify-between">
                  <span>Recommended OBS Size:</span>
                  <span className="bg-[#00FF66]/15 px-1.5 py-0.2 rounded text-[10px]">24:1 Bar</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Width × Height:</span>
                  <span className="text-[#00FF66] font-bold bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">1920 × 80 px</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>For 720p canvas:</span>
                  <span className="text-slate-300 font-mono">1280 × 65 px</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Screen Position:</span>
                  <span className="text-[#00FF66]">Top Center (X: 0, Y: 15)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold tracking-wider">Standard URL:</div>
                <p className="text-[11px] text-slate-200 break-all bg-[#121824] p-2.5 rounded-xl border border-[#1E293B] select-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?view=obs&layout=top4` : '/?view=obs&layout=top4'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href="/?view=obs&layout=top4&preview=true&demo=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-[#00FF66] flex items-center gap-1 font-sans cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview Top 4 HUD
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      triggerObsOverlayTest('top4', obsTestDuration);
                      setCopiedKey('test-top4-sent');
                      setTimeout(() => setCopiedKey(null), 3000);
                    }}
                    className="text-[10px] text-[#00FF66] hover:text-white flex items-center gap-1 font-sans cursor-pointer font-bold bg-[#00FF66]/15 hover:bg-[#00FF66]/30 px-2 py-0.5 rounded border border-[#00FF66]/40 transition-colors"
                  >
                    <Flame className="w-3 h-3" /> {copiedKey === 'test-top4-sent' ? '✓ Sent to OBS!' : `Send Test (${obsTestDuration}s)`}
                  </button>
                </div>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=top4`;
                    handleCopyLink('obs-top4-card', url);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#00FF66] hover:brightness-110 text-black text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_8px_rgba(0,255,102,0.3)] flex-shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey === 'obs-top4-card' ? '✓ Copied' : 'Copy Top 4 Link'}
                </button>
              </div>
              {/* Alpha Transparent Sub-option */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span>Transparent Alpha BG:</span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=top4&transparent=true`;
                    handleCopyLink('obs-top4-alpha', url);
                  }}
                  className="text-[#1a83c5] hover:underline font-bold font-mono cursor-pointer"
                >
                  {copiedKey === 'obs-top4-alpha' ? '✓ Alpha Copied' : 'Copy Alpha URL'}
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Between-Games Stage Leaderboard (Widescreen 16:9) */}
          <div className="bg-[#0B0E14] border border-[#1E293B] rounded-2xl p-4 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-[#FFB800]" />
                  <span className="text-[12px] font-bold text-[#FFB800] font-rajdhani uppercase tracking-wider">
                    3. Between Games Stage
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#FFB800] bg-[#FFB800]/10 border border-[#FFB800]/30 px-2 py-0.5 rounded-lg font-mono">
                  INTERMISSIONS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mb-2">
                Widescreen 16:9 stage broadcast with Top 3 podium spotlight and dual-page team standings (up to 18 teams).
              </p>

              {/* Recommended OBS Dimensions Box */}
              <div className="bg-[#121824] border border-[#FFB800]/30 rounded-xl p-2.5 mb-3 text-[11px] font-mono space-y-1">
                <div className="text-[10px] font-bold text-[#FFB800] font-rajdhani uppercase tracking-wider flex items-center justify-between">
                  <span>Recommended OBS Size:</span>
                  <span className="bg-[#FFB800]/15 px-1.5 py-0.2 rounded text-[10px]">16:9 Fullscreen</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Width × Height:</span>
                  <span className="text-[#FFB800] font-bold bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">1920 × 1080 px</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>For 720p canvas:</span>
                  <span className="text-slate-300 font-mono">1280 × 720 px</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Screen Position:</span>
                  <span className="text-[#FFB800]">Full Scene Canvas</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold tracking-wider">Standard URL (Stage Theme):</div>
                <p className="text-[11px] text-slate-200 break-all bg-[#121824] p-2.5 rounded-xl border border-[#1E293B] select-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?view=obs&layout=wide` : '/?view=obs&layout=wide'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href="/?view=obs&layout=wide&preview=true&demo=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview Stage
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      triggerObsOverlayTest('wide', obsTestDuration);
                      setCopiedKey('test-stage-sent');
                      setTimeout(() => setCopiedKey(null), 3000);
                    }}
                    className="text-[10px] text-[#FFB800] hover:text-white flex items-center gap-1 font-sans cursor-pointer font-bold bg-[#FFB800]/15 hover:bg-[#FFB800]/30 px-2 py-0.5 rounded border border-[#FFB800]/40 transition-colors"
                  >
                    <Trophy className="w-3 h-3" /> {copiedKey === 'test-stage-sent' ? '✓ Sent to OBS!' : `Send Test (${obsTestDuration}s)`}
                  </button>
                </div>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=wide`;
                    handleCopyLink('obs-stage-card', url);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#FFB800] hover:brightness-110 text-black text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer flex-shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey === 'obs-stage-card' ? '✓ Copied' : 'Copy Stage Link'}
                </button>
              </div>
              {/* Alpha Transparent Sub-option */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span>Transparent Alpha BG:</span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=wide&transparent=true`;
                    handleCopyLink('obs-stage-alpha', url);
                  }}
                  className="text-[#FF5200] hover:underline font-bold font-mono cursor-pointer"
                >
                  {copiedKey === 'obs-stage-alpha' ? '✓ Alpha Copied' : 'Copy Alpha URL'}
                </button>
              </div>

              {/* Flexible Half-Screen Leaderboard Link with intact slide */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-[#1E293B]">
                <span className="flex items-center gap-1">
                  <span className="text-[#38bdf8]">Flexible Half-Screen:</span>
                  <span className="text-slate-500 font-mono">(50% width / split slide)</span>
                </span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=half`;
                    handleCopyLink('obs-stage-half', url);
                  }}
                  className="text-[#38bdf8] hover:underline font-bold font-mono cursor-pointer"
                >
                  {copiedKey === 'obs-stage-half' ? '✓ Half Copied' : 'Copy Half-Screen Link'}
                </button>
              </div>

              {/* Main Leaderboard Link */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="text-[#10b981]">Main Leaderboard:</span>
                  <span className="text-slate-500 font-mono">(Classic Dual Column)</span>
                </span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=main`;
                    handleCopyLink('obs-stage-main', url);
                  }}
                  className="text-[#10b981] hover:underline font-bold font-mono cursor-pointer"
                >
                  {copiedKey === 'obs-stage-main' ? '✓ Main Copied' : 'Copy Main Link'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-[#1E293B]">
                <span className="flex items-center gap-1">
                  <span>Slide Duration:</span>
                  <strong className="text-amber-400 font-mono">{config.stageSlideIntervalSeconds ?? 20}s / page</strong>
                </span>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="text-sky-400 hover:underline font-bold cursor-pointer"
                >
                  Adjust in Settings
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: Admin & Tournament Controller */}
          <div className="bg-[#0B0E14] border border-[#1E293B] rounded-2xl p-4 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span className="text-[12px] font-bold text-white font-rajdhani uppercase tracking-wider">
                    4. Tournament Admin
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded-lg bg-[#1E293B]">
                  CONTROL PANEL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mb-2">
                Operator dashboard to adjust scores, set tournament name, trigger match saves, and manage spectator ingestion.
              </p>

              {/* Specs Box */}
              <div className="bg-[#121824] border border-[#1E293B] rounded-xl p-2.5 mb-3 text-[11px] font-mono space-y-1">
                <div className="text-[10px] font-bold text-slate-300 font-rajdhani uppercase tracking-wider flex items-center justify-between">
                  <span>Usage Target:</span>
                  <span className="text-[#1a83c5]">Operator Screen</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Browser Target:</span>
                  <span className="text-white font-bold bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">Chrome / Edge</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Device:</span>
                  <span className="text-slate-300 font-mono">PC / Tablet (Any)</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Direct Route:</span>
                  <span className="text-[#1a83c5]">/admin</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold tracking-wider">Admin Panel URL:</div>
                <p className="text-[11px] text-slate-200 break-all bg-[#121824] p-2.5 rounded-xl border border-[#1E293B] select-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/admin` : '/admin'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-sans">Admins &amp; casters only</span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/admin`;
                    handleCopyLink('admin-card', url);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey === 'admin-card' ? '✓ Copied' : 'Copy Admin Link'}
                </button>
              </div>
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span>Access shortcut:</span>
                <span className="text-[#1a83c5] font-mono font-bold">/admin</span>
              </div>
            </div>
          </div>

          {/* Card 5: Small Team Eliminated Alert Overlay (Active in Background, Pops up on Elimination) */}
          <div className="bg-[#0B0E14] border border-[#ff2a4b]/40 rounded-2xl p-4 flex flex-col justify-between shadow-md ring-1 ring-[#ff2a4b]/20">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <Skull className="w-4 h-4 text-[#ff2a4b]" />
                  <span className="text-[12px] font-bold text-[#ff2a4b] font-rajdhani uppercase tracking-wider">
                    5. Team Eliminated Alert
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#ff2a4b] bg-[#ff2a4b]/10 border border-[#ff2a4b]/30 px-2 py-0.5 rounded-lg font-mono">
                  POPUP ALERT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mb-2">
                Small overlay that stays active and hidden in the background until a squad is wiped. Pops up with dynamic spring entrance, team flag, team name, and exact placement badge (e.g. &ldquo;#9 Eliminated!&rdquo;).
              </p>

              {/* Specs Box */}
              <div className="bg-[#121824] border border-[#ff2a4b]/30 rounded-xl p-2.5 mb-3 text-[11px] font-mono space-y-1">
                <div className="text-[10px] font-bold text-[#ff2a4b] font-rajdhani uppercase tracking-wider flex items-center justify-between">
                  <span>Recommended OBS Size:</span>
                  <span className="bg-[#ff2a4b]/15 px-1.5 py-0.2 rounded text-[10px]">Small Card or Full 1080p</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Width × Height:</span>
                  <span className="text-white font-bold bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">500 × 260 px</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Full Screen Option:</span>
                  <span className="text-slate-300 font-mono">1920 × 1080 px (Alpha)</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Screen Position:</span>
                  <span className="text-[#ff4d6d]">Top-Right or Top-Center</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold tracking-wider">Standard URL:</div>
                <p className="text-[11px] text-slate-200 break-all bg-[#121824] p-2.5 rounded-xl border border-[#1E293B] select-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?view=obs&layout=elimination` : '/?view=obs&layout=elimination'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href="/?view=obs&layout=elimination&preview=1&demo=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview Alert
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      triggerObsOverlayTest('elimination', 5, { teamId: 1 });
                      setCopiedKey('alert-elim-triggered');
                      setTimeout(() => setCopiedKey(null), 3000);
                    }}
                    className="text-[10px] text-[#ff4763] hover:text-[#ff758a] flex items-center gap-1 font-sans cursor-pointer font-bold bg-[#ff4763]/10 hover:bg-[#ff4763]/20 px-2 py-0.5 rounded border border-[#ff4763]/30 transition-colors"
                  >
                    <Skull className="w-3 h-3" /> {copiedKey === 'alert-elim-triggered' ? '✓ Alert Sent!' : 'Send Test Alert (5s)'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=elimination`;
                    handleCopyLink('obs-elim-card', url);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#ff2a4b] hover:brightness-110 text-white text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer flex-shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey === 'obs-elim-card' ? '✓ Copied' : 'Copy Link'}
                </button>
              </div>
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span>Top-Center Position:</span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=elimination&pos=top-center`;
                    handleCopyLink('obs-elim-topcenter', url);
                  }}
                  className="text-amber-400 hover:underline font-bold font-mono cursor-pointer"
                >
                  {copiedKey === 'obs-elim-topcenter' ? '✓ Copied' : 'Copy Top-Center URL'}
                </button>
              </div>
            </div>
          </div>

          {/* Card 6: Match MVP Overlay (Full Screen & Small Pop Up Version) */}
          <div className="bg-[#0B0E14] border border-amber-400/40 rounded-2xl p-4 flex flex-col justify-between shadow-md ring-1 ring-amber-400/20">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-[12px] font-bold text-amber-400 font-rajdhani uppercase tracking-wider">
                    6. Match MVP (Full Screen &amp; Small Pop Up)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-lg font-mono">
                  FULLSCREEN &amp; POPUP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mb-2">
                Esports broadcast MVP presentation with Tournament Title, Match Number, Tournament Logo, and Player Portrait linked by UID. Available as a full 1080p broadcast stage or a sleek lower-third corner pop-up card.
              </p>

              {/* Specs Box */}
              <div className="bg-[#121824] border border-amber-400/30 rounded-xl p-2.5 mb-3 text-[11px] font-mono space-y-1">
                <div className="text-[10px] font-bold text-amber-400 font-rajdhani uppercase tracking-wider flex items-center justify-between">
                  <span>Recommended OBS Sizes:</span>
                  <span className="bg-amber-400/15 px-1.5 py-0.2 rounded text-[10px]">Dual Modes</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Full Screen Stage:</span>
                  <span className="text-amber-400 font-bold bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">1920 × 1080 px</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Small Pop Up Card:</span>
                  <span className="text-sky-400 font-bold bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">560 × 260 px</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Player Portrait:</span>
                  <span className="text-[#00FF66]">Linked via Player UID</span>
                </div>
              </div>

              {/* Remote Broadcast Live Controls */}
              <div className="bg-[#070e1c] border border-amber-400/30 rounded-xl p-2.5 mb-3 space-y-2">
                <div className="text-[10px] font-bold text-amber-400 font-rajdhani uppercase tracking-wider flex items-center justify-between">
                  <span>Remote Broadcast Controls:</span>
                  <span className="text-[9px] font-mono text-slate-400">Controls Live OBS</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        if (typeof BroadcastChannel !== 'undefined') {
                          const bc = new BroadcastChannel('pubg_mvp_channel');
                          bc.postMessage({ type: 'SET_MVP_SCOPE', scope: 'latest' });
                          bc.close();
                        }
                        localStorage.setItem('pubg_mvp_scope_remote', 'latest');
                        setCopiedKey('mvp-remote-latest');
                        setTimeout(() => setCopiedKey(null), 2000);
                      } catch {}
                    }}
                    className="px-2 py-1 rounded bg-[#121d33] hover:bg-[#1a2d52] text-slate-200 border border-[#1a83c5]/40 text-[10px] font-bold font-rajdhani uppercase transition-colors"
                  >
                    {copiedKey === 'mvp-remote-latest' ? '✓ Switched to Latest' : 'Set Scope: Latest'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        if (typeof BroadcastChannel !== 'undefined') {
                          const bc = new BroadcastChannel('pubg_mvp_channel');
                          bc.postMessage({ type: 'SET_MVP_SCOPE', scope: 'all' });
                          bc.close();
                        }
                        localStorage.setItem('pubg_mvp_scope_remote', 'all');
                        setCopiedKey('mvp-remote-all');
                        setTimeout(() => setCopiedKey(null), 2000);
                      } catch {}
                    }}
                    className="px-2 py-1 rounded bg-[#121d33] hover:bg-[#1a2d52] text-amber-300 border border-amber-400/40 text-[10px] font-bold font-rajdhani uppercase transition-colors"
                  >
                    {copiedKey === 'mvp-remote-all' ? '✓ Switched to All' : 'Set Scope: All Matches'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        if (typeof BroadcastChannel !== 'undefined') {
                          const bc = new BroadcastChannel('pubg_mvp_channel');
                          bc.postMessage({ type: 'SET_MVP_VARIANT', variant: 'fullscreen' });
                          bc.close();
                        }
                        localStorage.setItem('pubg_mvp_variant_remote', 'fullscreen');
                        setCopiedKey('mvp-remote-full');
                        setTimeout(() => setCopiedKey(null), 2000);
                      } catch {}
                    }}
                    className="px-2 py-1 rounded bg-[#121d33] hover:bg-[#1a2d52] text-slate-200 border border-[#1E293B] text-[10px] font-mono transition-colors"
                  >
                    {copiedKey === 'mvp-remote-full' ? '✓ Fullscreen' : 'Mode: Fullscreen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        if (typeof BroadcastChannel !== 'undefined') {
                          const bc = new BroadcastChannel('pubg_mvp_channel');
                          bc.postMessage({ type: 'SET_MVP_VARIANT', variant: 'popup' });
                          bc.close();
                        }
                        localStorage.setItem('pubg_mvp_variant_remote', 'popup');
                        setCopiedKey('mvp-remote-popup');
                        setTimeout(() => setCopiedKey(null), 2000);
                      } catch {}
                    }}
                    className="px-2 py-1 rounded bg-[#121d33] hover:bg-[#1a2d52] text-sky-300 border border-sky-400/40 text-[10px] font-mono transition-colors"
                  >
                    {copiedKey === 'mvp-remote-popup' ? '✓ Pop Up Card' : 'Mode: Small Pop Up'}
                  </button>
                </div>
              </div>

              {/* URLs List */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold tracking-wider">
                  Full Screen Latest Match URL:
                </div>
                <p className="text-[11px] text-slate-200 break-all bg-[#121824] p-2 rounded-xl border border-[#1E293B] select-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?view=obs&layout=mvp&scope=latest&variant=fullscreen` : '/?view=obs&layout=mvp&scope=latest&variant=fullscreen'}
                </p>

                <div className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold tracking-wider pt-1">
                  Small Pop Up Latest Match URL:
                </div>
                <p className="text-[11px] text-slate-200 break-all bg-[#121824] p-2 rounded-xl border border-[#1E293B] select-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?view=obs&layout=mvp&scope=latest&variant=popup` : '/?view=obs&layout=mvp&scope=latest&variant=popup'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <a
                    href="/?view=obs&layout=mvp&scope=latest&variant=fullscreen&preview=true&demo=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview Full
                  </a>
                  <a
                    href="/?view=obs&layout=mvp&scope=latest&variant=popup&preview=true&demo=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 font-sans cursor-pointer font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview Pop Up
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      triggerObsOverlayTest('mvp', obsTestDuration);
                      setCopiedKey('test-mvp-sent');
                      setTimeout(() => setCopiedKey(null), 3000);
                    }}
                    className="text-[10px] text-amber-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer font-bold bg-amber-400/15 hover:bg-amber-400/30 px-2 py-0.5 rounded border border-amber-400/40 transition-colors"
                  >
                    <Crown className="w-3 h-3" /> {copiedKey === 'test-mvp-sent' ? '✓ Sent to OBS!' : `Send Test (${obsTestDuration}s)`}
                  </button>
                </div>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=mvp&scope=latest&variant=fullscreen`;
                    handleCopyLink('obs-mvp-latest', url);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:brightness-110 text-black text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer flex-shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey === 'obs-mvp-latest' ? '✓ Copied' : 'Copy Fullscreen'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span>Copy Small Pop Up URL:</span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=mvp&scope=latest&variant=popup`;
                    handleCopyLink('obs-mvp-popup', url);
                  }}
                  className="text-sky-400 hover:underline font-bold font-mono cursor-pointer"
                >
                  {copiedKey === 'obs-mvp-popup' ? '✓ Copied Pop Up Link' : 'Copy Small Pop Up Link'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-400">
                <span>Copy All Matches URL:</span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=mvp&scope=all&variant=fullscreen`;
                    handleCopyLink('obs-mvp-all', url);
                  }}
                  className="text-amber-400 hover:underline font-bold font-mono cursor-pointer"
                >
                  {copiedKey === 'obs-mvp-all' ? '✓ Copied All Matches' : 'Copy All Matches Link'}
                </button>
              </div>
            </div>
          </div>

          {/* Card 7: Team Stats Broadcast Overlay (Full Screen Stage & Small Pop Up) */}
          <div className="bg-[#0B0E14] border border-[#38bdf8]/40 rounded-2xl p-4 flex flex-col justify-between shadow-md ring-1 ring-[#38bdf8]/20">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#38bdf8]" />
                  <span className="text-[12px] font-bold text-[#38bdf8] font-rajdhani uppercase tracking-wider">
                    7. Team Stats Overlay (Full Screen &amp; Small Pop Up)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30 px-2 py-0.5 rounded-lg font-mono">
                  TRIGGERED 20s POPUP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mb-2">
                Broadcast team roster card with 4-player stats (Kills, Damage, Knockouts, Survival Time).
                Stays hidden in OBS until triggered, then pops up for 20 seconds and automatically hides!
              </p>

              {/* Specs Box */}
              <div className="bg-[#121824] border border-[#38bdf8]/30 rounded-xl p-2.5 mb-3 text-[11px] font-mono space-y-1">
                <div className="text-[10px] font-bold text-[#38bdf8] font-rajdhani uppercase tracking-wider flex items-center justify-between">
                  <span>Recommended OBS Sizes:</span>
                  <span className="bg-[#38bdf8]/15 px-1.5 py-0.2 rounded text-[10px]">Dual Broadcast Modes</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Small Pop Up Card:</span>
                  <span className="text-[#38bdf8] font-bold bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">520 × 280 px (Bottom-Left)</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Full Screen Stage:</span>
                  <span className="text-white font-bold bg-[#1E293B] px-1.5 py-0.5 rounded border border-[#334155]">1920 × 1080 px (Alpha)</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Trigger Behavior:</span>
                  <span className="text-[#00FF66]">Pops up for {obsTestDuration}s then returns to hidden</span>
                </div>
              </div>

              {/* Trigger Buttons */}
              <div className="bg-[#070e1c] border border-[#38bdf8]/30 rounded-xl p-2.5 mb-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#38bdf8] font-rajdhani uppercase tracking-wider">
                  <span>Remote Broadcast Triggers:</span>
                  <span className="text-[9px] font-mono text-slate-400">Pops up in OBS for {obsTestDuration}s</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const targetTid = config.selectedTeamStatsId || 1;
                      triggerObsOverlayTest('teamstats_popup', obsTestDuration, { teamId: targetTid });
                      triggerObsOverlayTest('teamstats', obsTestDuration, { teamId: targetTid });
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('TEAM_STATS_TRIGGER', {
                          detail: { type: 'TEAM_STATS_TRIGGER', teamId: targetTid, durationSeconds: obsTestDuration }
                        }));
                      }
                      setCopiedKey('trigger-ts-popup');
                      setTimeout(() => setCopiedKey(null), 3000);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#38bdf8]/20 hover:bg-[#38bdf8]/30 text-[#38bdf8] border border-[#38bdf8]/40 text-xs font-bold font-rajdhani uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'trigger-ts-popup' ? '✓ Pop Up Triggered!' : `Trigger Pop Up (${obsTestDuration}s)`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetTid = config.selectedTeamStatsId || 1;
                      triggerObsOverlayTest('teamstats', obsTestDuration, { teamId: targetTid });
                      triggerObsOverlayTest('teamstats_popup', obsTestDuration, { teamId: targetTid });
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('TEAM_STATS_TRIGGER', {
                          detail: { type: 'TEAM_STATS_TRIGGER', teamId: targetTid, durationSeconds: obsTestDuration }
                        }));
                      }
                      setCopiedKey('trigger-ts-full');
                      setTimeout(() => setCopiedKey(null), 3000);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1a83c5]/20 hover:bg-[#1a83c5]/30 text-white border border-[#1a83c5]/40 text-xs font-bold font-rajdhani uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'trigger-ts-full' ? '✓ Stage Triggered!' : `Trigger Stage (${obsTestDuration}s)`}</span>
                  </button>
                </div>
              </div>

              {/* URLs List */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold tracking-wider">
                  Small Pop Up Card URL:
                </div>
                <p className="text-[11px] text-slate-200 break-all bg-[#121824] p-2 rounded-xl border border-[#1E293B] select-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?view=obs&layout=teamstats_popup` : '/?view=obs&layout=teamstats_popup'}
                </p>

                <div className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold tracking-wider pt-1">
                  Full Screen Stage URL:
                </div>
                <p className="text-[11px] text-slate-200 break-all bg-[#121824] p-2 rounded-xl border border-[#1E293B] select-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/?view=obs&layout=teamstats` : '/?view=obs&layout=teamstats'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <a
                    href="/?view=obs&layout=teamstats_popup&preview=true&demo=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#38bdf8] hover:underline flex items-center gap-1 font-sans cursor-pointer font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview Pop Up
                  </a>
                  <a
                    href="/?view=obs&layout=teamstats&preview=true&demo=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview Stage
                  </a>
                </div>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=teamstats_popup`;
                    handleCopyLink('obs-teamstats-popup', url);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#38bdf8] hover:brightness-110 text-black text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-[#38bdf8]/20"
                >
                  <Copy className="w-3 h-3" />
                  {copiedKey === 'obs-teamstats-popup' ? '✓ Copied' : 'Copy Pop Up Link'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span>Copy Full Screen Stage URL:</span>
                <button
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?view=obs&layout=teamstats`;
                    handleCopyLink('obs-teamstats-full', url);
                  }}
                  className="text-[#38bdf8] hover:underline font-bold font-mono cursor-pointer"
                >
                  {copiedKey === 'obs-teamstats-full' ? '✓ Copied Stage Link' : 'Copy Full Stage Link'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* OBS Browser Source Setup & Resolution Quick Reference Guide */}
        <div className="mt-4 bg-[#0B0E14] border border-[#1E293B] rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-[#1a83c5]" />
              <span className="text-xs sm:text-sm font-bold text-white font-rajdhani uppercase tracking-wider">
                OBS Browser Source Resolution &amp; Ratio Reference Guide
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded-lg bg-[#121824] border border-[#1E293B]">
              OBS STUDIO / STREAMLABS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E293B] text-[10px] text-slate-400 uppercase font-rajdhani tracking-wider">
                  <th className="pb-2 font-bold">Overlay Type</th>
                  <th className="pb-2 font-bold">Aspect Ratio</th>
                  <th className="pb-2 font-bold">1080p Canvas (W × H)</th>
                  <th className="pb-2 font-bold">720p Canvas (W × H)</th>
                  <th className="pb-2 font-bold">FPS</th>
                  <th className="pb-2 font-bold">Recommended Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-[11px]">
                <tr className="hover:bg-[#121824]/40">
                  <td className="py-2.5 font-bold text-[#1a83c5] font-rajdhani uppercase tracking-wide">
                    1. In-Game Leaderboard
                  </td>
                  <td className="py-2.5 text-slate-300">~1:2.45 (Vertical Strip)</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-[#1E293B] text-white font-bold border border-[#334155]">
                      440 × 1080 px
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-400">350 × 720 px</td>
                  <td className="py-2.5 text-[#00FF66] font-bold">60</td>
                  <td className="py-2.5 text-slate-300">Dock to Left or Right Edge (X: 0, Y: 0)</td>
                </tr>
                <tr className="hover:bg-[#121824]/40">
                  <td className="py-2.5 font-bold text-[#00FF66] font-rajdhani uppercase tracking-wide">
                    2. Top 4 Live HUD
                  </td>
                  <td className="py-2.5 text-slate-300">24:1 (Ultra-Wide Top Bar)</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#00FF66] font-bold border border-[#00FF66]/30">
                      1920 × 80 px
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-400">1280 × 65 px</td>
                  <td className="py-2.5 text-[#00FF66] font-bold">60</td>
                  <td className="py-2.5 text-slate-300">Top Center (X: 0, Y: 10–20px)</td>
                </tr>
                <tr className="hover:bg-[#121824]/40">
                  <td className="py-2.5 font-bold text-[#FFB800] font-rajdhani uppercase tracking-wide">
                    3. Stage Leaderboard
                  </td>
                  <td className="py-2.5 text-slate-300">16:9 (Widescreen)</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#FFB800] font-bold border border-[#FFB800]/30">
                      1920 × 1080 px
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-400">1280 × 720 px</td>
                  <td className="py-2.5 text-[#00FF66] font-bold">60</td>
                  <td className="py-2.5 text-slate-300">Full Screen Canvas (Between-Games / Podium)</td>
                </tr>
                <tr className="hover:bg-[#121824]/40">
                  <td className="py-2.5 font-bold text-[#ff2a4b] font-rajdhani uppercase tracking-wide">
                    4. Team Eliminated Alert
                  </td>
                  <td className="py-2.5 text-slate-300">~2:1 (Popup Card)</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#ff2a4b] font-bold border border-[#ff2a4b]/30">
                      500 × 260 px
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-400">400 × 220 px</td>
                  <td className="py-2.5 text-[#00FF66] font-bold">60</td>
                  <td className="py-2.5 text-slate-300">Top-Right or Top-Center (Hidden until Wipe)</td>
                </tr>
                <tr className="hover:bg-[#121824]/40">
                  <td className="py-2.5 font-bold text-amber-400 font-rajdhani uppercase tracking-wide">
                    5. Full Screen Match MVP
                  </td>
                  <td className="py-2.5 text-slate-300">16:9 (Widescreen)</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-[#1E293B] text-amber-400 font-bold border border-amber-400/30">
                      1920 × 1080 px
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-400">1280 × 720 px</td>
                  <td className="py-2.5 text-[#00FF66] font-bold">60</td>
                  <td className="py-2.5 text-slate-300">Full Scene Canvas (Post-Match / MVP Segment)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-2">
            <span>💡 Pro Tip: Uncheck &ldquo;Shutdown source when not visible&rdquo; in OBS to keep live standings seamlessly synchronized.</span>
            <span className="text-[#1a83c5]">Add &amp;transparent=true to URLs for clean transparent alpha backgrounds.</span>
          </div>
        </div>

        {/* OBS Custom CSS & Alpha Transparency Guide Box */}
        <div className="mt-4 bg-[#0B0E14] border border-[#1a83c5]/40 rounded-2xl p-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#1a83c5]/15 border border-[#1a83c5]/30 flex items-center justify-center text-[#1a83c5]">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <span>OBS Custom CSS for 100% Transparency</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a83c5]/20 text-[#1a83c5] font-mono border border-[#1a83c5]/30 font-bold">
                    RECOMMENDED
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Paste this CSS snippet into your OBS Browser Source properties under &ldquo;Custom CSS&rdquo; for seamless alpha transparency over your gameplay.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                const obsCss = `html, body, #root {\n  background-color: rgba(0, 0, 0, 0) !important;\n  background: transparent !important;\n  margin: 0px auto;\n  overflow: hidden;\n}`;
                handleCopyLink('obs-custom-css', obsCss);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#1a83c5] hover:brightness-110 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-[#1a83c5]/20 cursor-pointer flex-shrink-0"
            >
              {copiedKey === 'obs-custom-css' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === 'obs-custom-css' ? 'CSS Copied to Clipboard!' : 'Copy OBS Custom CSS'}
            </button>
          </div>

          <div className="relative bg-[#07090E] border border-[#1E293B] rounded-xl p-3 font-mono text-xs text-[#1a83c5]">
            <pre className="overflow-x-auto select-all leading-relaxed whitespace-pre-wrap">
{`html, body, #root {
  background-color: rgba(0, 0, 0, 0) !important;
  background: transparent !important;
  margin: 0px auto;
  overflow: hidden;
}`}
            </pre>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-slate-300 font-sans">
            <div className="bg-[#121824] p-2.5 rounded-xl border border-[#1E293B] flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1a83c5]/20 text-[#1a83c5] font-bold font-mono text-[11px] flex items-center justify-center flex-shrink-0">1</span>
              <span>In OBS Studio, double-click your <strong>Browser Source</strong> in the Sources list.</span>
            </div>
            <div className="bg-[#121824] p-2.5 rounded-xl border border-[#1E293B] flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1a83c5]/20 text-[#1a83c5] font-bold font-mono text-[11px] flex items-center justify-center flex-shrink-0">2</span>
              <span>Use the <strong>Alpha URL</strong> above (includes <code className="text-[#1a83c5]">&amp;transparent=true</code>).</span>
            </div>
            <div className="bg-[#121824] p-2.5 rounded-xl border border-[#1E293B] flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1a83c5]/20 text-[#1a83c5] font-bold font-mono text-[11px] flex items-center justify-center flex-shrink-0">3</span>
              <span>Replace the text in the <strong>Custom CSS</strong> field with this snippet and click <strong>OK</strong>.</span>
            </div>
          </div>
        </div>

        {/* Live Broadcast FX & Placement Change Animation Controls */}
        <div className="mt-4 pt-4 border-t border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0B0E14] p-4 rounded-2xl border border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              config.animatePlacementChanges !== false
                ? 'bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/40'
                : 'bg-[#1E293B] text-slate-400 border border-[#334155]'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white font-rajdhani uppercase tracking-wider">
                  Side Overlay Placement Change Animation
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono tracking-wider ${
                  config.animatePlacementChanges !== false
                    ? 'bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30'
                    : 'bg-[#FF5200]/15 text-[#FF5200] border border-[#FF5200]/30'
                }`}>
                  {config.animatePlacementChanges !== false ? '✨ ANIMATION ON' : '⚡ ANIMATION OFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Controls smooth sliding spring rank transitions when teams shift positions or gain points on the live stream leaderboard.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const currentVal = config.animatePlacementChanges !== false;
              if (onUpdateConfig) {
                onUpdateConfig({ ...config, animatePlacementChanges: !currentVal });
              }
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-2 transition-all flex-shrink-0 shadow-md cursor-pointer ${
              config.animatePlacementChanges !== false
                ? 'bg-[#FFB800] hover:brightness-110 text-black shadow-[#FFB800]/20'
                : 'bg-[#1E293B] hover:bg-[#334155] text-slate-300 border border-[#334155]'
            }`}
            title="Toggle smooth placement change animation in stream overlay"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {config.animatePlacementChanges !== false ? 'Disable Animation' : 'Enable Animation'}
          </button>
        </div>
      </div>

      )}

      {/* ========================================================================= */}
      {/* BACKUP & TOURNAMENT RESTORE HUB                                           */}
      {/* ========================================================================= */}
      {((activeTab === 'admin' && (adminSubTab === 'backup' || activeTab === 'all')) || activeTab === 'backup' || activeTab === 'all') && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-[#1E293B]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                    DATA INTEGRITY &amp; RECOVERY
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse" />
                    Auto-Vault Active (10-Min Snapshots)
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-emerald-400" />
                  Tournament Backups &amp; Data Restore
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload a tournament JSON file to restore past matches, download full tournament archives, or recover from local automatic restore points.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateManualSnapshot}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                  title="Create an instant local restore checkpoint in your browser"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Create Snapshot Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportTournamentBackupJson(config, savedMatches)}
                  className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-200 border border-[#334155] font-bold text-xs font-rajdhani uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Download complete tournament JSON backup"
                >
                  <Download className="w-3.5 h-3.5 text-[#FFB800]" />
                  <span>Download Backup (.json)</span>
                </button>
              </div>
            </div>

            {/* Notification Messages */}
            {backupUploadSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-[#00FF66]/10 border border-[#00FF66]/30 text-xs text-[#00FF66] font-mono flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{backupUploadSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBackupUploadSuccess(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}

            {backupUploadError && (
              <div className="mt-4 p-3 rounded-xl bg-[#FF5200]/10 border border-[#FF5200]/30 text-xs text-[#FF5200] font-mono flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{backupUploadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBackupUploadError(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Section 1: Upload Tournament Backup (.json) Dropzone & Inspector */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-[#1E293B]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white font-rajdhani uppercase tracking-wider">
                    Upload Tournament Backup (.json)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Import previously exported tournament files (<code className="text-emerald-400 font-mono">pubg_tournament_*.json</code>) or single match backups.
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#1E293B] text-slate-400 text-[10px] font-mono">
                JSON FORMAT ONLY
              </span>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={backupFileInputRef}
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBackupFileSelect(file);
                e.target.value = '';
              }}
            />

            {!backupFileState ? (
              /* Drag & Drop Area */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsBackupDragActive(true);
                }}
                onDragLeave={() => setIsBackupDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsBackupDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleBackupFileSelect(file);
                }}
                onClick={() => backupFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isBackupDragActive
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-[#1E293B] hover:border-emerald-500/50 hover:bg-[#161F2E]'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#1A2333] border border-[#2A374D] flex items-center justify-center text-emerald-400">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white font-rajdhani uppercase tracking-wider">
                    Drag and drop tournament backup JSON file here
                  </p>
                  <p className="text-xs text-slate-400">
                    or <span className="text-emerald-400 underline font-semibold">browse files</span> from your computer
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] text-slate-500 font-mono">
                  <span>Supports: Full Tournament Archives</span>
                  <span>•</span>
                  <span>Spectator Snapshots</span>
                  <span>•</span>
                  <span>Single Match JSON</span>
                </div>
              </div>
            ) : (
              /* Backup File Inspected Card */
              <div className="bg-[#0B0E14] border border-emerald-500/40 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E293B]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-white font-mono break-all">
                          {backupFileState.file.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                          VALID JSON
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Size: {(backupFileState.file.size / 1024).toFixed(1)} KB • {backupFileState.matches.length} matches detected
                        {backupFileState.dateExported && ` • Exported: ${new Date(backupFileState.dateExported).toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBackupFileState(null)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Choose Different File</span>
                  </button>
                </div>

                {/* Inspect details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-[#121824] p-3 rounded-xl border border-[#1E293B]">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Tournament Title</span>
                    <span className="font-bold text-white font-rajdhani">
                      {backupFileState.config?.name || config.name || 'PUBG MOBILE CHAMPIONSHIP'}
                    </span>
                  </div>
                  <div className="bg-[#121824] p-3 rounded-xl border border-[#1E293B]">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Matches Contained</span>
                    <span className="font-bold text-[#FFB800] font-rajdhani text-base">
                      {backupFileState.matches.length} Games
                    </span>
                  </div>
                  <div className="bg-[#121824] p-3 rounded-xl border border-[#1E293B]">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Game Mode</span>
                    <span className="font-bold text-[#1a83c5] font-rajdhani uppercase">
                      {backupFileState.config?.mode || config.mode || 'SQUAD'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setBackupFileState(null)}
                    className="px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-300 font-bold text-xs font-rajdhani uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteRestoreBackup('append')}
                    className="px-4 py-2.5 rounded-xl bg-[#1a83c5] hover:brightness-110 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#1a83c5]/20 cursor-pointer"
                    title="Append matches without replacing current games"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Append Matches (+{backupFileState.matches.length} Games)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteRestoreBackup('replace')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/25 cursor-pointer"
                    title="Replace entire tournament with this backup file"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restore Entire Tournament (Replace)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Instant Export & Safety Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Full JSON Backup */}
            <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-4 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/20 flex items-center justify-center text-[#FFB800]">
                    <Download className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-extrabold text-white font-rajdhani uppercase tracking-wider">
                    Full Tournament Backup
                  </h4>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Exports a self-contained JSON archive of tournament settings, logos, scoring presets, and all {savedMatches.length} completed matches.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportTournamentBackupJson(config, savedMatches)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#FFB800] hover:brightness-110 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#FFB800]/20 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Tournament JSON</span>
              </button>
            </div>

            {/* Card 2: Cumulative CSV Standings */}
            <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-4 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-extrabold text-white font-rajdhani uppercase tracking-wider">
                    Export Standings (CSV)
                  </h4>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Export complete cumulative leaderboard and match breakdown formatted for Microsoft Excel, Google Sheets, or liquipedia submission.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportStandingsCsv(config, savedMatches)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-emerald-400 border border-emerald-500/30 font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download Standings (.csv)</span>
              </button>
            </div>

            {/* Card 3: Instant Browser Snapshot */}
            <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-4 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <History className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-extrabold text-white font-rajdhani uppercase tracking-wider">
                    Instant Browser Snapshot
                  </h4>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Manually save a protected restore point into your local browser vault. Vault maintains the last 15 rolling snapshots.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateManualSnapshot}
                className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-purple-600/20 cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>Take Snapshot Now</span>
              </button>
            </div>
          </div>

          {/* Section 2.5: Google Drive Cloud Auto-Save & Off-Site Vault */}
          <div className="bg-[#121824] border border-[#4285F4]/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4285F4]/15 border border-[#4285F4]/40 flex items-center justify-center text-[#4285F4] flex-shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase bg-[#4285F4]/20 text-[#4285F4] border border-[#4285F4]/40 px-2 py-0.5 rounded">
                      GOOGLE DRIVE CLOUD STORAGE
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      driveUser
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}>
                      {driveUser ? `CONNECTED (${driveUser.email})` : 'NOT CONNECTED'}
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold text-white font-rajdhani uppercase tracking-wider mt-0.5">
                    Automatic Google Drive Cloud Backups
                  </h4>
                  <p className="text-xs text-slate-300">
                    Saves tournament standings and match backups automatically to your designated Google Drive folder after every game.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {driveUser ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await logoutGoogleDrive();
                      setDriveUser(null);
                      setDriveStatusMsg('Disconnected from Google Drive.');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-300 text-xs font-bold font-rajdhani uppercase transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignInGoogleDrive}
                    disabled={isDriveLoading}
                    className="px-4 py-2 rounded-xl bg-[#4285F4] hover:bg-[#3367D6] text-white font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-[#4285F4]/25 cursor-pointer disabled:opacity-50"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{isDriveLoading ? 'Connecting...' : 'Sign in with Google Drive'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Folder & Auto-Save Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
              <div className="bg-[#0B0E14] border border-[#1E293B] p-3.5 rounded-xl space-y-2">
                <label className="text-[11px] font-bold text-slate-300 uppercase font-rajdhani tracking-wider block">
                  Designated Google Drive Folder Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={config.googleDriveFolderName || 'PUBG Tournament Backups'}
                    onChange={(e) => {
                      if (onUpdateConfig) {
                        onUpdateConfig({ ...config, googleDriveFolderName: e.target.value });
                      }
                    }}
                    placeholder="e.g. PUBG Tournament Backups"
                    className="w-full px-3 py-2 bg-[#121824] border border-[#1E293B] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#4285F4]"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Folder is automatically created in your Google Drive if it doesn&rsquo;t already exist.
                </p>
              </div>

              <div className="bg-[#0B0E14] border border-[#1E293B] p-3.5 rounded-xl flex flex-col justify-between space-y-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase font-rajdhani tracking-wider block">
                    Cloud Auto-Save After Each Match
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">
                    When active, completing and saving any match automatically uploads a fresh snapshot to your Google Drive folder in the background.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = config.enableGoogleDriveAutoSave !== false;
                      if (onUpdateConfig) {
                        onUpdateConfig({ ...config, enableGoogleDriveAutoSave: !cur });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-rajdhani uppercase tracking-wider transition-all cursor-pointer ${
                      config.enableGoogleDriveAutoSave !== false
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-[#1E293B] text-slate-400 border border-[#334155]'
                    }`}
                  >
                    {config.enableGoogleDriveAutoSave !== false ? '✓ Cloud Auto-Save ON' : '✕ Cloud Auto-Save OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={handleManualDriveBackup}
                    disabled={isDriveLoading || !driveUser}
                    className="px-3.5 py-1.5 rounded-lg bg-[#4285F4] hover:bg-[#3367D6] text-white text-xs font-bold font-rajdhani uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Backup to Drive Now</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Feedback message */}
            {driveStatusMsg && (
              <div className="mt-3 p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E293B] text-xs font-mono text-slate-200 flex items-center justify-between">
                <span>{driveStatusMsg}</span>
                <button
                  type="button"
                  onClick={() => setDriveStatusMsg(null)}
                  className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Rolling Local Snapshots Vault History */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E293B]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-[#1a83c5]" />
                  <h4 className="text-base font-extrabold text-white font-rajdhani uppercase tracking-wider">
                    Browser Snapshot Vault (Rolling Auto-Backups)
                  </h4>
                </div>
                <p className="text-xs text-slate-400">
                  Automatic recovery checkpoints created every 10 minutes and on every saved game. Stored locally in your browser.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">
                  {autoBackupsList.length} Restore Points
                </span>
                {autoBackupsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Clear all local browser snapshots from vault? This will not affect your current tournament.')) {
                        clearAutoBackups();
                        refreshAutoBackups();
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#1E293B] hover:bg-red-900/40 text-slate-400 hover:text-red-300 text-[11px] font-rajdhani uppercase font-bold transition-all cursor-pointer"
                  >
                    Clear Vault
                  </button>
                )}
              </div>
            </div>

            {autoBackupsList.length === 0 ? (
              <div className="py-10 text-center text-slate-500 space-y-2">
                <History className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-rajdhani uppercase font-bold tracking-wider">No rolling snapshots in vault</p>
                <p className="text-[11px] text-slate-600">
                  Snapshots are automatically created during matches or when you click "Create Snapshot Now".
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#1E293B] mt-2">
                {autoBackupsList.map((item) => {
                  const triggerBadge =
                    item.trigger === 'auto_10min'
                      ? { label: '10-Min Auto', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' }
                      : item.trigger === 'match_saved'
                      ? { label: 'Match Saved', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
                      : item.trigger === 'session_start'
                      ? { label: 'Daily Session', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' }
                      : { label: 'Manual Snapshot', color: 'bg-[#FFB800]/15 text-[#FFB800] border-[#FFB800]/30' };

                  return (
                    <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#161F2E]/40 px-2 rounded-xl transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#1A2333] border border-[#2A374D] flex items-center justify-center text-slate-400 font-mono text-xs font-bold">
                          {item.matchCount}G
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white font-mono">
                              {item.dateStr}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${triggerBadge.color}`}>
                              {triggerBadge.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {item.config?.name || 'Tournament'} • {item.matchCount} matches recorded
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => exportTournamentBackupJson(item.config, item.matches)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-slate-300 text-xs font-rajdhani uppercase font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Download this snapshot as JSON"
                        >
                          <Download className="w-3 h-3 text-[#FFB800]" />
                          <span>JSON</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestoreVaultSnapshot(item)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-rajdhani uppercase font-extrabold flex items-center gap-1 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                          title="Restore tournament state from this snapshot"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteAutoBackup(item.id);
                            refreshAutoBackups();
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                          title="Delete snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tournament Identity & Universal Live Sync Hub */}
      {((activeTab === 'admin' && (adminSubTab === 'settings' || activeTab === 'all')) || activeTab === 'all') && (
        <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-[#1E293B]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                TOURNAMENT IDENTITY
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse" />
                Live Sync To All Viewers &amp; OBS
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#FFB800]" />
              Tournament Details &amp; Global Live Sync
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              All details edited here (tournament title, scheduled matches, game modes) immediately update in real-time for all connected casters, viewers, and OBS browser sources.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-[#1E293B] text-xs font-mono text-slate-300 flex items-center gap-2.5">
              <div>
                <span className="text-slate-500 mr-1.5 font-bold">OFFICIAL GAMES:</span>
                <span className="text-[#1a83c5] font-extrabold text-sm">{completedRankedCount}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-white font-bold">{totalTournamentMatches}</span>
              </div>
              <div className="w-20 h-2 bg-[#1E293B] rounded-full overflow-hidden border border-[#334155] hidden sm:block">
                <div
                  className="h-full bg-[#1a83c5] rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((completedRankedCount / Math.max(1, totalTournamentMatches)) * 100)
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-bold text-[#FFB800] hidden sm:inline">
                {Math.min(
                  100,
                  Math.round((completedRankedCount / Math.max(1, totalTournamentMatches)) * 100)
                )}%
              </span>
            </div>
          </div>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
          {/* Tournament Name Editor (7 cols) */}
          <div className="md:col-span-7 bg-[#0B0E14] border border-[#1E293B] rounded-2xl p-4">
            <label className="block text-[11px] font-bold font-rajdhani uppercase tracking-wider text-[#1a83c5] mb-1.5">
              Tournament Name / Title (Displayed in Header &amp; OBS)
            </label>
            <form onSubmit={handleSaveTournamentTitle} className="flex gap-2">
              <input
                type="text"
                value={tournamentNameInput}
                onChange={(e) => setTournamentNameInput(e.target.value)}
                onBlur={handleSaveTournamentTitle}
                placeholder="e.g. PUBG MOBILE CHAMPIONSHIP 2026"
                className="flex-1 bg-[#121824] border border-[#1E293B] rounded-xl px-3.5 py-2 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-[#1a83c5] font-rajdhani uppercase tracking-wider transition-all"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#1a83c5] hover:brightness-110 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-[#1a83c5]/20 flex-shrink-0 cursor-pointer"
              >
                {isSavedFeedback ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {isSavedFeedback ? 'Synced!' : 'Save Title'}
              </button>
            </form>
            <p className="text-[11px] text-slate-400 mt-1.5 font-sans">
              Press Enter or click away to auto-save and propagate instantly to all screens.
            </p>
          </div>

          {/* Total Scheduled Matches (3 cols) */}
          <div className="md:col-span-3 bg-[#0B0E14] border border-[#1E293B] rounded-2xl p-4 flex flex-col justify-between">
            <label className="block text-[11px] font-bold font-rajdhani uppercase tracking-wider text-[#FFB800] mb-1">
              Total Scheduled Games
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onUpdateTotalMatches) {
                    onUpdateTotalMatches(Math.max(1, totalTournamentMatches - 1));
                  } else if (onUpdateConfig) {
                    onUpdateConfig({ ...config, totalMatches: Math.max(1, totalTournamentMatches - 1) });
                  }
                }}
                disabled={totalTournamentMatches <= 1}
                className="w-10 h-10 rounded-xl bg-[#121824] hover:bg-[#1E293B] disabled:opacity-40 text-white font-bold text-base flex items-center justify-center border border-[#1E293B] cursor-pointer"
              >
                -
              </button>
              <div className="flex-1 text-center font-extrabold text-2xl text-white font-rajdhani">
                {totalTournamentMatches}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateTotalMatches) {
                    onUpdateTotalMatches(Math.min(50, totalTournamentMatches + 1));
                  } else if (onUpdateConfig) {
                    onUpdateConfig({ ...config, totalMatches: Math.min(50, totalTournamentMatches + 1) });
                  }
                }}
                className="w-10 h-10 rounded-xl bg-[#121824] hover:bg-[#1E293B] text-white font-bold text-base flex items-center justify-center border border-[#1E293B] cursor-pointer"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 text-center font-sans">
              Controls the OBS match counter (e.g. Match 1 of {totalTournamentMatches})
            </p>
          </div>

          {/* Tournament Mode (2 cols) */}
          <div className="md:col-span-2 bg-[#0B0E14] border border-[#1E293B] rounded-2xl p-4 flex flex-col justify-between">
            <label className="block text-[11px] font-bold font-rajdhani uppercase tracking-wider text-slate-400 mb-1">
              Team Mode
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['squad', 'duo', 'solo'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    if (onUpdateConfig) {
                      onUpdateConfig({ ...config, mode: m });
                    }
                  }}
                  className={`py-1.5 rounded-lg text-[10px] font-bold font-rajdhani uppercase tracking-wider transition-colors border cursor-pointer ${
                    config.mode === m
                      ? 'bg-[#FF5200] border-[#FF5200] text-white shadow-sm'
                      : 'bg-[#121824] border-[#1E293B] text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 text-center truncate font-mono">
              {config.mode ? config.mode.toUpperCase() : 'SQUAD'}
            </p>
          </div>
        </div>

        {/* Tournament Logo PNG Slot (Dedicated Upload Slot for User) */}
        <div className="mt-5 pt-4 border-t border-[#1E293B]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#1a83c5]" />
              <h4 className="text-base font-bold text-white font-rajdhani uppercase tracking-wider">
                Tournament Stage &amp; Broadcast Logo (PNG Upload Slot)
              </h4>
            </div>
            <span className="text-[11px] text-[#1a83c5] font-mono">
              Live on Between-Games Stage, OBS Broadcast &amp; Overlays
            </span>
          </div>

          <LogoUploadSlot
            currentLogoUrl={config.logoUrl}
            onLogoChange={(newUrl) => {
              if (onUpdateConfig) {
                onUpdateConfig({ ...config, logoUrl: newUrl });
              }
            }}
          />

          {/* Option: Hide main logo on between-games stage leaderboard */}
          <div className="mt-3 p-3 rounded-xl bg-[#03091E]/80 border border-[#1a83c5]/30 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-[#1a83c5]" />
                Hide Logo on Between-Games Stage Leaderboard
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Default: Hidden. Keeps the stage leaderboard focused on teams and scores. Turn off to show the large logo.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={config.hideBetweenGamesLogo !== false}
                onChange={(e) => {
                  if (onUpdateConfig) {
                    onUpdateConfig({ ...config, hideBetweenGamesLogo: e.target.checked });
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#0B1736] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1a83c5]"></div>
            </label>
          </div>
        </div>
      </div>

      )}

      {/* 4. ADMIN & SETUP - SPECTATOR API INGESTION */}
      {((activeTab === 'admin' && (adminSubTab === 'api' || activeTab === 'all')) || activeTab === 'all') && (
        <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E293B]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                  SPECTATOR INGESTION
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
                  isApiConnected
                    ? 'bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30'
                    : 'bg-[#FF5200]/10 text-[#FF5200] border border-[#FF5200]/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isApiConnected ? 'bg-[#00FF66] animate-pulse' : 'bg-[#FF5200]'}`} />
                  {isApiConnected ? 'FEED ONLINE' : 'FEED OFFLINE'}
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#38bdf8]" />
                Spectator API Ingestion &amp; Live Telemetry
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure your spectator server or ngrok tunnel URL to ingest live player drops, knockouts, kills, and team health.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleQuickTest}
                disabled={isTestingUrl}
                className="px-4 py-2 rounded-xl bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-[#38bdf8]/20 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingUrl ? 'animate-spin' : ''}`} />
                <span>{isTestingUrl ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>
          </div>

          {/* Test Connection Feedback */}
          {testFeedback && (
            <div className={`mt-4 p-3 rounded-xl border text-xs font-mono flex items-center gap-2 animate-fadeIn ${
              testFeedback.success
                ? 'bg-[#00FF66]/10 border-[#00FF66]/30 text-[#00FF66]'
                : 'bg-[#FF5200]/10 border-[#FF5200]/30 text-[#FF5200]'
            }`}>
              {testFeedback.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{testFeedback.text}</span>
            </div>
          )}

          {/* URL Input Form */}
          <div className="mt-4 space-y-3">
            <label className="block text-[11px] font-bold font-rajdhani uppercase tracking-wider text-[#38bdf8]">
              Spectator API Target URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://main.yousery.tech/gettotalplayerlist"
                className="flex-1 bg-[#0B0E14] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38bdf8] font-mono transition-all"
              />
              <button
                type="button"
                onClick={() => onUpdateApiUrl(inputUrl.trim())}
                className="px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-bold text-xs font-rajdhani uppercase tracking-wider border border-[#334155] transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>Save URL</span>
              </button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">Quick Presets:</span>
              <button
                type="button"
                onClick={handlePresetYousery}
                className="px-2.5 py-1 rounded-lg bg-[#0B0E14] hover:bg-[#1E293B] text-slate-300 border border-[#1E293B] text-[11px] font-mono transition-all cursor-pointer"
              >
                ☁️ Main Cloud Ingestion
              </button>
              <button
                type="button"
                onClick={handlePresetLocal}
                className="px-2.5 py-1 rounded-lg bg-[#0B0E14] hover:bg-[#1E293B] text-slate-300 border border-[#1E293B] text-[11px] font-mono transition-all cursor-pointer"
              >
                🖥️ Local Spectator PC (127.0.0.1:10086)
              </button>
            </div>

            {/* Timing Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-[#1E293B]">
              <div className="bg-[#0B0E14] p-3 rounded-xl border border-[#1E293B]">
                <label className="block text-[11px] font-bold font-rajdhani uppercase tracking-wider text-slate-400 mb-1">
                  API Polling Frequency (ms)
                </label>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    min={500}
                    max={10000}
                    step={100}
                    value={config.pollInterval || 1500}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && onUpdateConfig) {
                        onUpdateConfig({ ...config, pollInterval: val });
                      }
                    }}
                    className="w-24 bg-[#121824] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#38bdf8]"
                  />
                  <span className="text-xs text-slate-400 font-mono">ms (Default: 1500ms)</span>
                </div>
              </div>

              <div className="bg-[#0B0E14] p-3 rounded-xl border border-[#1E293B]">
                <label className="block text-[11px] font-bold font-rajdhani uppercase tracking-wider text-slate-400 mb-1">
                  Stream Refresh Cycle (Seconds)
                </label>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={config.streamRefreshInterval || 5}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && onUpdateConfig) {
                        onUpdateConfig({ ...config, streamRefreshInterval: val });
                      }
                    }}
                    className="w-24 bg-[#121824] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#38bdf8]"
                  />
                  <span className="text-xs text-slate-400 font-mono">seconds</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. ADMIN & SETUP - SCORING & POINT SYSTEM */}
      {((activeTab === 'admin' && (adminSubTab === 'points' || activeTab === 'all')) || activeTab === 'all') && (
        <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E293B]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                  TOURNAMENT RULES
                </span>
                <span className="text-slate-400 text-xs font-mono">
                  Preset: {(config.scoringPreset || 'pmgc').toUpperCase()}
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#10b981]" />
                Scoring Presets &amp; Point Distribution
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select official tournament point systems (PMGC, SUPER, PEL, Classic) or customize rank points and kill points per elimination.
              </p>
            </div>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#10b981] font-bold text-xs font-rajdhani uppercase tracking-wider border border-[#10b981]/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Customize Rules</span>
              </button>
            )}
          </div>

          {/* Scoring Presets Buttons */}
          <div className="mt-4">
            <label className="block text-[11px] font-bold font-rajdhani uppercase tracking-wider text-slate-400 mb-2">
              Official Scoring Ruleset Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'pmgc', name: 'PMGC / Global', desc: '1st: 10 pts, 2nd: 6, 3rd: 5, 4th: 4, 5th: 3, 6th: 2, 7th: 1, 8th: 1' },
                { id: 'super', name: 'SUPER Standard', desc: 'Standard PUBG Esports 10-point rule (10, 6, 5, 4, 3, 2, 1, 1)' },
                { id: 'pel', name: 'PEL (Peacekeeper)', desc: 'Chinese PEL competitive point allocation' },
                { id: 'classic', name: 'Classic (15 Pts)', desc: '1st: 15 pts, 2nd: 12, 3rd: 10, 4th: 8, 5th: 6, 6th: 4, 7th: 2, 8th: 1' },
              ].map((preset) => {
                const isSelected = (config.scoringPreset || 'pmgc') === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      const found = SCORING_PRESETS[preset.id as keyof typeof SCORING_PRESETS];
                      if (found && onUpdateConfig) {
                        onUpdateConfig({
                          ...config,
                          scoringPreset: preset.id as any,
                          rankPointsTable: { ...found.rankPoints },
                          killPointsPerKill: found.killPoints,
                        });
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#10b981]/15 border-[#10b981] shadow-md shadow-[#10b981]/15'
                        : 'bg-[#0B0E14] border-[#1E293B] hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`font-rajdhani font-black text-xs uppercase tracking-wider ${
                          isSelected ? 'text-[#10b981]' : 'text-white'
                        }`}>
                          {preset.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                        {preset.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kill Points Control */}
          <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0B0E14] p-3.5 rounded-xl border border-[#1E293B]">
            <div>
              <span className="text-xs font-bold text-white uppercase font-rajdhani tracking-wider block">
                Points Awarded Per Kill
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Number of tournament points credited for every confirmed enemy elimination.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={10}
                value={config.killPointsPerKill ?? 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && onUpdateConfig) {
                    onUpdateConfig({ ...config, killPointsPerKill: val });
                  }
                }}
                className="w-16 bg-[#121824] border border-[#1E293B] rounded-lg px-2.5 py-1 text-center text-sm font-bold text-[#FFB800] font-mono focus:outline-none focus:border-[#10b981]"
              />
              <span className="text-xs text-slate-400 font-mono">pt/kill</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. ADMIN & SETUP - DANGER ZONE & RESET */}
      {((activeTab === 'admin' && (adminSubTab === 'danger' || activeTab === 'all')) || activeTab === 'all') && (
        <div className="bg-[#121824] border border-red-900/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E293B]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                  DATA SAFETY &amp; RESET
                </span>
                <span className="text-red-400 text-xs font-mono">
                  Administrative Danger Zone
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Tournament Reset &amp; Maintenance
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Destructive actions to wipe match records, clear logos, or restore the tournament console to clean default settings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {/* Clear All Matches */}
            <div className="bg-[#0B0E14] p-4 rounded-xl border border-red-950/60 flex flex-col justify-between">
              <div>
                <span className="font-rajdhani font-black text-sm text-red-400 uppercase tracking-wider block mb-1">
                  Clear All Saved Matches ({savedMatches.length})
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Removes all recorded games and wipes tournament standings back to zero. Auto-backups in the vault remain safe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmingClearAll(true)}
                disabled={savedMatches.length === 0}
                className="mt-3 py-2 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/60 font-rajdhani font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Tournament Matches</span>
              </button>
            </div>

            {/* Revert Default Config */}
            <div className="bg-[#0B0E14] p-4 rounded-xl border border-[#1E293B] flex flex-col justify-between">
              <div>
                <span className="font-rajdhani font-black text-sm text-slate-300 uppercase tracking-wider block mb-1">
                  Revert Tournament Configuration
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Resets tournament name, scoring rules, and overlays back to standard defaults without deleting your saved matches.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateConfig) {
                    onUpdateConfig({ ...DEFAULT_CONFIG, totalMatches: config.totalMatches || 5 });
                  }
                }}
                className="mt-3 py-2 px-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-300 border border-[#334155] font-rajdhani font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#FFB800]" />
                <span>Revert Config to Defaults</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. TEAMS & ROSTERS TAB - TEAM DIRECTORY & ROSTERS */}
      {((activeTab === 'teams' && (teamsSubTab === 'rosters' || activeTab === 'all')) || activeTab === 'all') && (
        <div className="space-y-4">
          <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E293B]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-[10px] font-bold font-rajdhani uppercase tracking-widest">
                    TEAM DIRECTORY
                  </span>
                  <span className="text-slate-400 text-xs font-mono">
                    Official Squads &amp; Rosters
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#10b981]" />
                  Tournament Teams &amp; Rosters ({tournamentStandings.length > 0 ? tournamentStandings.length : teamList.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  View full squad rosters, total kills, cumulative tournament damage, and click any team to inspect detailed match-by-match statistics.
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search team or player..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="bg-[#0B0E14] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#10b981] w-56 transition-all font-mono"
                />
              </div>
            </div>

            {/* Team Directory Grid */}
            {(() => {
              const displayList = (tournamentStandings.length > 0
                ? tournamentStandings.map((t, idx) => ({
                    teamId: t.teamId,
                    teamName: t.teamName,
                    rank: idx + 1,
                    totalPoints: t.totalPoints,
                    totalKills: t.totalKills,
                    wins: t.wins,
                    players: (t.roster || []).map((r) => ({
                      playerName: r.playerName,
                      kills: r.kills,
                      damage: r.damage,
                    })),
                    fullStanding: t,
                  }))
                : teamList.map((t, idx) => ({
                    teamId: t.teamId,
                    teamName: t.teamName,
                    rank: idx + 1,
                    totalPoints: t.totalKills,
                    totalKills: t.totalKills,
                    wins: 0,
                    players: t.players.map((p) => ({
                      playerName: p.playerName,
                      kills: p.killNum,
                      damage: p.damage,
                    })),
                    fullStanding: null,
                  }))
              ).filter((t) => {
                if (!teamSearchQuery.trim()) return true;
                const q = teamSearchQuery.toLowerCase();
                return (
                  t.teamName.toLowerCase().includes(q) ||
                  t.players.some((p) => p.playerName.toLowerCase().includes(q))
                );
              });

              if (displayList.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-500 border border-dashed border-[#1E293B] rounded-2xl bg-[#0B0E14]/80 p-6 my-4">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-bold font-rajdhani uppercase tracking-wider text-slate-300">
                      No Teams Found
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {teamSearchQuery
                        ? `No team or player matches "${teamSearchQuery}". Try another search term.`
                        : 'No team records saved yet. Teams will automatically populate as matches are saved or spectator telemetry connects.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {displayList.map((item) => {
                    const flagVal = resolveTeamFlagValue(item.teamId, config.teamFlags, item.teamName);
                    const teamLogo = config.teamLogos?.[item.teamId] || config.teamLogos?.[String(item.teamId)];

                    return (
                      <div
                        key={item.teamId}
                        className="bg-[#0B0E14] border border-[#1E293B] hover:border-[#10b981]/50 rounded-2xl p-4 transition-all duration-200 shadow-md hover:shadow-lg flex flex-col justify-between"
                      >
                        <div>
                          {/* Card Header: Rank, Flag, Logo, Name */}
                          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#1E293B]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-[#121824] border border-[#1E293B] font-rajdhani font-black text-xs text-[#FFB800] flex items-center justify-center flex-shrink-0">
                                #{item.rank}
                              </span>
                              {teamLogo ? (
                                <img
                                  src={teamLogo}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-contain bg-black/40 border border-white/20 p-0.5 flex-shrink-0"
                                />
                              ) : null}
                              {flagVal ? (
                                <TeamFlag
                                  flagValue={flagVal}
                                  teamId={item.teamId}
                                  isWinner={false}
                                  className="w-6 h-4 object-cover rounded shadow-sm flex-shrink-0 border border-white/20"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <h4
                                  className="font-rajdhani font-black text-sm text-white uppercase tracking-wider truncate"
                                  title={item.teamName}
                                >
                                  {item.teamName}
                                </h4>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ID: {item.teamId}
                                </span>
                              </div>
                            </div>

                            {/* Wins Badge */}
                            {item.wins > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/30 whitespace-nowrap flex items-center gap-1">
                                🍗 {item.wins} WWCD
                              </span>
                            )}
                          </div>

                          {/* Stats Row */}
                          <div className="grid grid-cols-2 gap-2 my-3 text-center">
                            <div className="bg-[#121824] p-2 rounded-xl border border-[#1E293B]">
                              <span className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold block">
                                TOTAL PTS
                              </span>
                              <span className="text-lg font-black font-rajdhani text-[#FFB800] tabular-nums">
                                {item.totalPoints}
                              </span>
                            </div>
                            <div className="bg-[#121824] p-2 rounded-xl border border-[#1E293B]">
                              <span className="text-[10px] text-slate-400 font-rajdhani uppercase font-bold block">
                                TOTAL KILLS
                              </span>
                              <span className="text-lg font-black font-rajdhani text-[#38bdf8] tabular-nums">
                                {item.totalKills}
                              </span>
                            </div>
                          </div>

                          {/* Roster Tags */}
                          <div className="space-y-1 mb-3">
                            <span className="text-[10px] text-slate-500 font-mono font-bold uppercase block">
                              Active Roster:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {item.players.map((p, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="px-2 py-0.5 rounded-md bg-[#121824] border border-[#1E293B] text-[11px] text-slate-300 font-mono truncate max-w-[120px]"
                                  title={`${p.playerName} (${p.kills || 0} Kills, ${Math.round(p.damage || 0)} Dmg)`}
                                >
                                  {p.playerName}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* View Stats Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const standingObj: UnifiedTeamStanding = {
                              teamId: item.teamId,
                              teamName: item.teamName,
                              color: getTeamColor(item.teamId),
                              roster: item.players.map((p, pIdx) => ({
                                uId: pIdx + 1,
                                playerName: p.playerName,
                                kills: p.kills || 0,
                                damage: p.damage || 0,
                                isAlive: true,
                              })),
                              matchesPlayed: savedMatches.length,
                              pastWins: item.wins || 0,
                              pastPlacementPoints: Math.max(0, item.totalPoints - item.totalKills),
                              pastKillPoints: item.totalKills,
                              pastKills: item.totalKills,
                              pastTotalPoints: item.totalPoints,
                              matchRanks: (item.fullStanding?.matchPlacements || []).map((mp) => ({
                                matchNumber: mp.matchNumber,
                                rank: mp.placement,
                                points: mp.points,
                              })),
                              isLivePresent: false,
                              liveAliveCount: 0,
                              liveTotalMembers: item.players.length,
                              liveKills: 0,
                              liveKillPoints: 0,
                              liveDamage: 0,
                              livePlacement: 0,
                              liveRankPoints: 0,
                              liveTotalPoints: 0,
                              liveStatus: 'STANDBY',
                              isLiveWinner: false,
                              totalKills: item.totalKills,
                              totalPlacementPoints: Math.max(0, item.totalPoints - item.totalKills),
                              totalPoints: item.totalPoints,
                              totalWins: item.wins || 0,
                            };
                            setInspectTeamDetails(standingObj);
                          }}
                          className="w-full mt-2 py-2 px-3 rounded-xl bg-[#10b981]/15 hover:bg-[#10b981] text-[#10b981] hover:text-black border border-[#10b981]/40 font-rajdhani font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Team Stats &amp; Details</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Teams Pics Backend Management Panel */}
      {((activeTab === 'teams' && (teamsSubTab === 'pics' || activeTab === 'all')) || activeTab === 'teampics' || activeTab === 'all') && (
        <TeamsPicsAdmin
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          onUpdateConfig={(cfg) => {
            if (onUpdateConfig) onUpdateConfig(cfg);
          }}
          showToast={(msg) => setBackupUploadSuccess(msg)}
        />
      )}

      {/* Team Stats Management & Live Controller */}
      {((activeTab === 'broadcast' && (broadcastSubTab === 'teamstats' || activeTab === 'all')) || activeTab === 'teamstats' || activeTab === 'all') && (
        <TeamStatsAdmin
          config={config}
          savedMatches={savedMatches}
          activePlayers={displayedPlayers}
          teamStandings={tournamentStandings}
          onUpdateConfig={(cfg) => {
            if (onUpdateConfig) onUpdateConfig(cfg);
          }}
          onForceRefresh={onForceRefresh}
          showToast={(msg) => setBackupUploadSuccess(msg)}
        />
      )}

      {/* Player Portraits Management Panel (UID Bulk Upload & Default Silhouette) */}
      {((activeTab === 'teams' && (teamsSubTab === 'portraits' || activeTab === 'all')) || activeTab === 'portraits' || activeTab === 'all') && (
        <PlayerPortraitsAdmin
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          onUpdateConfig={(cfg) => {
            if (onUpdateConfig) onUpdateConfig(cfg);
          }}
          showToast={(msg) => setBackupUploadSuccess(msg)}
        />
      )}

      {/* Team Details Modal (Inspection from Teams & Rosters) */}
      {inspectTeamDetails && (
        <TeamDetailsModal
          team={inspectTeamDetails}
          onClose={() => setInspectTeamDetails(null)}
          config={config}
          savedMatches={savedMatches}
        />
      )}

      {/* Match Scorecard Modal */}
      {selectedMatchForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#121824] border border-[#1E293B] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B] bg-[#0B0E14]">
              <div>
                <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider">
                  Game #{selectedMatchForDetails.matchNumber} Scorecard
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Recorded at {selectedMatchForDetails.dateStr}
                </p>
              </div>
              <button
                onClick={() => setSelectedMatchForDetails(null)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-[#1E293B] text-xs font-rajdhani uppercase tracking-wider font-bold">
                    <th className="pb-2.5">Placement</th>
                    <th className="pb-2.5">Team</th>
                    <th className="pb-2.5">Kills</th>
                    <th className="pb-2.5">Damage</th>
                    <th className="pb-2.5">Rank Pts</th>
                    <th className="pb-2.5">Adjustment</th>
                    <th className="pb-2.5 text-right">Total Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {(Object.values(selectedMatchForDetails.teamScores) as TeamMatchScore[])
                    .sort((a, b) => a.placement - b.placement)
                    .map((ts) => (
                      <tr key={ts.teamId} className="hover:bg-[#0B0E14]">
                        <td className="py-2.5 font-bold text-sm font-mono text-[#FFB800]">
                          #{ts.placement}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center flex-wrap gap-1.5 font-extrabold text-white font-rajdhani uppercase tracking-wide">
                            <TeamFlag
                              flagValue={resolveTeamFlagValue(ts.teamId, config.teamFlags, ts.teamName)}
                              teamId={ts.teamId}
                              isWinner={ts.placement === 1 || ts.isWinner}
                              className="w-4 h-3 object-cover rounded-[1px] shadow-sm flex-shrink-0 border border-slate-600"
                            />
                            <span>{ts.teamName}</span>
                            {(ts.placement === 1 || ts.isWinner) && (
                              <span className="px-2 py-0.5 rounded-lg bg-[#FFB800] text-black font-extrabold text-[10px] font-rajdhani uppercase tracking-wider inline-flex items-center gap-1 shadow-sm">
                                🍗 WWCD WINNER
                              </span>
                            )}
                          </div>
                          {(() => {
                            const teamPlayers = (selectedMatchForDetails.playerSnapshots || [])
                              .filter((p) => p.teamId === ts.teamId)
                              .map((p) => p.playerName)
                              .filter(Boolean);
                            if (teamPlayers.length === 0) return null;
                            return (
                              <>
                                <div className="h-[1px] w-24 bg-[#1E293B] my-0.5" />
                                <div className="text-[11px] text-slate-400 font-sans">
                                  {teamPlayers.join(' • ')}
                                </div>
                              </>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 font-mono text-[#1a83c5] font-bold">{ts.totalKills}</td>
                        <td className="py-2.5 font-mono text-slate-400">{ts.totalDamage}</td>
                        <td className="py-2.5 font-mono text-[#FFB800] font-bold">{ts.rankPoints}</td>
                        <td className="py-2.5 font-mono text-xs">
                          {ts.penaltyPoints ? (
                            <span
                              className={`font-semibold px-1.5 py-0.5 rounded ${
                                ts.penaltyPoints < 0
                                  ? 'bg-[#FF5200]/20 text-[#FF5200] border border-[#FF5200]/40'
                                  : 'bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40'
                              }`}
                              title={ts.adjustmentReason || 'Penalty/Score adjustment'}
                            >
                              {ts.penaltyPoints > 0 ? `+${ts.penaltyPoints}` : ts.penaltyPoints}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-2.5 font-mono text-[#FFB800] font-extrabold text-right">
                          {ts.totalPoints} PTS
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3.5 border-t border-[#1E293B] bg-[#0B0E14] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = selectedMatchForDetails;
                  setSelectedMatchForDetails(null);
                  setMatchToDelete(target);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF5200]/15 hover:bg-[#FF5200] text-[#FF5200] hover:text-white border border-[#FF5200]/30 text-xs font-bold font-rajdhani uppercase tracking-wider transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Game #{selectedMatchForDetails.matchNumber}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedMatchForDetails;
                    setSelectedMatchForDetails(null);
                    setMatchToEdit(target);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1a83c5]/15 hover:bg-[#1a83c5] text-[#1a83c5] hover:text-black border border-[#1a83c5]/30 text-xs font-bold font-rajdhani uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Scores &amp; Penalties</span>
                </button>

                <button
                  onClick={() => setSelectedMatchForDetails(null)}
                  className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-bold font-rajdhani uppercase tracking-wider cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated In-App Confirmation Modal: Single Match Deletion */}
      {matchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121824] border border-[#FF5200]/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#FF5200]/20 border border-[#FF5200]/40 flex items-center justify-center text-[#FF5200]">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider">
                    Delete Game #{matchToDelete.matchNumber}?
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Recorded at {matchToDelete.dateStr} &bull; {matchToDelete.playerSnapshots.length} players
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E293B] text-xs text-slate-300 space-y-2">
                <p>
                  Are you sure you want to delete <strong className="text-white font-bold font-rajdhani uppercase">Game #{matchToDelete.matchNumber}</strong>?
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>All placement points and kills from this match will be removed from tournament standings.</li>
                  <li>Subsequent matches will automatically be renumbered.</li>
                  <li>Connected OBS leaderboards will update immediately.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setMatchToDelete(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-300 text-xs font-bold font-rajdhani uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = matchToDelete.id;
                    setMatchToDelete(null);
                    if (selectedMatchForDetails?.id === id) {
                      setSelectedMatchForDetails(null);
                    }
                    onDeleteMatch(id);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#FF5200] hover:brightness-110 text-white text-xs font-bold font-rajdhani uppercase tracking-wider shadow-lg shadow-[#FF5200]/25 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Delete Game</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated In-App Confirmation Modal: Clear All Matches */}
      {isConfirmingClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121824] border border-[#FF5200]/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#FF5200]/20 border border-[#FF5200]/40 flex items-center justify-center text-[#FF5200]">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider">
                    Reset Tournament?
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Delete all {savedMatches.length} recorded match{savedMatches.length > 1 ? 'es' : ''}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FF5200]/10 border border-[#FF5200]/30 text-xs text-slate-300 space-y-2">
                <p className="text-[#FF5200] font-bold font-rajdhani uppercase tracking-wider">
                  Warning: This action cannot be undone!
                </p>
                <p className="text-[11px] text-slate-300">
                  All {savedMatches.length} saved games will be permanently removed from your storage. Cumulative leaderboard scores, kills, and team standings will be reset to zero.
                </p>
                <p className="text-[10px] text-slate-400">
                  (Tip: You can use the "JSON" button in the top navbar to download a full backup file beforehand).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmingClearAll(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-300 text-xs font-bold font-rajdhani uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingClearAll(false);
                    setSelectedMatchForDetails(null);
                    onClearAllMatches?.();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#FF5200] hover:brightness-110 text-white text-xs font-bold font-rajdhani uppercase tracking-wider shadow-lg shadow-[#FF5200]/25 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Clear All Games</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Match Score & Penalty Editor Modal */}
      {matchToEdit && (
        <EditMatchScoresModal
          isOpen={Boolean(matchToEdit)}
          match={matchToEdit}
          config={config}
          onSave={(updated) => {
            onUpdateMatch?.(updated);
            setMatchToEdit(null);
          }}
          onClose={() => setMatchToEdit(null)}
        />
      )}

      {/* Confirm Restore / Replace Tournament Modal */}
      {confirmRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0E1420] border border-[#1E293B] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white font-rajdhani uppercase tracking-wider">
                  {confirmRestoreModal.title}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">AUTOMATIC SAFETY SNAPSHOT ENABLED</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-[#121824] p-3 rounded-xl border border-[#1E293B]">
              {confirmRestoreModal.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestoreModal(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-300 text-xs font-bold font-rajdhani uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestoreModal.onConfirm}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold font-rajdhani uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{confirmRestoreModal.confirmButtonText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
