import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Flame, Swords, Shield } from 'lucide-react';
import { TournamentConfig } from '../types/pubg';
import { getCountryName } from '../utils/flagHelper';
import { getTournamentBroadcastChannel } from '../utils/storage';
import { TeamFlag } from './TeamFlag';

export interface WinnerCelebrationDetail {
  teamId: number;
  teamName?: string;
  matchNumber?: number;
  timestamp?: number;
}

interface WinnerCelebrationProps {
  config: TournamentConfig;
  liveWinnerTeamId?: number | null;
  liveWinnerTeamName?: string;
}

export const WINNER_CELEBRATION_DURATION_MS = 7000; // Exactly 7 seconds

/**
 * Winner Celebration Animation System
 * When a team wins, reads the winning Team ID, fetches the 4-player squad image
 * from config.teamSquadPics[teamId], slides in dynamically from the right,
 * remains for exactly 7 seconds, and smoothly disappears.
 */
export const WinnerCelebration: React.FC<WinnerCelebrationProps> = ({
  config,
  liveWinnerTeamId,
  liveWinnerTeamName,
}) => {
  const [liveConfig, setLiveConfig] = useState<TournamentConfig>(config);
  useEffect(() => {
    setLiveConfig(config);
  }, [config]);

  // Real-time synchronization of config for flags and names
  useEffect(() => {
    const bc = getTournamentBroadcastChannel();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CONFIG_UPDATED' && event.data?.config) {
        setLiveConfig(event.data.config);
      }
    };
    if (bc) bc.addEventListener('message', handleMessage);

    const handleWindowConfig = (e: CustomEvent) => {
      if (e.detail) setLiveConfig(e.detail);
    };
    window.addEventListener('pubg_config_changed', handleWindowConfig as EventListener);

    return () => {
      if (bc) bc.removeEventListener('message', handleMessage);
      window.removeEventListener('pubg_config_changed', handleWindowConfig as EventListener);
    };
  }, []);

  const [activeCelebration, setActiveCelebration] = useState<WinnerCelebrationDetail | null>(null);
  const [progress, setProgress] = useState(100);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTriggeredWinnerRef = useRef<number | null>(null);

  const startCelebration = (detail: WinnerCelebrationDetail) => {
    // Clear any active timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    setActiveCelebration(detail);
    setProgress(100);

    const startTime = Date.now();
    const endTime = startTime + WINNER_CELEBRATION_DURATION_MS;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const pct = (remaining / WINNER_CELEBRATION_DURATION_MS) * 100;
      setProgress(pct);
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 50);

    timeoutRef.current = setTimeout(() => {
      setActiveCelebration(null);
    }, WINNER_CELEBRATION_DURATION_MS);
  };

  // 1. Listen for custom window event
  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent<WinnerCelebrationDetail>) => {
      if (event.detail && typeof event.detail.teamId === 'number') {
        startCelebration(event.detail);
      }
    };

    const handleCancel = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setActiveCelebration(null);
    };

    window.addEventListener('TRIGGER_WINNER_CELEBRATION' as any, handleCustomEvent);
    window.addEventListener('CANCEL_WINNER_CELEBRATION' as any, handleCancel);
    return () => {
      window.removeEventListener('TRIGGER_WINNER_CELEBRATION' as any, handleCustomEvent);
      window.removeEventListener('CANCEL_WINNER_CELEBRATION' as any, handleCancel);
    };
  }, []);

  // 2. Listen to BroadcastChannel for cross-tab / cross-window triggers (e.g. from Admin Panel to OBS)
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('pubg_winner_celebration_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'WINNER_TRIGGER' && event.data.winner) {
            startCelebration(event.data.winner);
          } else if (event.data?.type === 'WINNER_CANCEL') {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
            setActiveCelebration(null);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error', e);
      }
    }
    return () => {
      if (bc) bc.close();
    };
  }, []);

  // 3. Automatic trigger when a live winner is detected
  useEffect(() => {
    if (liveWinnerTeamId && liveWinnerTeamId !== lastTriggeredWinnerRef.current) {
      lastTriggeredWinnerRef.current = liveWinnerTeamId;
      startCelebration({
        teamId: liveWinnerTeamId,
        teamName: liveWinnerTeamName || `TEAM #${liveWinnerTeamId}`,
        timestamp: Date.now(),
      });
    } else if (!liveWinnerTeamId) {
      lastTriggeredWinnerRef.current = null;
    }
  }, [liveWinnerTeamId, liveWinnerTeamName]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const teamId = activeCelebration?.teamId;
  if (!teamId) return null;

  // Fetch squad image mapped to winning team ID
  const squadPicUrl =
    liveConfig.teamSquadPics?.[teamId] ||
    liveConfig.teamSquadPics?.[String(teamId)];

  const flagValue =
    liveConfig.showTeamFlags !== false
      ? liveConfig.teamFlags?.[teamId] || liveConfig.teamFlags?.[String(teamId)]
      : null;
  const countryName = getCountryName(flagValue);

  const teamName =
    activeCelebration.teamName ||
    liveConfig.customTeamNames?.[teamId] ||
    liveConfig.customTeamNames?.[String(teamId)] ||
    `TEAM #${teamId}`;

  // Chamfer style for celebration card
  const chamferOuterStyle = {
    clipPath:
      'polygon(16px 0%, calc(100% - 16px) 0%, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0% calc(100% - 16px), 0% 16px)',
  };

  return (
    <AnimatePresence>
      {activeCelebration && (
        <div className="fixed top-10 right-4 sm:right-8 z-[100] pointer-events-none select-none max-w-[95vw] sm:max-w-[580px] md:max-w-[620px]">
          <motion.div
            initial={{ x: 500, opacity: 0, scale: 0.95 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 500, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={chamferOuterStyle}
            className="p-[2px] bg-gradient-to-r from-[#1a83c5] via-[#1a83c5] to-[#1a83c5] shadow-[0_0_40px_rgba(26, 131, 197,0.8)]"
          >
            <div
              style={chamferOuterStyle}
              className="relative bg-[#050A1F]/95 backdrop-blur-2xl p-5 border border-[#1a83c5]/40 overflow-hidden"
            >
              {/* Subtle Cyan Geometric Corner Accents */}
              <div className="absolute top-2 left-2 pointer-events-none">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M 0 12 L 0 4 L 4 0 L 12 0" stroke="#1a83c5" strokeWidth="2" />
                </svg>
              </div>
              <div className="absolute top-2 right-2 pointer-events-none">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M 18 12 L 18 4 L 14 0 L 6 0" stroke="#1a83c5" strokeWidth="2" />
                </svg>
              </div>
              <div className="absolute bottom-2 left-2 pointer-events-none">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M 0 6 L 0 14 L 4 18 L 12 18" stroke="#1a83c5" strokeWidth="2" />
                </svg>
              </div>
              <div className="absolute bottom-2 right-2 pointer-events-none">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M 18 6 L 18 14 L 14 18 L 6 18" stroke="#1a83c5" strokeWidth="2" />
                </svg>
              </div>

              {/* Header Title: Bold heavy condensed sans-serif */}
              <div className="flex items-center justify-between gap-3 mb-3 border-b border-[#1a83c5]/30 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1a83c5] flex items-center justify-center text-white shadow-[0_0_12px_rgba(26, 131, 197,0.8)]">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono tracking-widest text-[#1a83c5] uppercase font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1a83c5] animate-ping" />
                      WINNER WINNER CHICKEN DINNER
                    </div>
                    <h3 className="text-xl sm:text-2xl font-rajdhani font-black uppercase tracking-wider text-white leading-none">
                      MATCH CHAMPIONS
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {flagValue && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0A1535] border border-[#1a83c5]/60 rounded-md shadow-sm">
                      <TeamFlag
                        flagValue={flagValue}
                        teamId={teamId}
                        isWinner={true}
                        className="w-5 h-3.5 object-cover rounded-[2px] border border-white/20 flex-shrink-0"
                      />
                      <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                        {countryName}
                      </span>
                    </div>
                  )}
                  <div className="px-3 py-1 bg-[#1a83c5]/20 border border-[#1a83c5] text-white font-rajdhani font-black text-sm tracking-wider uppercase rounded-md shadow-[0_0_8px_rgba(26, 131, 197,0.4)]">
                    #1 RANK
                  </div>
                </div>
              </div>

              {/* 4-Player Squad Picture Display - Enlarged hero frame */}
              <div
                className={`relative w-full rounded-xl overflow-hidden mb-3 ${
                  squadPicUrl ? 'border-0' : 'border border-[#1a83c5] shadow-inner'
                }`}
                style={{ background: 'transparent' }}
              >
                {squadPicUrl ? (
                  <div
                    className="relative w-full h-[280px] sm:h-[340px] overflow-hidden flex items-center justify-center"
                    style={{ background: 'transparent' }}
                  >
                    <img
                      src={squadPicUrl}
                      alt={`${teamName} 4-Player Squad`}
                      className="w-full h-full object-contain object-center filter contrast-105 transition-transform duration-700 hover:scale-105 drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)]"
                      referrerPolicy="no-referrer"
                      style={{ background: 'transparent' }}
                    />
                  </div>
                ) : (
                  /* High-Tech Fallback Squad Graphic if no picture uploaded yet */
                  <div className="w-full h-[220px] sm:h-[260px] flex flex-col items-center justify-center bg-gradient-to-br from-[#0A1535] to-[#050A1F] p-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#1a83c5]/20 border border-[#1a83c5] flex items-center justify-center text-[#1a83c5] mb-2 shadow-[0_0_15px_rgba(26, 131, 197,0.4)]">
                      <Shield className="w-10 h-10" />
                    </div>
                    <span className="text-white font-rajdhani font-bold text-base uppercase tracking-wider">
                      4-PLAYER SQUAD ROSTER
                    </span>
                    <span className="text-xs text-[#1a83c5] font-mono mt-0.5">
                      Upload Squad Picture in Admin &gt; Teams Pics &amp; Flags
                    </span>
                  </div>
                )}

                {/* Team Info Overlay Bar */}
                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-[#050A1F] via-[#050A1F]/90 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {flagValue && (
                      <TeamFlag
                        flagValue={flagValue}
                        teamId={teamId}
                        isWinner={true}
                        className="w-7 h-4.5 object-cover rounded-[2px] border border-white/30 shadow-md flex-shrink-0"
                      />
                    )}
                    <span className="text-white font-sans font-bold text-base sm:text-lg truncate tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {teamName}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-[#1a83c5] font-bold uppercase tracking-wider bg-[#0A1535]/80 px-2 py-0.5 rounded border border-[#1a83c5]/40">
                    TEAM {teamId}
                  </span>
                </div>
              </div>

              {/* 7-Second Countdown Timer Bar */}
              <div className="w-full bg-[#0A1535] h-1.5 rounded-full overflow-hidden border border-[#1a83c5]/30">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#1a83c5] to-[#1a83c5]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-[#1a83c5] mt-1.5 px-0.5">
                <span>SLIDE-IN WINNER CELEBRATION</span>
                <span>{( (progress * WINNER_CELEBRATION_DURATION_MS) / 100000 ).toFixed(1)}s</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
