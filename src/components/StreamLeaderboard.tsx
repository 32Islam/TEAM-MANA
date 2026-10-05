import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Trophy,
  Zap,
  Radio,
  Swords,
  Clock,
  CheckCircle2,
  Pause,
  Layers,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import {
  CumulativePlayerStats,
  CumulativeTeamStats,
  PlayerRawInfo,
  SavedMatch,
  TeamMatchScore,
  TournamentConfig,
} from '../types/pubg';
import {
  calculateMatchTeamScores,
  getTeamColor,
  findDuplicateMatch,
  resolveTeamDisplayName,
  compareTeamsOfficialTieBreakers,
} from '../utils/pubgCalculations';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { subscribeToObsTestTrigger } from '../utils/storage';
import { CyberLeaderboardRow } from './CyberLeaderboardRow';
import { BetweenGamesLeaderboard } from './BetweenGamesLeaderboard';
import { Top4LiveTeamsOverlay } from './Top4LiveTeamsOverlay';
import { FullScreenStageLeaderboard } from './FullScreenStageLeaderboard';
import { MainLeaderboard } from './MainLeaderboard';
import { NarrowSideLeaderboard } from './NarrowSideLeaderboard';
import { TeamStatsOverlay } from './TeamStatsOverlay';
import { WinnerCelebration } from './WinnerCelebration';
import { TeamEliminatedAlertOverlay } from './TeamEliminatedAlertOverlay';
import { MatchMvpOverlay } from './MatchMvpOverlay';

interface StreamLeaderboardProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers: PlayerRawInfo[];
  teamStandings: CumulativeTeamStats[];
  playerStandings: CumulativePlayerStats[];
  onManualRefresh: () => void;
  isStandaloneObs?: boolean;
  onUpdateConfig?: (cfg: TournamentConfig) => void;
  layoutOverride?: string;
}

export interface UnifiedPlayerInfo {
  uId: number;
  playerName: string;
  isAlive: boolean;
  health?: number;
  healthMax?: number;
  liveState?: number;
  kills?: number;
  damage?: number;
}

export interface UnifiedTeamStanding {
  teamId: number;
  teamName: string;
  color: ReturnType<typeof getTeamColor>;
  roster: UnifiedPlayerInfo[];

  // Past / Saved Matches stats
  matchesPlayed: number;
  pastWins: number;
  pastPlacementPoints: number;
  pastKillPoints: number;
  pastKills: number;
  pastTotalPoints: number;
  matchRanks: { matchNumber: number; rank: number; points: number }[];

  // Live Match stats
  isLivePresent: boolean;
  liveAliveCount: number;
  liveTotalMembers: number;
  liveKills: number;
  liveKillPoints: number;
  liveDamage: number;
  livePlacement: number;
  liveRankPoints: number;
  liveTotalPoints: number;
  liveStatus: 'ALIVE' | 'ELIMINATED' | 'STANDBY' | 'WINNER';
  isLiveWinner: boolean;

  // Combined Totals (All Games + Live)
  totalKills: number;
  totalPlacementPoints: number;
  totalPoints: number;
  totalWins: number;
  isLatestGameWinner?: boolean;
  flagValue?: string | null;
}

export const StreamLeaderboard: React.FC<StreamLeaderboardProps> = ({
  config,
  savedMatches,
  activePlayers,
  teamStandings,
  playerStandings = [],
  onManualRefresh,
  isStandaloneObs = false,
  onUpdateConfig,
  layoutOverride,
}) => {
  const refreshSeconds = config.streamRefreshInterval || 3;

  // Check if transparent background requested via URL (?transparent=true or ?transparent=1)
  const isTransparent = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('transparent') === 'true' || params.get('transparent') === '1';
    }
    return false;
  }, []);

  // Check if stage leaderboard requested via URL (?layout=stage or ?layout=wide or ?view=stage)
  const isStageMode = useMemo(() => {
    if (layoutOverride === 'stage' || layoutOverride === 'wide' || layoutOverride === 'half' || layoutOverride === 'halfscreen') return true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layout = params.get('layout') || params.get('mode');
      const view = params.get('view');
      return layout === 'stage' || layout === 'fullscreen' || layout === 'wide' || layout === 'between-games' || layout === 'half' || layout === 'halfscreen' || view === 'stage';
    }
    return false;
  }, [layoutOverride]);

  // Check if Main Between-Games Leaderboard requested via URL (?layout=main or ?layout=main_leaderboard or ?view=main)
  const isMainLeaderboardMode = useMemo(() => {
    if (layoutOverride === 'main') return true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layout = params.get('layout') || params.get('mode');
      const view = params.get('view');
      return layout === 'main' || layout === 'main_leaderboard' || layout === 'main-leaderboard' || view === 'main';
    }
    return false;
  }, [layoutOverride]);

  // Check if narrow side leaderboard requested via URL (?layout=side or ?layout=narrow or ?layout=overlay or ?view=side)
  const isSideMode = useMemo(() => {
    if (layoutOverride === 'side' || layoutOverride === 'narrow' || layoutOverride === 'overlay') return true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layout = params.get('layout') || params.get('mode');
      const view = params.get('view');
      return layout === 'side' || layout === 'narrow' || layout === 'overlay' || layout === 'ingame' || view === 'side';
    }
    return false;
  }, [layoutOverride]);

  // Check if Top 4 live teams overlay requested via URL (?layout=top4 or ?layout=latest4 or ?view=top4)
  const isTop4Mode = useMemo(() => {
    if (layoutOverride === 'top4') return true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layout = params.get('layout') || params.get('mode');
      const view = params.get('view');
      return layout === 'top4' || layout === 'latest4' || layout === 'top4hud' || view === 'top4';
    }
    return false;
  }, [layoutOverride]);

  // Check if Team Stats overlay requested via URL (?layout=teamstats or ?view=teamstats)
  const isTeamStatsMode = useMemo(() => {
    if (layoutOverride === 'teamstats' || layoutOverride === 'teamstats_popup') return true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layout = params.get('layout') || params.get('mode');
      const view = params.get('view');
      return (
        layout === 'teamstats' ||
        layout === 'squadstats' ||
        layout === 'team_stats' ||
        layout === 'teamstats_popup' ||
        layout === 'teamstats_small' ||
        view === 'teamstats'
      );
    }
    return false;
  }, [layoutOverride]);

  // Check if Team Eliminated Alert overlay requested via URL (?layout=elimination or ?layout=elim or ?view=elimination)
  const isElimAlertMode = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layout = params.get('layout') || params.get('mode');
      const view = params.get('view');
      return (
        layout === 'elimination' ||
        layout === 'elim' ||
        layout === 'eliminated' ||
        layout === 'killalert' ||
        view === 'elimination' ||
        view === 'elim'
      );
    }
    return false;
  }, []);

  // Check if Full Screen Match MVP overlay requested via URL (?layout=mvp or ?layout=match_mvp or ?view=mvp)
  const isMvpMode = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layout = params.get('layout') || params.get('mode');
      const view = params.get('view');
      return (
        layout === 'mvp' ||
        layout === 'match_mvp' ||
        layout === 'tournament_mvp' ||
        layout === 'mvp_match' ||
        layout === 'mvp_all' ||
        layout === 'mvp_popup' ||
        layout === 'mvp_small' ||
        view === 'mvp'
      );
    }
    return false;
  }, []);

  // Active layout tab for live stream/browser preview
  const [activeLayoutTab, setActiveLayoutTab] = useState<'side' | 'main' | 'stage' | 'top4' | 'teamstats'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layout = params.get('layout') || params.get('mode');
      const view = params.get('view');
      if (layout === 'main' || view === 'main') return 'main';
      if (layout === 'stage' || layout === 'wide' || layout === 'between-games' || view === 'stage') return 'stage';
      if (layout === 'top4' || view === 'top4') return 'top4';
      if (layout === 'teamstats' || view === 'teamstats') return 'teamstats';
      if (layout === 'side' || layout === 'narrow' || layout === 'overlay' || layout === 'ingame' || view === 'side') return 'side';
    }
    return 'side'; // Default to the exact In-Game Side Leaderboard requested by user
  });

  // Silent auto-refresh loop matching streamRefreshInterval (default 3s)
  useEffect(() => {
    const timer = setInterval(() => {
      onManualRefresh();
    }, refreshSeconds * 1000);

    return () => clearInterval(timer);
  }, [refreshSeconds, onManualRefresh]);

  const isLiveActive = activePlayers && activePlayers.length > 0;

  // Check if live activePlayers is actually already saved in savedMatches (prevents duplicate points!)
  const isLiveAlreadySaved = useMemo(() => {
    if (!isLiveActive || savedMatches.length === 0) return false;
    return Boolean(findDuplicateMatch(savedMatches, activePlayers));
  }, [isLiveActive, activePlayers, savedMatches]);

  // Calculate live match scores for all active players
  const liveScores = useMemo<Record<number, TeamMatchScore>>(() => {
    if (!isLiveActive) return {};
    return calculateMatchTeamScores(activePlayers, config);
  }, [isLiveActive, activePlayers, config]);

  // Merge all games (past saved matches) + live game data into ONE unified table
  const unifiedStandings = useMemo<UnifiedTeamStanding[]>(() => {
    const teamMap: Record<number, UnifiedTeamStanding> = {};

    // 1. Ingest teams from past saved matches
    teamStandings.forEach((ts) => {
      teamMap[ts.teamId] = {
        teamId: ts.teamId,
        teamName: resolveTeamDisplayName(ts.teamId, ts.teamName, config, false),
        color: getTeamColor(ts.teamId),
        roster: [...ts.roster],
        matchesPlayed: ts.matchesPlayed,
        pastWins: ts.wins,
        pastPlacementPoints: ts.totalPlacementPoints,
        pastKillPoints: ts.totalKillPoints,
        pastKills: ts.totalKills,
        pastTotalPoints: ts.totalPoints,
        matchRanks: [...ts.matchRanks],

        isLivePresent: false,
        liveAliveCount: 0,
        liveTotalMembers: 0,
        liveKills: 0,
        liveKillPoints: 0,
        liveDamage: 0,
        livePlacement: 0,
        liveRankPoints: 0,
        liveTotalPoints: 0,
        liveStatus: 'STANDBY',
        isLiveWinner: false,

        totalKills: ts.totalKills,
        totalPlacementPoints: ts.totalPlacementPoints,
        totalPoints: ts.totalPoints,
        totalWins: ts.wins,
      };
    });

    // 1b. Ingest any tournament teams from all saved matches so their identity is preserved even if a match is excluded
    savedMatches.forEach((match) => {
      if (match.teamScores) {
        Object.values(match.teamScores).forEach((ts: any) => {
          if (!teamMap[ts.teamId]) {
            teamMap[ts.teamId] = {
              teamId: ts.teamId,
              teamName: resolveTeamDisplayName(ts.teamId, ts.teamName, config, false),
              color: getTeamColor(ts.teamId),
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
              livePlacement: ts.teamId,
              liveRankPoints: 0,
              liveTotalPoints: 0,
              liveStatus: 'STANDBY',
              isLiveWinner: false,
              totalKills: 0,
              totalPlacementPoints: 0,
              totalPoints: 0,
              totalWins: 0,
            };
          }
        });
      }
    });

    // 2. Ingest or overlay active live match
    // STRICT GUARD: If this live match was already saved (e.g. paused & saved Game 1),
    // DO NOT add live points again to avoid duplicate points!
    const shouldAddLivePoints = isLiveActive && !isLiveAlreadySaved;

    if (isLiveActive) {
      (Object.values(liveScores) as TeamMatchScore[]).forEach((ls) => {
        const isAlive = ls.aliveCount > 0;
        if (!teamMap[ls.teamId]) {
          // Team not yet in saved matches (e.g. Game 1 in progress before saving)
          teamMap[ls.teamId] = {
            teamId: ls.teamId,
            teamName: resolveTeamDisplayName(ls.teamId, ls.teamName, config, true),
            color: getTeamColor(ls.teamId),
            roster: [],
            matchesPlayed: 0,
            pastWins: 0,
            pastPlacementPoints: 0,
            pastKillPoints: 0,
            pastKills: 0,
            pastTotalPoints: 0,
            matchRanks: [],

            isLivePresent: true,
            liveAliveCount: ls.aliveCount,
            liveTotalMembers: ls.totalMembers,
            liveKills: ls.totalKills,
            liveKillPoints: ls.killPoints,
            liveDamage: ls.totalDamage,
            livePlacement: ls.placement,
            liveRankPoints: ls.rankPoints,
            liveTotalPoints: ls.totalPoints,
            liveStatus: isAlive ? 'ALIVE' : 'ELIMINATED',
            isLiveWinner: ls.isWinner,

            totalKills: shouldAddLivePoints ? ls.totalKills : 0,
            totalPlacementPoints: shouldAddLivePoints ? ls.rankPoints : 0,
            totalPoints: shouldAddLivePoints ? ls.totalPoints : 0,
            totalWins: shouldAddLivePoints && ls.isWinner ? 1 : 0,
          };
        } else {
          // Team already exists in saved matches
          const item = teamMap[ls.teamId];
          item.isLivePresent = true;
          item.liveAliveCount = ls.aliveCount;
          item.liveTotalMembers = ls.totalMembers;
          item.liveKills = ls.totalKills;
          item.liveKillPoints = ls.killPoints;
          item.liveDamage = ls.totalDamage;
          item.livePlacement = ls.placement;
          item.liveRankPoints = ls.rankPoints;
          item.liveTotalPoints = ls.totalPoints;
          item.liveStatus = isAlive ? 'ALIVE' : 'ELIMINATED';
          item.isLiveWinner = ls.isWinner;

          if (shouldAddLivePoints) {
            // Live match is an in-progress NEW match, combine past + live
            item.totalKills = item.pastKills + ls.totalKills;
            item.totalPlacementPoints = item.pastPlacementPoints + ls.rankPoints;
            item.totalPoints = item.pastTotalPoints + ls.totalPoints;
            item.totalWins = item.pastWins + (ls.isWinner ? 1 : 0);
          } else {
            // Already saved into past totals! Keep official saved totals without duplication!
            item.totalKills = item.pastKills;
            item.totalPlacementPoints = item.pastPlacementPoints;
            item.totalPoints = item.pastTotalPoints;
            item.totalWins = item.pastWins;
          }
        }

        // Add live players to roster list if missing
        activePlayers
          .filter((p) => p.teamId === ls.teamId)
          .forEach((p) => {
            if (!teamMap[ls.teamId].roster.some((r) => r.uId === p.uId)) {
              teamMap[ls.teamId].roster.push({
                uId: p.uId,
                playerName: p.playerName,
                isAlive: !p.bHasDied && p.health > 0 && p.liveState !== 2,
                health: p.health !== undefined ? p.health : (p.bHasDied ? 0 : 100),
                healthMax: p.healthMax || 100,
                liveState: p.liveState ?? (p.bHasDied ? 2 : 0),
                kills: p.killNum || 0,
                damage: p.damage || 0,
              });
            }
          });
      });
    }

    // 3. Populate precise player alive status and kill numbers for all teams
    const latestMatch = savedMatches.length > 0 ? savedMatches[savedMatches.length - 1] : null;

    Object.values(teamMap).forEach((item) => {
      item.roster = item.roster.map((r) => {
        if (isLiveActive) {
          const livePlayer = activePlayers.find(
            (p) => p.uId === r.uId || (p.playerName && p.playerName.toLowerCase() === r.playerName.toLowerCase())
          );
          if (livePlayer) {
            const isAlive = !livePlayer.bHasDied && livePlayer.health > 0 && livePlayer.liveState !== 2;
            return {
              uId: r.uId,
              playerName: r.playerName,
              isAlive,
              health: livePlayer.health !== undefined ? livePlayer.health : (livePlayer.bHasDied ? 0 : 100),
              healthMax: livePlayer.healthMax || 100,
              liveState: livePlayer.liveState ?? (livePlayer.bHasDied ? 2 : 0),
              kills: livePlayer.killNum || 0,
              damage: livePlayer.damage || 0,
            };
          }
          return {
            uId: r.uId,
            playerName: r.playerName,
            isAlive: item.liveStatus === 'ALIVE',
            health: item.liveStatus === 'ALIVE' ? 100 : 0,
            healthMax: 100,
            liveState: item.liveStatus === 'ALIVE' ? 0 : 2,
            kills: 0,
          };
        }

        if (latestMatch) {
          const snap = (latestMatch.playerSnapshots || []).find(
            (p) => p.uId === r.uId || (p.playerName && p.playerName.toLowerCase() === r.playerName.toLowerCase())
          );
          const teamScore = latestMatch.teamScores[item.teamId];
          const isAlive = Boolean(teamScore?.isWinner || (snap ? !snap.bHasDied && snap.health > 0 : false));
          return {
            uId: r.uId,
            playerName: r.playerName,
            isAlive,
            health: snap?.health !== undefined ? snap.health : (isAlive ? 100 : 0),
            healthMax: snap?.healthMax || 100,
            liveState: snap?.liveState ?? (isAlive ? 0 : 2),
            kills: snap ? snap.killNum || 0 : 0,
          };
        }

        return {
          uId: r.uId,
          playerName: r.playerName,
          isAlive: item.pastWins > 0,
          health: item.pastWins > 0 ? 100 : 0,
          healthMax: 100,
          liveState: item.pastWins > 0 ? 0 : 2,
          kills: 0,
        };
      });
    });

    // Determine the ONLY latest game winner
    let latestWinnerId: number | null = null;
    const liveWinner = (Object.values(liveScores) as TeamMatchScore[]).find((ls) => ls.isWinner || ls.placement === 1);
    if (liveWinner && liveWinner.isWinner) {
      latestWinnerId = liveWinner.teamId;
    } else if (savedMatches.length > 0) {
      const latestMatch = savedMatches[savedMatches.length - 1];
      if (latestMatch && latestMatch.teamScores) {
        const scores = Object.values(latestMatch.teamScores) as TeamMatchScore[];
        const winnerScore = scores.find(
          (ts) => ts.isWinner || ts.placement === 1
        );
        if (winnerScore) {
          latestWinnerId = winnerScore.teamId;
        }
      }
    }

    Object.values(teamMap).forEach((item) => {
      item.flagValue = resolveTeamFlagValue(item.teamId, config.teamFlags, item.teamName);
      item.isLatestGameWinner = latestWinnerId !== null && item.teamId === latestWinnerId;
    });

    // 4. Sort teams using Official Competition Tie Breaker Rules:
    // Ties between two Teams during Official Competitions will be determined in the order of:
    // (a) total times of winning first placement (WWCD);
    // (b) total accumulated placement points;
    // (c) total accumulated kills;
    // and (d) placement in the most recent match of the Tournament.
    return Object.values(teamMap).sort((a, b) => {
      return compareTeamsOfficialTieBreakers(a, b, {
        savedMatches,
        isLiveCounting: shouldAddLivePoints,
      });
    });
  }, [teamStandings, isLiveActive, activePlayers, liveScores, savedMatches, config]);

  // Live match overview stats
  const liveAliveTeamsCount = useMemo(() => {
    if (!isLiveActive) return 0;
    return (Object.values(liveScores) as TeamMatchScore[]).filter((s) => s.aliveCount > 0).length;
  }, [isLiveActive, liveScores]);

  const liveAlivePlayersCount = useMemo(() => {
    if (!isLiveActive) return 0;
    return activePlayers.filter((p) => !p.bHasDied && p.health > 0).length;
  }, [isLiveActive, activePlayers]);

  // Filter only ranked tournament games that count towards standings and progress
  const rankedSavedMatches = useMemo(
    () => savedMatches.filter((m) => !m.excludeFromLeaderboard),
    [savedMatches]
  );
  const completedRankedCount = rankedSavedMatches.length;

  const currentMatchNumber = completedRankedCount + (isLiveActive ? 1 : 0);
  const currentMatchLabel = currentMatchNumber < 10 ? `0${currentMatchNumber}` : `${currentMatchNumber}`;
  const totalMatches = config.totalMatches || 5;
  const isPaused = Boolean(config.isPaused);
  const isTournamentEnded =
    isPaused ||
    Boolean(config.isTournamentConcluded) ||
    (completedRankedCount >= totalMatches && completedRankedCount > 0);
  const upcomingMatchNumber = completedRankedCount + 1;

  // The ONLY latest game winner teamId (from latest ranked game or live game)
  const latestWinnerTeamId = useMemo<number | null>(() => {
    const liveWinner = (Object.values(liveScores) as TeamMatchScore[]).find((ls) => ls.isWinner || ls.placement === 1);
    if (liveWinner && liveWinner.isWinner) {
      return liveWinner.teamId;
    }
    if (rankedSavedMatches.length > 0) {
      const latest = rankedSavedMatches[rankedSavedMatches.length - 1];
      if (latest && latest.teamScores) {
        const scores = Object.values(latest.teamScores) as TeamMatchScore[];
        const winnerScore = scores.find(
          (ts) => ts.isWinner || ts.placement === 1
        );
        if (winnerScore) {
          return winnerScore.teamId;
        }
      }
    }
    return null;
  }, [liveScores, rankedSavedMatches]);

  // Squad death tracking for dynamic elimination animation on row
  const prevSquadAliveRef = useRef<Record<number, number>>({});
  const [eliminatedEvents, setEliminatedEvents] = useState<Record<number, { timestamp: number; placement: number }>>({});

  useEffect(() => {
    if (!isLiveActive || isPaused) return;

    const scores = Object.values(liveScores) as TeamMatchScore[];
    const aliveSquadsCount = scores.filter((s) => s.aliveCount > 0).length;
    const newlyEliminated: Record<number, { timestamp: number; placement: number }> = {};
    const now = Date.now();

    const dyingSquads = scores.filter((ls) => {
      const prev = prevSquadAliveRef.current[ls.teamId];
      return prev !== undefined && prev > 0 && ls.aliveCount === 0;
    });

    if (dyingSquads.length > 0) {
      dyingSquads.forEach((ls, idx) => {
        const fallbackPlacement = aliveSquadsCount + dyingSquads.length - idx;
        const placement = ls.placement && ls.placement > 1 ? ls.placement : fallbackPlacement;
        newlyEliminated[ls.teamId] = {
          timestamp: now,
          placement,
        };
      });

      setEliminatedEvents((curr) => ({
        ...curr,
        ...newlyEliminated,
      }));
    }

    scores.forEach((ls) => {
      prevSquadAliveRef.current[ls.teamId] = ls.aliveCount;
    });
  }, [isLiveActive, isPaused, liveScores]);

  // Clean up elimination animations after 4.5 seconds
  useEffect(() => {
    if (Object.keys(eliminatedEvents).length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const nextMap: Record<number, { timestamp: number; placement: number }> = {};
      Object.entries(eliminatedEvents).forEach(([idStr, ev]) => {
        const item = ev as { timestamp: number; placement: number };
        if (item && now - item.timestamp < 4500) {
          nextMap[Number(idStr)] = item;
        } else {
          changed = true;
        }
      });
      if (changed) {
        setEliminatedEvents(nextMap);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [eliminatedEvents]);

  // Real team names fallback: when there are no ranked games, or ALL games are hidden,
  // extract team names from the first saved match (even if excluded/hidden), or live active players.
  // If no official points yet, extract all teams from saved matches or active players.
  // Never show random/fake demo names.
  const fallbackTeamsFromFirstMatch = useMemo<UnifiedTeamStanding[]>(() => {
    // 1. Extract teams across all saved matches (even if some matches are excluded from tournament rankings)
    if (savedMatches.length > 0) {
      const teamMap: Record<number, UnifiedTeamStanding> = {};

      savedMatches.forEach((match) => {
        if (match.teamScores && Object.keys(match.teamScores).length > 0) {
          const rawScores = Object.values(match.teamScores) as TeamMatchScore[];
          rawScores.forEach((ts) => {
            if (!teamMap[ts.teamId]) {
              const roster = (match.playerSnapshots || [])
                .filter((p) => p.teamId === ts.teamId)
                .map((p) => ({
                  uId: p.uId,
                  playerName: p.playerName,
                  isAlive: false,
                  health: 0,
                  healthMax: 100,
                  liveState: 2,
                  kills: 0,
                  damage: 0,
                }));

              const cleanName = resolveTeamDisplayName(ts.teamId, ts.teamName, config, false);

              teamMap[ts.teamId] = {
                teamId: ts.teamId,
                teamName: cleanName,
                color: getTeamColor(ts.teamId),
                roster,
                matchesPlayed: 0,
                pastWins: 0,
                pastPlacementPoints: 0,
                pastKillPoints: 0,
                pastKills: 0,
                pastTotalPoints: 0,
                matchRanks: [],
                isLivePresent: false,
                liveAliveCount: 0,
                liveTotalMembers: roster.length || 4,
                liveKills: 0,
                liveKillPoints: 0,
                liveDamage: 0,
                livePlacement: 0,
                liveRankPoints: 0,
                liveTotalPoints: 0,
                liveStatus: 'STANDBY',
                isLiveWinner: false,
                totalKills: 0,
                totalPlacementPoints: 0,
                totalPoints: 0,
                totalWins: 0,
              };
            }
          });
        } else if (match.playerSnapshots && match.playerSnapshots.length > 0) {
          match.playerSnapshots.forEach((p) => {
            if (!teamMap[p.teamId]) {
              const cleanName = resolveTeamDisplayName(p.teamId, p.teamName, config, false);
              teamMap[p.teamId] = {
                teamId: p.teamId,
                teamName: cleanName,
                color: getTeamColor(p.teamId),
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
                livePlacement: 0,
                liveRankPoints: 0,
                liveTotalPoints: 0,
                liveStatus: 'STANDBY',
                isLiveWinner: false,
                totalKills: 0,
                totalPlacementPoints: 0,
                totalPoints: 0,
                totalWins: 0,
              };
            }
            if (!teamMap[p.teamId].roster.some((r) => r.uId === p.uId)) {
              teamMap[p.teamId].roster.push({
                uId: p.uId,
                playerName: p.playerName,
                isAlive: false,
                health: 0,
                healthMax: 100,
                liveState: 2,
                kills: 0,
                damage: 0,
              });
            }
          });
        }
      });

      const extracted = Object.values(teamMap).sort((a, b) => a.teamId - b.teamId);
      if (extracted.length > 0) {
        return extracted;
      }
    }

    // 2. If no saved matches, check active live players
    if (activePlayers && activePlayers.length > 0) {
      const map: Record<number, { teamId: number; teamName: string; roster: any[] }> = {};
      activePlayers.forEach((p) => {
        if (!map[p.teamId]) {
          const displayName = resolveTeamDisplayName(p.teamId, p.teamName, config, true);
          map[p.teamId] = {
            teamId: p.teamId,
            teamName: displayName,
            roster: [],
          };
        }
        map[p.teamId].roster.push({
          uId: p.uId,
          playerName: p.playerName,
          isAlive: !p.bHasDied && p.health > 0,
          health: p.health || 0,
          healthMax: p.healthMax || 100,
          liveState: p.liveState || 0,
          kills: p.killNum || 0,
          damage: p.damage || 0,
        });
      });

      const teams = Object.values(map)
        .sort((a, b) => a.teamId - b.teamId)
        .map((tm) => ({
          teamId: tm.teamId,
          teamName: tm.teamName,
          color: getTeamColor(tm.teamId),
          roster: tm.roster,
          matchesPlayed: 0,
          pastWins: 0,
          pastPlacementPoints: 0,
          pastKillPoints: 0,
          pastKills: 0,
          pastTotalPoints: 0,
          matchRanks: [],
          isLivePresent: true,
          liveAliveCount: tm.roster.filter((r) => r.isAlive).length,
          liveTotalMembers: tm.roster.length,
          liveKills: 0,
          liveKillPoints: 0,
          liveDamage: 0,
          livePlacement: 0,
          liveRankPoints: 0,
          liveTotalPoints: 0,
          liveStatus: tm.roster.some((r) => r.isAlive) ? ('ALIVE' as const) : ('STANDBY' as const),
          isLiveWinner: false,
          totalKills: 0,
          totalPlacementPoints: 0,
          totalPoints: 0,
          totalWins: 0,
        }));

      if (teams.length > 0) return teams;
    }

    // 3. Fallback: clean generic teams (Team 1 ... Team 18), NO RANDOM NAMES
    const defaultTeams: UnifiedTeamStanding[] = [];
    for (let i = 1; i <= 18; i++) {
      const displayName = resolveTeamDisplayName(i, undefined, config, false);
      defaultTeams.push({
        teamId: i,
        teamName: displayName,
        color: getTeamColor(i),
        roster: [1, 2, 3, 4].map((pIdx) => ({
          uId: i * 10 + pIdx,
          playerName: `Player ${pIdx}`,
          isAlive: false,
          health: 0,
          healthMax: 100,
          liveState: 2,
          kills: 0,
          damage: 0,
        })),
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
        livePlacement: 0,
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
  }, [savedMatches, activePlayers, config.customTeamNames]);

  // Fallback to real teams from the first match (even if hidden/excluded) if no tournament games are active
  const effectiveStandings: UnifiedTeamStanding[] = useMemo(() => {
    if (unifiedStandings.length > 0) return unifiedStandings;
    return fallbackTeamsFromFirstMatch;
  }, [unifiedStandings, fallbackTeamsFromFirstMatch]);

  // Display all tournament teams directly on the leaderboard
  const displayedTeams = useMemo(() => {
    return effectiveStandings.map((team, idx) => ({ team, rank: idx + 1 }));
  }, [effectiveStandings]);

  // Support Test Elim Wipe trigger from Admin Panel across all leaderboard overlays
  useEffect(() => {
    const handleTriggerElim = (detail: any) => {
      const placement = detail?.placement || 9;
      const targetTeam =
        (detail?.teamId ? effectiveStandings.find((t) => t.teamId === detail.teamId) : null) ||
        effectiveStandings[placement - 1] ||
        effectiveStandings[0];
      if (targetTeam) {
        setEliminatedEvents((prev) => ({
          ...prev,
          [targetTeam.teamId]: {
            timestamp: Date.now(),
            placement,
          },
        }));
      }
    };

    // 1. Subscribe via universal storage & OBS test trigger
    const unsubscribeTest = subscribeToObsTestTrigger('narrow', (payload) => {
      handleTriggerElim({ teamId: payload.teamId || 1, placement: 9 });
    });
    const unsubscribeOverlay = subscribeToObsTestTrigger('overlay', (payload) => {
      handleTriggerElim({ teamId: payload.teamId || 1, placement: 9 });
    });

    // 2. Intra-window custom event
    const handleCustomTrigger = (e: any) => {
      handleTriggerElim(e.detail);
    };
    window.addEventListener('TRIGGER_ELIMINATION_ANIMATION' as any, handleCustomTrigger);

    // 3. Storage event for pubg_test_elim_trigger
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pubg_test_elim_trigger' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data && Date.now() - data.timestamp < 4500) {
            handleTriggerElim(data);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. Broadcast channel
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('pubg_elim_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'ELIMINATION_TRIGGER') {
            handleTriggerElim(event.data);
          }
        };
      } catch {}
    }

    return () => {
      unsubscribeTest();
      unsubscribeOverlay();
      window.removeEventListener('TRIGGER_ELIMINATION_ANIMATION' as any, handleCustomTrigger);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, [effectiveStandings]);

  // =========================================================================
  // OBS DEDICATED OVERLAYS (Standalone OBS Browser Source)
  // =========================================================================
  if (isStandaloneObs) {
    if (isTop4Mode) {
      return (
        <Top4LiveTeamsOverlay
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          teamStandings={teamStandings}
          playerStandings={playerStandings}
          onManualRefresh={onManualRefresh}
          isStandaloneObs={isStandaloneObs}
          onUpdateConfig={onUpdateConfig}
        />
      );
    }

    if (isMainLeaderboardMode) {
      return (
        <MainLeaderboard
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          unifiedStandings={effectiveStandings}
          onManualRefresh={onManualRefresh}
          isStandaloneObs={isStandaloneObs}
          onUpdateConfig={onUpdateConfig}
        />
      );
    }

    if (isStageMode) {
      return (
        <BetweenGamesLeaderboard
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          unifiedStandings={effectiveStandings}
          onManualRefresh={onManualRefresh}
          isStandaloneObs={isStandaloneObs}
          onUpdateConfig={onUpdateConfig}
        />
      );
    }

    if (isTeamStatsMode) {
      return (
        <TeamStatsOverlay
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          teamStandings={teamStandings}
          onManualRefresh={onManualRefresh}
          isStandaloneObs={isStandaloneObs}
          onClose={() => {
            if (onUpdateConfig) {
              onUpdateConfig({ ...config, showTeamStatsOverlay: false });
            }
          }}
        />
      );
    }

    if (isElimAlertMode) {
      return (
        <TeamEliminatedAlertOverlay
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          teamStandings={teamStandings}
          playerStandings={playerStandings}
          onManualRefresh={onManualRefresh}
          isStandaloneObs={isStandaloneObs}
          onUpdateConfig={onUpdateConfig}
        />
      );
    }

    if (isMvpMode) {
      return (
        <MatchMvpOverlay
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          teamStandings={teamStandings}
          playerStandings={playerStandings}
          onManualRefresh={onManualRefresh}
          isStandaloneObs={isStandaloneObs}
          onUpdateConfig={onUpdateConfig}
        />
      );
    }

    // Default standalone OBS mode is the exact in-game side leaderboard
    return (
      <NarrowSideLeaderboard
        config={config}
        savedMatches={savedMatches}
        activePlayers={activePlayers}
        unifiedStandings={effectiveStandings}
        onManualRefresh={onManualRefresh}
        isStandaloneObs={isStandaloneObs}
        onUpdateConfig={onUpdateConfig}
      />
    );
  }

  // =========================================================================
  // BROWSER PREVIEW MODE (When operator/streamer visits the site)
  // Shows full switcher and renders each design cleanly!
  // =========================================================================
  return (
    <div className="w-full min-h-screen bg-[#070b14] text-[#f8fafc] flex flex-col font-outfit select-none overflow-x-hidden no-scrollbar">
      {/* Design Switcher Bar */}
      <div className="sticky top-0 z-40 bg-[#0a0f1d]/95 border-b border-[#1b2b46] px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs backdrop-blur-md shadow-md">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[#64748b] font-heading font-black text-xs uppercase tracking-wider mr-1">
            VIEW DESIGN:
          </span>
          <button
            onClick={() => setActiveLayoutTab('side')}
            className={`px-3 py-1.5 rounded-lg font-heading font-black text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              activeLayoutTab === 'side'
                ? 'bg-[#10b981] text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-[#131d2e] text-[#94a3b8] hover:bg-[#1a283e] hover:text-white border border-[#1e293b]'
            }`}
          >
            🎮 IN-GAME SIDE LEADERBOARD
          </button>
          <button
            onClick={() => setActiveLayoutTab('main')}
            className={`px-3 py-1.5 rounded-lg font-heading font-black text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              activeLayoutTab === 'main'
                ? 'bg-[#38bdf8] text-black shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                : 'bg-[#131d2e] text-[#94a3b8] hover:bg-[#1a283e] hover:text-white border border-[#1e293b]'
            }`}
          >
            📊 MAIN LEADERBOARD
          </button>
          <button
            onClick={() => setActiveLayoutTab('stage')}
            className={`px-3 py-1.5 rounded-lg font-heading font-black text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              activeLayoutTab === 'stage'
                ? 'bg-[#ffb800] text-black shadow-[0_0_12px_rgba(255,184,0,0.4)]'
                : 'bg-[#131d2e] text-[#94a3b8] hover:bg-[#1a283e] hover:text-white border border-[#1e293b]'
            }`}
          >
            🏆 BETWEEN-GAMES STAGE
          </button>
          <button
            onClick={() => setActiveLayoutTab('top4')}
            className={`px-3 py-1.5 rounded-lg font-heading font-black text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              activeLayoutTab === 'top4'
                ? 'bg-[#00ff66] text-black shadow-[0_0_12px_rgba(0,255,102,0.4)]'
                : 'bg-[#131d2e] text-[#94a3b8] hover:bg-[#1a283e] hover:text-white border border-[#1e293b]'
            }`}
          >
            ⚡ TOP 4 HUD
          </button>
          <button
            onClick={() => setActiveLayoutTab('teamstats')}
            className={`px-3 py-1.5 rounded-lg font-heading font-black text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              activeLayoutTab === 'teamstats'
                ? 'bg-[#a855f7] text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                : 'bg-[#131d2e] text-[#94a3b8] hover:bg-[#1a283e] hover:text-white border border-[#1e293b]'
            }`}
          >
            📈 TEAM STATS
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono text-[11px] hidden lg:inline">
            OBS Source: <code className="text-[#38bdf8]">/?view=obs&layout={activeLayoutTab === 'side' ? 'overlay' : activeLayoutTab}</code>
          </span>
        </div>
      </div>

      {/* Selected Leaderboard Component */}
      <div className="flex-1 w-full">
        {activeLayoutTab === 'side' && (
          <NarrowSideLeaderboard
            config={config}
            savedMatches={savedMatches}
            activePlayers={activePlayers}
            unifiedStandings={effectiveStandings}
            onManualRefresh={onManualRefresh}
            isStandaloneObs={false}
            onUpdateConfig={onUpdateConfig}
          />
        )}
        {activeLayoutTab === 'main' && (
          <MainLeaderboard
            config={config}
            savedMatches={savedMatches}
            activePlayers={activePlayers}
            unifiedStandings={effectiveStandings}
            onManualRefresh={onManualRefresh}
            isStandaloneObs={false}
            onUpdateConfig={onUpdateConfig}
          />
        )}
        {activeLayoutTab === 'stage' && (
          <BetweenGamesLeaderboard
            config={config}
            savedMatches={savedMatches}
            activePlayers={activePlayers}
            unifiedStandings={effectiveStandings}
            onManualRefresh={onManualRefresh}
            isStandaloneObs={false}
            onUpdateConfig={onUpdateConfig}
          />
        )}
        {activeLayoutTab === 'top4' && (
          <div className="p-4 flex flex-col items-center justify-start min-h-[600px]">
            <Top4LiveTeamsOverlay
              config={config}
              savedMatches={savedMatches}
              activePlayers={activePlayers}
              teamStandings={teamStandings}
              playerStandings={playerStandings}
              onManualRefresh={onManualRefresh}
              isStandaloneObs={false}
              onUpdateConfig={onUpdateConfig}
            />
          </div>
        )}
        {activeLayoutTab === 'teamstats' && (
          <div className="p-4 flex flex-col items-center justify-start min-h-[600px]">
            <TeamStatsOverlay
              config={config}
              savedMatches={savedMatches}
              activePlayers={activePlayers}
              teamStandings={teamStandings}
              onManualRefresh={onManualRefresh}
              isStandaloneObs={false}
              onClose={() => setActiveLayoutTab('side')}
            />
          </div>
        )}
      </div>

      {/* Floating Team Stats Overlay (when enabled from Admin Panel, docks at left-mid corner) */}
      {config.showTeamStatsOverlay && (
        <TeamStatsOverlay
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          teamStandings={teamStandings}
          onManualRefresh={onManualRefresh}
          isStandaloneObs={isStandaloneObs}
          onClose={() => {
            if (onUpdateConfig) {
              onUpdateConfig({ ...config, showTeamStatsOverlay: false });
            }
          }}
        />
      )}

      {/* 7-Second Slide-in Winner Celebration Popup */}
      <WinnerCelebration config={config} />
    </div>
  );
};
