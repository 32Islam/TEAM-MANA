import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, Trophy, Swords, RotateCw, Shield } from 'lucide-react';
import {
  PlayerRawInfo,
  SavedMatch,
  TournamentConfig,
  TeamMatchScore,
  CumulativeTeamStats,
  CumulativePlayerStats,
} from '../types/pubg';
import {
  calculateMatchTeamScores,
  getTeamColor,
  findDuplicateMatch,
  resolveTeamDisplayName,
} from '../utils/pubgCalculations';
import { UnifiedTeamStanding } from './StreamLeaderboard';
import { TournamentLogoSlot } from './TournamentLogoSlot';
import { getCountryName } from '../utils/flagHelper';
import { getTournamentBroadcastChannel, subscribeToObsTestTrigger } from '../utils/storage';
import { TeamFlag } from './TeamFlag';

interface Top4LiveTeamsOverlayProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers: PlayerRawInfo[];
  teamStandings: CumulativeTeamStats[];
  playerStandings: CumulativePlayerStats[];
  onManualRefresh: () => void;
  isStandaloneObs?: boolean;
  onUpdateConfig?: (cfg: TournamentConfig) => void;
}

export const Top4LiveTeamsOverlay: React.FC<Top4LiveTeamsOverlayProps> = ({
  config,
  savedMatches,
  activePlayers,
  onManualRefresh,
  onUpdateConfig,
}) => {
  // Reactive liveConfig state that immediately updates on flag, team name, or config changes
  const [liveConfig, setLiveConfig] = useState<TournamentConfig>(config);
  useEffect(() => {
    setLiveConfig(config);
  }, [config]);

  // Real-time multi-channel synchronization: BroadcastChannel, window CustomEvent, and Server-Sent Events (SSE)
  useEffect(() => {
    // 1. Inter-tab / inter-window BroadcastChannel
    const bc = getTournamentBroadcastChannel();
    const handleBcMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CONFIG_UPDATED' && event.data?.config) {
        setLiveConfig(event.data.config);
      }
      setIsRefreshing(true);
      onManualRefreshRef.current();
      setTimeout(() => setIsRefreshing(false), 500);
    };
    if (bc) {
      bc.addEventListener('message', handleBcMessage);
    }

    // 2. Intra-window instant CustomEvent
    const handleWindowConfig = (e: CustomEvent) => {
      if (e.detail) {
        setLiveConfig(e.detail);
      }
    };
    window.addEventListener('pubg_config_changed', handleWindowConfig as EventListener);

    // 3. LocalStorage event listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pubg_tournament_config' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) setLiveConfig(parsed);
        } catch {}
      }
      if (
        e.key === 'pubg_saved_matches' ||
        e.key === 'pubg_tournament_config' ||
        e.key === 'pubg_last_snapshot'
      ) {
        setIsRefreshing(true);
        onManualRefreshRef.current();
        setTimeout(() => setIsRefreshing(false), 500);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 4. Server-Sent Events (SSE) listener for OBS browser sources or external viewers
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/tournament/events');
      es.addEventListener('STATE_UPDATED', (event: MessageEvent) => {
        try {
          const remote = JSON.parse(event.data);
          if (remote?.config) {
            setLiveConfig((prev) => ({
              ...prev,
              ...remote.config,
              teamFlags: remote.config.teamFlags !== undefined ? remote.config.teamFlags : prev.teamFlags,
            }));
          }
        } catch {}
      });
    } catch {}

    return () => {
      if (bc) bc.removeEventListener('message', handleBcMessage);
      window.removeEventListener('pubg_config_changed', handleWindowConfig as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      if (es) es.close();
    };
  }, []);

  const refreshSeconds = Math.max(1, liveConfig.streamRefreshInterval || 3);

  // Keep a stable ref for onManualRefresh to ensure setInterval doesn't drop or restart prematurely
  const onManualRefreshRef = useRef(onManualRefresh);
  useEffect(() => {
    onManualRefreshRef.current = onManualRefresh;
  }, [onManualRefresh]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(refreshSeconds);

  // Auto-refresh countdown matching streamRefreshInterval
  useEffect(() => {
    setCountdown(refreshSeconds);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsRefreshing(true);
          try {
            onManualRefreshRef.current();
          } catch (err) {
            console.error('[Top 4] Auto-refresh failed:', err);
          }
          setTimeout(() => setIsRefreshing(false), 500);
          return refreshSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [refreshSeconds]);

  const handleInstantRefresh = () => {
    setIsRefreshing(true);
    onManualRefreshRef.current();
    setCountdown(refreshSeconds);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const isLiveActive = Boolean(activePlayers && activePlayers.length > 0);

  // Filter out any matches that are excluded or hidden from the tournament rankings
  const visibleSavedMatches = useMemo(() => {
    return (savedMatches || []).filter(
      (m) => !m.excludeFromLeaderboard && !(m as any).isHidden && !(m as any).isExhibition
    );
  }, [savedMatches]);

  const latestVisibleSavedMatch = useMemo(() => {
    if (visibleSavedMatches.length === 0) return null;
    return visibleSavedMatches[visibleSavedMatches.length - 1];
  }, [visibleSavedMatches]);

  // Check if live activePlayers is actually already saved in savedMatches
  const liveSavedMatch = useMemo(() => {
    if (!isLiveActive || (savedMatches || []).length === 0) return null;
    return findDuplicateMatch(savedMatches, activePlayers);
  }, [isLiveActive, activePlayers, savedMatches]);

  // Check if the current live match is marked as hidden/excluded
  const isLiveMatchHidden = useMemo(() => {
    if (!liveSavedMatch) return false;
    return Boolean(
      liveSavedMatch.excludeFromLeaderboard ||
      (liveSavedMatch as any).isHidden ||
      (liveSavedMatch as any).isExhibition
    );
  }, [liveSavedMatch]);

  // Only display live match if it is NOT hidden
  const isLiveDisplayActive = isLiveActive && !isLiveMatchHidden;

  // Calculate live match scores for all active players
  const liveScores = useMemo<Record<number, TeamMatchScore>>(() => {
    if (!isLiveActive) return {};
    return calculateMatchTeamScores(activePlayers, liveConfig, false);
  }, [isLiveActive, activePlayers, liveConfig]);

  // Determine if the live game has ended / concluded
  const isLiveMatchConcluded = useMemo(() => {
    if (liveSavedMatch) return true;
    if (isLiveActive) {
      const scores = Object.values(liveScores) as TeamMatchScore[];
      const aliveTeams = scores.filter((s) => s.aliveCount > 0);
      const hasWinner = scores.some((s) => s.isWinner);
      if (
        hasWinner ||
        (scores.length > 1 &&
          aliveTeams.length === 1 &&
          scores.some((s) => s.totalKills > 0 || (s.totalDamage || 0) > 0))
      ) {
        return true;
      }
    }
    return false;
  }, [liveSavedMatch, isLiveActive, liveScores]);

  // Squad wipe elimination tracking for live matches
  const prevSquadAliveRef = useRef<Record<number, number>>({});
  const [eliminatedTimestamps, setEliminatedTimestamps] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!isLiveActive) return;

    const scores = Object.values(liveScores) as TeamMatchScore[];
    const newEliminations: Record<number, number> = {};
    let hasNew = false;

    scores.forEach((ls) => {
      const prev = prevSquadAliveRef.current[ls.teamId];
      if (prev !== undefined && prev > 0 && ls.aliveCount === 0) {
        newEliminations[ls.teamId] = Date.now();
        hasNew = true;
      }
      prevSquadAliveRef.current[ls.teamId] = ls.aliveCount;
    });

    if (hasNew) {
      setEliminatedTimestamps((prev) => ({
        ...prev,
        ...newEliminations,
      }));
    }
  }, [isLiveActive, liveScores]);

  // Clear eliminated animations after 5 seconds
  useEffect(() => {
    if (Object.keys(eliminatedTimestamps).length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const nextMap: Record<number, number> = {};
      Object.entries(eliminatedTimestamps).forEach(([idStr, tVal]) => {
        const t = Number(tVal);
        if (now - t < 5000) {
          nextMap[Number(idStr)] = t;
        } else {
          changed = true;
        }
      });
      if (changed) {
        setEliminatedTimestamps(nextMap);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [eliminatedTimestamps]);

  // Build the Top 4 Teams, ensuring hidden games are never shown
  const top4Teams = useMemo<UnifiedTeamStanding[]>(() => {
    // 1. Live Match Display (Only if NOT hidden)
    if (isLiveDisplayActive) {
      const liveScoresList = Object.values(liveScores) as TeamMatchScore[];
      const aliveTeams = liveScoresList.filter((s) => s.aliveCount > 0);

      // Sort alive teams primarily by aliveCount, then totalPoints, then totalKills
      const sortedAlive = [...aliveTeams].sort((a, b) => {
        if (b.aliveCount !== a.aliveCount) return b.aliveCount - a.aliveCount;
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
        return a.placement - b.placement;
      });

      let selectedScores: TeamMatchScore[] = [];

      if (sortedAlive.length >= 4) {
        selectedScores = sortedAlive.slice(0, 4);
      } else {
        selectedScores = [...sortedAlive];
        const aliveIds = new Set(selectedScores.map((s) => s.teamId));

        // Fill remaining slots with recently eliminated teams
        const deadTeams = liveScoresList
          .filter((s) => !aliveIds.has(s.teamId))
          .sort((a, b) => {
            const timeA = eliminatedTimestamps[a.teamId] || 0;
            const timeB = eliminatedTimestamps[b.teamId] || 0;
            if (timeB !== timeA) return timeB - timeA;
            if (a.placement !== b.placement && a.placement > 0 && b.placement > 0) {
              return a.placement - b.placement;
            }
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            return b.totalKills - a.totalKills;
          });

        const needed = 4 - selectedScores.length;
        selectedScores = [...selectedScores, ...deadTeams.slice(0, needed)];
      }

      const assignedPlacements = new Set<number>();

      return selectedScores.map((ts, idx) => {
        const roster = activePlayers
          .filter((p) => p.teamId === ts.teamId)
          .map((p) => ({
            uId: p.uId,
            playerName: p.playerName,
            isAlive: !p.bHasDied && p.health > 0,
            health: p.health,
            healthMax: p.healthMax || 100,
            liveState: p.liveState,
            kills: p.killNum,
            damage: p.damage,
          }));

        const isAlive = ts.aliveCount > 0;
        let calculatedPlacement = ts.placement || idx + 1;

        if (isAlive) {
          calculatedPlacement = idx + 1;
        } else {
          let p = Math.max(idx + 1, ts.placement || idx + 1);
          while (assignedPlacements.has(p)) {
            p++;
          }
          calculatedPlacement = p;
        }
        assignedPlacements.add(calculatedPlacement);

        const displayName = resolveTeamDisplayName(ts.teamId, ts.teamName, liveConfig, true);

        return {
          teamId: ts.teamId,
          teamName: displayName,
          color: getTeamColor(ts.teamId),
          roster,
          matchesPlayed: 1,
          pastWins: 0,
          pastPlacementPoints: 0,
          pastKillPoints: 0,
          pastKills: 0,
          pastTotalPoints: 0,
          matchRanks: [],
          isLivePresent: true,
          liveAliveCount: isAlive ? ts.aliveCount : 0,
          liveTotalMembers: roster.length || 4,
          liveKills: ts.totalKills,
          liveKillPoints: ts.killPoints,
          liveDamage: ts.totalDamage,
          livePlacement: calculatedPlacement,
          liveRankPoints: ts.rankPoints,
          liveTotalPoints: ts.totalPoints,
          liveStatus: isAlive ? ('ALIVE' as const) : ('ELIMINATED' as const),
          isLiveWinner: ts.isWinner,
          totalKills: ts.totalKills,
          totalPlacementPoints: ts.rankPoints,
          totalPoints: ts.totalPoints,
          totalWins: ts.isWinner ? 1 : 0,
        };
      });
    }

    // 2. Latest Visible (Non-Hidden) Saved Match
    if (latestVisibleSavedMatch && latestVisibleSavedMatch.teamScores) {
      const rawScores = Object.values(latestVisibleSavedMatch.teamScores) as TeamMatchScore[];
      const scores = rawScores.sort((a, b) => (a.placement || 99) - (b.placement || 99));

      return scores.slice(0, 4).map((ts) => {
        const isWinner = ts.placement === 1 || ts.isWinner;
        const roster = (latestVisibleSavedMatch.playerSnapshots || [])
          .filter((p) => p.teamId === ts.teamId)
          .map((p) => ({
            uId: p.uId,
            playerName: p.playerName,
            isAlive: isWinner ? true : !p.bHasDied && p.health > 0,
            health: isWinner ? 100 : p.health,
            healthMax: p.healthMax || 100,
            liveState: isWinner ? 0 : p.liveState,
            kills: p.killNum,
            damage: p.damage,
          }));

        const displayName = resolveTeamDisplayName(ts.teamId, ts.teamName, liveConfig, false);

        return {
          teamId: ts.teamId,
          teamName: displayName,
          color: getTeamColor(ts.teamId),
          roster,
          matchesPlayed: 1,
          pastWins: isWinner ? 1 : 0,
          pastPlacementPoints: ts.rankPoints,
          pastKillPoints: ts.killPoints,
          pastKills: ts.totalKills,
          pastTotalPoints: ts.totalPoints,
          matchRanks: ts.placement ? [{ matchNumber: latestVisibleSavedMatch.matchNumber, rank: ts.placement, points: ts.totalPoints }] : [],
          isLivePresent: false,
          liveAliveCount: isWinner ? roster.filter((r) => r.isAlive).length || 4 : 0,
          liveTotalMembers: roster.length || 4,
          liveKills: ts.totalKills,
          liveKillPoints: ts.killPoints,
          liveDamage: ts.totalDamage,
          livePlacement: ts.placement,
          liveRankPoints: ts.rankPoints,
          liveTotalPoints: ts.totalPoints,
          liveStatus: isWinner ? ('WINNER' as const) : ('ELIMINATED' as const),
          isLiveWinner: isWinner,
          totalKills: ts.totalKills,
          totalPlacementPoints: ts.rankPoints,
          totalPoints: ts.totalPoints,
          totalWins: isWinner ? 1 : 0,
        };
      });
    }

    // 3. Fallback Standby default Teams 1..4
    const defaultTeams: UnifiedTeamStanding[] = [];
    for (let i = 1; i <= 4; i++) {
      const displayName = resolveTeamDisplayName(i, undefined, liveConfig, false);
      defaultTeams.push({
        teamId: i,
        teamName: displayName,
        color: getTeamColor(i),
        roster: [],
        matchesPlayed: 0,
        pastWins: 0,
        pastPlacementPoints: 0,
        pastKillPoints: 0,
        pastKills: 0,
        pastTotalPoints: 0,
        matchRanks: [],
        isLivePresent: false,
        liveAliveCount: 0,
        liveTotalMembers: 4,
        liveKills: 0,
        liveKillPoints: 0,
        liveDamage: 0,
        livePlacement: i,
        liveRankPoints: 0,
        liveTotalPoints: 0,
        liveStatus: 'STANDBY',
        isLiveWinner: false,
        totalKills: 0,
        totalPlacementPoints: 0,
        totalPoints: 0,
        totalWins: 0,
      });
    }
    return defaultTeams;
  }, [
    isLiveDisplayActive,
    liveScores,
    eliminatedTimestamps,
    activePlayers,
    liveConfig,
    latestVisibleSavedMatch,
  ]);

  // Chamfered clipping style
  const outerChamferStyle = {
    clipPath:
      'polygon(12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px), 0% 12px)',
  };

  const innerChamferStyle = {
    clipPath:
      'polygon(11px 0%, calc(100% - 11px) 0%, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0% calc(100% - 11px), 0% 11px)',
  };

  // Determine if a team has won the match
  const winningTeam = useMemo(() => {
    if (isLiveDisplayActive) {
      const scores = Object.values(liveScores) as TeamMatchScore[];
      const winScore = scores.find((s) => s.isWinner);
      if (winScore) {
        const displayName = resolveTeamDisplayName(winScore.teamId, winScore.teamName, liveConfig, true);
        return {
          teamId: winScore.teamId,
          teamName: displayName,
          color: getTeamColor(winScore.teamId),
        };
      }
      const alive = scores.filter((s) => s.aliveCount > 0);
      // When 2 teams are left and 1 dies, only 1 team remains alive - trigger WIN immediately!
      if (alive.length === 1 && scores.length > 1) {
        const winScore2 = alive[0];
        const displayName = resolveTeamDisplayName(winScore2.teamId, winScore2.teamName, liveConfig, true);
        return {
          teamId: winScore2.teamId,
          teamName: displayName,
          color: getTeamColor(winScore2.teamId),
        };
      }
    } else if (latestVisibleSavedMatch && latestVisibleSavedMatch.teamScores) {
      const scores = Object.values(latestVisibleSavedMatch.teamScores) as TeamMatchScore[];
      const winScore = scores.find((s) => s.placement === 1 || s.isWinner);
      if (winScore) {
        const displayName = resolveTeamDisplayName(winScore.teamId, winScore.teamName, liveConfig, false);
        return {
          teamId: winScore.teamId,
          teamName: displayName,
          color: getTeamColor(winScore.teamId),
        };
      }
    }
    return null;
  }, [isLiveDisplayActive, liveScores, latestVisibleSavedMatch, liveConfig]);

  // Number of teams with at least 1 alive player during live gameplay
  const aliveTeamsCount = useMemo(() => {
    if (!isLiveDisplayActive) return 0;
    const scores = Object.values(liveScores) as TeamMatchScore[];
    return scores.filter((s) => s.aliveCount > 0).length;
  }, [isLiveDisplayActive, liveScores]);

  // Determine if the match has concluded (a winner is decided or post-match display)
  const isMatchEnded = useMemo(() => {
    if (winningTeam) return true;
    if (isLiveMatchConcluded) return true;
    if (latestVisibleSavedMatch && !isLiveDisplayActive) return true;
    return false;
  }, [winningTeam, isLiveMatchConcluded, latestVisibleSavedMatch, isLiveDisplayActive]);

  // Targeted OBS test trigger state
  const [targetedObsTestActive, setTargetedObsTestActive] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeToObsTestTrigger('top4', (payload) => {
      setTargetedObsTestActive(true);
      const dur = (payload.durationSeconds || 20) * 1000;
      setTimeout(() => setTargetedObsTestActive(false), dur);
    });

    return unsubscribe;
  }, []);

  // Top 4 HUD visibility logic:
  // User Requirement:
  // "for the top 4 hud it remains active in background but hidden until 4 teams are left it becomes visible"
  // 1 - In OBS background: stays completely hidden while > 4 teams are alive during matches.
  // 2 - As soon as <= 4 teams are left alive (aliveTeamsCount <= 4 and > 0), it automatically slides down into view!
  // 3 - When a team wins (WWCD), it stays visible celebrating the victory.
  // 4 - When no match is active, stays hidden unless an OBS test / preview is triggered.
  const isTop4Visible = useMemo(() => {
    if (targetedObsTestActive) return true;

    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (
        p.get('preview') === 'true' ||
        p.get('force') === 'true' ||
        p.get('test') === 'true' ||
        p.get('demo') === '1'
      ) {
        return true;
      }
    }

    // During active live gameplay:
    if (isLiveDisplayActive && aliveTeamsCount > 0) {
      if (Boolean(winningTeam)) {
        return true;
      }
      return aliveTeamsCount <= 4;
    }

    // When no live match is running or > 4 teams are alive, keep hidden in OBS background
    return false;
  }, [targetedObsTestActive, isLiveDisplayActive, winningTeam, aliveTeamsCount]);

  const isTransparent = useMemo(() => {
    if (typeof window === 'undefined') return true;
    const p = new URLSearchParams(window.location.search);
    return p.get('transparent') === '1' || p.get('transparent') === 'true' || liveConfig.obsTheme === 'transparent';
  }, [liveConfig.obsTheme]);

  return (
    <div
      id="top4-live-overlay"
      className="relative w-full h-screen max-h-screen bg-transparent text-white select-none px-3 sm:px-5 pt-0 pb-3 flex flex-col items-center justify-start overflow-hidden font-sans"
    >
      <AnimatePresence>
        {isTop4Visible && (
          <motion.div
            key="top4-normal-container"
            layout
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -25 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full max-w-5xl mx-auto z-10 flex flex-col items-center justify-start pt-0 sm:pt-1"
          >
            <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <AnimatePresence mode="popLayout">
                {top4Teams.map((team, index) => {
                  const rank = index + 1;
                  const isFirstPlace = rank === 1;
                  const isAlive = (team.liveAliveCount ?? 0) > 0 || team.liveStatus === 'ALIVE';
                  const isWinner = team.isLiveWinner || team.liveStatus === 'WINNER';
                  const isJustEliminated = Boolean(eliminatedTimestamps[team.teamId]);

                  const rawTeamName = (team.teamName || '').trim();
                  const displayName =
                    !rawTeamName || /^team\s*\d+$/i.test(rawTeamName)
                      ? rawTeamName ? rawTeamName.toUpperCase() : `TEAM #${team.teamId}`
                      : rawTeamName;

                  const liveScore = liveScores[team.teamId];
                  const aliveCount = liveScore?.aliveCount ?? team.liveAliveCount ?? (isAlive ? 4 : 0);
                  const isStandby = team.liveStatus === 'STANDBY' && !isLiveDisplayActive && !latestVisibleSavedMatch;
                  const teamPlayers = activePlayers.filter((p) => p.teamId === team.teamId);

                  const teamFlag =
                    liveConfig.showTeamFlags !== false
                      ? liveConfig.teamFlags?.[team.teamId] || liveConfig.teamFlags?.[String(team.teamId)]
                      : null;
                  const countryName = getCountryName(teamFlag);

                  return (
                    <motion.div
                      key={`top4-card-${team.teamId}`}
                      layout="position"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: isJustEliminated ? [1, 1.05, 0.98, 1] : 1,
                      }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.35 }}
                      style={{
                        borderLeft: isWinner
                          ? '4px solid #10b981'
                          : rank === 1
                          ? '4px solid #ffb800'
                          : rank === 2
                          ? '4px solid #cbd5e1'
                          : rank === 3
                          ? '4px solid #f97316'
                          : '4px solid #38bdf8',
                      }}
                      className={`relative rounded-[12px] p-3 transition-all duration-200 bg-gradient-to-b from-[#0f172a]/96 via-[#0a0f1d]/96 to-[#060a14]/98 backdrop-blur-md border border-[#1e293b] hover:bg-[#121824] hover:border-[#334155] ${
                        isWinner
                          ? 'shadow-[0_0_24px_rgba(16,185,129,0.35)]'
                          : rank === 1
                          ? 'shadow-[0_0_20px_rgba(255,184,0,0.25)]'
                          : 'shadow-md'
                      } ${!isAlive && !isWinner && !isStandby ? 'opacity-40 grayscale-[25%]' : 'opacity-100'}`}
                    >
                      <div className="w-full flex flex-col justify-between items-center text-center">
                        {/* Team Rank / WWCD Indicator */}
                        <div className="flex items-center justify-center gap-1.5 mb-1 flex-shrink-0">
                          {isWinner ? (
                            <span className="flex items-center gap-1 text-[11px] font-telemetry text-[#10b981] uppercase font-bold tracking-wider bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.35)] px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                              <Trophy className="w-3.5 h-3.5 text-[#ffb800]" />
                              WWCD
                            </span>
                          ) : (
                            <span className={`text-[10px] font-telemetry uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                              rank === 1
                                ? 'text-[#ffb800] bg-[rgba(255,184,0,0.15)] border-[rgba(255,184,0,0.40)]'
                                : rank === 2
                                ? 'text-[#cbd5e1] bg-[rgba(203,213,225,0.15)] border-[rgba(203,213,225,0.35)]'
                                : rank === 3
                                ? 'text-[#f97316] bg-[rgba(249,115,22,0.15)] border-[rgba(249,115,22,0.35)]'
                                : 'text-[#38bdf8] bg-[rgba(56,189,248,0.12)] border-[rgba(56,189,248,0.35)]'
                            }`}>
                              #{rank}
                            </span>
                          )}
                        </div>

                        {/* Full Team Name, Country Flag & Team Logo */}
                        <div className="w-full px-1 flex-1 flex items-center justify-center gap-1.5 my-1 min-w-0">
                          {(() => {
                            const teamLogo =
                              liveConfig.teamLogos?.[team.teamId] ||
                              liveConfig.teamLogos?.[String(team.teamId)] ||
                              liveConfig.teamLogos?.[team.teamName] ||
                              (team.teamName ? liveConfig.teamLogos?.[team.teamName.trim().toLowerCase()] : undefined);
                            return (
                              <>
                                {teamLogo && (
                                  <img
                                    src={teamLogo}
                                    alt=""
                                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
                                  />
                                )}
                                {teamFlag && (
                                  <TeamFlag
                                    flagValue={teamFlag}
                                    teamId={team.teamId}
                                    isWinner={isWinner}
                                    className={`w-5 h-3.5 sm:w-6 sm:h-4 object-cover rounded-[2px] shadow-sm flex-shrink-0 ${
                                      isWinner
                                        ? 'border border-[#ffb800] ring-1 ring-[rgba(255,184,0,0.5)]'
                                        : 'border border-white/20'
                                    }`}
                                  />
                                )}
                              </>
                            );
                          })()}
                          <h3
                            className="font-heading font-black text-sm sm:text-base md:text-lg text-[#f8fafc] tracking-wide uppercase leading-tight break-words text-center"
                            title={displayName}
                          >
                            {displayName}
                          </h3>
                        </div>

                        {/* Indicator of Live Players Only */}
                        <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-shrink-0">
                          {/* Case 1: Standby Mode */}
                          {isStandby && (
                            <>
                              <div className="flex items-center gap-1" title="Standby / Squad Ready">
                                {[0, 1, 2, 3].map((slotIdx) => (
                                  <div
                                    key={slotIdx}
                                    className="w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-[1px] bg-[#0a0d14] border border-[#1e293b] flex flex-col justify-end overflow-hidden"
                                  >
                                    <div className="w-full h-full bg-[#38bdf8]/60" />
                                  </div>
                                ))}
                              </div>
                              <span className="text-[9px] sm:text-[10px] font-telemetry font-bold uppercase tracking-wider ml-1 text-[#38bdf8]">
                                READY
                              </span>
                            </>
                          )}

                          {/* Case 2: Post-Match Saved Game */}
                          {!isLiveDisplayActive && latestVisibleSavedMatch && !isStandby && (
                            <>
                              <div className="flex items-center gap-1">
                                {[0, 1, 2, 3].map((slotIdx) => (
                                  <div
                                    key={slotIdx}
                                    className={`w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-[1px] bg-[#0a0d14] border flex flex-col justify-end overflow-hidden ${
                                      isWinner
                                        ? 'border-[#10b981] shadow-[0_0_6px_#10b981]'
                                        : 'border-[#1e293b]'
                                    }`}
                                  >
                                    <div
                                      className={`w-full h-full ${
                                        isWinner ? 'bg-[#10b981]' : 'bg-[#38bdf8]/60'
                                      }`}
                                    />
                                  </div>
                                ))}
                              </div>
                              <span
                                className={`text-[9px] sm:text-[10px] font-telemetry font-bold uppercase tracking-wider ml-1 ${
                                  isWinner ? 'text-[#10b981]' : 'text-[#38bdf8]'
                                }`}
                              >
                                {isWinner ? 'WWCD' : `#${rank} PLACE`}
                              </span>
                            </>
                          )}

                          {/* Case 3: Live In-Game Match */}
                          {isLiveDisplayActive && (
                            <>
                              <div className="flex items-center gap-1">
                                {[0, 1, 2, 3].map((slotIdx) => {
                                  if (isWinner) {
                                    return (
                                      <div
                                        key={slotIdx}
                                        title="Winner - WWCD"
                                        className="w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-[1px] bg-[#0a0d14] border border-[#10b981] flex flex-col justify-end overflow-hidden shadow-[0_0_6px_#10b981]"
                                      >
                                        <div className="w-full h-full bg-[#10b981]" />
                                      </div>
                                    );
                                  }

                                  if (isJustEliminated || aliveCount === 0) {
                                    return (
                                      <div
                                        key={slotIdx}
                                        title="Eliminated"
                                        className="w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-[1px] bg-[#0a0d14] border border-[#1e293b] flex flex-col justify-end overflow-hidden"
                                      >
                                        <div className="w-full h-0" />
                                      </div>
                                    );
                                  }

                                  const p = teamPlayers[slotIdx];
                                  const isDead = p
                                    ? (p.bHasDied || p.health <= 0 || p.liveState === 2)
                                    : (slotIdx >= aliveCount);
                                  const isKnocked = p
                                    ? (!isDead && (p.liveState === 1 || Boolean((p as any).bIsKnocked)))
                                    : false;
                                  const healthVal = p
                                    ? Math.max(0, Math.min(100, p.health))
                                    : (slotIdx < aliveCount ? 100 : 0);

                                  if (isDead || healthVal <= 0) {
                                    return (
                                      <div
                                        key={slotIdx}
                                        title="Player Dead"
                                        className="w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-[1px] bg-[#0a0d14] border border-[#1e293b] flex flex-col justify-end overflow-hidden"
                                      >
                                        <div className="w-full h-0" />
                                      </div>
                                    );
                                  }

                                  if (isKnocked) {
                                    return (
                                      <div
                                        key={slotIdx}
                                        title={`Knocked Down (HP: ${Math.round(healthVal)}%)`}
                                        className="w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-[1px] bg-[#1a0508] border border-[#ef4444] flex flex-col justify-end overflow-hidden shadow-[0_0_6px_rgba(239,68,68,0.7)] animate-pulse"
                                      >
                                        <div
                                          className="w-full bg-[#ef4444] transition-all duration-300"
                                          style={{ height: `${Math.max(20, healthVal)}%` }}
                                        />
                                      </div>
                                    );
                                  }

                                  const barColor =
                                    healthVal > 50
                                      ? 'bg-[#10b981] shadow-[0_0_4px_rgba(16,185,129,0.8)]'
                                      : healthVal > 20
                                      ? 'bg-[#ffb800] shadow-[0_0_4px_rgba(255,184,0,0.8)]'
                                      : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.9)] animate-pulse';

                                  return (
                                    <div
                                      key={slotIdx}
                                      title={`HP: ${Math.round(healthVal)}%`}
                                      className="w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-[1px] bg-[#0a0d14] border border-[#1e293b] flex flex-col justify-end overflow-hidden"
                                    >
                                      <div
                                        className={`w-full ${barColor} transition-all duration-300 ease-out`}
                                        style={{ height: `${healthVal}%` }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              <span
                                className={`text-[9px] sm:text-[10px] font-telemetry font-bold uppercase tracking-wider ml-1 flex items-center gap-0.5 ${
                                  isWinner
                                    ? 'text-[#10b981] font-black'
                                    : aliveCount > 0
                                    ? 'text-[#10b981]'
                                    : 'text-[#64748b]'
                                }`}
                              >
                                {isWinner ? (
                                  'WWCD'
                                ) : aliveCount > 0 ? (
                                  `${aliveCount} ALIVE`
                                ) : (
                                  <>
                                    <Skull className="w-2.5 h-2.5 inline" />
                                    {isJustEliminated ? 'OUT' : 'OUT'}
                                  </>
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
