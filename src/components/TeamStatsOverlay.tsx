import React, { useMemo, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Trophy,
  Flame,
  Users,
  Clock,
  Crosshair,
  Skull,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  TournamentConfig,
  SavedMatch,
  PlayerRawInfo,
  CumulativeTeamStats,
} from '../types/pubg';
import { getTeamSquadStats } from '../utils/teamStatsHelper';
import { getTournamentBroadcastChannel, subscribeToObsTestTrigger } from '../utils/storage';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { TeamFlag } from './TeamFlag';
import {
  CrosshairIcon,
  StarburstIcon,
  ThreePersonTeamIcon,
  ClockIcon,
} from './TeamStatsCard';

interface TeamStatsOverlayProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers: PlayerRawInfo[];
  teamStandings?: CumulativeTeamStats[];
  onManualRefresh?: () => void;
  isStandaloneObs?: boolean;
  forcedTeamId?: number | null;
  onClose?: () => void;
}

export const TeamStatsOverlay: React.FC<TeamStatsOverlayProps> = ({
  config,
  savedMatches,
  activePlayers,
  teamStandings = [],
  onManualRefresh,
  isStandaloneObs = false,
  forcedTeamId = null,
  onClose,
}) => {
  // Check URL query parameters: ?team=ID, ?mode=hud|stage|popup, ?transparent=true, ?fit=contain|cover, ?maxh=380, ?always=true
  const { urlTeamId, urlMode, isTransparent, urlFit, urlMaxH, isAlwaysVisible } = useMemo(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('team');
      const m = p.get('mode');
      const trans =
        p.get('transparent') === '1' ||
        p.get('transparent') === 'true' ||
        config.obsTheme === 'transparent';
      const fit = p.get('fit');
      const maxh = p.get('maxh');
      const always =
        p.get('always') === 'true' ||
        p.get('always') === '1' ||
        p.get('preview') === 'true' ||
        p.get('force') === 'true' ||
        p.get('preview') === '1';
      return {
        urlTeamId: t && !isNaN(Number(t)) ? Number(t) : null,
        urlMode: m,
        isTransparent: trans,
        urlFit: fit === 'cover' ? 'cover' : 'contain',
        urlMaxH: maxh && !isNaN(Number(maxh)) ? Number(maxh) : null,
        isAlwaysVisible: always,
      };
    }
    return {
      urlTeamId: null,
      urlMode: null,
      isTransparent: false,
      urlFit: 'contain',
      urlMaxH: null,
      isAlwaysVisible: false,
    };
  }, [config.obsTheme]);

  // Small popup overlay variant check
  const isPopupMode = useMemo(() => {
    if (urlMode === 'popup' || urlMode === 'small') return true;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const layout = p.get('layout');
      return (
        layout === 'teamstats_popup' ||
        layout === 'teamstats_small' ||
        layout === 'popup' ||
        urlMode === 'popup'
      );
    }
    return false;
  }, [urlMode]);

  // Trigger state: appears for 20 seconds, then returns to hidden
  const [triggeredVisible, setTriggeredVisible] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(20);
  const [triggeredTeamId, setTriggeredTeamId] = useState<number | null>(null);

  useEffect(() => {
    let timer: any = null;
    let interval: any = null;

    const handleTriggerPayload = (payload: any) => {
      if (payload.teamId) {
        setTriggeredTeamId(payload.teamId);
      }
      const duration =
        payload.durationSeconds ||
        config.teamStatsTriggerDurationSeconds ||
        20;
      setTotalDuration(duration);
      setTriggeredVisible(true);
      setCountdownSeconds(duration);

      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);

      timer = setTimeout(() => {
        setTriggeredVisible(false);
        setCountdownSeconds(0);
      }, duration * 1000);

      interval = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const unsubscribe = subscribeToObsTestTrigger('teamstats', handleTriggerPayload);
    const unsubscribePopup = subscribeToObsTestTrigger('teamstats_popup', handleTriggerPayload);

    const handleCustomTrigger = (e: any) => {
      const payload = e?.detail || e?.data;
      if (payload && (payload.type === 'TEAM_STATS_TRIGGER' || payload.type === 'OBS_TEST_TRIGGER')) {
        if (payload.teamId) {
          setTriggeredTeamId(payload.teamId);
        }
        const duration = payload.durationSeconds || config.teamStatsTriggerDurationSeconds || 20;
        setTotalDuration(duration);
        setTriggeredVisible(true);
        setCountdownSeconds(duration);

        if (timer) clearTimeout(timer);
        if (interval) clearInterval(interval);

        timer = setTimeout(() => {
          setTriggeredVisible(false);
          setCountdownSeconds(0);
        }, duration * 1000);

        interval = setInterval(() => {
          setCountdownSeconds((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };
    window.addEventListener('TEAM_STATS_TRIGGER' as any, handleCustomTrigger);

    return () => {
      unsubscribe();
      unsubscribePopup();
      window.removeEventListener('TEAM_STATS_TRIGGER' as any, handleCustomTrigger);
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [config.teamStatsTriggerDurationSeconds]);

  // Determine active target team ID
  const activeTeamId = useMemo(() => {
    if (triggeredTeamId !== null && triggeredTeamId !== undefined) {
      return triggeredTeamId;
    }
    if (forcedTeamId !== null && forcedTeamId !== undefined) {
      return forcedTeamId;
    }
    if (urlTeamId !== null) {
      return urlTeamId;
    }
    if (config.selectedTeamStatsId !== undefined && config.selectedTeamStatsId !== null) {
      return config.selectedTeamStatsId;
    }
    if (activePlayers.length > 0) {
      return activePlayers[0].teamId || 1;
    }
    if (teamStandings.length > 0) {
      return teamStandings[0].teamId;
    }
    return 1;
  }, [triggeredTeamId, forcedTeamId, urlTeamId, config.selectedTeamStatsId, activePlayers, teamStandings]);

  // Compute stats data for the selected team
  const stats = useMemo(() => {
    return getTeamSquadStats(
      activeTeamId,
      activePlayers,
      savedMatches,
      config,
      teamStandings,
      config.teamStatsDataSource || 'auto',
      config.teamStatsSelectedMatchId
    );
  }, [
    activeTeamId,
    activePlayers,
    savedMatches,
    config,
    teamStandings,
  ]);

  // Real-time auto refresh timer
  const refreshSeconds = Math.max(1, config.streamRefreshInterval || 3);
  const onManualRefreshRef = useRef(onManualRefresh);
  useEffect(() => {
    onManualRefreshRef.current = onManualRefresh;
  }, [onManualRefresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (onManualRefreshRef.current) {
        onManualRefreshRef.current();
      }
    }, refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [refreshSeconds]);

  // Real-time synchronization via BroadcastChannel
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('pubg_tournament_channel');
        bc.onmessage = () => {
          if (onManualRefreshRef.current) onManualRefreshRef.current();
        };
      } catch {}
    }
    return () => {
      if (bc) bc.close();
    };
  }, []);

  const tournamentName = config.name || 'VIRTUOCITY BATTLEGROUND';
  const {
    teamId,
    teamName,
    teamColor,
    squadPic,
    isLiveGame,
    alivePlayersCount,
    totalKills,
    totalDamage,
    totalKnockouts,
    placement,
    players,
    matchLabel,
  } = stats;

  const currentTeamStanding = (teamStandings || []).find((t) => t.teamId === teamId);
  const teamRank =
    (teamStandings || []).findIndex((t) => t.teamId === teamId) !== -1
      ? (teamStandings || []).findIndex((t) => t.teamId === teamId) + 1
      : (placement || 1);
  const totalTournamentPoints = currentTeamStanding?.totalPoints ?? (totalKills + (currentTeamStanding?.totalPlacementPoints || 0));
  const totalTournamentKills = currentTeamStanding?.totalKills ?? totalKills;
  const rankedMatches = useMemo(() => (savedMatches || []).filter((m) => !m.excludeFromLeaderboard), [savedMatches]);
  const tournamentMatchesPlayed = currentTeamStanding?.matchesPlayed || rankedMatches.length || 1;

  // Match placement trend
  const matchPlacementTrend = useMemo(() => {
    return rankedMatches.map((m, idx) => {
      const ts = m.teamScores ? m.teamScores[teamId] : null;
      const rank = ts?.placement ?? 16;
      const pts = ts?.totalPoints ?? 0;
      const isWin = Boolean(ts?.isWinner || rank === 1);
      return {
        matchNumber: m.matchNumber || idx + 1,
        rank,
        pts,
        isWin,
      };
    });
  }, [rankedMatches, teamId]);

  // Accurate WWCD: count of matches where team got rank 1 or isWinner
  const wwcdCount = useMemo(() => {
    const trendWins = matchPlacementTrend.filter((m) => m.isWin).length;
    return Math.max(trendWins, currentTeamStanding?.wins ?? (currentTeamStanding as any)?.totalWins ?? 0);
  }, [matchPlacementTrend, currentTeamStanding]);

  const teamLogoUrl =
    config.teamLogos?.[teamId] ||
    config.teamLogos?.[String(teamId)] ||
    config.teamLogos?.[teamName] ||
    (teamName ? config.teamLogos?.[teamName.trim().toLowerCase()] : undefined);

  const teamFlag = resolveTeamFlagValue(teamId, config.teamFlags, teamName);

  // If in popup mode, appear only when triggered (or always/preview specified).
  // If in fullscreen stage mode, appear all the time.
  const isVisible = isAlwaysVisible || triggeredVisible || !isStandaloneObs || !isPopupMode;

  if (isStandaloneObs && !isVisible) {
    return <div id="team-stats-obs-silent" className="w-0 h-0 overflow-hidden" />;
  }

  // =========================================================================
  // CASE 1: SMALL POP-UP OVERLAY (LOWER-THIRD / COMPACT BROADCAST CARD)
  // Matches Screenshot 3 (Left Window: TEAM Stats Pop-up)
  // =========================================================================
  if (isPopupMode) {
    const progressPercent = totalDuration > 0 ? (countdownSeconds / totalDuration) * 100 : 0;

    return (
      <div
        id="team-stats-popup-overlay"
        className="fixed inset-0 pointer-events-none z-50 select-none overflow-hidden flex items-end justify-start p-4 sm:p-6 font-outfit"
      >
        <AnimatePresence>
          {isVisible && (
            <motion.div
              key={`team-stats-popup-${teamId}`}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="pointer-events-auto relative w-full max-w-[540px] rounded-2xl bg-[#111927]/98 backdrop-blur-xl border border-[#1e293b] shadow-[0_16px_50px_rgba(0,0,0,0.9)] p-4 sm:p-5 flex flex-col gap-3.5 overflow-hidden"
            >
              {/* Trigger Countdown Bar */}
              {triggeredVisible && countdownSeconds > 0 && (
                <div className="absolute top-0 inset-x-0 bg-[#0a0d14] h-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#38bdf8] to-[#10b981]"
                    initial={{ width: '100%' }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ ease: 'linear', duration: 0.8 }}
                  />
                </div>
              )}

              {/* Close Button */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 z-20 w-6 h-6 rounded-full bg-[#1e293b] hover:bg-[#334155] text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                  title="Close Pop-up"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Header: Logo (NO BOX) + Flag + Team Name + Subtitle + Right Badges */}
              <div className="flex items-center justify-between gap-2 border-b border-[#1e293b]/70 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {teamLogoUrl && (
                    <img
                      src={teamLogoUrl}
                      alt=""
                      className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0"
                    />
                  )}
                  {teamFlag && (
                    <TeamFlag
                      flagValue={teamFlag}
                      teamId={teamId}
                      className="w-6 h-4 object-cover rounded shadow flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-heading font-black uppercase text-white truncate leading-tight">
                      {teamName}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] font-telemetry font-bold text-[#38bdf8] uppercase tracking-wider">
                      TEAM SPOTLIGHT &bull; ID: {teamId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#ffb800]/15 border border-[#ffb800]/40 text-[#ffb800] text-xs font-heading font-black">
                    #{teamRank}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#78350f]/60 text-[#f59e0b] border border-[#f59e0b]/40 text-[11px] font-bold font-telemetry flex items-center gap-1">
                    🍗 {wwcdCount} WWCD
                  </span>
                </div>
              </div>

              {/* 3 Stats Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#0b121e] border border-[#1e293b] rounded-xl p-2 text-center">
                  <span className="text-[9px] font-heading font-bold text-[#64748b] uppercase tracking-wider block">
                    TOTAL PTS
                  </span>
                  <span className="text-lg sm:text-xl font-telemetry font-black text-[#ffb800]">
                    {totalTournamentPoints}
                  </span>
                </div>
                <div className="bg-[#0b121e] border border-[#1e293b] rounded-xl p-2 text-center">
                  <span className="text-[9px] font-heading font-bold text-[#64748b] uppercase tracking-wider block">
                    TOTAL KILLS
                  </span>
                  <span className="text-lg sm:text-xl font-telemetry font-black text-[#10b981]">
                    {totalTournamentKills}
                  </span>
                </div>
                <div className="bg-[#0b121e] border border-[#1e293b] rounded-xl p-2 text-center">
                  <span className="text-[9px] font-heading font-bold text-[#64748b] uppercase tracking-wider block">
                    MATCHES
                  </span>
                  <span className="text-lg sm:text-xl font-telemetry font-black text-[#38bdf8]">
                    {tournamentMatchesPlayed}
                  </span>
                </div>
              </div>

              {/* 4 Player Cards Row */}
              <div className="grid grid-cols-4 gap-2">
                {players.slice(0, 4).map((p, idx) => {
                  const portraitUrl =
                    config.playerPortraits?.[String(p.uId)] ||
                    config.playerPortraits?.[p.uId] ||
                    config.playerPortraits?.[p.playerName] ||
                    config.defaultPlayerPortraitUrl;
                  return (
                    <div
                      key={p.uId || idx}
                      className="bg-[#0b121e] border border-[#1e293b] rounded-xl p-1.5 flex flex-col items-center text-center"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-black/40 mb-1 flex items-center justify-center">
                        {portraitUrl ? (
                          <img
                            src={portraitUrl}
                            alt=""
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <span className="text-lg">👤</span>
                        )}
                      </div>
                      <span className="font-heading font-black uppercase text-[10px] text-white truncate max-w-full block">
                        {p.playerName}
                      </span>
                      <span className="font-telemetry font-bold text-[10px] text-[#38bdf8] mt-0.5">
                        <span className="text-[#10b981]">{p.kills}K</span> &bull; {p.damage}D
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Cyan Accent Line */}
              <div className="w-full h-1 bg-[#38bdf8] rounded-full mt-1" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // =========================================================================
  // CASE 2: MAIN BROADCAST STAGE OVERLAY (FULL SCREEN CARD)
  // Matches Screenshot 2 (Left Window: TEAM STATS FULL SCREEN)
  // =========================================================================
  return (
    <div
      id="team-stats-broadcast-stage"
      className={`relative w-full h-full min-h-screen overflow-hidden select-none flex flex-col items-center justify-center p-3 sm:p-6 ${
        isTransparent ? 'bg-transparent' : 'bg-[#0a0d14]'
      } text-white font-outfit`}
    >
      {/* Dismiss Button */}
      {!isStandaloneObs && onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-4 z-50 px-3 py-1.5 rounded-lg bg-[#121824]/90 hover:bg-[#ef4444]/20 border border-[#1e293b] text-[#94a3b8] hover:text-white text-xs font-telemetry font-bold transition-all shadow-lg cursor-pointer"
        >
          ✕ Close Overlay
        </button>
      )}

      {/* Main Container Card: Expanded Fullscreen Scale */}
      <div className="relative z-10 w-full max-w-6xl xl:max-w-7xl rounded-[22px] bg-[#111927]/98 border-2 border-[#1e293b] shadow-[0_16px_60px_rgba(0,0,0,0.9)] p-6 sm:p-8 md:p-9 flex flex-col gap-6 overflow-hidden backdrop-blur-md">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-[#1e293b]/70 pb-5">
          {/* Left: Logo (NO BOX) + Name + Trophy + Flag + WWCD Badge + Subtitle */}
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            {teamLogoUrl && (
              <img
                src={teamLogoUrl}
                alt=""
                className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-black uppercase text-white tracking-wide truncate">
                  {teamName}
                </h2>
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-[#ffb800] fill-[#ffb800] flex-shrink-0" />
                {teamFlag && (
                  <TeamFlag
                    flagValue={teamFlag}
                    teamId={teamId}
                    className="w-8 h-5 sm:w-9 sm:h-6 object-cover rounded shadow flex-shrink-0"
                  />
                )}
                <span className="px-3.5 py-1 rounded-full bg-[#78350f]/70 text-[#f59e0b] border border-[#f59e0b]/40 text-xs sm:text-sm font-bold font-telemetry flex items-center gap-1.5 shadow-sm">
                  🍗 {wwcdCount} WWCD
                </span>
              </div>
              <p className="text-xs sm:text-sm md:text-base font-telemetry font-bold text-[#38bdf8] uppercase tracking-wider mt-1.5">
                DAY 2 MATCH #{rankedMatches.length} &bull; TEAM ID: {teamId}
              </p>
            </div>
          </div>

          {/* Right: 4 Stat Boxes (RANK, TOTAL POINTS, KILLS, GAMES) */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
            <div className="bg-[#0b121e] border border-[#ffb800]/50 rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-center min-w-[85px] sm:min-w-[100px]">
              <span className="text-[10px] sm:text-xs font-heading font-bold text-[#94a3b8] uppercase tracking-wider block">
                RANK
              </span>
              <span className="text-lg sm:text-xl md:text-2xl font-telemetry font-black text-[#ffb800]">
                #{teamRank}
              </span>
            </div>
            <div className="bg-[#0b121e] border border-[#1e293b] rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-center min-w-[85px] sm:min-w-[100px]">
              <span className="text-[10px] sm:text-xs font-heading font-bold text-[#94a3b8] uppercase tracking-wider block">
                TOTAL POINTS
              </span>
              <span className="text-lg sm:text-xl md:text-2xl font-telemetry font-black text-white">
                {totalTournamentPoints}
              </span>
            </div>
            <div className="bg-[#0b121e] border border-[#1e293b] rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-center min-w-[85px] sm:min-w-[100px]">
              <span className="text-[10px] sm:text-xs font-heading font-bold text-[#94a3b8] uppercase tracking-wider block">
                KILLS
              </span>
              <span className="text-lg sm:text-xl md:text-2xl font-telemetry font-black text-[#10b981]">
                {totalTournamentKills}
              </span>
            </div>
            <div className="bg-[#0b121e] border border-[#1e293b] rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-center min-w-[85px] sm:min-w-[100px]">
              <span className="text-[10px] sm:text-xs font-heading font-bold text-[#94a3b8] uppercase tracking-wider block">
                GAMES
              </span>
              <span className="text-lg sm:text-xl md:text-2xl font-telemetry font-black text-[#38bdf8]">
                {tournamentMatchesPlayed}
              </span>
            </div>
          </div>
        </div>

        {/* Match Placement Trend Section */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs sm:text-sm font-heading font-black text-[#94a3b8] uppercase tracking-wider flex-shrink-0">
            MATCH PLACEMENT TREND:
          </span>
          <div className="flex items-center gap-2 flex-wrap overflow-x-auto no-scrollbar py-0.5">
            {matchPlacementTrend.map((m) => (
              <span
                key={`trend-m-${m.matchNumber}`}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-telemetry font-bold ${
                  m.isWin
                    ? 'bg-[#ffb800]/20 text-[#ffb800] border border-[#ffb800]/50 shadow-sm'
                    : 'bg-[#0b121e] text-[#94a3b8] border border-[#1e293b]'
                }`}
              >
                M{m.matchNumber}: <strong className={m.isWin ? 'text-[#ffb800]' : 'text-white'}>#{m.rank}</strong> ({m.pts}pts)
              </span>
            ))}
          </div>
        </div>

        {/* 4 Player Roster Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
          {players.slice(0, 4).map((p, idx) => {
            const portraitUrl =
              config.playerPortraits?.[String(p.uId)] ||
              config.playerPortraits?.[p.uId] ||
              config.playerPortraits?.[p.playerName] ||
              config.defaultPlayerPortraitUrl;
            return (
              <div
                key={p.uId || idx}
                className="bg-[#0b121e] border border-[#1e293b] rounded-xl p-3.5 sm:p-4 flex flex-col items-center text-center shadow-lg"
              >
                {/* Player Photo */}
                <div className="w-full h-36 sm:h-44 md:h-52 rounded-lg overflow-hidden bg-black/40 mb-2.5 flex items-center justify-center">
                  {portraitUrl ? (
                    <img
                      src={portraitUrl}
                      alt={p.playerName}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <span className="text-5xl text-slate-600">👤</span>
                  )}
                </div>

                {/* Player Name */}
                <h4 className="font-heading font-black uppercase text-sm sm:text-base md:text-lg text-white tracking-wide truncate max-w-full mb-2.5">
                  {p.playerName}
                </h4>

                {/* 2x2 Stats Grid */}
                <div className="w-full grid grid-cols-2 gap-2 text-left border-t border-[#1e293b]/70 pt-2.5">
                  <div>
                    <span className="block text-[9px] sm:text-[10px] font-heading font-bold text-[#64748b] uppercase">
                      KILLS
                    </span>
                    <span className="font-telemetry font-bold text-sm sm:text-base text-[#10b981]">
                      {p.kills}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] sm:text-[10px] font-heading font-bold text-[#64748b] uppercase">
                      DAMAGE
                    </span>
                    <span className="font-telemetry font-bold text-sm sm:text-base text-[#38bdf8]">
                      {p.damage}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] sm:text-[10px] font-heading font-bold text-[#64748b] uppercase">
                      KNOCKOUTS
                    </span>
                    <span className="font-telemetry font-bold text-sm sm:text-base text-[#ffb800]">
                      {p.knockouts || 0}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] sm:text-[10px] font-heading font-bold text-[#64748b] uppercase">
                      SURVIVAL
                    </span>
                    <span className="font-telemetry font-bold text-sm sm:text-base text-slate-200">
                      {p.survivalTimeFormatted || '26:59'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

