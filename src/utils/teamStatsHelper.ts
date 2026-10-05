import {
  PlayerRawInfo,
  SavedMatch,
  TournamentConfig,
  TeamSquadMemberStats,
  CumulativeTeamStats,
} from '../types/pubg';
import { getTeamColor, resolveTeamDisplayName } from './pubgCalculations';

export interface ComputedTeamStats {
  teamId: number;
  teamName: string;
  teamColor: ReturnType<typeof getTeamColor>;
  squadPic?: string;
  isLiveGame: boolean;
  isConcludedMatch: boolean;
  alivePlayersCount: number;
  totalKills: number;
  totalDamage: number;
  totalKnockouts: number;
  placement?: number;
  totalPoints: number;
  players: TeamSquadMemberStats[];
  matchLabel: string;
}

export function formatSurvivalTime(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds <= 0) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Computes the 4-squad player stats for a selected team based on the chosen mode:
 * - 'live': uses the active spectator snapshot (live game)
 * - 'latest': uses the most recent concluded/saved match
 * - 'match': uses a specific saved match
 * - 'tournament': aggregates across all saved matches
 * - 'auto': uses live if active game contains team; otherwise latest saved match; otherwise tournament cumulative
 */
export function getTeamSquadStats(
  teamId: number,
  activePlayers: PlayerRawInfo[],
  savedMatches: SavedMatch[],
  config: TournamentConfig,
  teamStandings?: CumulativeTeamStats[],
  preferredSource: 'auto' | 'live' | 'tournament' | 'match' | 'latest' = 'auto',
  specificMatchId?: string | null
): ComputedTeamStats {
  const teamColor = getTeamColor(teamId);
  const squadPic = config.teamSquadPics?.[teamId] || config.teamSquadPics?.[String(teamId)];

  // 1. Check live match players
  const liveTeamPlayers = activePlayers.filter((p) => p.teamId === teamId);
  const isLiveActive = activePlayers.length > 0 && liveTeamPlayers.length > 0;

  // 2. Find latest saved match (by matchNumber descending, then timestamp descending)
  const sortedMatches = [...savedMatches].sort(
    (a, b) => (b.matchNumber || 0) - (a.matchNumber || 0) || (b.timestamp || 0) - (a.timestamp || 0)
  );
  const latestSavedMatch = sortedMatches.length > 0 ? sortedMatches[0] : null;

  // 3. Check specific saved match if requested or if latest is requested
  const chosenMatch = specificMatchId
    ? savedMatches.find((m) => m.id === specificMatchId)
    : preferredSource === 'latest'
      ? latestSavedMatch
      : null;

  // 4. Determine effective source
  let effectiveSource = preferredSource;
  if (effectiveSource === 'auto') {
    if (isLiveActive) {
      effectiveSource = 'live';
    } else if (latestSavedMatch) {
      effectiveSource = 'latest';
    } else if (savedMatches.length > 0) {
      effectiveSource = 'tournament';
    } else {
      effectiveSource = 'live';
    }
  }

  // Determine Team Name
  let samplePlayerName: string | undefined = undefined;
  if (chosenMatch) {
    const matchPlayer = chosenMatch.playerSnapshots?.find((p) => p.teamId === teamId);
    if (matchPlayer?.teamName) {
      samplePlayerName = matchPlayer.teamName;
    }
  }
  if (!samplePlayerName && liveTeamPlayers.length > 0) {
    samplePlayerName = liveTeamPlayers[0].teamName;
  } else if (!samplePlayerName && savedMatches.length > 0) {
    for (let i = savedMatches.length - 1; i >= 0; i--) {
      const match = savedMatches[i];
      const matchPlayer = match.playerSnapshots?.find((p) => p.teamId === teamId);
      if (matchPlayer?.teamName) {
        samplePlayerName = matchPlayer.teamName;
        break;
      }
    }
  }

  const teamName = resolveTeamDisplayName(teamId, samplePlayerName, config, isLiveActive);

  // CASE A: Live Active Game
  if (effectiveSource === 'live' && liveTeamPlayers.length > 0) {
    const aliveCount = liveTeamPlayers.filter((p) => !p.bHasDied && p.health > 0).length;
    let totalKills = 0;
    let totalDamage = 0;
    let totalKnockouts = 0;

    const squadMembers: TeamSquadMemberStats[] = liveTeamPlayers.slice(0, 4).map((p, idx) => {
      const kills = p.killNum || 0;
      const damage = Math.round(p.damage || 0);
      const knockouts = p.knockouts !== undefined ? p.knockouts : (p.assists || 0);
      const sTime = p.survivalTime || 0;
      const isAlive = !p.bHasDied && p.health > 0;

      totalKills += kills;
      totalDamage += damage;
      totalKnockouts += knockouts;

      return {
        uId: p.uId || (teamId * 10 + idx + 1),
        playerName: p.playerName || `PLAYER ${idx + 1}`,
        kills,
        damage,
        knockouts,
        survivalTimeSeconds: sTime,
        survivalTimeFormatted: formatSurvivalTime(sTime),
        isAlive,
        health: p.health || 0,
        bHasDied: p.bHasDied || false,
      };
    });

    // Pad to 4 squad members if team has less than 4 players
    while (squadMembers.length < 4) {
      const idx = squadMembers.length;
      squadMembers.push({
        uId: teamId * 10 + idx + 1,
        playerName: `PLAYER ${idx + 1}`,
        kills: 0,
        damage: 0,
        knockouts: 0,
        survivalTimeSeconds: 0,
        survivalTimeFormatted: '00:00',
        isAlive: false,
        health: 0,
        bHasDied: true,
      });
    }

    return {
      teamId,
      teamName,
      teamColor,
      squadPic,
      isLiveGame: true,
      isConcludedMatch: false,
      alivePlayersCount: aliveCount,
      totalKills,
      totalDamage,
      totalKnockouts,
      placement: liveTeamPlayers[0]?.rank > 0 ? liveTeamPlayers[0].rank : undefined,
      totalPoints: totalKills * config.killPointsPerKill,
      players: squadMembers,
      matchLabel: config.teamStatsCustomLabel?.trim() || 'LIVE MATCH',
    };
  }

  // CASE B: Specific Saved Match OR Latest Match
  if ((effectiveSource === 'match' || effectiveSource === 'latest') && chosenMatch) {
    const matchPlayers = (chosenMatch.playerSnapshots || []).filter((p) => p.teamId === teamId);
    const score = chosenMatch.teamScores?.[teamId];

    let totalKills = 0;
    let totalDamage = 0;
    let totalKnockouts = 0;

    const squadMembers: TeamSquadMemberStats[] = matchPlayers.slice(0, 4).map((p, idx) => {
      const kills = p.killNum || 0;
      const damage = Math.round(p.damage || 0);
      const knockouts = p.knockouts !== undefined ? p.knockouts : (p.assists || 0);
      const sTime = p.survivalTime || 0;

      totalKills += kills;
      totalDamage += damage;
      totalKnockouts += knockouts;

      return {
        uId: p.uId || (teamId * 10 + idx + 1),
        playerName: p.playerName || `PLAYER ${idx + 1}`,
        kills,
        damage,
        knockouts,
        survivalTimeSeconds: sTime,
        survivalTimeFormatted: formatSurvivalTime(sTime),
        isAlive: score?.placement === 1,
        health: score?.placement === 1 ? 100 : 0,
        bHasDied: score?.placement !== 1,
      };
    });

    while (squadMembers.length < 4) {
      const idx = squadMembers.length;
      squadMembers.push({
        uId: teamId * 10 + idx + 1,
        playerName: `PLAYER ${idx + 1}`,
        kills: 0,
        damage: 0,
        knockouts: 0,
        survivalTimeSeconds: 0,
        survivalTimeFormatted: '00:00',
        isAlive: false,
        health: 0,
        bHasDied: true,
      });
    }

    const isLatest = effectiveSource === 'latest' || preferredSource === 'latest';
    const defaultLabel = isLatest
      ? `LATEST MATCH (GAME #${chosenMatch.matchNumber})`
      : `MATCH #${chosenMatch.matchNumber}`;

    return {
      teamId,
      teamName,
      teamColor,
      squadPic,
      isLiveGame: false,
      isConcludedMatch: true,
      alivePlayersCount: score?.placement === 1 ? squadMembers.length : 0,
      totalKills: score?.totalKills ?? totalKills,
      totalDamage: score?.totalDamage ?? totalDamage,
      totalKnockouts,
      placement: score?.placement,
      totalPoints: score?.totalPoints ?? (totalKills * config.killPointsPerKill),
      players: squadMembers,
      matchLabel: config.teamStatsCustomLabel?.trim() || defaultLabel,
    };
  }

  // CASE C: Tournament Cumulative Standings
  // Collect all players for this team across all saved matches
  const cumulativeTeam = teamStandings?.find((t) => t.teamId === teamId);
  const playerMap: Record<string, {
    uId: number;
    playerName: string;
    kills: number;
    damage: number;
    knockouts: number;
    maxSurvivalTime: number;
  }> = {};

  savedMatches.forEach((m) => {
    (m.playerSnapshots || []).forEach((p) => {
      if (p.teamId === teamId) {
        const key = p.playerName || String(p.uId);
        if (!playerMap[key]) {
          playerMap[key] = {
            uId: p.uId,
            playerName: p.playerName,
            kills: 0,
            damage: 0,
            knockouts: 0,
            maxSurvivalTime: 0,
          };
        }
        playerMap[key].kills += p.killNum || 0;
        playerMap[key].damage += Math.round(p.damage || 0);
        playerMap[key].knockouts += (p.knockouts !== undefined ? p.knockouts : (p.assists || 0));
        if ((p.survivalTime || 0) > playerMap[key].maxSurvivalTime) {
          playerMap[key].maxSurvivalTime = p.survivalTime || 0;
        }
      }
    });
  });

  const cumulativePlayersList = Object.values(playerMap).sort((a, b) => b.kills - a.kills || b.damage - a.damage);

  const squadMembers: TeamSquadMemberStats[] = cumulativePlayersList.slice(0, 4).map((p, idx) => ({
    uId: p.uId || (teamId * 10 + idx + 1),
    playerName: p.playerName || `PLAYER ${idx + 1}`,
    kills: p.kills,
    damage: p.damage,
    knockouts: p.knockouts,
    survivalTimeSeconds: p.maxSurvivalTime,
    survivalTimeFormatted: formatSurvivalTime(p.maxSurvivalTime),
    isAlive: true,
    health: 100,
    bHasDied: false,
  }));

  while (squadMembers.length < 4) {
    const idx = squadMembers.length;
    squadMembers.push({
      uId: teamId * 10 + idx + 1,
      playerName: `PLAYER ${idx + 1}`,
      kills: 0,
      damage: 0,
      knockouts: 0,
      survivalTimeSeconds: 0,
      survivalTimeFormatted: '00:00',
      isAlive: false,
      health: 0,
      bHasDied: true,
    });
  }

  const standingRank = teamStandings?.findIndex((t) => t.teamId === teamId);
  const placement = standingRank !== undefined && standingRank >= 0 ? standingRank + 1 : undefined;

  return {
    teamId,
    teamName,
    teamColor,
    squadPic,
    isLiveGame: false,
    isConcludedMatch: savedMatches.length > 0,
    alivePlayersCount: 4,
    totalKills: cumulativeTeam?.totalKills || squadMembers.reduce((sum, p) => sum + p.kills, 0),
    totalDamage: cumulativeTeam?.totalDamage || squadMembers.reduce((sum, p) => sum + p.damage, 0),
    totalKnockouts: squadMembers.reduce((sum, p) => sum + p.knockouts, 0),
    placement,
    totalPoints: cumulativeTeam?.totalPoints || 0,
    players: squadMembers,
    matchLabel: config.teamStatsCustomLabel?.trim()
      ? config.teamStatsCustomLabel.trim()
      : savedMatches.length > 0
        ? `TOURNAMENT OVERALL (${savedMatches.length} GAMES)`
        : 'TOURNAMENT OVERALL',
  };
}
