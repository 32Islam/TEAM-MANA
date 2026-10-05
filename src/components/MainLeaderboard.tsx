import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  RefreshCw,
  Clock,
  Maximize2,
  Minimize2,
  Crosshair,
  Columns,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  PlayerRawInfo,
  SavedMatch,
  TeamMatchScore,
  TournamentConfig,
} from '../types/pubg';
import { UnifiedTeamStanding } from './StreamLeaderboard';
import { VirtuocityLogo } from './VirtuocityLogo';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { TeamFlag } from './TeamFlag';

interface MainLeaderboardProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers: PlayerRawInfo[];
  unifiedStandings: UnifiedTeamStanding[];
  onManualRefresh: () => void;
  isStandaloneObs?: boolean;
  onUpdateConfig?: (cfg: TournamentConfig) => void;
}

export const MainLeaderboard: React.FC<MainLeaderboardProps> = ({
  config,
  savedMatches,
  unifiedStandings,
  onManualRefresh,
  isStandaloneObs = false,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(config.streamRefreshInterval || 3);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if transparent background requested via URL (?transparent=true or ?transparent=1)
  const isTransparent = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (
        params.get('transparent') === '1' ||
        params.get('transparent') === 'true' ||
        config.obsTheme === 'transparent'
      );
    }
    return false;
  }, [config.obsTheme]);

  // View style toggle: 'dual' (Col 1: #1-8, Col 2: #9-16) or 'slide' (8 per page with 20s auto-slide)
  const [viewLayout, setViewLayout] = useState<'dual' | 'slide'>('dual');

  // Slide state for slide mode
  const totalTeams = unifiedStandings.length;
  const TEAMS_PER_PAGE = totalTeams <= 16 ? 8 : Math.ceil(totalTeams / 2);
  const totalPages = totalTeams > TEAMS_PER_PAGE ? 2 : 1;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [slideProgress, setSlideProgress] = useState<number>(0);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filter ranked tournament matches
  const rankedSavedMatches = useMemo(
    () => (savedMatches || []).filter((m) => !m.excludeFromLeaderboard),
    [savedMatches]
  );
  const completedRankedCount = rankedSavedMatches.length;

  // Calculate confirmed chicken dinners (WWCD) directly from savedMatches ensuring exactly 1 winner per match
  const teamWinsMap = useMemo(() => {
    const byId: Record<number, number> = {};
    (savedMatches || [])
      .filter((m) => !m.excludeFromLeaderboard)
      .forEach((m) => {
        if (!m.teamScores) return;
        const scores = Object.values(m.teamScores) as TeamMatchScore[];
        if (scores.length === 0) return;

        // Exactly one winner per match
        const winner =
          scores.find((s) => s.isWinner && s.placement === 1) ||
          scores.find((s) => s.isWinner) ||
          scores.find((s) => s.placement === 1);

        if (winner && winner.teamId !== undefined && winner.teamId !== null) {
          const tid = Number(winner.teamId);
          byId[tid] = (byId[tid] || 0) + 1;
        }
      });
    return byId;
  }, [savedMatches]);

  const getTeamWwcd = (t: UnifiedTeamStanding) => {
    const fromMap = teamWinsMap[t.teamId];
    if (fromMap !== undefined) return fromMap;
    return Number((t as any).totalWins ?? (t as any).wins ?? (t as any).wwcd ?? (t as any).pastWins ?? 0);
  };

  // Find latest match winner
  const latestWinner = useMemo<{ teamId: number; teamName: string; matchNumber: number } | null>(() => {
    const liveWinner = unifiedStandings.find((t) => t.isLiveWinner);
    if (liveWinner) {
      return {
        teamId: liveWinner.teamId,
        teamName: liveWinner.teamName,
        matchNumber: completedRankedCount + 1,
      };
    }
    if (rankedSavedMatches.length > 0) {
      const lastMatch = rankedSavedMatches[rankedSavedMatches.length - 1];
      if (lastMatch?.teamScores) {
        const scores = Object.values(lastMatch.teamScores) as TeamMatchScore[];
        const winnerScore = scores.find((ts) => ts.isWinner || ts.placement === 1);
        if (winnerScore) {
          return {
            teamId: winnerScore.teamId,
            teamName: winnerScore.teamName,
            matchNumber: lastMatch.matchNumber,
          };
        }
      }
    }
    return null;
  }, [unifiedStandings, rankedSavedMatches, completedRankedCount]);

  // Auto-refresh countdown
  useEffect(() => {
    const intervalSec = config.streamRefreshInterval || 3;
    setCountdown(intervalSec);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsRefreshing(true);
          onManualRefresh();
          setTimeout(() => setIsRefreshing(false), 500);
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [config.streamRefreshInterval, onManualRefresh]);

  // Auto-slide effect when in 'slide' mode
  useEffect(() => {
    if (viewLayout !== 'slide' || totalPages <= 1) {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
      return;
    }

    const durationSec = config.stageSlideIntervalSeconds || 20;
    const durationMs = durationSec * 1000;
    const stepMs = 100;
    let elapsed = 0;

    slideTimerRef.current = setInterval(() => {
      elapsed += stepMs;
      setSlideProgress(Math.min(100, (elapsed / durationMs) * 100));

      if (elapsed >= durationMs) {
        elapsed = 0;
        setSlideProgress(0);
        setCurrentPage((prev) => (prev === 1 ? 2 : 1));
      }
    }, stepMs);

    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [viewLayout, totalPages, config.stageSlideIntervalSeconds]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Dual Column split
  const halfCount = Math.ceil(unifiedStandings.length / 2);
  const leftColumnTeams = useMemo(() => {
    return unifiedStandings.slice(0, halfCount).map((team, idx) => ({
      team,
      rank: idx + 1,
    }));
  }, [unifiedStandings, halfCount]);

  const rightColumnTeams = useMemo(() => {
    return unifiedStandings.slice(halfCount).map((team, idx) => ({
      team,
      rank: halfCount + idx + 1,
    }));
  }, [unifiedStandings, halfCount]);

  // Slide page teams
  const slidePageTeams = useMemo(() => {
    const startIndex = (currentPage - 1) * TEAMS_PER_PAGE;
    return unifiedStandings.slice(startIndex, startIndex + TEAMS_PER_PAGE).map((team, idx) => ({
      team,
      rank: startIndex + idx + 1,
    }));
  }, [unifiedStandings, currentPage, TEAMS_PER_PAGE]);

  const totalMatches = config.totalMatches || 5;

  return (
    <div
      id="obs-main-leaderboard"
      className={`w-full min-h-screen transition-colors duration-200 ${
        isTransparent ? 'bg-transparent' : 'bg-[#0a0d14] text-[#f8fafc]'
      } p-2 sm:p-4 md:p-6 flex flex-col items-center select-none overflow-x-hidden no-scrollbar font-outfit`}
    >
      <div className="w-full max-w-[1680px] mx-auto flex flex-col space-y-3 sm:space-y-4">
        {/* ================= STAGE TOP BANNER ================= */}
        <div className="relative w-full rounded-[16px] bg-[#0d1522]/95 border-2 border-[#1e293b] p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Animated Live Scanline Glow */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#38bdf8] to-transparent shadow-[0_0_12px_#38bdf8] animate-pulse" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <VirtuocityLogo size="md" customUrl={config.logoUrl} glow={false} />
              <div>
                <h1 className="text-lg sm:text-2xl font-heading font-black uppercase text-white tracking-wide leading-tight">
                  {config.name || 'VBG FEATURING PUBG MOBILE DAY 2'}
                </h1>
                <p className="text-xs sm:text-sm font-heading font-black tracking-widest text-[#38bdf8] uppercase mt-0.5">
                  OFFICIAL LEADERBOARD &bull; AFTER {completedRankedCount} GAMES
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Live Pulsing Broadcast Feed Badge */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/15 border border-[#10b981]/50 text-[#10b981] text-xs font-mono font-bold shadow-[0_0_14px_rgba(16,185,129,0.35)]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10b981]" />
                </span>
                <span className="tracking-wider">LIVE FEED</span>
              </div>

              {!isStandaloneObs && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg bg-[#0a0d14] hover:bg-[#172132] border border-[#1e293b] text-[#94a3b8] hover:text-white cursor-pointer"
                  title="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ================= MAIN CONTENT ================= */}
        {viewLayout === 'dual' ? (
          /* ================= DUAL COLUMN ESPORTS VIEW ================= */
          <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
            {/* LEFT COLUMN: #1 to #8 */}
            <div className="w-full flex flex-col space-y-1.5 sm:space-y-2">
              {leftColumnTeams.map(({ team, rank }) => (
                <MainLeaderboardRow
                  key={team.teamId}
                  rank={rank}
                  team={team}
                  isLatestWinner={Boolean(latestWinner && team.teamId === latestWinner.teamId)}
                  wwcdCount={getTeamWwcd(team)}
                  teamLogo={
                    config.teamLogos?.[team.teamId] ||
                    config.teamLogos?.[String(team.teamId)] ||
                    config.teamLogos?.[team.teamName] ||
                    (team.teamName ? config.teamLogos?.[team.teamName.trim().toLowerCase()] : undefined)
                  }
                  flagValue={team.flagValue || resolveTeamFlagValue(team.teamId, config.teamFlags, team.teamName)}
                />
              ))}
            </div>

            {/* RIGHT COLUMN: #9 to #16 */}
            <div className="w-full flex flex-col space-y-1.5 sm:space-y-2">
              {rightColumnTeams.map(({ team, rank }) => (
                <MainLeaderboardRow
                  key={team.teamId}
                  rank={rank}
                  team={team}
                  isLatestWinner={Boolean(latestWinner && team.teamId === latestWinner.teamId)}
                  wwcdCount={getTeamWwcd(team)}
                  teamLogo={
                    config.teamLogos?.[team.teamId] ||
                    config.teamLogos?.[String(team.teamId)] ||
                    config.teamLogos?.[team.teamName] ||
                    (team.teamName ? config.teamLogos?.[team.teamName.trim().toLowerCase()] : undefined)
                  }
                  flagValue={team.flagValue || resolveTeamFlagValue(team.teamId, config.teamFlags, team.teamName)}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ================= 20s AUTO SLIDE VIEW ================= */
          <div className="w-full flex flex-col space-y-2 sm:space-y-3">
            {/* Slide Header with Progress Bar */}
            <div className="w-full flex items-center justify-between bg-[#121824] border border-[#1e293b] p-3 rounded-[12px]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#ffb800] animate-spin" />
                <span className="text-xs font-telemetry font-bold text-[#f8fafc]">
                  PAGE {currentPage} OF {totalPages}
                </span>
                <div className="w-24 sm:w-36 h-1.5 bg-[#0a0d14] rounded-full overflow-hidden border border-[#1e293b] ml-2">
                  <div
                    className="h-full bg-gradient-to-r from-[#38bdf8] to-[#ffb800] transition-all duration-100 ease-linear shadow-[0_0_6px_#38bdf8]"
                    style={{ width: `${slideProgress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(1);
                    setSlideProgress(0);
                  }}
                  className={`px-3 py-1 rounded text-xs font-telemetry font-bold transition-all cursor-pointer ${
                    currentPage === 1
                      ? 'bg-[#38bdf8] text-black font-black'
                      : 'bg-[#0a0d14] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  Page 1 (#1-8)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(2);
                    setSlideProgress(0);
                  }}
                  className={`px-3 py-1 rounded text-xs font-telemetry font-bold transition-all cursor-pointer ${
                    currentPage === 2
                      ? 'bg-[#38bdf8] text-black font-black'
                      : 'bg-[#0a0d14] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  Page 2 (#9-16)
                </button>
              </div>
            </div>

            <MainColumnHeader
              title={`STANDINGS PAGE ${currentPage}`}
              subtitle={currentPage === 1 ? '#1 - #8' : '#9 - #16'}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full flex flex-col space-y-1.5 sm:space-y-2"
              >
                {slidePageTeams.map(({ team, rank }) => (
                  <MainLeaderboardRow
                    key={team.teamId}
                    rank={rank}
                    team={team}
                    isLatestWinner={Boolean(latestWinner && team.teamId === latestWinner.teamId)}
                    wwcdCount={getTeamWwcd(team)}
                    teamLogo={
                      config.teamLogos?.[team.teamId] ||
                      config.teamLogos?.[String(team.teamId)] ||
                      config.teamLogos?.[team.teamName] ||
                      (team.teamName ? config.teamLogos?.[team.teamName.trim().toLowerCase()] : undefined)
                    }
                    flagValue={team.flagValue || resolveTeamFlagValue(team.teamId, config.teamFlags, team.teamName)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

/* Column Header Component */
const MainColumnHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="relative flex items-center justify-between h-[38px] sm:h-[42px] px-3 sm:px-4 md:px-5 rounded-[10px] bg-[#182234] border border-[#1e293b] select-none shadow-sm">
    <div className="flex items-center gap-2">
      <span className="text-[#38bdf8] tracking-widest font-heading font-black text-xs uppercase drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]">
        {title}
      </span>
      {subtitle && (
        <span className="text-[10px] text-[#94a3b8] font-telemetry font-bold px-1.5 py-0.5 rounded bg-black/40">
          {subtitle}
        </span>
      )}
    </div>
    <div className="flex items-center gap-2.5 sm:gap-3.5 md:gap-4 text-right font-telemetry">
      <span className="w-11 sm:w-13 md:w-15 text-center text-[#10b981] text-xs font-bold">KILLS</span>
      <span className="w-14 sm:w-16 md:w-18 text-center text-[#38bdf8] text-xs font-bold">PLACEMENT</span>
      <span className="w-12 sm:w-15 md:w-18 text-center text-[#ffb800] font-bold text-xs sm:text-sm">PTS</span>
    </div>
  </div>
);

/* Main Leaderboard Row Component */
interface MainLeaderboardRowProps {
  rank: number;
  team: UnifiedTeamStanding;
  isLatestWinner: boolean;
  wwcdCount?: number;
  teamLogo?: string | null;
  flagValue?: string | null;
}

const MainLeaderboardRow: React.FC<MainLeaderboardRowProps> = ({
  rank,
  team,
  isLatestWinner,
  wwcdCount: propWwcdCount,
  teamLogo,
  flagValue,
}) => {
  const isFirstPlace = rank === 1;

  // Podium border & badges
  const podiumStyles = useMemo(() => {
    if (rank === 1) {
      return {
        borderLeft: '4px solid #ffb800',
        rankColor: 'text-[#ffb800] bg-[rgba(255,184,0,0.15)] border-[rgba(255,184,0,0.40)]',
        glow: 'shadow-[0_0_18px_rgba(255,184,0,0.22)] ring-1 ring-[#ffb800]/30',
      };
    }
    if (rank === 2) {
      return {
        borderLeft: '4px solid #cbd5e1',
        rankColor: 'text-[#cbd5e1] bg-[rgba(203,213,225,0.15)] border-[rgba(203,213,225,0.35)]',
        glow: '',
      };
    }
    if (rank === 3) {
      return {
        borderLeft: '4px solid #f97316',
        rankColor: 'text-[#f97316] bg-[rgba(249,115,22,0.15)] border-[rgba(249,115,22,0.35)]',
        glow: '',
      };
    }
    if (rank >= 4 && rank <= 8) {
      return {
        borderLeft: '4px solid #38bdf8',
        rankColor: 'text-[#38bdf8] bg-[rgba(56,189,248,0.12)] border-[rgba(56,189,248,0.35)]',
        glow: '',
      };
    }
    return {
      borderLeft: '4px solid #1e293b',
      rankColor: 'text-[#94a3b8] bg-[#0f1622] border-[#1e293b]',
      glow: '',
    };
  }, [rank]);

  const displayTeamName = useMemo(() => {
    const raw = (team.teamName || '').trim();
    if (!raw || /^team\s*\d+$/i.test(raw)) {
      return raw ? raw.toUpperCase() : `TEAM #${team.teamId}`;
    }
    return raw;
  }, [team.teamName, team.teamId]);

  const wwcdCount = propWwcdCount !== undefined ? propWwcdCount : (team.totalWins || (team as any).wins || (team as any).wwcd || 0);

  return (
    <div
      className={`relative flex items-center justify-between min-h-[52px] sm:min-h-[58px] md:min-h-[64px] my-1.5 sm:my-2 px-3 sm:px-4 md:px-5 py-2 select-none rounded-[12px] sm:rounded-[14px] bg-[#0f1724] border border-[#1e293b] hover:bg-[#142032] hover:border-[#38bdf8]/40 hover:shadow-[0_0_14px_rgba(56,189,248,0.15)] transition-all duration-200 overflow-hidden ${podiumStyles.glow}`}
    >
      {/* Live ambient top hairline shimmer */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* 1. RANK */}
      <div className="w-7 sm:w-9 md:w-10 text-center flex-shrink-0">
        <span
          className={`font-telemetry font-black text-base sm:text-xl md:text-2xl ${
            rank === 1
              ? 'text-[#ffb800]'
              : rank === 2
              ? 'text-[#cbd5e1]'
              : rank === 3
              ? 'text-[#f97316]'
              : 'text-[#94a3b8]'
          }`}
        >
          {rank}
        </span>
      </div>

      {/* 2. TEAM LOGO (NO BOX) & FLAG & NAME & WWCD PILL */}
      <div className="flex-1 flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 min-w-0 pr-2 overflow-hidden">
        {teamLogo && (
          <img
            src={teamLogo}
            alt=""
            className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain flex-shrink-0"
          />
        )}
        {flagValue && (
          <TeamFlag
            flagValue={flagValue}
            teamId={team.teamId}
            isWinner={isFirstPlace}
            className="w-6 h-4 sm:w-7 sm:h-4.5 md:w-8 md:h-5 object-cover rounded-[2px] shadow-sm flex-shrink-0"
          />
        )}
        <span
          className="font-heading font-black text-sm xs:text-base sm:text-lg md:text-xl tracking-wide uppercase text-white truncate drop-shadow-md leading-tight"
          dir="auto"
          title={displayTeamName}
        >
          {displayTeamName}
        </span>

        {/* WWCD Pill (Gold Chicken Dinner Badge) */}
        {wwcdCount > 0 && (
          <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-[#78350f]/80 text-[#f59e0b] border border-[#f59e0b]/50 text-xs font-bold font-telemetry flex items-center gap-1.5 flex-shrink-0 shadow-sm">
            🍗 {wwcdCount}
          </span>
        )}
      </div>

      {/* 3. KILLS, PLACEMENT & TOTAL POINTS BOX */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 md:gap-4 flex-shrink-0">
        {/* Kills Column */}
        <div className="text-center w-11 sm:w-13 md:w-15">
          <span className="block text-[8px] sm:text-[10px] font-heading font-bold text-[#64748b] uppercase tracking-wider">
            KILLS
          </span>
          <span className="font-telemetry font-bold text-sm sm:text-base md:text-lg text-[#10b981] tabular-nums">
            {team.totalKills}
          </span>
        </div>

        {/* Placement Points Column */}
        <div className="text-center w-14 sm:w-16 md:w-18">
          <span className="block text-[8px] sm:text-[10px] font-heading font-bold text-[#64748b] uppercase tracking-wider">
            PLACEMENT
          </span>
          <span className="font-telemetry font-bold text-sm sm:text-base md:text-lg text-[#38bdf8] tabular-nums">
            {team.totalPlacementPoints}
          </span>
        </div>

        {/* Total Points Box */}
        <div className="relative w-12 sm:w-15 md:w-18 h-9 sm:h-11 md:h-12 rounded-xl bg-[#0e1726] border-2 border-[#1e293b] flex items-center justify-center font-telemetry font-black text-base sm:text-xl md:text-2xl text-white flex-shrink-0 shadow-inner">
          {team.totalPoints}
          {rank === 1 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#ffb800] animate-ping" />
          )}
        </div>
      </div>
    </div>
  );
};
