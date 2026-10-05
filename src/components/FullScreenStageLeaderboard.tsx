import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, Eye, EyeOff } from 'lucide-react';
import { TournamentConfig, SavedMatch, PlayerRawInfo } from '../types/pubg';
import { UnifiedTeamStanding } from './StreamLeaderboard';
import { TournamentLogoSlot } from './TournamentLogoSlot';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { TeamFlag } from './TeamFlag';
import { getTournamentBroadcastChannel, subscribeToObsTestTrigger } from '../utils/storage';

interface FullScreenStageLeaderboardProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers?: PlayerRawInfo[];
  unifiedStandings: UnifiedTeamStanding[];
  onManualRefresh?: () => void;
  isStandaloneObs?: boolean;
  onUpdateConfig?: (cfg: TournamentConfig) => void;
}

export const FullScreenStageLeaderboard: React.FC<FullScreenStageLeaderboardProps> = ({
  config,
  unifiedStandings,
  isStandaloneObs = false,
  onUpdateConfig,
}) => {
  const totalTeams = unifiedStandings.length;
  const TEAMS_PER_PAGE = totalTeams <= 16 ? 8 : Math.ceil(totalTeams / 2);
  const totalPages = totalTeams > TEAMS_PER_PAGE ? 2 : 1;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [slideProgress, setSlideProgress] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if half-screen flexible mode is enabled via URL (?layout=half, ?half=1, or ?half=true, or config)
  const isHalfScreen = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    const layout = p.get('layout') || p.get('mode');
    return (
      layout === 'half' ||
      layout === 'halfscreen' ||
      p.get('half') === '1' ||
      p.get('half') === 'true' ||
      p.get('split') === '1'
    );
  }, []);

  // Slide duration in seconds (default 20, configurable via URL or config)
  const slideDurationSec = useMemo(() => {
    if (typeof window === 'undefined') return 20;
    const p = new URLSearchParams(window.location.search);
    const val = p.get('slideTime') || p.get('slide') || p.get('interval');
    if (val && !isNaN(Number(val)) && Number(val) > 0) {
      return Number(val);
    }
    return config.stageSlideIntervalSeconds || 20;
  }, [config.stageSlideIntervalSeconds]);

  // Auto slide between Page 1 and Page 2 with intact progress animation
  useEffect(() => {
    if (totalPages <= 1 || slideDurationSec <= 0) {
      setCurrentPage(1);
      setSlideProgress(0);
      return;
    }

    const DURATION_MS = slideDurationSec * 1000;
    const STEP_MS = 100;
    let elapsed = 0;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      elapsed += STEP_MS;
      setSlideProgress(Math.min(100, (elapsed / DURATION_MS) * 100));

      if (elapsed >= DURATION_MS) {
        elapsed = 0;
        setSlideProgress(0);
        setCurrentPage((prev) => (prev === 1 ? 2 : 1));
      }
    }, STEP_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [totalPages, slideDurationSec]);

  // Support targeted test on OBS
  useEffect(() => {
    const unsubscribe = subscribeToObsTestTrigger('wide', () => {
      // Reset progress and cycle pages on test trigger
      setCurrentPage(1);
      setSlideProgress(0);
    });
    return unsubscribe;
  }, []);

  const handleSelectPage = (page: number) => {
    setCurrentPage(page);
    setSlideProgress(0);
  };

  const displayedPageTeams = useMemo(() => {
    const startIndex = (currentPage - 1) * TEAMS_PER_PAGE;
    return unifiedStandings.slice(startIndex, startIndex + TEAMS_PER_PAGE).map((team, idx) => ({
      team,
      rank: startIndex + idx + 1,
    }));
  }, [unifiedStandings, currentPage, TEAMS_PER_PAGE]);

  const isTransparent = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return (
      p.get('transparent') === '1' ||
      p.get('transparent') === 'true' ||
      config.obsTheme === 'transparent'
    );
  }, [config.obsTheme]);

  const isLogoHidden = useMemo(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('hideLogo') === '1' || p.get('hideLogo') === 'true') return true;
      if (p.get('showLogo') === '1' || p.get('showLogo') === 'true') return false;
    }
    return config.hideBetweenGamesLogo !== false;
  }, [config.hideBetweenGamesLogo]);

  return (
    <div
      id="obs-stage-leaderboard"
      className={`relative w-full min-h-screen ${
        isTransparent ? 'bg-transparent' : 'bg-[#0a0d14]'
      } text-[#f8fafc] select-none overflow-x-hidden no-scrollbar p-3 sm:p-5 md:p-6 flex flex-col ${
        isHalfScreen ? 'items-start justify-start' : 'items-center justify-start'
      } font-outfit`}
    >
      {/* Main Container: Full width (1440px) or Half Screen (max-w-[760px] or 50vw) */}
      <div className={`w-full ${isHalfScreen ? 'max-w-[760px] md:w-1/2 md:max-w-none' : 'max-w-[1440px]'} mx-auto flex flex-col flex-1 z-10 space-y-3 sm:space-y-4`}>
        {/* Designated Tournament Logo Slot at top */}
        {!isLogoHidden && (
          <div className="w-full flex flex-col items-center justify-center mb-1 sm:mb-2 flex-shrink-0">
            <TournamentLogoSlot
              logoUrl={config.logoUrl}
              size="hero"
              isInteractive={!isStandaloneObs}
              onUploadLogo={(url) => {
                if (onUpdateConfig) {
                  onUpdateConfig({ ...config, logoUrl: url });
                }
              }}
            />
          </div>
        )}

        {/* Main Header Title & 20s Page Switcher Bar */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-[#1e293b] flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-heading font-black uppercase tracking-wide text-[#f8fafc] leading-none drop-shadow-[0_2px_8px_rgba(56,189,248,0.35)]">
              {config.name || 'TOURNAMENT STAGE'}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* 2-Page Auto-Slide Indicator & Manual Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 sm:gap-3 bg-[#121824] border border-[#1e293b] px-3 py-1.5 rounded-[10px] shadow-md">
                <div className="flex items-center gap-1.5 text-[11px] font-telemetry text-[#38bdf8]">
                  <Clock className="w-3.5 h-3.5 text-[#38bdf8] animate-spin" />
                  <span className="hidden xs:inline text-[#94a3b8] font-bold">20s SLIDE:</span>
                  <div className="w-14 sm:w-18 h-1.5 bg-[#0a0d14] rounded-full overflow-hidden border border-[#1e293b]">
                    <div
                      className="h-full bg-gradient-to-r from-[#38bdf8] to-[#10b981] transition-all duration-100 ease-linear shadow-[0_0_6px_#38bdf8]"
                      style={{ width: `${slideProgress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSelectPage(1)}
                    className={`px-2.5 py-1 rounded text-[10px] sm:text-xs font-telemetry font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      currentPage === 1
                        ? 'bg-[#38bdf8] text-black shadow-md font-extrabold'
                        : 'bg-[#0f1622] text-[#94a3b8] hover:text-[#f8fafc] border border-[#1e293b]'
                    }`}
                  >
                    PAGE 1 (#{`1-${TEAMS_PER_PAGE}`})
                  </button>
                  <button
                    onClick={() => handleSelectPage(2)}
                    className={`px-2.5 py-1 rounded text-[10px] sm:text-xs font-telemetry font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      currentPage === 2
                        ? 'bg-[#38bdf8] text-black shadow-md font-extrabold'
                        : 'bg-[#0f1622] text-[#94a3b8] hover:text-[#f8fafc] border border-[#1e293b]'
                    }`}
                  >
                    PAGE 2 (#{`${TEAMS_PER_PAGE + 1}-${totalTeams}`})
                  </button>
                </div>
              </div>
            )}

            {!isStandaloneObs && onUpdateConfig && (
              <button
                id="btn-stage-toggle-logo"
                onClick={() => onUpdateConfig({ ...config, hideBetweenGamesLogo: !isLogoHidden })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#121824] hover:bg-[#172132] text-[#94a3b8] hover:text-white border border-[#1e293b] text-xs font-telemetry transition-colors shadow-sm cursor-pointer"
                title={isLogoHidden ? 'Show tournament logo' : 'Hide tournament logo'}
              >
                {isLogoHidden ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span className="hidden sm:inline">Show Logo</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-[#64748b]" />
                    <span className="hidden sm:inline">Hide Logo</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Column Header Row */}
        <div className={`w-full h-[40px] px-4 sm:px-6 rounded-[10px] ${isTransparent ? 'bg-[#182234]/95 backdrop-blur-md' : 'bg-[#182234]'} border border-[#1e293b] flex items-center justify-between text-xs sm:text-sm font-heading font-black uppercase tracking-wider text-[#94a3b8] flex-shrink-0 shadow-sm`}>
          <div className="w-12 sm:w-16 text-center">#</div>
          <div className="flex-1 pl-3 sm:pl-5">TEAM NAME</div>
          <div className="w-20 sm:w-28 text-center text-[#38bdf8]">KILLS</div>
          <div className="w-24 sm:w-36 text-center text-[#ffb800]">PTS</div>
          <div className="w-16 sm:w-24 text-center pr-2 text-[#cbd5e1]">WINS</div>
        </div>

        {/* Results Page Container */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full flex flex-col justify-start space-y-1.5 sm:space-y-2"
          >
            {displayedPageTeams.map(({ team, rank }) => {
              const isFirstPlace = rank === 1;

              const rawTeamName = (team.teamName || '').trim();
              const displayName =
                !rawTeamName || /^team\s*\d+$/i.test(rawTeamName)
                  ? rawTeamName ? rawTeamName.toUpperCase() : `TEAM #${team.teamId}`
                  : rawTeamName;
              const flagVal = resolveTeamFlagValue(team.teamId, config.teamFlags, team.teamName);

              const kills = team.totalKills || 0;
              const totalPts = team.totalPoints ?? (kills + (team.totalPlacementPoints || 0));
              const wins = team.totalWins ?? team.pastWins ?? 0;

              // Podium Hierarchy Accent Border & Rank Badges
              let borderLeftStyle = '4px solid #1e293b';
              let rankBadgeStyle = 'text-[#94a3b8] bg-[#0f1622] border-[#1e293b]';
              let glowStyle = '';

              if (rank === 1) {
                borderLeftStyle = '4px solid #ffb800';
                rankBadgeStyle = 'text-[#ffb800] bg-[rgba(255,184,0,0.15)] border-[rgba(255,184,0,0.40)]';
                glowStyle = 'shadow-[0_0_20px_rgba(255,184,0,0.25)]';
              } else if (rank === 2) {
                borderLeftStyle = '4px solid #cbd5e1';
                rankBadgeStyle = 'text-[#cbd5e1] bg-[rgba(203,213,225,0.15)] border-[rgba(203,213,225,0.35)]';
              } else if (rank === 3) {
                borderLeftStyle = '4px solid #f97316';
                rankBadgeStyle = 'text-[#f97316] bg-[rgba(249,115,22,0.15)] border-[rgba(249,115,22,0.35)]';
              } else if (rank >= 4 && rank <= 8) {
                borderLeftStyle = '4px solid #38bdf8';
                rankBadgeStyle = 'text-[#38bdf8] bg-[rgba(56,189,248,0.12)] border-[rgba(56,189,248,0.35)]';
              }

              return (
                <div
                  key={team.teamId}
                  style={{ borderLeft: borderLeftStyle }}
                  className={`w-full min-h-[52px] sm:min-h-[60px] md:min-h-[68px] flex items-center justify-between px-3 sm:px-6 py-2 rounded-[12px] ${
                    isTransparent ? 'bg-[#0e1626]/95 backdrop-blur-md' : 'bg-[#121824]'
                  } border border-[#1e293b] hover:bg-[#172132] hover:border-[#334155] transition-all duration-200 select-none ${glowStyle}`}
                >
                  {/* # Column: Rank */}
                  <div className="w-12 sm:w-16 flex items-center justify-center flex-shrink-0">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-md border flex items-center justify-center font-telemetry font-bold text-sm sm:text-base md:text-lg ${rankBadgeStyle}`}
                    >
                      {rank}
                    </div>
                  </div>

                  {/* TEAM NAME Column */}
                  <div className="flex-1 flex items-center gap-2.5 sm:gap-3.5 pl-3 sm:pl-5 min-w-0 pr-2">
                    {(() => {
                      const teamLogo =
                        (config.teamLogos &&
                          (config.teamLogos[team.teamId] ||
                            config.teamLogos[String(team.teamId)] ||
                            config.teamLogos[team.teamName] ||
                            (team.teamName ? config.teamLogos[team.teamName.trim().toLowerCase()] : undefined))) ||
                        null;
                      return (
                        <>
                          {teamLogo && (
                            <img
                              src={teamLogo}
                              alt=""
                              className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0"
                            />
                          )}
                          {flagVal && (
                            <TeamFlag
                              flagValue={flagVal}
                              teamId={team.teamId}
                              isWinner={isFirstPlace}
                              className={`w-6 h-4 sm:w-8 sm:h-5 md:w-9 md:h-6 object-cover rounded-[2px] shadow-sm flex-shrink-0 ${
                                isFirstPlace ? 'border border-[#ffb800] ring-1 ring-[rgba(255,184,0,0.5)]' : 'border border-white/20'
                              }`}
                            />
                          )}
                        </>
                      );
                    })()}
                    <span className="text-[#f8fafc] font-heading font-black text-base sm:text-xl md:text-2xl truncate tracking-wide uppercase">
                      {displayName}
                    </span>
                    {isFirstPlace && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-telemetry font-bold uppercase bg-[rgba(255,184,0,0.15)] text-[#ffb800] border border-[rgba(255,184,0,0.40)] flex-shrink-0">
                        <Trophy className="w-3 h-3 text-[#ffb800]" />
                        LEADER
                      </span>
                    )}
                  </div>

                  {/* KILLS Column: Cyan */}
                  <div className="w-20 sm:w-28 text-center font-telemetry font-bold text-[#38bdf8] text-base sm:text-xl md:text-2xl tabular-nums">
                    {kills}
                  </div>

                  {/* PTS Column: Gold */}
                  <div className="w-24 sm:w-36 text-center font-telemetry font-bold text-[#ffb800] text-lg sm:text-2xl md:text-3xl lg:text-4xl tabular-nums">
                    {totalPts}
                  </div>

                  {/* WINS Column */}
                  <div className="w-16 sm:w-24 text-center pr-2 font-telemetry font-bold text-base sm:text-xl md:text-2xl tabular-nums">
                    {wins > 0 ? (
                      <span className="inline-flex items-center justify-center gap-1 text-[#f8fafc]">
                        {wins}
                      </span>
                    ) : (
                      <span className="text-[#64748b]">0</span>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
