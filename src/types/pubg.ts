export interface PlayerRawInfo {
  uId: number;
  playerName: string;
  playerOpenId: string;
  picUrl?: string;
  showPicUrl?: boolean;
  teamId: number;
  teamName: string;
  character?: string;
  isFiring?: boolean;
  bHasDied: boolean;
  location?: { x: number; y: number; z: number };
  health: number;
  healthMax: number;
  liveState: number; // 0: alive, 1: knocked/down, 2+: dead or spectator
  killNum: number;
  killNumBeforeDie?: number;
  playerKey?: number;
  gotAirDropNum?: number;
  maxKillDistance?: number;
  damage: number;
  killNumInVehicle?: number;
  killNumByGrenade?: number;
  AIKillNum?: number;
  BossKillNum?: number;
  rank: number; // match rank placement
  isOutsideBlueCircle?: boolean;
  inDamage?: number;
  heal?: number;
  headShotNum?: number;
  survivalTime?: number;
  driveDistance?: number;
  marchDistance?: number;
  assists?: number;
  outsideBlueCircleTime?: number;
  knockouts?: number;
  rescueTimes?: number;
  useSmokeGrenadeNum?: number;
  useFragGrenadeNum?: number;
  useBurnGrenadeNum?: number;
  useFlashGrenadeNum?: number;
  PoisonTotalDamage?: number;
  UseSelfRescueTime?: number;
  UseEmergencyCallTime?: number;
}

export interface PubgApiResponse {
  playerInfoList: PlayerRawInfo[];
}

export type TournamentMode = 'solo' | 'duo' | 'trio' | 'squad';

export interface TeamMatchScore {
  teamId: number;
  teamName: string;
  placement: number;
  rankPoints: number;
  killPoints: number;
  penaltyPoints?: number; // Minus/penalty points (or positive bonus)
  adjustmentReason?: string;
  totalPoints: number;
  totalKills: number;
  totalDamage: number;
  isWinner: boolean;
  aliveCount: number;
  totalMembers: number;
}

export interface SavedMatch {
  id: string;
  matchNumber: number;
  mapName?: string;
  timestamp: number;
  dateStr: string;
  playerSnapshots: PlayerRawInfo[];
  teamScores: Record<number, TeamMatchScore>;
  excludeFromLeaderboard?: boolean; // When true, does NOT count in tournament cumulative standings
  isExhibition?: boolean; // When true, marks match as exhibition/showmatch/unranked
  customLabel?: string; // Optional custom tag (e.g., "Warm-Up Game", "All-Stars Showmatch", "Exhibition")
}

export interface AutoBackupItem {
  id: string;
  timestamp: number;
  dateStr: string;
  trigger: 'interval_10min' | 'game_saved' | 'manual' | 'daily';
  matchCount: number;
  config: TournamentConfig;
  matches: SavedMatch[];
}

export interface TournamentConfig {
  name: string;
  logoUrl?: string;
  hideBetweenGamesLogo?: boolean; // When true (default), hides the main tournament logo on the between games stage leaderboard
  stageSlideIntervalSeconds?: number; // Page slider cycle duration in seconds for between games stage leaderboard (default 20, 0 = pause)
  mode: TournamentMode;
  apiUrl: string;
  pollInterval: number; // in ms, default 1500
  streamRefreshInterval: number; // in seconds, default 3
  killPointsPerKill: number;
  rankPointsTable: Record<number, number>;
  autoSaveOnMatchEnd: boolean;
  obsTheme: 'vibrant' | 'neon' | 'dark-esports' | 'transparent';
  enableCorsProxyHelp: boolean;
  totalMatches: number; // Total games planned in the tournament, default 5
  isTournamentConcluded?: boolean; // Manually mark tournament finished or auto when all matches played
  isPaused?: boolean; // When paused, means no more upcoming games
  animatePlacementChanges?: boolean; // Smooth layout animation when standings/placements change
  autoBackupIntervalMinutes?: number; // default 10
  enableAutoBackup?: boolean; // default true
  exportReminderHours?: number; // default 2
  enableSingleAdminLock?: boolean; // When true, prevents multiple devices from opening Admin Panel simultaneously
  // Scoring and Tie-Breaker customization
  scoringPreset?: 'super' | 'pmgc' | 'pel' | 'classic' | 'custom';
  tieBreakerRules?: ('wwcd' | 'placement_points' | 'kills' | 'damage' | 'recent_match' | 'highest_single_match')[];
  // Google Drive Cloud Auto-Save
  googleDriveFolderName?: string;
  googleDriveFolderId?: string;
  enableGoogleDriveAutoSave?: boolean;
  // Overlay Visibility and Trigger Control
  top4HudAutoHideUntilTop4?: boolean; // When true (default), hides Top 4 HUD until <= 4 teams remain alive
  teamStatsTriggerDurationSeconds?: number; // Default 20 seconds
  teamLogos?: Record<number | string, string>; // Maps Team ID to custom team logo/crest (PNG/JPG/WEBP)
  teamSquadPics?: Record<number | string, string>; // Maps Team ID to 4-player squad image URL or base64 data
  teamFlags?: Record<number | string, string>; // Maps Team ID to country code (e.g. 'sa', 'in', 'pk') or custom flag URL/base64
  showTeamFlags?: boolean; // When enabled (default true), shows team country flag on Top 4 HUD and winner celebrations
  customTeamNames?: Record<number | string, string>; // Maps Team ID to custom team display name
  preferLiveApiTeamNames?: boolean; // When true, once game starts live API names override pre-configured names if available
  // Team Stats Overlay Config
  selectedTeamStatsId?: number | null; // Team ID currently chosen to display in Team Stats widget
  showTeamStatsOverlay?: boolean; // When true, renders the Team Stats widget on stream overlay
  teamStatsPosition?: 'left-mid' | 'left-bottom' | 'right-mid' | 'top-left'; // default 'left-mid'
  teamStatsDisplayMode?: 'stage' | 'hud'; // 'stage' = full 1920x1080 broadcast screen, 'hud' = docked HUD
  teamStatsDataSource?: 'auto' | 'live' | 'tournament' | 'match' | 'latest'; // default 'auto', 'latest' = most recent saved match
  teamStatsSelectedMatchId?: string | null; // Optional specific match ID to show
  teamStatsBackgroundImage?: string; // Optional custom background image for full stage team stats
  teamStatsBgFit?: 'contain' | 'fill' | 'cover'; // Fitting mode: 'contain' (default, 100% full image uncropped), 'fill' (stretch 16:9 stage uncropped), 'cover' (crop to fill)
  teamStatsBgDim?: number; // Optional dark tint overlay 0-100% (default 0% = full vibrancy)
  teamStatsCustomLabel?: string; // Optional custom label to replace "TOURNAMENT OVERALL"
  teamStatsStageScale?: number; // Size/scale factor for stage mode (default 1.0, range ~0.5 to 2.0)
  teamStatsStageOffsetX?: number; // Horizontal offset in pixels for stage mode (default 0)
  teamStatsStageOffsetY?: number; // Vertical offset in pixels for stage mode (default 0)
  // Player Portraits & MVP Overlay Config
  playerPortraits?: Record<string, string>; // Maps player UID (string) to portrait image URL / base64
  defaultPlayerPortraitUrl?: string; // Default blank picture to use when player UID portrait is not found
  mvpOverlayScope?: 'latest' | 'all'; // Default or broadcast scope: 'latest' or 'all'
  mvpOverlayVariant?: 'fullscreen' | 'popup'; // 'fullscreen' or 'popup'
  showMvpOverlay?: boolean; // Broadcaster toggle to display MVP overlay on stream
}

export interface TeamSquadMemberStats {
  uId: number;
  playerName: string;
  kills: number;
  damage: number;
  knockouts: number;
  survivalTimeSeconds: number;
  survivalTimeFormatted: string;
  isAlive: boolean;
  health: number;
  bHasDied: boolean;
}

export interface CumulativePlayerStats {
  uId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  totalKills: number;
  totalDamage: number;
  totalKnockouts: number;
  totalAssists: number;
  totalHeadshots: number;
  matchesPlayed: number;
  avgKills: number;
  avgDamage: number;
}

export interface CumulativeTeamStats {
  teamId: number;
  teamName: string;
  roster: { uId: number; playerName: string }[];
  totalPlacementPoints: number;
  totalKillPoints: number;
  totalPenaltyPoints?: number;
  totalPoints: number;
  totalKills: number;
  totalDamage: number;
  wins: number; // chicken dinners
  wwcd?: number; // alias for wins (WWCD)
  matchesPlayed: number;
  matchRanks: { matchNumber: number; rank: number; points: number }[];
}
