import {
  CumulativePlayerStats,
  CumulativeTeamStats,
  PlayerRawInfo,
  SavedMatch,
  TeamMatchScore,
  TournamentConfig,
} from '../types/pubg';

export const DEFAULT_RANK_POINTS: Record<number, number> = {
  1: 10,
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
  9: 0,
  10: 0,
  11: 0,
  12: 0,
  13: 0,
  14: 0,
  15: 0,
  16: 0,
  17: 0,
  18: 0,
};

export const SCORING_PRESETS: Record<
  string,
  { name: string; killPoints: number; rankPoints: Record<number, number> }
> = {
  super: {
    name: 'SUPER (Standard Official)',
    killPoints: 1,
    rankPoints: { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0 },
  },
  pmgc: {
    name: 'PMGC / PMPL Official',
    killPoints: 1,
    rankPoints: { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0 },
  },
  pel: {
    name: 'PEL (Peacekeeper Elite)',
    killPoints: 1,
    rankPoints: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 4, 7: 2, 8: 1, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0 },
  },
  classic: {
    name: 'Classic Esports (Old)',
    killPoints: 1,
    rankPoints: { 1: 20, 2: 14, 3: 10, 4: 8, 5: 7, 6: 6, 7: 5, 8: 4, 9: 3, 10: 2, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1 },
  },
};

export const DEFAULT_TIE_BREAKER_RULES: ('wwcd' | 'placement_points' | 'kills' | 'damage' | 'recent_match' | 'highest_single_match')[] = [
  'wwcd',
  'placement_points',
  'kills',
  'damage',
  'recent_match',
  'highest_single_match',
];

export const DEFAULT_CONFIG: TournamentConfig = {
  name: 'VIRTUOCITY BATTLEGROUND QATAR 2026',
  logoUrl: '/virtuocity-logo.svg',
  hideBetweenGamesLogo: true, // Default: hide the main logo on the between games stage leaderboard
  stageSlideIntervalSeconds: 20, // Default 20 seconds auto-slide
  mode: 'squad',
  apiUrl: 'https://main.yousery.tech/gettotalplayerlist',
  pollInterval: 1500, // 1.5s live polling
  streamRefreshInterval: 3, // 3 seconds
  killPointsPerKill: 1,
  rankPointsTable: DEFAULT_RANK_POINTS,
  autoSaveOnMatchEnd: false, // Default to false: always prompt admin before saving
  obsTheme: 'vibrant',
  enableCorsProxyHelp: true,
  totalMatches: 5,
  isTournamentConcluded: false,
  isPaused: false,
  animatePlacementChanges: true,
  autoBackupIntervalMinutes: 10,
  enableAutoBackup: true,
  exportReminderHours: 2,
  enableSingleAdminLock: true, // Default to single device admin lock to prevent collisions & confusion
  showTeamFlags: true, // Default to true: displays country flags on Top 4 HUD and winner celebration
  teamFlags: {},
};

// Vibrant, esports-grade distinct team color palette
export const TEAM_COLORS: { [key: number]: { bg: string; border: string; text: string; accent: string; gradient: string } } = {
  1: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400', accent: '#f59e0b', gradient: 'from-amber-600 to-amber-400' },
  2: { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-400', accent: '#06b6d4', gradient: 'from-cyan-600 to-cyan-400' },
  3: { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500', text: 'text-fuchsia-400', accent: '#d946ef', gradient: 'from-fuchsia-600 to-fuchsia-400' },
  4: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400', accent: '#10b981', gradient: 'from-emerald-600 to-emerald-400' },
  5: { bg: 'bg-[#f1223e]/20', border: 'border-[#f1223e]', text: 'text-[#f1223e]', accent: '#f1223e', gradient: 'from-[#f1223e] to-[#f44760]' },
  6: { bg: 'bg-[#1a83c5]/20', border: 'border-[#1a83c5]', text: 'text-[#1a83c5]', accent: '#1a83c5', gradient: 'from-[#1a83c5] to-[#2b9ee7]' },
  7: { bg: 'bg-lime-500/20', border: 'border-lime-500', text: 'text-lime-400', accent: '#84cc16', gradient: 'from-lime-600 to-lime-400' },
  8: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400', accent: '#a855f7', gradient: 'from-purple-600 to-purple-400' },
  9: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', accent: '#f97316', gradient: 'from-orange-600 to-orange-400' },
  10: { bg: 'bg-teal-500/20', border: 'border-teal-500', text: 'text-teal-400', accent: '#14b8a6', gradient: 'from-teal-600 to-teal-400' },
  11: { bg: 'bg-[#f1223e]/20', border: 'border-[#f1223e]', text: 'text-[#f1223e]', accent: '#f1223e', gradient: 'from-[#f1223e] to-[#d61430]' },
  12: { bg: 'bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-400', accent: '#6366f1', gradient: 'from-indigo-600 to-indigo-400' },
  13: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400', accent: '#eab308', gradient: 'from-yellow-600 to-yellow-400' },
  14: { bg: 'bg-[#1a83c5]/20', border: 'border-[#1a83c5]', text: 'text-[#1a83c5]', accent: '#1a83c5', gradient: 'from-[#1a83c5] to-[#156da6]' },
  15: { bg: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-400', accent: '#ec4899', gradient: 'from-pink-600 to-pink-400' },
  16: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400', accent: '#22c55e', gradient: 'from-green-600 to-green-400' },
  17: { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-400', accent: '#8b5cf6', gradient: 'from-violet-600 to-violet-400' },
  18: { bg: 'bg-rose-500/20', border: 'border-rose-500', text: 'text-rose-400', accent: '#f43f5e', gradient: 'from-rose-600 to-rose-400' },
};

export function getTeamColor(teamId: number) {
  const index = ((Math.abs(teamId) - 1) % 18) + 1;
  return TEAM_COLORS[index] || TEAM_COLORS[1];
}

/**
 * Calculates Team Scores from a player list snapshot.
 * Resolves placement ranks (using API's rank or calculating based on survival status).
 *
 * @param players The snapshot of players from spectator tool
 * @param config Tournament scoring configuration
 * @param forceFinalizeMatch If true, forces finalization of placement ranks and placement points (e.g. when saving a match)
 */
export function calculateMatchTeamScores(
  players: PlayerRawInfo[],
  config: TournamentConfig,
  forceFinalizeMatch = false
): Record<number, TeamMatchScore> {
  const teamMap: Record<number, {
    teamId: number;
    teamName: string;
    players: PlayerRawInfo[];
    totalKills: number;
    totalDamage: number;
    aliveCount: number;
    apiRanks: number[];
    maxSurvivalTime: number;
  }> = {};

  // Group by teamId
  players.forEach((p) => {
    if (!teamMap[p.teamId]) {
      teamMap[p.teamId] = {
        teamId: p.teamId,
        teamName: p.teamName || `Team ${p.teamId}`,
        players: [],
        totalKills: 0,
        totalDamage: 0,
        aliveCount: 0,
        apiRanks: [],
        maxSurvivalTime: 0,
      };
    }
    const t = teamMap[p.teamId];
    t.players.push(p);
    t.totalKills += p.killNum || 0;
    t.totalDamage += p.damage || 0;
    const isAlive = !p.bHasDied && p.health > 0;
    if (isAlive) {
      t.aliveCount += 1;
    }
    if (p.rank && p.rank > 0) {
      t.apiRanks.push(p.rank);
    }
    const sTime = p.survivalTime || 0;
    if (sTime > t.maxSurvivalTime) {
      t.maxSurvivalTime = sTime;
    }
  });

  const teamList = Object.values(teamMap);
  const totalTeams = teamList.length;
  if (totalTeams === 0) return {};

  const aliveTeams = teamList.filter((t) => t.aliveCount > 0);
  const eliminatedTeams = teamList.filter((t) => t.aliveCount === 0);

  // Is the game still actively in progress with multiple competing teams?
  // When multiple teams are alive, the game is still on — neither team has won 1st place yet!
  const isMatchLiveAndActive = !forceFinalizeMatch && totalTeams > 1 && aliveTeams.length > 1;

  // Has the match concluded with a definitive sole surviving team?
  // When only 1 team remains alive (and >1 team played), that sole surviving team is the WINNER (Chicken Dinner)!
  const singleSurvivingTeam = (totalTeams > 1 && aliveTeams.length === 1) ? aliveTeams[0] : null;

  // Or if all teams are dead in post-match snapshot, check if API reported rank 1
  const explicitApiWinner = teamList.find((t) => t.apiRanks.includes(1));

  let matchWinnerTeamId: number | null = null;
  if (singleSurvivingTeam) {
    matchWinnerTeamId = singleSurvivingTeam.teamId;
  } else if (explicitApiWinner) {
    matchWinnerTeamId = explicitApiWinner.teamId;
  } else if (!isMatchLiveAndActive && (aliveTeams.length === 0 || forceFinalizeMatch) && totalTeams > 0) {
    // If all dead (or forced finalize) and no explicit API rank 1:
    // The team that survived longest (highest survivalTime) or had most kills won the match!
    const longestSurvivor = [...teamList].sort((a, b) => {
      // First, teams that were alive rank above eliminated teams
      if (b.aliveCount !== a.aliveCount) return b.aliveCount - a.aliveCount;
      // Then survival time
      if (b.maxSurvivalTime !== a.maxSurvivalTime) return b.maxSurvivalTime - a.maxSurvivalTime;
      // Then kills
      if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
      return b.totalDamage - a.totalDamage;
    })[0];
    if (longestSurvivor) {
      matchWinnerTeamId = longestSurvivor.teamId;
    }
  }

  // Calculate placements for each team
  const placements: Record<number, number> = {};

  if (isMatchLiveAndActive) {
    // === SCENARIO 1: MATCH IN PROGRESS (2+ teams still alive) ===
    // Neither team has won yet!
    // Alive teams are sorted by current kills descending, then damage
    const sortedAlive = [...aliveTeams].sort((a, b) => {
      if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
      return b.totalDamage - a.totalDamage;
    });

    // Eliminated teams are sorted by their elimination order / API rank with strict tie-breaking
    const sortedEliminated = [...eliminatedTeams].sort((a, b) => {
      const minApiA = a.apiRanks.length ? Math.min(...a.apiRanks) : 999;
      const minApiB = b.apiRanks.length ? Math.min(...b.apiRanks) : 999;
      if (minApiA !== 999 && minApiB !== 999 && minApiA !== minApiB) {
        return minApiA - minApiB;
      }
      if (minApiA !== 999 && minApiB === 999) return -1;
      if (minApiB !== 999 && minApiA === 999) return 1;

      // When multiple teams are eliminated at the same time:
      // 1. Survived longer (maxSurvivalTime)
      if (b.maxSurvivalTime !== a.maxSurvivalTime) return b.maxSurvivalTime - a.maxSurvivalTime;
      // 2. More match kills
      if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
      // 3. More match damage
      if (b.totalDamage !== a.totalDamage) return b.totalDamage - a.totalDamage;
      // 4. Stable team ID
      return a.teamId - b.teamId;
    });

    // Alive teams occupy ranks 1 .. aliveTeams.length (provisional)
    sortedAlive.forEach((t, i) => {
      placements[t.teamId] = i + 1;
    });
    // Eliminated teams occupy strictly unique sequential ranks after all alive teams
    // Prevents multiple teams from colliding on the same rank (e.g. rank 2)
    sortedEliminated.forEach((t, i) => {
      placements[t.teamId] = sortedAlive.length + i + 1;
    });
  } else {
    // === SCENARIO 2: MATCH CONCLUDED (1 winning team, or forced finalization) ===
    if (matchWinnerTeamId != null) {
      placements[matchWinnerTeamId] = 1;
    }

    // Sort all remaining teams for ranks 2 .. totalTeams with strict tie-breaking
    const remainingTeams = teamList.filter((t) => t.teamId !== matchWinnerTeamId);

    remainingTeams.sort((a, b) => {
      const minApiA = a.apiRanks.length ? Math.min(...a.apiRanks) : 999;
      const minApiB = b.apiRanks.length ? Math.min(...b.apiRanks) : 999;
      // If API provided positive ranks > 1 and they are NOT identical
      if (minApiA > 1 && minApiB > 1 && minApiA !== minApiB) {
        return minApiA - minApiB;
      }
      if (minApiA > 1 && minApiB === 999) return -1;
      if (minApiB > 1 && minApiA === 999) return 1;

      // Alive status (if one team was still alive)
      if (b.aliveCount !== a.aliveCount) return b.aliveCount - a.aliveCount;

      // Survival time (died later = better finish rank)
      if (b.maxSurvivalTime !== a.maxSurvivalTime) return b.maxSurvivalTime - a.maxSurvivalTime;

      // Kills & Damage tie-breakers when multiple teams are eliminated at the same time
      if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
      if (b.totalDamage !== a.totalDamage) return b.totalDamage - a.totalDamage;
      return a.teamId - b.teamId;
    });

    // Assign strictly unique, sequential ranks 2, 3, 4, 5...
    // Guarantees that when multiple teams die at the exact same moment,
    // they never both get made rank 2! One gets rank 2, the other gets rank 3, etc.
    remainingTeams.forEach((t, i) => {
      placements[t.teamId] = i + 2;
    });
  }

  const result: Record<number, TeamMatchScore> = {};

  teamList.forEach((team) => {
    const placement = placements[team.teamId] || totalTeams;
    // Crucial: Only the true winner of a concluded match has isWinner = true!
    // When 2+ teams are alive during live game, isWinner is FALSE for ALL teams!
    const isWinner = !isMatchLiveAndActive && matchWinnerTeamId === team.teamId;

    // Rank / Placement points:
    // In live active games (2+ teams alive), alive teams receive 0 placement points until
    // the game concludes to prevent premature awarding of 1st place points.
    // Eliminated teams get their locked placement points.
    // Once the match concludes, the winning team receives 1st place points (default 10) + kills!
    let rankPoints = 0;
    if (isMatchLiveAndActive) {
      if (team.aliveCount === 0) {
        rankPoints = config.rankPointsTable[placement] ?? 0;
      } else {
        rankPoints = 0;
      }
    } else {
      rankPoints = config.rankPointsTable[placement] ?? 0;
    }

    const killPoints = team.totalKills * config.killPointsPerKill;
    const totalPoints = rankPoints + killPoints;

    result[team.teamId] = {
      teamId: team.teamId,
      teamName: team.teamName,
      placement,
      rankPoints,
      killPoints,
      totalPoints,
      totalKills: team.totalKills,
      totalDamage: Math.round(team.totalDamage),
      isWinner,
      aliveCount: team.aliveCount,
      totalMembers: team.players.length,
    };
  });

  return result;
}

/**
 * Calculates cumulative statistics across all saved matches in the tournament.
 */
export function calculateTournamentStandings(
  matches: SavedMatch[],
  config: TournamentConfig
): {
  teamStandings: CumulativeTeamStats[];
  playerStandings: CumulativePlayerStats[];
} {
  const teamMap: Record<number, CumulativeTeamStats> = {};
  const playerMap: Record<number, CumulativePlayerStats> = {};

  matches.forEach((match) => {
    // If marked as special/exhibition game excluded from tournament standings, skip from cumulative leaderboard
    if (match.excludeFromLeaderboard) {
      return;
    }

    // Process players
    match.playerSnapshots.forEach((p) => {
      if (!playerMap[p.uId]) {
        playerMap[p.uId] = {
          uId: p.uId,
          playerName: p.playerName || `Player_${p.uId}`,
          teamId: p.teamId,
          teamName: p.teamName || `Team ${p.teamId}`,
          totalKills: 0,
          totalDamage: 0,
          totalKnockouts: 0,
          totalAssists: 0,
          totalHeadshots: 0,
          matchesPlayed: 0,
          avgKills: 0,
          avgDamage: 0,
        };
      }

      const pStat = playerMap[p.uId];
      pStat.totalKills += p.killNum || 0;
      pStat.totalDamage += p.damage || 0;
      pStat.totalKnockouts += p.knockouts || 0;
      pStat.totalAssists += p.assists || 0;
      pStat.totalHeadshots += p.headShotNum || 0;
      pStat.matchesPlayed += 1;
      pStat.teamName = p.teamName || pStat.teamName;
      pStat.teamId = p.teamId || pStat.teamId;
    });

    // De-duplicate team scores by teamId to prevent duplicate scores and duplicate WWCD counts
    const rawScores = Object.values(match.teamScores || {});
    const uniqueTeamScores: Record<number, TeamMatchScore> = {};
    rawScores.forEach((ts: any) => {
      if (!ts) return;
      const tid = Number(ts.teamId);
      if (isNaN(tid)) return;
      if (!uniqueTeamScores[tid] || (ts.totalPoints || 0) > (uniqueTeamScores[tid].totalPoints || 0)) {
        uniqueTeamScores[tid] = ts;
      }
    });

    const matchScores = Object.values(uniqueTeamScores);
    if (matchScores.length === 0) return;

    // Identify the SINGLE legitimate winner of this match (maximum 1 WWCD awarded per match)
    let winningTeamId: number | null = null;
    const winnerCandidate =
      matchScores.find((ts) => ts.isWinner && ts.placement === 1) ||
      matchScores.find((ts) => ts.isWinner) ||
      matchScores.find((ts) => ts.placement === 1);

    if (winnerCandidate) {
      winningTeamId = Number(winnerCandidate.teamId);
    } else {
      // Fallback: Concluded match with highest score/placement
      const sortedByPlacement = [...matchScores].sort((a, b) => {
        const pA = a.placement && a.placement > 0 ? a.placement : 999;
        const pB = b.placement && b.placement > 0 ? b.placement : 999;
        if (pA !== pB) return pA - pB;
        return (b.totalPoints || 0) - (a.totalPoints || 0);
      });
      if (sortedByPlacement.length > 0 && sortedByPlacement[0].placement === 1) {
        winningTeamId = Number(sortedByPlacement[0].teamId);
      }
    }

    // Process teams with guaranteed single iteration per team
    matchScores.forEach((ts) => {
      const tid = Number(ts.teamId);
      if (!teamMap[tid]) {
        teamMap[tid] = {
          teamId: tid,
          teamName: ts.teamName,
          roster: [],
          totalPlacementPoints: 0,
          totalKillPoints: 0,
          totalPoints: 0,
          totalKills: 0,
          totalDamage: 0,
          wins: 0,
          wwcd: 0,
          matchesPlayed: 0,
          matchRanks: [],
        };
      }

      const tStat = teamMap[tid];
      tStat.totalPlacementPoints += ts.rankPoints || 0;
      tStat.totalKillPoints += ts.killPoints || 0;
      tStat.totalPenaltyPoints = (tStat.totalPenaltyPoints || 0) + (ts.penaltyPoints || 0);
      tStat.totalPoints += ts.totalPoints || 0;
      tStat.totalKills += ts.totalKills || 0;
      tStat.totalDamage += ts.totalDamage || 0;
      if (winningTeamId !== null && tid === winningTeamId) {
        tStat.wins += 1;
      }
      tStat.wwcd = tStat.wins;
      tStat.matchesPlayed += 1;
      tStat.matchRanks.push({
        matchNumber: match.matchNumber,
        rank: ts.placement,
        points: ts.totalPoints,
      });

      // Update roster
      (match.playerSnapshots || [])
        .filter((p) => Number(p.teamId) === tid)
        .forEach((p) => {
          if (!tStat.roster.some((r) => r.uId === p.uId)) {
            tStat.roster.push({ uId: p.uId, playerName: p.playerName });
          }
        });
    });
  });

  // Calculate averages for players
  Object.values(playerMap).forEach((p) => {
    p.avgKills = p.matchesPlayed > 0 ? Number((p.totalKills / p.matchesPlayed).toFixed(2)) : 0;
    p.avgDamage = p.matchesPlayed > 0 ? Math.round(p.totalDamage / p.matchesPlayed) : 0;
  });

  // Sort teams using Official Competition Tie Breaker Rules:
  // Ties between two Teams during Official Competitions will be determined in the order of:
  // (a) total times of winning the first placement across all Tournament Games in the applicable product (WWCD);
  // (b) total accumulated placement points across all Tournament Games in the applicable product;
  // (c) total accumulated kills across all Tournament Games in the applicable product;
  // and (d) placement in the most recent match of the Tournament.
  const includedMatches = matches.filter((m) => !m.excludeFromLeaderboard);
  const teamStandings = Object.values(teamMap).sort((a, b) => {
    return compareTeamsOfficialTieBreakers(a, b, { savedMatches: includedMatches, config });
  });

  // Sort players: totalKills descending, totalDamage descending, assists descending
  const playerStandings = Object.values(playerMap).sort((a, b) => {
    if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
    if (b.totalDamage !== a.totalDamage) return b.totalDamage - a.totalDamage;
    return b.totalAssists - a.totalAssists;
  });

  return { teamStandings, playerStandings };
}

export interface TieBreakerTeamCandidate {
  teamId: number;
  totalPoints: number;
  totalPlacementPoints?: number;
  totalKills?: number;
  totalDamage?: number;
  wins?: number;
  wwcd?: number;
  totalWins?: number;
  matchRanks?: { matchNumber: number; rank: number; points?: number }[];
  livePlacement?: number;
  isLivePresent?: boolean;
}

export interface TieBreakerContext {
  savedMatches?: SavedMatch[];
  isLiveCounting?: boolean;
  config?: TournamentConfig;
  rules?: ('wwcd' | 'placement_points' | 'kills' | 'damage' | 'recent_match' | 'highest_single_match' | string)[];
}

/**
 * Official & Custom Competition Tie Breaker Rules:
 * Ties between two Teams will be determined according to the configured tieBreakerRules sequence
 * (defaults to: (a) WWCD wins, (b) Placement Points, (c) Kills, (d) Damage, (e) Recent match placement, (f) Highest single match).
 */
export function compareTeamsOfficialTieBreakers<T extends TieBreakerTeamCandidate>(
  a: T,
  b: T,
  context?: TieBreakerContext
): number {
  // 1. Primary: Total Points (descending: higher total points ranks higher)
  const ptsA = a.totalPoints ?? 0;
  const ptsB = b.totalPoints ?? 0;
  if (ptsB !== ptsA) {
    return ptsB - ptsA;
  }

  // TIE ENCOUNTERED -> Evaluate configured tie breaker rules
  const activeRules =
    context?.rules ||
    context?.config?.tieBreakerRules ||
    DEFAULT_TIE_BREAKER_RULES;

  for (const rule of activeRules) {
    if (rule === 'wwcd') {
      const winsA = a.totalWins ?? a.wins ?? a.wwcd ?? 0;
      const winsB = b.totalWins ?? b.wins ?? b.wwcd ?? 0;
      if (winsB !== winsA) return winsB - winsA;
    } else if (rule === 'placement_points') {
      const placePtsA = a.totalPlacementPoints ?? 0;
      const placePtsB = b.totalPlacementPoints ?? 0;
      if (placePtsB !== placePtsA) return placePtsB - placePtsA;
    } else if (rule === 'kills') {
      const killsA = a.totalKills ?? 0;
      const killsB = b.totalKills ?? 0;
      if (killsB !== killsA) return killsB - killsA;
    } else if (rule === 'damage') {
      const dmgA = a.totalDamage ?? 0;
      const dmgB = b.totalDamage ?? 0;
      if (dmgB !== dmgA) return dmgB - dmgA;
    } else if (rule === 'highest_single_match') {
      // Find highest points achieved in any single match
      const maxPtsA = Math.max(0, ...(a.matchRanks?.map((m) => m.points ?? 0) || [0]));
      const maxPtsB = Math.max(0, ...(b.matchRanks?.map((m) => m.points ?? 0) || [0]));
      if (maxPtsB !== maxPtsA) return maxPtsB - maxPtsA;
    } else if (rule === 'recent_match') {
      // (d) placement in the most recent match of the Tournament
      if (context?.isLiveCounting) {
        const livePlaceA = a.livePlacement && a.livePlacement > 0 ? a.livePlacement : 999;
        const livePlaceB = b.livePlacement && b.livePlacement > 0 ? b.livePlacement : 999;
        if (livePlaceA !== livePlaceB) {
          return livePlaceA - livePlaceB;
        }
      }

      // Gather all match numbers to check placements from most recent match backwards
      const matchNumbersSet = new Set<number>();
      if (a.matchRanks) {
        a.matchRanks.forEach((mr) => matchNumbersSet.add(mr.matchNumber));
      }
      if (b.matchRanks) {
        b.matchRanks.forEach((mr) => matchNumbersSet.add(mr.matchNumber));
      }
      if (context?.savedMatches) {
        context.savedMatches
          .filter((m) => !m.excludeFromLeaderboard)
          .forEach((m) => matchNumbersSet.add(m.matchNumber));
      }

      const sortedMatchNumbers = Array.from(matchNumbersSet).sort((x, y) => y - x);

      for (const matchNum of sortedMatchNumbers) {
        let rankA = 999;
        let rankB = 999;

        const mrA = a.matchRanks?.find((mr) => mr.matchNumber === matchNum);
        if (mrA && mrA.rank && mrA.rank > 0) {
          rankA = mrA.rank;
        } else if (context?.savedMatches) {
          const matchObj = context.savedMatches.find((m) => m.matchNumber === matchNum);
          const scoreA = matchObj?.teamScores?.[a.teamId];
          if (scoreA?.placement && scoreA.placement > 0) {
            rankA = scoreA.placement;
          }
        }

        const mrB = b.matchRanks?.find((mr) => mr.matchNumber === matchNum);
        if (mrB && mrB.rank && mrB.rank > 0) {
          rankB = mrB.rank;
        } else if (context?.savedMatches) {
          const matchObj = context.savedMatches.find((m) => m.matchNumber === matchNum);
          const scoreB = matchObj?.teamScores?.[b.teamId];
          if (scoreB?.placement && scoreB.placement > 0) {
            rankB = scoreB.placement;
          }
        }

        if (rankA !== rankB) {
          return rankA - rankB; // Lower numerical rank wins tiebreaker (1st is better than 2nd)
        }
      }
    }
  }

  // Deterministic final fallback: teamId ascending
  return a.teamId - b.teamId;
}

export interface MatchFullnessCheck {
  isFull: boolean;
  reason?: string;
  playerCount: number;
  teamCount: number;
  aliveTeamsCount: number;
  totalKills: number;
}

/**
 * Validates that a captured match has a legitimate full lobby.
 * In PUBG tournaments/scrims, a game should have at least 8 players across at least 2 teams.
 * Prevents saving partial/empty lobbies, initial warmups, or 0-player corrupt snapshots.
 */
export function validateMatchFullness(
  players: PlayerRawInfo[] | null | undefined,
  minimumPlayers = 8,
  minimumTeams = 2
): MatchFullnessCheck {
  if (!players || players.length === 0) {
    return {
      isFull: false,
      reason: 'No players detected in the game snapshot.',
      playerCount: 0,
      teamCount: 0,
      aliveTeamsCount: 0,
      totalKills: 0,
    };
  }

  const playerCount = players.length;
  const teamsSet = new Set(players.map((p) => p.teamId));
  const teamCount = teamsSet.size;
  const aliveTeamsSet = new Set(
    players.filter((p) => !p.bHasDied && p.health > 0 && p.liveState !== 2).map((p) => p.teamId)
  );
  const aliveTeamsCount = aliveTeamsSet.size;
  const totalKills = players.reduce((acc, p) => acc + (p.killNum || 0), 0);

  if (playerCount < minimumPlayers) {
    return {
      isFull: false,
      reason: `Match is not full! Found only ${playerCount} players (minimum required is ${minimumPlayers} players for an official match).`,
      playerCount,
      teamCount,
      aliveTeamsCount,
      totalKills,
    };
  }

  if (teamCount < minimumTeams) {
    return {
      isFull: false,
      reason: `Match is not full! Found only ${teamCount} team(s) (minimum required is ${minimumTeams} distinct teams).`,
      playerCount,
      teamCount,
      aliveTeamsCount,
      totalKills,
    };
  }

  return {
    isFull: true,
    playerCount,
    teamCount,
    aliveTeamsCount,
    totalKills,
  };
}

/**
 * Generates a stable fingerprint for a set of players in a match.
 * Used for strict deduplication to ensure the same match cannot be saved twice,
 * and to prevent spectator API replay loops from re-ingesting already saved games.
 */
export function getMatchFingerprint(players: PlayerRawInfo[] | null | undefined): string {
  if (!players || players.length === 0) return '';
  const sorted = [...players].sort((a, b) => (Number(a.uId) || 0) - (Number(b.uId) || 0));
  return sorted
    .map(
      (p) =>
        `${p.uId}:${p.teamId}:${p.killNum || 0}:${p.damage || 0}:${p.bHasDied ? 1 : 0}:${p.rank || 0}`
    )
    .join('|');
}

/**
 * Checks if a candidate player list matches an already saved game.
 * Uses exact fingerprint comparison so repeated games with the same team rosters
 * (Game 1, Game 2, Game 3, Game 4, Game 5) are never falsely flagged as duplicates!
 */
export function findDuplicateMatch(
  savedMatches: SavedMatch[],
  candidatePlayers: PlayerRawInfo[]
): SavedMatch | null {
  if (!candidatePlayers || candidatePlayers.length === 0 || savedMatches.length === 0) {
    return null;
  }

  const candFingerprint = getMatchFingerprint(candidatePlayers);
  if (!candFingerprint) return null;

  for (const m of savedMatches) {
    if (!m.playerSnapshots || m.playerSnapshots.length === 0) continue;
    
    // Strict exact fingerprint match: EVERY player's individual stats, kills, damage, and death state
    const mFingerprint = getMatchFingerprint(m.playerSnapshots);
    if (mFingerprint && mFingerprint === candFingerprint) {
      return m;
    }
  }

  return null;
}

/**
 * Resolves a team's display name respecting pre-configured names (before match 1 starts)
 * and optionally taking names from the live match API once the match starts.
 */
export function resolveTeamDisplayName(
  teamId: number,
  apiTeamName: string | undefined | null,
  config: TournamentConfig,
  isLiveActive: boolean
): string {
  const customName = (config.customTeamNames?.[teamId] || config.customTeamNames?.[String(teamId)] || '').trim();
  const rawApi = (apiTeamName || '').trim();
  const isGenericApi = !rawApi || /^team\s*#?\s*\d+$/i.test(rawApi);

  // If live game is active and API has a real name, and preferLiveApiTeamNames is not disabled (defaults to true)
  if (isLiveActive && config.preferLiveApiTeamNames !== false && !isGenericApi) {
    return rawApi;
  }

  // If custom pre-configured name exists, use it
  if (customName) {
    return customName;
  }

  // Fallback to API name or TEAM #ID
  return rawApi || `TEAM #${teamId}`;
}

