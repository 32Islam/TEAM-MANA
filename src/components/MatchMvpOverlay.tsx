import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Crown,
  Crosshair,
  Flame,
  Zap,
  Target,
  ShieldCheck,
  Award,
  Sparkles,
  Users,
  User,
  ChevronRight,
} from 'lucide-react';
import {
  PlayerRawInfo,
  SavedMatch,
  TournamentConfig,
  CumulativeTeamStats,
  CumulativePlayerStats,
  TeamMatchScore,
} from '../types/pubg';
import { resolveTeamDisplayName, getTeamColor } from '../utils/pubgCalculations';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { subscribeToObsTestTrigger } from '../utils/storage';
import { TeamFlag } from './TeamFlag';
import { VirtuocityLogo } from './VirtuocityLogo';

interface MatchMvpOverlayProps {
  config: TournamentConfig;
  savedMatches?: SavedMatch[];
  activePlayers?: PlayerRawInfo[];
  teamStandings?: CumulativeTeamStats[];
  playerStandings?: CumulativePlayerStats[];
  onManualRefresh?: () => void;
  isStandaloneObs?: boolean;
  onUpdateConfig?: (cfg: TournamentConfig) => void;
}

export interface ComputedMvpProfile {
  uId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  kills: number;
  damage: number;
  headshots: number;
  knockouts: number;
  assists: number;
  heal: number;
  survivalTime: number; // in seconds
  matchesPlayed: number;
  wins: number;
  avgDamage: number;
  avgKills: number;
  placement: number;
  isWinner: boolean;
  mvpRating: number;
  picUrl?: string;
}

// Format seconds into MM:SS
function formatSurvivalTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '27:47';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const MatchMvpOverlay: React.FC<MatchMvpOverlayProps> = ({
  config,
  savedMatches = [],
  activePlayers = [],
  playerStandings = [],
  isStandaloneObs = false,
}) => {
  // 1. Determine Scope ('latest' or 'all') from URL query, config, or initial state
  const initialScope = useMemo<'latest' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const scopeParam = params.get('scope') || params.get('mode') || params.get('type');
      const layoutParam = params.get('layout');
      if (
        scopeParam === 'all' ||
        scopeParam === 'tournament' ||
        scopeParam === 'overall' ||
        layoutParam === 'mvp_all' ||
        layoutParam === 'tournament_mvp'
      ) {
        return 'all';
      }
      if (scopeParam === 'latest' || layoutParam === 'mvp_match') {
        return 'latest';
      }
    }
    return config.mvpOverlayScope || 'latest';
  }, [config.mvpOverlayScope]);

  // 2. Determine Variant ('fullscreen' or 'popup')
  const initialVariant = useMemo<'fullscreen' | 'popup'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const variantParam = params.get('variant') || params.get('size');
      const layoutParam = params.get('layout');
      if (
        variantParam === 'popup' ||
        variantParam === 'small' ||
        layoutParam === 'mvp_popup' ||
        layoutParam === 'mvp_small'
      ) {
        return 'popup';
      }
      if (variantParam === 'fullscreen' || variantParam === 'full') {
        return 'fullscreen';
      }
    }
    return config.mvpOverlayVariant || 'fullscreen';
  }, [config.mvpOverlayVariant]);

  // 3. Position for popup
  const popupPosition = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('pos') || 'bottom-right';
    }
    return 'bottom-right';
  }, []);

  const [scope, setScope] = useState<'latest' | 'all'>(initialScope);
  const [variant, setVariant] = useState<'fullscreen' | 'popup'>(initialVariant);
  // User directive: "Make the small MVP popup overlay appear only when triggered, but the full screen one to be appearing all the time."
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (initialVariant === 'popup') return false;
    return true;
  });
  const [showContendersDrawer, setShowContendersDrawer] = useState<boolean>(false);

  // Sync with remote BroadcastChannel from Admin Panel
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('pubg_mvp_channel');
        bc.onmessage = (event: MessageEvent) => {
          const data = event.data;
          if (!data) return;
          if (data.type === 'SET_MVP_SCOPE' && (data.scope === 'latest' || data.scope === 'all')) {
            setScope(data.scope);
          } else if (data.type === 'SET_MVP_VARIANT' && (data.variant === 'fullscreen' || data.variant === 'popup')) {
            setVariant(data.variant);
            if (data.variant === 'fullscreen') {
              setIsVisible(true);
            }
          } else if (data.type === 'SET_MVP_VISIBILITY' && typeof data.visible === 'boolean') {
            setIsVisible(data.visible);
          }
        };
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pubg_mvp_scope_remote' && e.newValue) {
        if (e.newValue === 'latest' || e.newValue === 'all') {
          setScope(e.newValue);
        }
      } else if (e.key === 'pubg_mvp_variant_remote' && e.newValue) {
        if (e.newValue === 'fullscreen' || e.newValue === 'popup') {
          setVariant(e.newValue);
          if (e.newValue === 'fullscreen') {
            setIsVisible(true);
          }
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    let testTimer: any = null;
    const unsubscribe = subscribeToObsTestTrigger('mvp', (payload) => {
      setIsVisible(true);
      const dur = (payload.durationSeconds || 20) * 1000;
      if (testTimer) clearTimeout(testTimer);
      testTimer = setTimeout(() => {
        // Only auto-hide if small popup
        if (variant === 'popup' || initialVariant === 'popup') {
          setIsVisible(false);
        }
      }, dur);
    });

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      unsubscribe();
      if (testTimer) clearTimeout(testTimer);
    };
  }, [variant, initialVariant]);

  // Ranked saved matches
  const rankedMatches = useMemo(
    () => savedMatches.filter((m) => !m.excludeFromLeaderboard),
    [savedMatches]
  );
  const latestSavedMatch = rankedMatches.length > 0 ? rankedMatches[rankedMatches.length - 1] : null;

  // Helper: Resolve player portrait by UID
  const getPlayerPortrait = (uId: number | string | undefined, apiPicUrl?: string) => {
    const uidStr = String(uId || '').trim();
    if (uidStr && config.playerPortraits && config.playerPortraits[uidStr]) {
      return config.playerPortraits[uidStr];
    }
    if (apiPicUrl && apiPicUrl.trim()) {
      return apiPicUrl.trim();
    }
    if (config.defaultPlayerPortraitUrl && config.defaultPlayerPortraitUrl.trim()) {
      return config.defaultPlayerPortraitUrl.trim();
    }
    return null;
  };

  // 1. Compute Latest Match MVP
  const latestMatchData = useMemo(() => {
    let players: PlayerRawInfo[] = [];
    let matchNumber = 1;
    let mapName = 'Erangel';
    let teamScores: Record<number, TeamMatchScore> = {};

    const hasLiveStats = activePlayers.some((p) => (p.killNum || 0) > 0 || (p.damage || 0) > 0);

    if (hasLiveStats) {
      players = activePlayers;
      matchNumber = rankedMatches.length + 1;
    } else if (latestSavedMatch) {
      players = latestSavedMatch.playerSnapshots || [];
      matchNumber = latestSavedMatch.matchNumber;
      mapName = latestSavedMatch.mapName || 'Erangel';
      teamScores = latestSavedMatch.teamScores || {};
    }

    if (!players || players.length === 0) {
      // Demo MVP mirroring the official esports screenshot (RETRO / 4 Elims / 329 Dmg / 1 Knock / 27:47)
      const demoMvp: ComputedMvpProfile = {
        uId: 512538234,
        playerName: 'RETRO',
        teamId: 1,
        teamName: 'FALCONS ESPORTS',
        kills: 4,
        damage: 329,
        headshots: 2,
        knockouts: 1,
        assists: 0,
        heal: 216,
        survivalTime: 1667, // 27:47
        matchesPlayed: 1,
        wins: 1,
        avgDamage: 329,
        avgKills: 4,
        placement: 1,
        isWinner: true,
        mvpRating: 94.6,
      };
      const demoContenders: ComputedMvpProfile[] = [
        {
          uId: 512538235,
          playerName: 'BatulinS',
          teamId: 2,
          teamName: 'TWISTED MINDS',
          kills: 3,
          damage: 285,
          headshots: 1,
          knockouts: 2,
          assists: 1,
          heal: 180,
          survivalTime: 1540,
          matchesPlayed: 1,
          wins: 0,
          avgDamage: 285,
          avgKills: 3,
          placement: 2,
          isWinner: false,
          mvpRating: 82.4,
        },
        {
          uId: 512538236,
          playerName: 'Pio',
          teamId: 3,
          teamName: 'GEN.G',
          kills: 3,
          damage: 240,
          headshots: 2,
          knockouts: 1,
          assists: 2,
          heal: 95,
          survivalTime: 1420,
          matchesPlayed: 1,
          wins: 0,
          avgDamage: 240,
          avgKills: 3,
          placement: 3,
          isWinner: false,
          mvpRating: 76.8,
        },
        {
          uId: 512538237,
          playerName: 'Gustav',
          teamId: 4,
          teamName: 'FAZE CLAN',
          kills: 2,
          damage: 195,
          headshots: 1,
          knockouts: 2,
          assists: 1,
          heal: 120,
          survivalTime: 1290,
          matchesPlayed: 1,
          wins: 0,
          avgDamage: 195,
          avgKills: 2,
          placement: 4,
          isWinner: false,
          mvpRating: 71.2,
        },
      ];
      return { mvp: demoMvp, contenders: demoContenders, matchNumber: 1, mapName: 'Erangel', isLive: false };
    }

    const scoredPlayers: ComputedMvpProfile[] = players.map((p) => {
      const kills = p.killNum || 0;
      const damage = Math.round(p.damage || 0);
      const headshots = p.headShotNum || 0;
      const knocks = p.knockouts !== undefined ? p.knockouts : Math.max(0, kills - 1);
      const assists = p.assists || 0;
      const heal = Math.round(p.heal || 0);
      const teamScore = teamScores[p.teamId];
      const isWinner = Boolean(teamScore?.isWinner || (p.rank === 1 && !p.bHasDied));
      const placement = teamScore?.placement || (p.rank && p.rank > 0 ? p.rank : 9);

      // Survival time in seconds
      let survivalTime = p.survivalTime || 0;
      if (!survivalTime || survivalTime <= 0) {
        survivalTime = isWinner ? 1667 : Math.max(480, Math.round(1750 - placement * 85));
      }

      const rawScore = kills * 35 + damage * 0.12 + headshots * 8 + (isWinner ? 45 : Math.max(0, 20 - placement * 1.5));
      const normalizedRating = Math.min(99.9, Math.max(50.0, +(rawScore / 3.8).toFixed(1)));

      const resolvedTeamName = resolveTeamDisplayName(p.teamId, p.teamName, config, hasLiveStats);

      return {
        uId: p.uId,
        playerName: p.playerName,
        teamId: p.teamId,
        teamName: resolvedTeamName,
        kills,
        damage,
        headshots,
        knockouts: knocks,
        assists,
        heal,
        survivalTime,
        matchesPlayed: 1,
        wins: isWinner ? 1 : 0,
        avgDamage: damage,
        avgKills: kills,
        placement,
        isWinner,
        mvpRating: normalizedRating,
        picUrl: p.picUrl,
      };
    });

    scoredPlayers.sort((a, b) => {
      if (b.mvpRating !== a.mvpRating) return b.mvpRating - a.mvpRating;
      if (b.kills !== a.kills) return b.kills - a.kills;
      return b.damage - a.damage;
    });

    return {
      mvp: scoredPlayers[0],
      contenders: scoredPlayers.slice(1, 5),
      matchNumber,
      mapName,
      isLive: hasLiveStats,
    };
  }, [activePlayers, latestSavedMatch, rankedMatches, config]);

  // 2. Compute Tournament MVP (Overall)
  const tournamentMvpData = useMemo(() => {
    if (playerStandings && playerStandings.length > 0) {
      const scored: ComputedMvpProfile[] = playerStandings.map((p) => {
        const matches = p.matchesPlayed || Math.max(1, rankedMatches.length);
        const kills = p.totalKills || 0;
        const damage = Math.round(p.totalDamage || 0);
        const headshots = p.totalHeadshots || 0;
        const knockouts = p.totalKnockouts || 0;
        const assists = p.totalAssists || 0;
        const avgDmg = +(damage / matches).toFixed(1);
        const avgK = +(kills / matches).toFixed(1);
        const heal = Math.round(p.totalDamage ? p.totalDamage * 0.22 : 216);
        const survivalTime = 1600;

        const rawScore = kills * 30 + damage * 0.1 + avgDmg * 0.18 + headshots * 5;
        const normalizedRating = Math.min(99.9, Math.max(55.0, +(rawScore / (matches * 4.2)).toFixed(1)));

        const resolvedTeamName = resolveTeamDisplayName(p.teamId, p.teamName, config, false);

        return {
          uId: p.uId,
          playerName: p.playerName,
          teamId: p.teamId,
          teamName: resolvedTeamName,
          kills,
          damage,
          headshots,
          knockouts,
          assists,
          heal,
          survivalTime,
          matchesPlayed: matches,
          wins: 0,
          avgDamage: avgDmg,
          avgKills: avgK,
          placement: 1,
          isWinner: false,
          mvpRating: normalizedRating,
        };
      });

      scored.sort((a, b) => {
        if (b.mvpRating !== a.mvpRating) return b.mvpRating - a.mvpRating;
        if (b.kills !== a.kills) return b.kills - a.kills;
        return b.damage - a.damage;
      });

      return {
        mvp: scored[0] || latestMatchData.mvp,
        contenders: scored.slice(1, 5),
        totalMatches: rankedMatches.length,
      };
    }

    return {
      mvp: latestMatchData.mvp,
      contenders: latestMatchData.contenders,
      totalMatches: Math.max(1, rankedMatches.length),
    };
  }, [playerStandings, rankedMatches, config, latestMatchData]);

  // User Directive: "Make the small MVP popup overlay appear only when triggered, but the full screen one to be appearing all the time."
  if (variant === 'popup' && !isVisible) {
    return <div className="w-full min-h-screen bg-transparent pointer-events-none" />;
  }

  const activeMvp = scope === 'latest' ? latestMatchData.mvp : tournamentMvpData.mvp;
  const activeContenders = scope === 'latest' ? latestMatchData.contenders : tournamentMvpData.contenders;
  const teamFlagVal = resolveTeamFlagValue(activeMvp.teamId, config.teamFlags, activeMvp.teamName);
  const mvpPortraitUrl = getPlayerPortrait(activeMvp.uId, activeMvp.picUrl);

  const stageName = (config.name || 'PUBG ESPORTS').toUpperCase();
  const matchSubtitle =
    scope === 'latest'
      ? `MATCH ${latestMatchData.matchNumber}`
      : `ALL MATCHES (${tournamentMvpData.totalMatches || 1} GAMES)`;

  // =========================================================================
  // VARIANT 1: SMALL POP-UP CORNER CARD (Lower-third / HUD Pop-up)
  // Matching the exact new theme: White ELIMS box, Dark Damage/Knocks, Cyan MVP & Banner
  // =========================================================================
  if (variant === 'popup') {
    const positionClasses = {
      'bottom-right': 'items-end justify-end p-6 sm:p-8',
      'bottom-left': 'items-end justify-start p-6 sm:p-8',
      'top-right': 'items-start justify-end p-6 sm:p-8',
      'top-left': 'items-start justify-start p-6 sm:p-8',
      'top-center': 'items-start justify-center p-6 sm:p-8',
      center: 'items-center justify-center p-4',
    }[popupPosition] || 'items-end justify-end p-6 sm:p-8';

    return (
      <div className={`fixed inset-0 pointer-events-none flex ${positionClasses} z-50 overflow-hidden font-sans select-none bg-transparent`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 35 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 35 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className="pointer-events-auto relative w-full max-w-[620px] rounded-2xl bg-[#030914]/98 border-2 border-[#1a83c5]/80 p-4 sm:p-5 shadow-[0_15px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(0,210,255,0.3)] backdrop-blur-xl overflow-hidden"
        >
          {/* Cyber Chevrons Accent Texture */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-[#00d2ff]/10 to-transparent pointer-events-none rounded-bl-full" />
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00d2ff] to-transparent" />

          {/* TOP HEADER: MVP + STAGE & MATCH */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#1a83c5]/30">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-['Rajdhani',sans-serif] font-black tracking-tighter text-[#00d2ff] drop-shadow-[0_0_12px_rgba(0,210,255,0.6)]">
                MVP
              </span>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-['Rajdhani',sans-serif] font-black text-white tracking-widest leading-none">
                  {stageName}
                </span>
                <span className="text-xs sm:text-sm font-['Rajdhani',sans-serif] font-black text-[#00d2ff] tracking-widest leading-none mt-0.5">
                  {matchSubtitle}
                </span>
              </div>
            </div>

            {/* Virtuocity Logo */}
            <VirtuocityLogo size="sm" customUrl={config.logoUrl} glow={false} className="max-h-7 max-w-[90px]" />
          </div>

          {/* MAIN BODY: PORTRAIT & EXACT STAT BOX */}
          <div className="flex items-end gap-3 mt-3 relative">
            {/* Player Portrait */}
            <div className="relative flex-shrink-0 w-28 sm:w-36 h-36 sm:h-44 flex items-end justify-center z-10">
              <div className="absolute inset-0 bg-[#00d2ff]/15 blur-xl rounded-full scale-105 pointer-events-none" />
              {mvpPortraitUrl ? (
                <img
                  src={mvpPortraitUrl}
                  alt={activeMvp.playerName}
                  className="max-h-full max-w-full object-contain object-bottom drop-shadow-[0_8px_16px_rgba(0,0,0,0.95)]"
                  style={{ background: 'transparent' }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-end pb-2">
                  <User className="w-20 h-20 sm:w-24 sm:h-24 text-[#00d2ff] drop-shadow-[0_0_15px_rgba(0,210,255,0.5)]" />
                  <span className="text-[9px] font-mono text-[#00d2ff] font-bold uppercase bg-black/80 px-2 py-0.5 rounded border border-[#00d2ff]/50">
                    UID #{activeMvp.uId}
                  </span>
                </div>
              )}
            </div>

            {/* Stat Box + Identity */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              {/* THE EXACT STAT BOX */}
              <div className="relative rounded-lg overflow-hidden border border-[#1a83c5]/50 bg-[#061224] shadow-lg">
                {/* Top Row: White ELIMS + Dark DAMAGE / KNOCKS */}
                <div className="flex items-stretch border-b border-[#1a83c5]/30">
                  {/* ELIMS (Crisp White Card) */}
                  <div className="w-[36%] bg-white p-2 flex flex-col items-center justify-center">
                    <span className="text-[10px] sm:text-xs font-['Barlow',sans-serif] font-black text-[#050d1a] tracking-wider uppercase">
                      ELIMS
                    </span>
                    <span className="text-3xl sm:text-4xl font-['Rajdhani',sans-serif] font-black text-[#0099dd] leading-none">
                      {activeMvp.kills}
                    </span>
                  </div>

                  {/* DAMAGE / KNOCKS (Dark Card) */}
                  <div className="flex-1 bg-[#061224] px-2.5 py-1.5 flex items-center justify-around">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] sm:text-[10px] font-['Barlow',sans-serif] font-bold text-slate-200 tracking-wider uppercase">
                        DAMAGE
                      </span>
                      <span className="text-xl sm:text-2xl font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-0.5">
                        {activeMvp.damage}
                      </span>
                    </div>

                    <span className="text-xl font-light text-slate-500/70 select-none">/</span>

                    <div className="flex flex-col items-center">
                      <span className="text-[9px] sm:text-[10px] font-['Barlow',sans-serif] font-bold text-slate-200 tracking-wider uppercase">
                        KNOCKS
                      </span>
                      <span className="text-xl sm:text-2xl font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-0.5">
                        {activeMvp.knockouts}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Assists / Healing Done / Survival Time */}
                <div className="bg-[#030914] px-2 py-1.5 grid grid-cols-3 gap-1 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] sm:text-[9px] font-['Barlow',sans-serif] font-bold text-slate-400 uppercase">
                      ASSISTS
                    </span>
                    <span className="text-sm sm:text-base font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-0.5">
                      {activeMvp.assists}
                    </span>
                  </div>

                  <div className="flex flex-col items-center border-x border-[#1a83c5]/20">
                    <span className="text-[8px] sm:text-[9px] font-['Barlow',sans-serif] font-bold text-slate-400 uppercase truncate">
                      HEALING DONE
                    </span>
                    <span className="text-sm sm:text-base font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-0.5">
                      {activeMvp.heal || 216}
                    </span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[8px] sm:text-[9px] font-['Barlow',sans-serif] font-bold text-slate-400 uppercase truncate">
                      SURVIVAL TIME
                    </span>
                    <span className="text-sm sm:text-base font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-0.5">
                      {formatSurvivalTime(activeMvp.survivalTime)}
                    </span>
                  </div>
                </div>

                {/* Vertical Angled Cyan Accent Tab on Far Right */}
                <div className="absolute top-0 right-0 bottom-0 w-2 bg-[#00d2ff]" />
              </div>

              {/* Slanted Player Identity Banner with Team Logo & Flag */}
              <div
                className="relative px-4 py-1.5 flex items-center gap-2.5 rounded-sm shadow-md overflow-hidden"
                style={{
                  background: 'linear-gradient(90deg, #00d2ff 0%, #1a83c5 100%)',
                  clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
                }}
              >
                {(() => {
                  const teamLogo =
                    config.teamLogos?.[activeMvp.teamId] ||
                    config.teamSquadPics?.[activeMvp.teamId];
                  return (
                    <>
                      {teamLogo && (
                        <img
                          src={teamLogo}
                          alt=""
                          className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
                        />
                      )}
                      {teamFlagVal && (
                        <TeamFlag
                          flagValue={teamFlagVal}
                          className="w-6 h-4 object-cover rounded-[1px] shadow-sm border border-black/30 flex-shrink-0"
                        />
                      )}
                    </>
                  );
                })()}
                <span className="text-base sm:text-lg font-['Rajdhani',sans-serif] font-black text-black uppercase tracking-wider truncate">
                  {activeMvp.playerName}
                </span>
                <span className="text-[10px] font-mono font-bold text-black/70 truncate ml-auto">
                  {activeMvp.teamName}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // =========================================================================
  // VARIANT 2: FULL SCREEN 1080P BROADCAST STAGE OVERLAY
  // Replicating the official PUBG Mobile Esports Match MVP graphic:
  // - Background: Dark midnight esports blue with subtle angled chevrons & glow
  // - Top Header: Giant "MVP" in Electric Cyan + Stage & Match label
  // - Left: Tall Player cutout with ambient backlight
  // - Center-Right: Exact Stat Box (White ELIMS card, Dark Damage/Knocks with slash, bottom bar for Assists, Healing Done, Survival Time, and Far-Right Cyan Tab)
  // - Bottom Banner: Sheared Electric Cyan Banner with Flag, Team Crest, and Bold Player Name
  // - Bottom Right: Tech Sponsor / Device Slot with official PUBG Mobile Esports Badge
  // =========================================================================
  return (
    <div
      id="obs-match-mvp-fullscreen"
      className="relative w-full min-h-screen bg-[#030814] text-white select-none overflow-hidden flex flex-col justify-between p-6 sm:p-10 lg:p-12 font-sans"
    >
      {/* 1. ESPORTS BACKGROUND THEME (Midnight Navy with subtle angled chevrons) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#06152b] via-[#030914] to-[#02050c] pointer-events-none" />

      {/* Angled Tech Chevron Stripes Texture (Top-Left & Right) */}
      <svg
        className="absolute -top-12 -left-12 w-[650px] h-[650px] opacity-10 pointer-events-none"
        viewBox="0 0 600 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="#00d2ff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50 150 L180 50 L180 200 L50 300 Z" opacity="0.4" fill="#00d2ff" fillOpacity="0.05" />
          <path d="M120 220 L250 120 L250 270 L120 370 Z" opacity="0.6" fill="#00d2ff" fillOpacity="0.07" />
          <path d="M190 290 L320 190 L320 340 L190 440 Z" opacity="0.8" fill="#00d2ff" fillOpacity="0.1" />
        </g>
      </svg>

      {/* Cyber Grid Lines & Ambient Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00d2ff08_1px,transparent_1px),linear-gradient(to_bottom,#00d2ff08_1px,transparent_1px)] bg-[size:56px_56px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/5 w-[550px] h-[550px] bg-[#00d2ff]/12 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[#1a83c5]/15 rounded-full blur-[160px] pointer-events-none" />

      {/* Diagonal Tech Split Line */}
      <div
        className="absolute top-0 right-0 bottom-0 w-[42%] bg-gradient-to-bl from-[#051833]/30 via-transparent to-transparent pointer-events-none"
        style={{ clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)' }}
      />

      {/* 2. TOP HEADER SECTION: Giant "MVP" in Electric Cyan + Stage & Match Labels */}
      <header className="relative z-20 w-full flex items-start justify-end pr-4 sm:pr-10 pt-2 sm:pt-4">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* GIANT "MVP" TITLE */}
          <h1
            className="text-7xl sm:text-8xl md:text-9xl lg:text-[145px] font-['Rajdhani',sans-serif] font-black tracking-tighter leading-none select-none text-[#00d2ff] drop-shadow-[0_0_25px_rgba(0,210,255,0.7)]"
            style={{
              textShadow: '0 0 35px rgba(0, 210, 255, 0.6), 0 4px 15px rgba(0,0,0,0.9)',
            }}
          >
            MVP
          </h1>

          {/* STAGE & MATCH NAME LOCKUP */}
          <div className="flex flex-col justify-center -space-y-1 sm:-space-y-2">
            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-['Rajdhani',sans-serif] font-black text-white tracking-widest uppercase leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              {stageName}
            </span>
            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-['Rajdhani',sans-serif] font-black text-[#00d2ff] tracking-widest uppercase leading-none mt-1 drop-shadow-[0_0_15px_rgba(0,210,255,0.6)]">
              {matchSubtitle}
            </span>
          </div>
        </div>
      </header>

      {/* 3. MAIN CENTER STAGE: Player Cutout (Left) + Exact Stat Box (Center-Right) */}
      <main className="relative z-20 w-full flex-1 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-12 my-auto px-2 sm:px-6">
        {/* LEFT: HERO PLAYER CUTOUT */}
        <div className="relative w-full lg:w-[48%] h-[420px] sm:h-[520px] md:h-[600px] lg:h-[680px] flex items-end justify-center lg:justify-start">
          {/* Soft ambient back-light glow behind player head/body */}
          <div className="absolute bottom-16 left-1/4 w-[360px] h-[460px] bg-gradient-to-t from-[#00d2ff]/25 via-[#1a83c5]/15 to-transparent blur-3xl rounded-full pointer-events-none" />

          {/* Player Cutout Image */}
          <div className="relative w-full h-full flex items-end justify-center lg:justify-start overflow-visible z-10">
            {mvpPortraitUrl ? (
              <img
                src={mvpPortraitUrl}
                alt={activeMvp.playerName}
                className="max-h-full max-w-full object-contain object-bottom drop-shadow-[0_25px_50px_rgba(0,0,0,0.98)] filter"
                style={{ background: 'transparent' }}
              />
            ) : (
              /* Fallback Cyber Silhouette */
              <div className="w-full h-full flex flex-col items-center justify-end pb-24 text-center">
                <User className="w-56 h-56 sm:w-64 sm:h-64 text-[#00d2ff] drop-shadow-[0_0_35px_rgba(0,210,255,0.7)]" />
                <span className="text-sm font-mono text-[#00d2ff] font-bold uppercase bg-black/90 px-4 py-1 rounded-full border border-[#00d2ff]/60 -mt-4 shadow-2xl">
                  UID #{activeMvp.uId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: THE STAT BOX & SPONSOR BADGE */}
        <div className="w-full lg:w-[52%] flex flex-col items-start lg:items-end justify-center gap-6">
          {/* THE SIGNATURE ESPORTS STAT BOX */}
          <div className="relative w-full max-w-[660px] rounded-xl overflow-hidden border-2 border-[#1a83c5]/60 bg-[#061224] shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(0,210,255,0.2)]">
            {/* ROW 1: TOP STATS (White ELIMS Card + Dark DAMAGE & KNOCKS with Slanted Slash) */}
            <div className="flex items-stretch border-b-2 border-[#1a83c5]/30">
              {/* 1. ELIMS BOX (Crisp High-Contrast White Card) */}
              <div className="w-[34%] sm:w-[32%] bg-white px-4 sm:px-6 py-4 sm:py-5 flex flex-col items-center justify-center text-center shadow-inner">
                <span className="text-xs sm:text-sm lg:text-base font-['Barlow',sans-serif] font-black text-[#050d1a] tracking-wider uppercase">
                  ELIMS
                </span>
                <span
                  className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-['Rajdhani',sans-serif] font-black text-[#008ec9] leading-none mt-1 tracking-tight"
                  style={{ textShadow: '0 2px 10px rgba(0, 142, 201, 0.25)' }}
                >
                  {activeMvp.kills}
                </span>
              </div>

              {/* 2. DAMAGE & KNOCKS BOX (Dark Tech Backdrop with Slash Divider) */}
              <div className="flex-1 bg-[#061224] px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-around">
                {/* DAMAGE SUB-STAT */}
                <div className="flex flex-col items-center text-center">
                  <span className="text-xs sm:text-sm lg:text-base font-['Barlow',sans-serif] font-bold text-slate-200 tracking-wider uppercase">
                    DAMAGE
                  </span>
                  <span
                    className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-1 drop-shadow-[0_0_15px_rgba(0,210,255,0.6)]"
                  >
                    {activeMvp.damage.toLocaleString()}
                  </span>
                </div>

                {/* SLANTED SLASH DIVIDER */}
                <span className="text-3xl sm:text-4xl lg:text-5xl font-light text-slate-500/70 select-none px-2 sm:px-4">
                  /
                </span>

                {/* KNOCKS SUB-STAT */}
                <div className="flex flex-col items-center text-center">
                  <span className="text-xs sm:text-sm lg:text-base font-['Barlow',sans-serif] font-bold text-slate-200 tracking-wider uppercase">
                    KNOCKS
                  </span>
                  <span
                    className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-1 drop-shadow-[0_0_15px_rgba(0,210,255,0.6)]"
                  >
                    {activeMvp.knockouts}
                  </span>
                </div>
              </div>
            </div>

            {/* ROW 2: BOTTOM STATS (Assists | Healing Done | Survival Time) */}
            <div className="bg-[#030914] px-4 sm:px-8 py-3 sm:py-4 grid grid-cols-3 gap-2 sm:gap-4 text-center">
              {/* ASSISTS */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] sm:text-xs lg:text-sm font-['Barlow',sans-serif] font-bold text-slate-300 tracking-wider uppercase">
                  ASSISTS
                </span>
                <span className="text-2xl sm:text-3xl lg:text-4xl font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-1">
                  {activeMvp.assists}
                </span>
              </div>

              {/* HEALING DONE */}
              <div className="flex flex-col items-center border-x border-[#1a83c5]/30 px-2">
                <span className="text-[10px] sm:text-xs lg:text-sm font-['Barlow',sans-serif] font-bold text-slate-300 tracking-wider uppercase truncate">
                  HEALING DONE
                </span>
                <span className="text-2xl sm:text-3xl lg:text-4xl font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-1">
                  {activeMvp.heal || 216}
                </span>
              </div>

              {/* SURVIVAL TIME */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] sm:text-xs lg:text-sm font-['Barlow',sans-serif] font-bold text-slate-300 tracking-wider uppercase truncate">
                  SURVIVAL TIME
                </span>
                <span className="text-2xl sm:text-3xl lg:text-4xl font-['Rajdhani',sans-serif] font-black text-[#00d2ff] leading-none mt-1">
                  {formatSurvivalTime(activeMvp.survivalTime)}
                </span>
              </div>
            </div>

            {/* VERTICAL ANGLED ACCENT TAB ON FAR RIGHT (Signature Official Detail) */}
            <div
              className="absolute top-0 right-0 bottom-0 w-3 sm:w-3.5 bg-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.8)]"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 35% 100%)',
              }}
            />
          </div>
        </div>
      </main>

      {/* 4. FOOTER SECTION: Slanted Player Banner (Left-Center) & Sponsor/Device with Official Badge (Right) */}
      <footer className="relative z-30 w-full flex flex-col md:flex-row items-center md:items-end justify-between gap-6 pb-2">
        {/* SLANTED PLAYER IDENTITY BANNER */}
        <div className="relative flex flex-col items-start w-full md:w-auto">
          {/* Sheared Banner Card */}
          <div
            className="relative px-6 sm:px-10 py-3 sm:py-3.5 flex items-center gap-3 sm:gap-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, #00d2ff 0%, #00c4ed 50%, #1a83c5 100%)',
              clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
              minWidth: 'min(500px, 92vw)',
            }}
          >
            {/* Country Flag & Team Crest / Logo Badge */}
            {teamFlagVal && (
              <TeamFlag
                flagValue={teamFlagVal}
                className="w-9 h-6 sm:w-11 sm:h-7.5 object-cover rounded-[2px] shadow-sm border border-black/30 flex-shrink-0"
              />
            )}

            {/* Team Crest / Logo Badge */}
            {(() => {
              const teamLogo =
                config.teamLogos?.[activeMvp.teamId] ||
                config.teamSquadPics?.[activeMvp.teamId];
              return teamLogo ? (
                <img
                  src={teamLogo}
                  alt=""
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain flex-shrink-0"
                />
              ) : null;
            })()}

            {/* PLAYER IN-GAME NAME */}
            <span
              className="text-3xl sm:text-4xl lg:text-5xl font-['Rajdhani',sans-serif] font-black text-black uppercase tracking-wider leading-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)] truncate"
              title={activeMvp.playerName}
            >
              {activeMvp.playerName}
            </span>

            {/* Team Name Tag */}
            <span className="hidden sm:inline-block text-xs font-mono font-bold text-black/75 uppercase truncate ml-auto border-l border-black/30 pl-3">
              {activeMvp.teamName}
            </span>
          </div>

          {/* Cyan Tech Circuit Line Underneath (Mirroring the Reference Image) */}
          <div className="flex items-center ml-8 sm:ml-12 mt-1 pointer-events-none">
            <svg width="220" height="16" viewBox="0 0 220 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 2 L140 2 L152 12 L210 12" stroke="#00d2ff" strokeWidth="2" strokeLinecap="round" />
              <rect x="210" y="10" width="4" height="4" fill="#00d2ff" />
            </svg>
          </div>
        </div>

        {/* BOTTOM RIGHT: SPONSOR / DEVICE & OFFICIAL PUBG MOBILE ESPORTS BADGE */}
        <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
          {/* Tech Sponsor / Device Box */}
          <div className="relative flex items-center gap-3 bg-[#061224]/80 border border-[#1a83c5]/40 rounded-lg px-4 py-2 shadow-lg backdrop-blur-sm">
            {/* Tech Phone Icon / Silhouette */}
            <div className="relative w-8 h-12 rounded-[5px] bg-[#030914] border border-[#00d2ff]/80 p-0.5 shadow-[0_0_10px_rgba(0,210,255,0.4)] flex flex-col justify-between items-center flex-shrink-0">
              <div className="w-2 h-0.5 bg-[#00d2ff]/60 rounded-full mt-0.5" />
              <div className="w-4 h-5 border border-[#00d2ff]/40 rounded-sm flex items-center justify-center">
                <Zap className="w-3 h-3 text-[#00d2ff]" />
              </div>
              <div className="w-1.5 h-1.5 rounded-full border border-[#00d2ff]/60 mb-0.5" />
            </div>

            {/* Sponsor Text / Device Brand */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-['Rajdhani',sans-serif] font-black text-white tracking-wider">
                  Infinix <span className="text-[#00d2ff]">GT 50 Pro</span>
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-['Barlow',sans-serif] font-extrabold tracking-widest text-slate-300 uppercase">
                BUILT FOR 144FPS
              </span>

              {/* Circuit Tech Bracket under Sponsor */}
              <div className="w-full h-1 mt-0.5 flex items-center">
                <div className="w-2 h-2 border-l border-b border-[#00d2ff]" />
                <div className="flex-1 h-[1px] bg-[#00d2ff]/60" />
                <div className="w-1.5 h-1.5 bg-[#00d2ff]" />
              </div>
            </div>
          </div>

          {/* OFFICIAL PUBG MOBILE ESPORTS BADGE (As seen in the bottom-right corner) */}
          <div className="bg-black border-2 border-white px-2.5 py-1.5 rounded flex flex-col items-center justify-center shadow-xl">
            <span className="text-[10px] font-['Rajdhani',sans-serif] font-black text-white tracking-tighter leading-none">
              PUBG
            </span>
            <span className="text-[8px] font-['Barlow',sans-serif] font-bold text-white tracking-widest leading-none mt-0.5">
              MOBILE
            </span>
            <span className="text-[7px] font-mono font-bold text-[#00d2ff] tracking-widest leading-none mt-0.5">
              ESPORTS
            </span>
          </div>

          {/* Contenders Toggle Button (for Broadcaster Stage Control) */}
          <button
            type="button"
            onClick={() => setShowContendersDrawer(!showContendersDrawer)}
            className="p-2 rounded-lg bg-[#061224]/80 border border-[#1a83c5]/40 hover:border-[#00d2ff] text-slate-300 hover:text-white transition-colors"
            title="Toggle MVP Contenders List"
          >
            <Trophy className="w-5 h-5 text-[#00d2ff]" />
          </button>
        </div>
      </footer>

      {/* OPTIONAL BROADCASTER DRAWER: TOP CONTENDERS */}
      <AnimatePresence>
        {showContendersDrawer && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 right-8 z-50 w-full max-w-[380px] bg-[#040c1a]/95 border-2 border-[#1a83c5] rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1a83c5]/30">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#00d2ff]" />
                <h3 className="font-['Rajdhani',sans-serif] font-black text-base uppercase text-white tracking-wider">
                  TOP CONTENDERS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowContendersDrawer(false)}
                className="text-xs font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="space-y-2">
              {activeContenders.map((contender, idx) => {
                const rank = idx + 2;
                const flag = resolveTeamFlagValue(contender.teamId, config.teamFlags, contender.teamName);
                const contenderPortrait = getPlayerPortrait(contender.uId, contender.picUrl);

                return (
                  <div
                    key={contender.uId || `${contender.playerName}-${idx}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#07152b] border border-[#1a83c5]/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded flex items-center justify-center font-['Rajdhani',sans-serif] font-black text-xs bg-black text-[#00d2ff] border border-[#00d2ff]/40 flex-shrink-0">
                        #{rank}
                      </span>
                      {contenderPortrait && (
                        <img
                          src={contenderPortrait}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover border border-white/40 flex-shrink-0"
                          style={{ background: 'transparent' }}
                        />
                      )}
                      {flag && (
                        <TeamFlag flagValue={flag} className="w-4 h-3 object-cover rounded-[1px] flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-['Rajdhani',sans-serif] font-black text-xs text-white uppercase truncate">
                          {contender.playerName}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 uppercase truncate">
                          {contender.teamName}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-['Rajdhani',sans-serif] font-black text-xs text-[#00d2ff]">
                        {contender.kills} K <span className="text-slate-400 font-normal">/</span> {contender.damage} DMG
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
