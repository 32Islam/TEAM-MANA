import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, Crosshair, AlertTriangle, ShieldAlert, Sparkles, Volume2, VolumeX } from 'lucide-react';
import {
  PlayerRawInfo,
  SavedMatch,
  TournamentConfig,
  CumulativeTeamStats,
  CumulativePlayerStats,
} from '../types/pubg';
import { resolveTeamDisplayName, getTeamColor } from '../utils/pubgCalculations';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { subscribeToObsTestTrigger } from '../utils/storage';
import { TeamFlag } from './TeamFlag';

export interface EliminationAlertItem {
  id: string;
  teamId: number;
  teamName: string;
  placement: number;
  kills?: number;
  damage?: number;
  timestamp: number;
}

interface TeamEliminatedAlertOverlayProps {
  config: TournamentConfig;
  savedMatches?: SavedMatch[];
  activePlayers?: PlayerRawInfo[];
  teamStandings?: CumulativeTeamStats[];
  playerStandings?: CumulativePlayerStats[];
  onManualRefresh?: () => void;
  isStandaloneObs?: boolean;
  onUpdateConfig?: (cfg: TournamentConfig) => void;
}

// Play synthetic esports alert chime using browser Web Audio API (no external sound files required)
const playEsportsElimSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    // Sub-bass hit
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // High sci-fi chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(440, now + 0.4);

    gain2.gain.setValueAtTime(0.18, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.45);
  } catch {
    // Audio autoplay might be blocked in some browser environments
  }
};

export const TeamEliminatedAlertOverlay: React.FC<TeamEliminatedAlertOverlayProps> = ({
  config,
  savedMatches = [],
  activePlayers = [],
  onManualRefresh,
}) => {
  // Stacking active alerts array (supports simultaneous eliminations stacked below each other)
  const [activeAlerts, setActiveAlerts] = useState<EliminationAlertItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Position preference via URL: ?pos=top-right (default), top-center, bottom-center, bottom-right, center
  const screenPosition = useMemo(() => {
    if (typeof window === 'undefined') return 'top-right';
    const params = new URLSearchParams(window.location.search);
    const pos = params.get('pos') || params.get('position');
    if (pos === 'top-center' || pos === 'top') return 'top-center';
    if (pos === 'bottom-center' || pos === 'bottom') return 'bottom-center';
    if (pos === 'bottom-right') return 'bottom-right';
    if (pos === 'center') return 'center';
    return 'top-right';
  }, []);

  const positionClasses = useMemo(() => {
    switch (screenPosition) {
      case 'top-center':
        return 'top-8 left-1/2 -translate-x-1/2 items-center';
      case 'bottom-center':
        return 'bottom-10 left-1/2 -translate-x-1/2 items-center';
      case 'bottom-right':
        return 'bottom-10 right-8 items-end';
      case 'center':
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center';
      case 'top-right':
      default:
        return 'top-8 right-8 items-end';
    }
  }, [screenPosition]);

  // Keep track of previous alive count per team
  const prevAliveCountRef = useRef<Map<number, number>>(new Map());
  const isFirstLoadRef = useRef<boolean>(true);

  // Function to enqueue an elimination alert (appears for 3s only and stacks below each other)
  const enqueueElimination = (item: EliminationAlertItem) => {
    if (soundEnabled) {
      playEsportsElimSound();
    }
    setActiveAlerts((prev) => {
      // Don't duplicate if exact same team was just enqueued in the last 1.5s
      if (prev.some((a) => a.teamId === item.teamId && Date.now() - a.timestamp < 1500)) {
        return prev;
      }
      return [...prev, item];
    });

    // Auto-remove after exactly 3.0 seconds (3000ms)
    setTimeout(() => {
      setActiveAlerts((prev) => prev.filter((a) => a.id !== item.id));
    }, 3000);
  };

  // Listen to activePlayers updates to detect squad wipes in real time (handles simultaneous squad wipes)
  useEffect(() => {
    if (!activePlayers || activePlayers.length === 0) {
      return;
    }

    // Group players by team
    const teamMap = new Map<number, { name: string; aliveCount: number; kills: number; damage: number }>();
    activePlayers.forEach((p) => {
      const existing = teamMap.get(p.teamId) || {
        name: p.teamName,
        aliveCount: 0,
        kills: 0,
        damage: 0,
      };
      if (!p.bHasDied && p.health > 0 && p.liveState !== 2) {
        existing.aliveCount += 1;
      }
      existing.kills += p.killNum || 0;
      existing.damage += p.damage || 0;
      teamMap.set(p.teamId, existing);
    });

    const currentAliveTeams = Array.from(teamMap.entries()).filter(([_, t]) => t.aliveCount > 0);
    const aliveTeamsCount = currentAliveTeams.length;

    // Skip trigger on very first initial mount so we don't alert already-dead teams on load
    if (isFirstLoadRef.current) {
      teamMap.forEach((data, teamId) => {
        prevAliveCountRef.current.set(teamId, data.aliveCount);
      });
      isFirstLoadRef.current = false;
      return;
    }

    // Find all teams dying in this tick
    const dyingTeams: { teamId: number; data: { name: string; aliveCount: number; kills: number; damage: number } }[] = [];
    teamMap.forEach((data, teamId) => {
      const prevAlive = prevAliveCountRef.current.get(teamId) ?? data.aliveCount;
      if (prevAlive > 0 && data.aliveCount === 0) {
        dyingTeams.push({ teamId, data });
      }
      prevAliveCountRef.current.set(teamId, data.aliveCount);
    });

    if (dyingTeams.length > 0) {
      // Sort dying teams by damage/kills
      dyingTeams.sort((a, b) => b.data.damage - a.data.damage);

      dyingTeams.forEach(({ teamId, data }, idx) => {
        const placement = Math.max(2, aliveTeamsCount + dyingTeams.length - idx);
        const resolvedName = resolveTeamDisplayName(teamId, data.name, config, true);
        enqueueElimination({
          id: `elim-${teamId}-${Date.now()}-${idx}`,
          teamId,
          teamName: resolvedName,
          placement,
          kills: data.kills,
          damage: Math.round(data.damage),
          timestamp: Date.now(),
        });
      });
    }
  }, [activePlayers, config]);

  // Universal OBS Test Trigger Subscriber
  useEffect(() => {
    const unsubscribe = subscribeToObsTestTrigger('elimination', (payload) => {
      const tId = payload.teamId || 1;
      const resolvedName = resolveTeamDisplayName(tId, config.customTeamNames?.[tId] || 'TWISTED MINDS', config, false);
      enqueueElimination({
        id: `obs-test-elim-${Date.now()}`,
        teamId: tId,
        teamName: resolvedName,
        placement: 9,
        kills: 6,
        damage: 1340,
        timestamp: Date.now(),
      });
    });

    // Support testing via ?test_elim=1 or ?test_team=FaZe
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const testElimParam = params.get('test_elim') || params.get('preview');
      const testTeamParam = params.get('test_team');
      if (testElimParam) {
        const place = parseInt(testElimParam, 10);
        enqueueElimination({
          id: `test-preview-${Date.now()}`,
          teamId: 1,
          teamName: testTeamParam || 'TWISTED MINDS',
          placement: isNaN(place) || place < 1 ? 9 : place,
          kills: 6,
          damage: 1240,
          timestamp: Date.now(),
        });
      }
    }

    // BroadcastChannel listener fallback
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('pubg_elim_channel');
        bc.onmessage = (event: MessageEvent) => {
          if (event.data?.type === 'ELIMINATION_TRIGGER') {
            enqueueElimination({
              id: `bc-elim-${Date.now()}`,
              teamId: event.data.teamId || 1,
              teamName: event.data.teamName || 'NAVIGATOR ESPORTS',
              placement: event.data.placement || 9,
              kills: event.data.kills || 5,
              damage: event.data.damage || 880,
              timestamp: Date.now(),
            });
          }
        };
      }
    } catch {}

    const handleCustomTrigger = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail || {};
      enqueueElimination({
        id: `ce-elim-${Date.now()}`,
        teamId: detail.teamId || 1,
        teamName: detail.teamName || 'SONIQS ESPORTS',
        placement: detail.placement || 9,
        kills: detail.kills || 4,
        damage: detail.damage || 790,
        timestamp: Date.now(),
      });
    };
    window.addEventListener('TRIGGER_ELIMINATION_ANIMATION', handleCustomTrigger);

    return () => {
      unsubscribe();
      if (bc) bc.close();
      window.removeEventListener('TRIGGER_ELIMINATION_ANIMATION', handleCustomTrigger);
    };
  }, [config]);

  return (
    <div
      id="obs-team-eliminated-overlay"
      className="fixed inset-0 w-full h-full pointer-events-none select-none overflow-hidden font-sans z-50 bg-transparent"
    >
      {/* Position container: Stacks multiple simultaneous alerts vertically with flex-col gap-3 */}
      <div className={`absolute flex flex-col gap-3 ${positionClasses}`}>
        <AnimatePresence mode="popLayout">
          {activeAlerts.map((alert) => {
            const teamLogo =
              config.teamLogos?.[alert.teamId] ||
              config.teamLogos?.[String(alert.teamId)];
            const flagVal = resolveTeamFlagValue(alert.teamId, config.teamFlags, alert.teamName);

            return (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, y: -25, scale: 0.92, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, scale: 0.92, filter: 'blur(4px)', transition: { duration: 0.25 } }}
                transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                className="relative w-[380px] xs:w-[420px] sm:w-[460px] pointer-events-auto"
              >
                {/* Outer Cyber Neon Aura */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#ff1744] via-[#ff5252] to-[#ff1744] opacity-75 blur-md animate-pulse pointer-events-none" />

                {/* Main Card Frame with High Opacity */}
                <div
                  className="relative rounded-xl overflow-hidden border-2 border-[#ff2a4b] bg-gradient-to-br from-[#120306]/98 via-[#0b0f1a]/96 to-[#1a0509]/98 shadow-[0_12px_36px_rgba(255,23,68,0.55)] backdrop-blur-xl p-3 sm:p-4 text-white"
                  style={{
                    clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
                  }}
                >
                  {/* Diagonal Esports Cyber Corner Accent Lines */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#ff7088] pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#ff7088] pointer-events-none" />

                  {/* Sweeping Shimmer Highlight */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />

                  {/* Top Badge Banner: ELIMINATED Alert & Rank */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#ff2a4b]/40">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#ff1744] flex items-center justify-center shadow-[0_0_12px_#ff1744]">
                        <Skull className="w-4 h-4 text-white animate-bounce" />
                      </div>
                      <span className="font-rajdhani font-black uppercase text-xs sm:text-sm tracking-widest text-[#ff4d6d] flex items-center gap-1 drop-shadow-[0_0_6px_rgba(255,77,109,0.8)]">
                        <span>SQUAD ELIMINATED</span>
                      </span>
                    </div>

                    {/* Placement Rank Pill */}
                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/90 border border-[#FFD700]/70 shadow-[0_0_12px_rgba(255,215,0,0.45)]">
                      <span className="font-rajdhani font-black text-sm sm:text-base text-[#FFD700] tracking-wider">
                        #{alert.placement}
                      </span>
                      <span className="text-[10px] font-bold font-rajdhani uppercase text-slate-300">
                        PLACE
                      </span>
                    </div>
                  </div>

                  {/* Middle: Prominent Team Name, Team Logo & Country Flag */}
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {teamLogo && (
                        <img
                          src={teamLogo}
                          alt=""
                          className="w-9 h-9 sm:w-10 sm:h-10 object-contain flex-shrink-0"
                        />
                      )}
                      {flagVal && (
                        <TeamFlag
                          flagValue={flagVal}
                          teamId={alert.teamId}
                          isWinner={false}
                          className="w-10 h-7 object-cover rounded shadow-md border-2 border-white/60 flex-shrink-0"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h2
                        className="font-rajdhani font-black text-xl sm:text-2xl lg:text-3xl text-white uppercase tracking-wide truncate leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                        title={alert.teamName}
                      >
                        {alert.teamName}
                      </h2>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 mt-0.5">
                        {alert.kills !== undefined && (
                          <span className="flex items-center gap-1 text-[#ff7088]">
                            <Crosshair className="w-3 h-3" />
                            <strong className="text-white font-bold">{alert.kills}</strong> KILLS
                          </span>
                        )}
                        {alert.damage !== undefined && (
                          <span className="text-slate-400">
                            <strong className="text-white font-bold">{alert.damage}</strong> DMG
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Countdown Sweep Bar: Exactly 3 seconds */}
                  <div className="w-full h-1 bg-[#1a0a10] rounded-full overflow-hidden mt-3">
                    <motion.div
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: 3.0, ease: 'linear' }}
                      className="h-full bg-gradient-to-r from-[#ff1744] to-[#ff9100]"
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Broadcaster Quick Test Trigger Toolbar (Discreet corner helper in browser mode) */}
      {activeAlerts.length === 0 && (
        <div className="absolute bottom-3 right-3 opacity-20 hover:opacity-100 transition-opacity flex items-center gap-2 pointer-events-auto bg-black/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-300 font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            OBS Elim Alert Active (3s Stackable)
          </span>
          <button
            onClick={() => {
              enqueueElimination({
                id: `demo-test-${Date.now()}`,
                teamId: 1,
                teamName: 'TWISTED MINDS',
                placement: 9,
                kills: 6,
                damage: 1340,
                timestamp: Date.now(),
              });
            }}
            className="px-2 py-0.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded border border-red-500/40 text-[10px] cursor-pointer"
          >
            Test 3s Alert
          </button>
          <button
            onClick={() => {
              // Simulate 2 teams dying at the same time to test stacking
              const now = Date.now();
              enqueueElimination({
                id: `demo-stack-1-${now}`,
                teamId: 1,
                teamName: 'TWISTED MINDS',
                placement: 9,
                kills: 6,
                damage: 1340,
                timestamp: now,
              });
              setTimeout(() => {
                enqueueElimination({
                  id: `demo-stack-2-${now + 100}`,
                  teamId: 2,
                  teamName: 'FAZE CLAN',
                  placement: 8,
                  kills: 4,
                  damage: 980,
                  timestamp: now + 100,
                });
              }, 150);
            }}
            className="px-2 py-0.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded border border-amber-500/40 text-[10px] cursor-pointer"
          >
            Test Stack (2 Teams)
          </button>
        </div>
      )}
    </div>
  );
};

