import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Trophy, Skull } from 'lucide-react';
import { UnifiedTeamStanding } from './StreamLeaderboard';
import { TeamFlag } from './TeamFlag';

interface CyberLeaderboardRowProps {
  rank: number;
  team: UnifiedTeamStanding;
  isPaused: boolean;
  isLiveActive: boolean;
  liveAliveTeamsCount: number;
  latestWinnerTeamId?: number | null;
  isJustEliminated?: boolean;
  eliminatedPlacement?: number;
  flagValue?: string | null;
  teamLogo?: string | null;
}

export const CyberLeaderboardRow: React.FC<CyberLeaderboardRowProps> = ({
  rank,
  team,
  isPaused,
  isLiveActive,
  isJustEliminated = false,
  eliminatedPlacement,
  flagValue,
  teamLogo,
}) => {
  const isFirstPlace = rank === 1;
  const effectiveFlag = flagValue !== undefined ? flagValue : team.flagValue;

  // Extract clean team name (shown prominently with maximum space)
  const displayTeamName = React.useMemo(() => {
    let rawTeamName = (team.teamName || '').trim();
    if (!rawTeamName || /^team\s*\d+$/i.test(rawTeamName)) {
      return rawTeamName ? rawTeamName.toUpperCase() : `TEAM #${team.teamId}`;
    }
    return rawTeamName;
  }, [team.teamName, team.teamId]);

  // Squad live health bars (dynamic indicators using theme tokens)
  const healthBars = React.useMemo(() => {
    if (isLiveActive && !team.isLivePresent) {
      return [0, 1, 2, 3].map((idx) => ({
        id: idx,
        name: `Member ${idx + 1}`,
        hp: 0,
        rawHp: 0,
        maxHp: 100,
        isKnocked: false,
        isDead: true,
        colorClass: 'bg-transparent',
      }));
    }

    if (team.roster && team.roster.length > 0) {
      return team.roster.map((player, idx) => {
        const rawHealth = typeof player.health === 'number' ? player.health : (player.isAlive ? 100 : 0);
        const maxHealth = player.healthMax || 100;
        const hpPercent = Math.max(0, Math.min(100, Math.round((rawHealth / maxHealth) * 100)));
        const isDead = !player.isAlive || Boolean(player.bHasDied) || player.liveState === 2 || rawHealth <= 0;
        const isKnocked = !isDead && (player.liveState === 1 || Boolean((player as any).bIsKnocked));

        let colorClass = 'bg-[#10b981] shadow-[0_0_4px_rgba(16,185,129,0.8)]';
        if (isKnocked) {
          colorClass = 'bg-[#ef4444] animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.9)]';
        } else if (isDead) {
          colorClass = 'bg-transparent';
        } else if (hpPercent <= 20) {
          colorClass = 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.8)]';
        } else if (hpPercent <= 50) {
          colorClass = 'bg-[#ffb800] shadow-[0_0_4px_rgba(255,184,0,0.8)]';
        }

        return {
          id: player.uId || idx,
          name: player.playerName || `Player ${idx + 1}`,
          hp: hpPercent,
          rawHp: rawHealth,
          maxHp: maxHealth,
          isKnocked,
          isDead,
          colorClass,
        };
      });
    }

    const aliveCount = team.isLivePresent
      ? (team.liveAliveCount ?? (team.liveStatus === 'ALIVE' ? 4 : 0))
      : 0;
    return [0, 1, 2, 3].map((idx) => {
      const isAlive = idx < aliveCount;
      return {
        id: idx,
        name: `Member ${idx + 1}`,
        hp: isAlive ? 100 : 0,
        rawHp: isAlive ? 100 : 0,
        maxHp: 100,
        isKnocked: false,
        isDead: !isAlive,
        colorClass: isAlive ? 'bg-[#10b981] shadow-[0_0_4px_rgba(16,185,129,0.8)]' : 'bg-transparent',
      };
    });
  }, [team.roster, team.liveStatus, team.liveAliveCount, team.isLivePresent, isLiveActive]);

  const isDeadOrNotPlaying = isLiveActive && !isPaused && (!team.isLivePresent || team.liveStatus === 'ELIMINATED' || (team.liveAliveCount ?? 0) === 0);

  // Podium Hierarchy Accent Border & Rank Badges
  // Rank 1: Left accent border 4px solid #ffb800 (Gold) + subtle gold rank number.
  // Rank 2: Left accent border 4px solid #cbd5e1 (Silver).
  // Rank 3: Left accent border 4px solid #f97316 (Bronze).
  // Top 4–8: Left accent border 4px solid #38bdf8 (Cyan).
  // Lower ranks: Left accent border 4px solid #1e293b.
  const podiumStyles = React.useMemo(() => {
    if (rank === 1) {
      return {
        borderLeft: '4px solid #ffb800',
        rankColor: 'text-[#ffb800] bg-[rgba(255,184,0,0.15)] border-[rgba(255,184,0,0.40)]',
        glow: 'shadow-[0_0_20px_rgba(255,184,0,0.2)]',
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

  return (
    <div
      id={`cyber-row-${rank}`}
      style={{
        borderLeft: isJustEliminated ? '4px solid #ef4444' : podiumStyles.borderLeft,
      }}
      className={`relative flex items-center justify-between min-h-[38px] xs:min-h-[42px] sm:min-h-[46px] h-auto my-1 select-none group transition-all duration-200 hover:scale-[1.002] rounded-[10px] sm:rounded-[12px] bg-[#121824] border border-[#1e293b] hover:bg-[#172132] hover:border-[#334155] ${
        isJustEliminated
          ? 'ring-1 ring-[#ef4444]/60 shadow-[0_0_18px_rgba(239,68,68,0.6)] z-20'
          : podiumStyles.glow
      } ${!isJustEliminated && isDeadOrNotPlaying ? 'opacity-40 grayscale-[25%]' : 'opacity-100'}`}
    >
      {/* Row Content */}
      <div className="relative z-10 flex items-center justify-between w-full h-full px-2 xs:px-3 sm:px-4 py-1.5 gap-2 overflow-hidden">
        {/* Slide Animation: "#{placement} Eliminated!" */}
        <AnimatePresence>
          {isJustEliminated && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="absolute inset-0 z-30 flex items-center justify-between px-3 bg-gradient-to-r from-[#2a0408] via-[#520914] to-[#1a0205] text-[#f8fafc] border-y border-[#ef4444]/60 shadow-[0_0_20px_rgba(239,68,68,0.7)] overflow-hidden rounded-[10px]"
            >
              {/* Sweeping Shimmer Line */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-1.5 z-10">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#0a0d14] border border-[#ef4444]/60 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Skull className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ef4444] animate-pulse" />
                </div>
                {teamLogo && (
                  <img
                    src={teamLogo}
                    alt=""
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
                  />
                )}
                {effectiveFlag && (
                  <TeamFlag
                    flagValue={effectiveFlag}
                    teamId={team.teamId}
                    isWinner={false}
                    className="w-5 h-3.5 sm:w-6 sm:h-4 object-cover rounded-[2px] shadow-sm flex-shrink-0 border border-white/40"
                  />
                )}
                <span className="text-[#f8fafc] font-heading font-black text-sm sm:text-base uppercase tracking-wide truncate">
                  {displayTeamName}
                </span>
              </div>

              <div className="flex items-center gap-1 z-10 flex-shrink-0">
                <span className="font-telemetry font-bold text-xs sm:text-sm tracking-wider text-[#ffb800] uppercase bg-[#0a0d14]/90 px-2.5 py-0.5 rounded-md border border-[rgba(255,184,0,0.40)] shadow-[0_0_10px_rgba(255,184,0,0.3)] whitespace-nowrap flex items-center gap-1.5">
                  <span>#{eliminatedPlacement || 9}</span>
                  <span className="text-[#f8fafc]">ELIMINATED</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. RANK BADGE (#1, #2, ...) - Matches In-Game Leaderboard */}
        <div className="flex items-center justify-center min-w-[32px] xs:min-w-[36px] sm:min-w-[40px] flex-shrink-0">
          {rank === 1 ? (
            <div className="w-6 h-6 rounded bg-[#ffb800] text-black font-black text-xs sm:text-sm flex items-center justify-center font-telemetry shadow-sm">
              1
            </div>
          ) : rank === 2 ? (
            <div className="w-6 h-6 rounded bg-[#94a3b8] text-black font-black text-xs sm:text-sm flex items-center justify-center font-telemetry shadow-sm">
              2
            </div>
          ) : rank === 3 ? (
            <div className="w-6 h-6 rounded bg-[#ea580c] text-white font-black text-xs sm:text-sm flex items-center justify-center font-telemetry shadow-sm">
              3
            </div>
          ) : (
            <span className="text-[#94a3b8] font-bold text-xs sm:text-sm font-telemetry">
              {rank}
            </span>
          )}
        </div>

        {/* 2. TEAM NAME & SQUAD HEALTH */}
        <div className="flex-1 flex items-center justify-between gap-2 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            {teamLogo && (
              <img
                src={teamLogo}
                alt=""
                className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
              />
            )}
            {effectiveFlag && (
              <TeamFlag
                flagValue={effectiveFlag}
                teamId={team.teamId}
                isWinner={isFirstPlace}
                className={`w-5 h-3.5 sm:w-6 sm:h-4 object-cover rounded-[2px] shadow-sm flex-shrink-0 ${
                  isFirstPlace
                    ? 'border border-[#ffb800] ring-1 ring-[rgba(255,184,0,0.5)]'
                    : 'border border-white/20'
                }`}
              />
            )}
            <span
              className={`font-heading font-black text-base xs:text-lg sm:text-xl tracking-wide uppercase truncate leading-none ${
                isFirstPlace
                  ? 'text-[#f8fafc] drop-shadow-[0_0_10px_rgba(255,184,0,0.4)]'
                  : 'text-[#f8fafc]'
              }`}
              dir="auto"
              title={displayTeamName}
            >
              {displayTeamName}
            </span>
          </div>

          {/* Mini Live Health Bar Indicator */}
          {isLiveActive && (
            <div
              className={`flex items-center gap-[3px] px-1.5 py-1 rounded-md bg-[#0a0d14] border ${
                isFirstPlace ? 'border-[rgba(255,184,0,0.4)]' : 'border-[#1e293b]'
              } flex-shrink-0 shadow-inner`}
              title={`Squad Live Health: ${healthBars.filter((b) => !b.isDead).length}/${healthBars.length} Alive`}
            >
              {healthBars.map((bar) => (
                <div
                  key={bar.id}
                  className="w-[3.5px] sm:w-[4px] h-[13px] sm:h-[15px] rounded-[1px] relative overflow-hidden flex-shrink-0 bg-[#0a0d14] border border-[#1e293b]"
                  title={`${bar.name}: ${bar.isDead ? 'ELIMINATED' : bar.isKnocked ? 'KNOCKED' : `${bar.hp}% HP`}`}
                >
                  <div
                    className={`absolute bottom-0 inset-x-0 rounded-[1px] transition-all duration-300 ease-out ${bar.colorClass}`}
                    style={{
                      height: bar.isDead ? '0%' : bar.isKnocked ? '100%' : `${bar.hp}%`,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. TOTAL KILLS & POINTS */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 flex-shrink-0">
          {/* KILLS DISPLAY: Cyan text with darker badge background */}
          <div
            className="flex items-center justify-center gap-1 bg-[#0f1622] border border-[rgba(56,189,248,0.35)] px-2 py-0.5 rounded-md text-center shadow-sm flex-shrink-0 min-w-[34px] sm:min-w-[42px]"
            title={`${team.totalKills} Total Kills`}
          >
            <Crosshair className="w-3 h-3 text-[#38bdf8] flex-shrink-0 hidden xs:inline" />
            <span className="font-telemetry font-bold text-xs xs:text-sm sm:text-base text-[#38bdf8] leading-none">
              {team.totalKills}
            </span>
          </div>

          {/* TOTAL POINTS DISPLAY: Bold Rajdhani tabular numerals in Gold (#ffb800) */}
          <div className="flex items-baseline justify-end min-w-[44px] sm:min-w-[56px] text-right flex-shrink-0 pr-0.5">
            <span className="font-telemetry font-bold text-lg sm:text-2xl text-[#ffb800] tracking-tight leading-none">
              {team.totalPoints}
            </span>
            <span className="text-[9px] sm:text-[10px] font-telemetry font-bold ml-1 tracking-wider text-[#94a3b8] leading-none">
              PTS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
