import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Skull } from 'lucide-react';
import { TournamentConfig, SavedMatch, PlayerRawInfo, TeamMatchScore } from '../types/pubg';
import { UnifiedTeamStanding } from './StreamLeaderboard';
import {
  calculateMatchTeamScores,
  resolveTeamDisplayName,
  compareTeamsOfficialTieBreakers,
} from '../utils/pubgCalculations';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { TeamFlag } from './TeamFlag';
import { VirtuocityLogo } from './VirtuocityLogo';
import { getTournamentBroadcastChannel, subscribeToObsTestTrigger } from '../utils/storage';

interface NarrowSideLeaderboardProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers?: PlayerRawInfo[];
  unifiedStandings: UnifiedTeamStanding[];
  onManualRefresh?: () => void;
  isStandaloneObs?: boolean;
  onUpdateConfig?: (cfg: TournamentConfig) => void;
}

export interface EliminationInfo {
  timestamp: number;
  placement: number;
}

export const NarrowSideLeaderboard: React.FC<NarrowSideLeaderboardProps> = ({
  config,
  savedMatches,
  activePlayers = [],
  unifiedStandings,
  isStandaloneObs = false,
  onUpdateConfig,
}) => {
  // Live in-game squad scoring & elimination tracking
  const isLiveGameActive = Boolean(activePlayers && activePlayers.length > 0);

  const liveScores = useMemo(() => {
    if (!isLiveGameActive || !activePlayers || activePlayers.length === 0) return {};
    return calculateMatchTeamScores(activePlayers, config, false);
  }, [isLiveGameActive, activePlayers, config]);

  const prevSquadAliveRef = useRef<Record<number, number>>({});
  const [eliminatedEvents, setEliminatedEvents] = useState<Record<number, EliminationInfo>>({});

  // Detect when teams die in the current live game (handles simultaneous squad wipes)
  useEffect(() => {
    if (!isLiveGameActive) return;

    const scores = Object.values(liveScores) as TeamMatchScore[];
    const newlyEliminated: Record<number, EliminationInfo> = {};
    const now = Date.now();

    // Remaining alive squads count after this tick
    const aliveSquadsCount = scores.filter((s) => s.aliveCount > 0).length;

    // Identify teams dying in this tick
    const dyingSquads = scores.filter((ls) => {
      const prev = prevSquadAliveRef.current[ls.teamId];
      return prev !== undefined && prev > 0 && ls.aliveCount === 0;
    });

    if (dyingSquads.length > 0) {
      // Sort dying squads: those who survived longer or had higher placement rank better (smaller rank number)
      dyingSquads.sort((a, b) => {
        if (a.placement && b.placement) return b.placement - a.placement;
        if (a.rankPoints !== b.rankPoints) return a.rankPoints - b.rankPoints;
        return (b.totalDamage || 0) - (a.totalDamage || 0);
      });

      // Assign placements: e.g. if 8 teams remain alive, dying squad gets 8 + 1 = 9th place ("#9 Eliminated!")
      dyingSquads.forEach((ls, idx) => {
        const fallbackPlacement = aliveSquadsCount + dyingSquads.length - idx;
        const placement = ls.placement && ls.placement > 1 ? ls.placement : fallbackPlacement;
        newlyEliminated[ls.teamId] = {
          timestamp: now,
          placement,
        };
      });

      setEliminatedEvents((prev) => ({
        ...prev,
        ...newlyEliminated,
      }));
    }

    scores.forEach((ls) => {
      prevSquadAliveRef.current[ls.teamId] = ls.aliveCount;
    });
  }, [isLiveGameActive, liveScores]);

  // Clean up elimination animations after exactly 2.0 seconds
  useEffect(() => {
    if (Object.keys(eliminatedEvents).length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const nextMap: Record<number, EliminationInfo> = {};
      Object.entries(eliminatedEvents).forEach(([idStr, info]) => {
        const item = info as EliminationInfo;
        if (item && now - item.timestamp < 2000) {
          nextMap[Number(idStr)] = item;
        } else {
          changed = true;
        }
      });
      if (changed) {
        setEliminatedEvents(nextMap);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [eliminatedEvents]);

  // Strictly only show teams that have actually played in included matches or are active in the live match
  // Sorted according to official tournament tie-breaker rules
  const displayTeamsList = useMemo<UnifiedTeamStanding[]>(() => {
    return [...unifiedStandings].sort((a, b) => {
      return compareTeamsOfficialTieBreakers(a, b, { savedMatches });
    });
  }, [unifiedStandings, savedMatches]);

  // Support targeted test on OBS
  useEffect(() => {
    const unsubscribe = subscribeToObsTestTrigger('narrow', (payload) => {
      const placement = payload.teamId
        ? displayTeamsList.findIndex((t) => t.teamId === payload.teamId) + 1 || 9
        : 9;
      const targetTeam = payload.teamId
        ? displayTeamsList.find((t) => t.teamId === payload.teamId)
        : displayTeamsList[placement - 1] || displayTeamsList[0];
      if (targetTeam) {
        setEliminatedEvents((prev) => ({
          ...prev,
          [targetTeam.teamId]: {
            timestamp: Date.now(),
            placement,
          },
        }));
      }
    });

    const handleCustomTrigger = (e: any) => {
      const payload = e?.detail || e?.data;
      if (payload) {
        const placement = payload.teamId
          ? displayTeamsList.findIndex((t) => t.teamId === payload.teamId) + 1 || 9
          : 9;
        const targetTeam = payload.teamId
          ? displayTeamsList.find((t) => t.teamId === payload.teamId)
          : displayTeamsList[placement - 1] || displayTeamsList[0];
        if (targetTeam) {
          setEliminatedEvents((prev) => ({
            ...prev,
            [targetTeam.teamId]: {
              timestamp: Date.now(),
              placement,
            },
          }));
        }
      }
    };
    window.addEventListener('TRIGGER_ELIMINATION_ANIMATION' as any, handleCustomTrigger);

    return () => {
      unsubscribe();
      window.removeEventListener('TRIGGER_ELIMINATION_ANIMATION' as any, handleCustomTrigger);
    };
  }, [displayTeamsList]);

  // Support testing via ?test_elim=9 or window event / storage / broadcast
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const testParam = params.get('test_elim');
    if (testParam && displayTeamsList.length > 0) {
      const targetPlacement = Number(testParam) > 0 ? Number(testParam) : 9;
      const targetTeam = displayTeamsList[targetPlacement - 1] || displayTeamsList[0];
      if (targetTeam) {
        setEliminatedEvents({
          [targetTeam.teamId]: {
            timestamp: Date.now(),
            placement: targetPlacement,
          },
        });
      }
    }
  }, [displayTeamsList]);

  useEffect(() => {
    const handleTrigger = (e: any) => {
      const detail = e.detail;
      const placement = detail?.placement || 9;
      const targetTeam = detail?.teamId
        ? displayTeamsList.find((t) => t.teamId === detail.teamId)
        : displayTeamsList[placement - 1] || displayTeamsList[0];
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

    window.addEventListener('TRIGGER_ELIMINATION_ANIMATION' as any, handleTrigger);

    const checkStorageTrigger = () => {
      try {
        const raw = localStorage.getItem('pubg_test_elim_trigger');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || !data.timestamp) return;
        if (Date.now() - data.timestamp < 4500) {
          const placement = data.placement || 9;
          const targetTeam = data.teamId
            ? displayTeamsList.find((t) => t.teamId === data.teamId)
            : displayTeamsList[placement - 1] || displayTeamsList[0];
          if (targetTeam) {
            setEliminatedEvents((prev) => ({
              ...prev,
              [targetTeam.teamId]: {
                timestamp: data.timestamp,
                placement,
              },
            }));
          }
        }
      } catch {}
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pubg_test_elim_trigger') {
        checkStorageTrigger();
      }
    };
    window.addEventListener('storage', handleStorage);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('pubg_elim_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'ELIMINATION_TRIGGER') {
            const placement = event.data.placement || 9;
            const targetTeam = event.data.teamId
              ? displayTeamsList.find((t) => t.teamId === event.data.teamId)
              : displayTeamsList[placement - 1] || displayTeamsList[0];
            if (targetTeam) {
              setEliminatedEvents((prev) => ({
                ...prev,
                [targetTeam.teamId]: {
                  timestamp: Date.now(),
                  placement,
                },
              }));
            }
          }
        };
      } catch {}
    }

    return () => {
      window.removeEventListener('TRIGGER_ELIMINATION_ANIMATION' as any, handleTrigger);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, [displayTeamsList]);

  // User Directive: "don't make animation of placment change until elemented animation finish so it doesn't stuck"
  // Keep row ordering frozen while any team is actively showing its 4.5s ELIMINATED animation
  const [frozenOrder, setFrozenOrder] = useState<number[]>([]);
  const hasActiveEliminations = Object.keys(eliminatedEvents).length > 0;

  useEffect(() => {
    if (!hasActiveEliminations || frozenOrder.length === 0) {
      setFrozenOrder(displayTeamsList.map((t) => t.teamId));
    }
  }, [displayTeamsList, hasActiveEliminations]);

  // Reconstruct display array matching frozenOrder while preserving latest points/status
  const displayedTeams = useMemo<UnifiedTeamStanding[]>(() => {
    if (frozenOrder.length === 0) return displayTeamsList;
    const map = new Map<number, UnifiedTeamStanding>();
    displayTeamsList.forEach((t) => map.set(t.teamId, t));

    const result: UnifiedTeamStanding[] = [];
    const added = new Set<number>();

    frozenOrder.forEach((id) => {
      const t = map.get(id);
      if (t) {
        result.push(t);
        added.add(id);
      }
    });

    displayTeamsList.forEach((t) => {
      if (!added.has(t.teamId)) {
        result.push(t);
      }
    });

    return result;
  }, [displayTeamsList, frozenOrder]);

  // Chamfered clipping polygon (10px cut)
  const outerChamferStyle = {
    clipPath:
      'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)',
  };

  const innerChamferStyle = {
    clipPath:
      'polygon(7px 0%, calc(100% - 7px) 0%, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0% calc(100% - 7px), 0% 7px)',
  };

  // Live vertical health progress indicator for each squad player:
  // Fills vertically from bottom to top. When health is 50%, it fills to the exact middle!
  const renderLivePlayerPips = (team: UnifiedTeamStanding, isDeadSquad: boolean) => {
    if (!isLiveGameActive) {
      // Standby / Between games: 4 vertical ready bars
      return (
        <div className="flex items-center gap-1" title="Standby / Squad Ready">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-[1px] bg-[#0A1E3F] border border-[#1a83c5]/40 flex flex-col justify-end overflow-hidden"
            >
              <div className="w-full h-full bg-[#1a83c5]/60" />
            </div>
          ))}
        </div>
      );
    }

    const liveScore = liveScores[team.teamId];
    if (!liveScore) {
      // Team played past games but is not playing in this live game: render as inactive / dead
      return (
        <div className="flex items-center gap-1" title="Not in this live match">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="w-1.5 sm:w-2 h-3.5 sm:h-4 rounded-[1px] bg-[#0A1224] border border-slate-700/50 flex flex-col justify-end overflow-hidden"
            >
              <div className="w-full h-0" />
            </div>
          ))}
        </div>
      );
    }

    const teamPlayers = activePlayers.filter((p) => p.teamId === team.teamId);
    const isWinner = team.isLiveWinner || liveScore?.isWinner;
    const aliveCount = liveScore?.aliveCount ?? team.liveAliveCount ?? 0;

    if (isWinner) {
      return (
        <div className="flex items-center gap-[3px]" title="Winner Winner Chicken Dinner">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="w-[6px] sm:w-[7px] h-[13px] sm:h-[15px] rounded-none bg-[#0A1E3F] border border-[#1a83c5] flex flex-col justify-end overflow-hidden shadow-[0_0_6px_#1a83c5]"
            >
              <div className="w-full h-full bg-[#1a83c5]" />
            </div>
          ))}
        </div>
      );
    }

    if (aliveCount === 0) {
      return (
        <div className="flex items-center gap-[3px]" title="Squad Eliminated">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="w-[6px] sm:w-[7px] h-[13px] sm:h-[15px] rounded-none bg-[#0A1224] border border-slate-700/50 flex flex-col justify-end overflow-hidden"
            >
              <div className="w-full h-0" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-[3px]" title={`${aliveCount} Players Alive`}>
        {[0, 1, 2, 3].map((slotIdx) => {
          const p = teamPlayers[slotIdx];
          // Strict: health <= 0 or bHasDied or liveState === 2 -> DEAD
          const isDead = p ? (p.bHasDied || p.health <= 0 || p.liveState === 2) : (slotIdx >= aliveCount);
          const isKnocked = p ? (!isDead && (p.liveState === 1 || Boolean((p as any).bIsKnocked))) : false;
          const healthVal = p ? Math.max(0, Math.min(100, p.health)) : (slotIdx < aliveCount ? 100 : 0);

          if (isDead || healthVal <= 0) {
            return (
              <div
                key={slotIdx}
                title="Player Dead"
                className="w-[6px] sm:w-[7px] h-[13px] sm:h-[15px] rounded-none bg-[#0A1224] border border-slate-700/50 flex flex-col justify-end overflow-hidden"
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
                className="w-[6px] sm:w-[7px] h-[13px] sm:h-[15px] rounded-none bg-[#1a0508] border border-[#ef4444] flex flex-col justify-end overflow-hidden shadow-[0_0_6px_rgba(239,68,68,0.7)] animate-pulse"
              >
                <div
                  className="w-full bg-[#ef4444] transition-all duration-300"
                  style={{ height: `${Math.max(20, healthVal)}%` }}
                />
              </div>
            );
          }

          // Dynamic live vertical health indicator using theme tokens
          const barColor =
            healthVal > 50
              ? 'bg-[#10b981] shadow-[0_0_4px_rgba(16,185,129,0.8)]'
              : healthVal > 20
              ? 'bg-[#ffb800] shadow-[0_0_4px_rgba(255,184,0,0.8)]'
              : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.9)] animate-pulse';

          return (
            <div
              key={slotIdx}
              title={`Player Health: ${Math.round(healthVal)}%`}
              className="w-[6px] sm:w-[7px] h-[13px] sm:h-[15px] rounded-none bg-[#0a0d14] border border-[#1e293b] flex flex-col justify-end overflow-hidden"
            >
              <div
                className={`w-full ${barColor} transition-all duration-300 ease-out`}
                style={{ height: `${healthVal}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const isTransparent = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return (
      p.get('transparent') === '1' ||
      p.get('transparent') === 'true' ||
      config.obsTheme === 'transparent'
    );
  }, [config.obsTheme]);

  return (
    <div
      id="obs-narrow-side-leaderboard"
      className={`relative w-full ${
        isStandaloneObs ? 'h-screen max-h-screen justify-start items-start' : 'min-h-[840px] justify-center items-start py-4'
      } ${
        isTransparent ? 'bg-transparent' : 'bg-transparent'
      } text-[#f8fafc] select-none overflow-hidden p-1 sm:p-2 flex font-outfit`}
    >
      {/* Side Leaderboard Container - 92% Opacity & Sharp Edges */}
      <div className="w-full max-w-[452px] sm:max-w-[492px] md:max-w-[522px] rounded-none bg-[#141d28]/92 border border-[#2b3a4f] shadow-[0_12px_40px_rgba(0,0,0,0.8)] p-2 sm:p-2.5 flex flex-col h-full max-h-full justify-between z-10 overflow-hidden backdrop-blur-md">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Column Header Row: #, TEAM, STATUS, ELIMS, PTS */}
          <div className="w-full h-[32px] mb-1.5 px-2 rounded-none bg-[#1d2938] border-b border-[#29374c] flex items-center justify-between text-[13px] sm:text-sm font-heading font-black uppercase tracking-wider text-[#94a3b8] flex-shrink-0">
            <div className="w-7 sm:w-8 text-center text-[#8495a8]">#</div>
            <div className="flex-1 pl-1.5 sm:pl-2 text-left text-[#d2ddec]">TEAM</div>
            <div className="w-[72px] sm:w-[76px] text-center text-[#38bdf8]">STATUS</div>
            <div className="w-11 sm:w-12 text-center text-[#10b981]">ELIMS</div>
            <div className="w-11 sm:w-12 text-center text-[#f59e0b]">PTS</div>
          </div>

          {/* Leaderboard Rows */}
          <div className="w-full flex-1 min-h-0 flex flex-col justify-start space-y-[3px] overflow-y-auto no-scrollbar">
            {displayedTeams.map((team, index) => {
              const rank = index + 1;
              const isFirstPlace = rank === 1;

              const displayName = resolveTeamDisplayName(team.teamId, team.teamName, config, isLiveGameActive);
              const flagVal = resolveTeamFlagValue(team.teamId, config.teamFlags, team.teamName);
              const teamLogo =
                config.teamLogos?.[team.teamId] ||
                config.teamLogos?.[String(team.teamId)] ||
                config.teamLogos?.[team.teamName] ||
                (team.teamName ? config.teamLogos?.[team.teamName.trim().toLowerCase()] : undefined);

              const pts = team.totalPoints || 0;
              const kills = team.totalKills || 0;

              const currentLiveScore = liveScores[team.teamId];
              const aliveCount = isLiveGameActive
                ? (currentLiveScore?.aliveCount ?? team.liveAliveCount ?? 0)
                : 4;
              const isSquadDead = isLiveGameActive && aliveCount === 0;
              const eliminationEvent = eliminatedEvents[team.teamId];
              const isRecentlyEliminated = Boolean(eliminationEvent);
              const eliminationPlacement = eliminationEvent?.placement || (currentLiveScore?.placement && currentLiveScore.placement > 1 ? currentLiveScore.placement : 9);

              const teamPlayers = isLiveGameActive
                ? activePlayers.filter((p) => p.teamId === team.teamId)
                : [];

              return (
                <motion.div
                  key={team.teamId}
                  layout="position"
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className={`w-full min-h-[38px] h-[38px] sm:min-h-[40px] sm:h-[40px] px-2 py-0.5 rounded-none ${
                    isTransparent ? 'bg-[#192433]/92' : 'bg-[#192433]/95'
                  } border border-[#243346] hover:bg-[#1f2c3e] flex-shrink-0 transition-all duration-200 relative ${
                    rank === 1
                      ? 'border-l-4 border-l-[#f59e0b]'
                      : rank === 2
                      ? 'border-l-4 border-l-[#cbd5e1]'
                      : rank === 3
                      ? 'border-l-4 border-l-[#ea580c]'
                      : 'border-l-4 border-l-transparent'
                  } ${
                    isRecentlyEliminated
                      ? 'ring-1 ring-[#ef4444]/60 shadow-[0_0_16px_rgba(239,68,68,0.7)] z-20'
                      : isSquadDead
                      ? 'opacity-40 grayscale-[40%] brightness-75'
                      : 'opacity-100'
                  }`}
                >
                  <div className="w-full h-full flex items-center justify-between relative overflow-hidden">
                    {/* Side Wipe Animation: "#{placement} Eliminated!" for 2 seconds */}
                    <AnimatePresence>
                      {isRecentlyEliminated && (
                        <motion.div
                          key={`elim-slide-${team.teamId}`}
                          initial={{ x: '-100%' }}
                          animate={{ x: '0%' }}
                          exit={{ x: '100%', opacity: 0 }}
                          transition={{
                            duration: 0.3,
                            ease: 'easeOut',
                          }}
                          className="absolute inset-0 z-30 flex items-center justify-between px-2 bg-gradient-to-r from-[#ef4444] via-[#991b1b] to-[#450a0a] text-[#f8fafc] border-y border-[#ef4444] shadow-[0_0_20px_rgba(239,68,68,0.9)] overflow-hidden rounded-none"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite] pointer-events-none" />

                          {/* Left: Skull Icon, Team Logo, Country Flag & Team Name */}
                          <div className="flex items-center gap-1.5 min-w-0 pr-1.5 z-10">
                            <div className="w-5.5 h-5.5 rounded-none bg-[#0a0d14] border border-white/60 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <Skull className="w-4 h-4 text-[#ef4444] animate-pulse" />
                            </div>
                            {teamLogo && (
                              <img
                                src={teamLogo}
                                alt=""
                                className="w-5.5 h-5.5 object-contain flex-shrink-0"
                              />
                            )}
                            {flagVal && (
                              <TeamFlag
                                flagValue={flagVal}
                                teamId={team.teamId}
                                isWinner={false}
                                className="w-5.5 h-4 object-cover rounded-none shadow-sm flex-shrink-0 border border-white/40"
                              />
                            )}
                            <span
                              className="text-white font-heading font-black text-sm sm:text-[15px] uppercase tracking-wide truncate drop-shadow"
                              title={displayName}
                            >
                              {displayName}
                            </span>
                          </div>

                          {/* Right: "#{eliminationPlacement} ELIMINATED!" */}
                          <div className="flex items-center gap-1 z-10 flex-shrink-0">
                            <span className="font-heading font-black text-xs sm:text-sm tracking-wider text-white uppercase bg-black/80 px-1.5 py-0.5 rounded-none border border-[#ef4444] whitespace-nowrap flex items-center gap-1 shadow-md">
                              <span className="text-[#ffb800]">#{eliminationPlacement}</span>
                              <span className="text-white">ELIMINATED!</span>
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* # Rank Column */}
                    <div className="w-7 sm:w-8 text-center flex-shrink-0 font-telemetry font-black text-sm sm:text-base">
                      {rank === 1 ? (
                        <span className="text-[#f59e0b]">1</span>
                      ) : rank === 2 ? (
                        <span className="text-[#cbd5e1]">2</span>
                      ) : rank === 3 ? (
                        <span className="text-[#ea580c]">3</span>
                      ) : (
                        <span className="text-[#8a9bb0] font-bold">{rank}</span>
                      )}
                    </div>

                    {/* TEAM Column: Team Logo, Flag, Display Name */}
                    <div className="flex-1 flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-1.5 min-w-0 pr-1 overflow-hidden">
                      {teamLogo && (
                        <img
                          src={teamLogo}
                          alt=""
                          className={`w-5.5 h-5.5 sm:w-6 sm:h-6 object-contain flex-shrink-0 ${
                            isSquadDead ? 'opacity-50' : 'opacity-100'
                          }`}
                        />
                      )}
                      {flagVal && (
                        <TeamFlag
                          flagValue={flagVal}
                          teamId={team.teamId}
                          isWinner={isFirstPlace && !isSquadDead}
                          className={`w-5.5 h-4 sm:w-6 sm:h-4.5 object-cover rounded-none shadow-sm flex-shrink-0 border border-black/40 ${
                            isSquadDead ? 'opacity-50' : 'opacity-100'
                          }`}
                        />
                      )}
                      <span
                        className={`font-heading font-black text-sm sm:text-[15px] md:text-base tracking-wide leading-tight truncate uppercase ${
                          isSquadDead
                            ? 'text-slate-400'
                            : 'text-[#f8fafc]'
                        }`}
                        title={displayName}
                      >
                        {displayName}
                      </span>
                    </div>

                    {/* STATUS Column: Tightened Equal Width Health Indicator Pips under STATUS header */}
                    <div className="w-[72px] sm:w-[76px] flex items-center justify-center flex-shrink-0">
                      <div className="flex items-center gap-1 px-1 py-0.5 rounded-none bg-[#0c1420] border border-[#1e2c3e]">
                        <div className="flex items-center gap-[2.5px]">
                          {[0, 1, 2, 3].map((slotIdx) => {
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

                            // Every indicator pip is guaranteed uniform exact equal width
                            if (isDead || healthVal <= 0 || aliveCount === 0) {
                              return (
                                <div
                                  key={slotIdx}
                                  className="w-[5.5px] h-[13px] sm:w-[6.5px] sm:h-[15px] rounded-none bg-[#1c2838]"
                                  title="Player Dead"
                                />
                              );
                            }

                            if (isKnocked) {
                              return (
                                <div
                                  key={slotIdx}
                                  className="w-[5.5px] h-[13px] sm:w-[6.5px] sm:h-[15px] rounded-none bg-[#ef4444] shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse"
                                  title={`Knocked Down (${Math.round(healthVal)}%)`}
                                />
                              );
                            }

                            const barColor =
                              healthVal > 50
                                ? 'bg-[#10b981]'
                                : healthVal > 20
                                ? 'bg-[#f59e0b]'
                                : 'bg-[#ef4444]';

                            return (
                              <div
                                key={slotIdx}
                                className={`w-[5.5px] h-[13px] sm:w-[6.5px] sm:h-[15px] rounded-none ${barColor}`}
                                title={`Health: ${Math.round(healthVal)}%`}
                              />
                            );
                          })}
                        </div>
                        <span
                          className={`text-xs sm:text-[13px] font-telemetry font-bold leading-none ${
                            aliveCount > 0 ? 'text-[#10b981]' : 'text-slate-500'
                          }`}
                        >
                          {aliveCount}
                        </span>
                      </div>
                    </div>

                    {/* ELIMS Column: Bright Green Text (#10b981) */}
                    <div className="w-11 sm:w-12 text-center font-telemetry font-bold text-[#10b981] text-sm sm:text-base md:text-[17px] tabular-nums flex-shrink-0">
                      {kills}
                    </div>

                    {/* PTS Column: Boxed Number */}
                    <div className="w-11 sm:w-12 flex items-center justify-center flex-shrink-0">
                      <div className="bg-[#0e1624] border border-[#1c2a3c] rounded-none px-1.5 py-0.5 min-w-[34px] sm:min-w-[36px] text-center text-white font-heading font-black text-sm sm:text-base md:text-[17px] shadow-inner tabular-nums">
                        {pts}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
