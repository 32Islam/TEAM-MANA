import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  RefreshCw,
  Clock,
  Maximize2,
  Minimize2,
  Crosshair,
  Sparkles,
  Layers,
  Upload,
  Check,
  Eye,
  EyeOff,
  Play,
  Pause,
  Sliders,
  Settings,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  PlayerRawInfo,
  SavedMatch,
  TeamMatchScore,
  TournamentConfig,
} from '../types/pubg';
import { UnifiedTeamStanding } from './StreamLeaderboard';
import { VirtuocityLogo } from './VirtuocityLogo';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { TeamFlag } from './TeamFlag';
import { subscribeToObsTestTrigger } from '../utils/storage';

interface BetweenGamesLeaderboardProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers: PlayerRawInfo[];
  unifiedStandings: UnifiedTeamStanding[];
  onManualRefresh: () => void;
  isStandaloneObs?: boolean;
  onUpdateConfig?: (cfg: TournamentConfig) => void;
}

export const BetweenGamesLeaderboard: React.FC<BetweenGamesLeaderboardProps> = ({
  config,
  savedMatches,
  unifiedStandings,
  onManualRefresh,
  isStandaloneObs = false,
  onUpdateConfig,
}) => {
  const stageFileInputRef = useRef<HTMLInputElement>(null);
  const [isStageDragging, setIsStageDragging] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  // Support transparent background via URL param without on-screen toggle button
  const isTransparent = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('transparent') === '1' ||
      params.get('transparent') === 'true' ||
      config.obsTheme === 'transparent'
    );
  }, [config.obsTheme]);

  // Main logo is hidden by default unless hideBetweenGamesLogo is explicitly set to false, or showLogo=1 in URL
  const isLogoHidden = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('hideLogo') === '1' || params.get('hideLogo') === 'true') return true;
      if (params.get('showLogo') === '1' || params.get('showLogo') === 'true') return false;
    }
    return config.hideBetweenGamesLogo !== false;
  }, [config.hideBetweenGamesLogo]);

  // Check if half-screen flexible mode is enabled via URL (?layout=half, ?half=1, or ?half=true, or config)
  const isHalfScreen = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const layout = params.get('layout') || params.get('mode');
      return (
        layout === 'half' ||
        layout === 'halfscreen' ||
        layout === 'stage_half' ||
        params.get('half') === '1' ||
        params.get('half') === 'true' ||
        params.get('split') === '1' ||
        config.betweenGamesHalfScreen === true
      );
    }
    return Boolean(config.betweenGamesHalfScreen);
  }, [config.betweenGamesHalfScreen]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(config.streamRefreshInterval || 3);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh countdown matching streamRefreshInterval (default 3s)
  useEffect(() => {
    const intervalSec = config.streamRefreshInterval || 3;
    setCountdown(intervalSec);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsRefreshing(true);
          onManualRefresh();
          setTimeout(() => setIsRefreshing(false), 500);
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [config.streamRefreshInterval, onManualRefresh]);

  // Support targeted test on OBS
  useEffect(() => {
    const unsubscribe = subscribeToObsTestTrigger('wide', () => {
      setCurrentPage(1);
      setSlideProgress(0);
      setIsRefreshing(true);
      onManualRefresh();
      setTimeout(() => setIsRefreshing(false), 500);
    });
    return unsubscribe;
  }, [onManualRefresh]);

  const triggerInstantRefresh = () => {
    setIsRefreshing(true);
    onManualRefresh();
    setCountdown(config.streamRefreshInterval || 3);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleStageFileUpload = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      if (onUpdateConfig) {
        onUpdateConfig({ ...config, logoUrl: dataUrl });
      }

      setUploadFeedback('✓ PNG Logo Applied!');
      setTimeout(() => setUploadFeedback(null), 4000);

      try {
        const res = await fetch('/api/tournament/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, fileName: file.name }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.logoUrl && onUpdateConfig) {
            onUpdateConfig({ ...config, logoUrl: result.logoUrl });
          }
        }
      } catch (err) {
        console.warn('Failed to upload logo to server, kept local dataUrl', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Filter ranked tournament matches
  const rankedSavedMatches = useMemo(
    () => (savedMatches || []).filter((m) => !m.excludeFromLeaderboard),
    [savedMatches]
  );
  const completedRankedCount = rankedSavedMatches.length;

  // Find the ONLY latest game winner (from live game or latest counted tournament match)
  const latestWinner = useMemo<{ teamId: number; teamName: string; matchNumber: number } | null>(() => {
    // 1. Live match winner if a live game has just concluded with a winner
    const liveWinner = unifiedStandings.find((t) => t.isLiveWinner);
    if (liveWinner) {
      return {
        teamId: liveWinner.teamId,
        teamName: liveWinner.teamName,
        matchNumber: completedRankedCount + 1,
      };
    }

    // 2. The winner of the latest ranked saved match
    if (rankedSavedMatches && rankedSavedMatches.length > 0) {
      const lastMatch = rankedSavedMatches[rankedSavedMatches.length - 1];
      if (lastMatch && lastMatch.teamScores) {
        const scores = Object.values(lastMatch.teamScores) as TeamMatchScore[];
        const winnerScore = scores.find(
          (ts) => ts.isWinner || ts.placement === 1
        );
        if (winnerScore) {
          return {
            teamId: winnerScore.teamId,
            teamName: winnerScore.teamName,
            matchNumber: lastMatch.matchNumber,
          };
        }
      }
    }

    return null;
  }, [unifiedStandings, rankedSavedMatches, completedRankedCount]);

  // Dual column layout: Col 1 (#1-8), Col 2 (#9-16) by default
  const totalMatches = config.totalMatches || 5;
  const currentMatchLabel = completedRankedCount + 1;
  const isTournamentEnded =
    config.isTournamentConcluded ||
    (config.totalMatches > 0 && completedRankedCount >= config.totalMatches);

  const top3 = useMemo(() => unifiedStandings.slice(0, 3), [unifiedStandings]);

  // 2 Pages for Stage Leaderboard with 20s auto slide (8 per page for 16 teams, 9 per page for 18 teams)
  const totalTeams = unifiedStandings.length;
  const TEAMS_PER_PAGE = totalTeams <= 16 ? 8 : Math.ceil(totalTeams / 2);
  const totalPages = totalTeams > TEAMS_PER_PAGE ? 2 : 1;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [slideProgress, setSlideProgress] = useState<number>(0);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Page slide interval in seconds (default 20, 0 = paused)
  const urlSlideSec = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('slideTime') || params.get('slide') || params.get('slideInterval');
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return null;
  }, []);

  const [slideIntervalSec, setSlideIntervalSec] = useState<number>(() => {
    if (urlSlideSec !== null) return urlSlideSec;
    return typeof config.stageSlideIntervalSeconds === 'number'
      ? config.stageSlideIntervalSeconds
      : 20;
  });

  const [isSlidePaused, setIsSlidePaused] = useState<boolean>(slideIntervalSec === 0);
  const [showSliderSettings, setShowSliderSettings] = useState<boolean>(false);
  const sliderSettingsRef = useRef<HTMLDivElement>(null);

  // Sync external config updates
  useEffect(() => {
    if (urlSlideSec === null && typeof config.stageSlideIntervalSeconds === 'number') {
      setSlideIntervalSec(config.stageSlideIntervalSeconds);
      if (config.stageSlideIntervalSeconds === 0) {
        setIsSlidePaused(true);
      }
    }
  }, [config.stageSlideIntervalSeconds, urlSlideSec]);

  // Click outside to close settings popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        sliderSettingsRef.current &&
        !sliderSettingsRef.current.contains(e.target as Node)
      ) {
        setShowSliderSettings(false);
      }
    };
    if (showSliderSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSliderSettings]);

  const handleUpdateSlideInterval = (newSec: number) => {
    const clamped = Math.max(0, Math.min(180, newSec));
    setSlideIntervalSec(clamped);
    setIsSlidePaused(clamped === 0);
    setSlideProgress(0);
    if (onUpdateConfig) {
      onUpdateConfig({
        ...config,
        stageSlideIntervalSeconds: clamped,
      });
    }
  };

  const togglePauseSlide = () => {
    setIsSlidePaused((prev) => !prev);
    setSlideProgress(0);
  };

  useEffect(() => {
    if (totalPages <= 1 || isSlidePaused || slideIntervalSec <= 0) {
      setSlideProgress(0);
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
      return;
    }

    const DURATION_MS = slideIntervalSec * 1000;
    const STEP_MS = 100;
    let elapsed = 0;

    if (slideTimerRef.current) clearInterval(slideTimerRef.current);

    slideTimerRef.current = setInterval(() => {
      elapsed += STEP_MS;
      setSlideProgress(Math.min(100, (elapsed / DURATION_MS) * 100));

      if (elapsed >= DURATION_MS) {
        elapsed = 0;
        setSlideProgress(0);
        setCurrentPage((prev) => (prev === 1 ? 2 : 1));
      }
    }, STEP_MS);

    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [totalPages, isSlidePaused, slideIntervalSec]);

  const remainingSlideSeconds = useMemo(() => {
    if (isSlidePaused || slideIntervalSec <= 0) return 0;
    return Math.max(0, Math.ceil(((100 - slideProgress) / 100) * slideIntervalSec));
  }, [slideProgress, slideIntervalSec, isSlidePaused]);

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
  }, [unifiedStandings, currentPage]);

  // Overall match stats
  const totalTournamentKills = useMemo(() => {
    return unifiedStandings.reduce((sum, t) => sum + t.totalKills, 0);
  }, [unifiedStandings]);

  return (
    <div
      className={`w-full min-h-screen transition-colors duration-200 ${
        isTransparent ? 'bg-transparent' : 'bg-[#0a0d14] text-[#f8fafc]'
      } p-2 sm:p-4 md:p-6 lg:p-8 flex flex-col items-center select-none overflow-x-hidden no-scrollbar font-outfit`}
    >
      {/* Container max-w-7xl Widescreen Canvas or Flexible Half-Screen */}
      <div className={`w-full ${isHalfScreen ? 'max-w-[760px] md:w-1/2 md:max-w-none mr-auto' : 'max-w-[1580px]'} mx-auto flex flex-col space-y-4 sm:space-y-6`}>
        
        {/* ================= HEADER STAGE BANNER (DARK CYBER THEME) ================= */}
        <div className="relative w-full rounded-[14px] bg-[#121824] border border-[#1e293b] p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)] overflow-hidden">
          {/* Ambient Lighting & Micro-grid */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(56,189,248,0.08),transparent_70%)] pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#38bdf8] to-transparent shadow-[0_0_10px_rgba(56,189,248,0.4)]" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Title & Stage Brand with Virtuocity Battleground Logo */}
            <div className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-3.5 sm:gap-5">
              {/* Official Tournament Stage Logo Emblem & Quick PNG Slot (hidden by default, toggleable) */}
              {!isLogoHidden && (
                <div
                  id="stage-logo-slot"
                  onClick={() => !isStandaloneObs && stageFileInputRef.current?.click()}
                  onDragOver={(e) => {
                    if (isStandaloneObs) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setIsStageDragging(true);
                  }}
                  onDragLeave={(e) => {
                    if (isStandaloneObs) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setIsStageDragging(false);
                  }}
                  onDrop={(e) => {
                    if (isStandaloneObs) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setIsStageDragging(false);
                    if (e.dataTransfer.files?.[0]) {
                      handleStageFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`relative flex-shrink-0 group ${
                    !isStandaloneObs ? 'cursor-pointer' : ''
                  } transition-all duration-200 ${
                    isStageDragging ? 'scale-105 ring-2 ring-[#1a83c5] shadow-[0_0_20px_#1a83c5]' : ''
                  }`}
                  title={!isStandaloneObs ? 'Click or drag & drop PNG to update tournament logo' : undefined}
                >
                  {!isStandaloneObs && (
                    <input
                      type="file"
                      ref={stageFileInputRef}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleStageFileUpload(e.target.files[0]);
                        }
                      }}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                    />
                  )}

                  <div className="relative flex items-center justify-center">
                    <VirtuocityLogo size="hero" customUrl={config.logoUrl} glow={false} />

                    {/* Non-OBS quick upload hover overlay */}
                    {!isStandaloneObs && (
                      <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-center p-1 backdrop-blur-xs">
                        <Upload className="w-6 h-6 text-sky-400 animate-bounce" />
                        <span className="text-xs font-bold text-white tracking-wider">
                          Upload PNG
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Upload feedback notification toast */}
                  {uploadFeedback && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-black font-semibold text-[11px] shadow-lg whitespace-nowrap animate-bounce">
                      {uploadFeedback}
                    </span>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold italic tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-[#d0f0ff] to-[#1a83c5] drop-shadow-[0_0_12px_rgba(26, 131, 197,0.4)]">
                    {config.name || 'VIRTUOCITY BATTLEGROUND QATAR 2026'}
                  </h1>
                </div>
              </div>
            </div>

            {/* Right Side: Instant Refresh & Controls */}
            <div className="flex items-center flex-wrap justify-center gap-2.5">
              {/* Toggle Logo Visibility (non-OBS preview) */}
              {!isStandaloneObs && onUpdateConfig && (
                <button
                  id="btn-between-games-toggle-logo"
                  onClick={() => onUpdateConfig({ ...config, hideBetweenGamesLogo: !isLogoHidden })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#060c18] hover:bg-[#0b1b36] border border-slate-800 text-gray-300 hover:text-white text-xs font-mono transition-colors shadow-sm"
                  title={isLogoHidden ? 'Show tournament logo' : 'Hide tournament logo'}
                >
                  {isLogoHidden ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-[#1a83c5]" />
                      <span className="hidden sm:inline">Show Logo</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      <span className="hidden sm:inline">Hide Logo</span>
                    </>
                  )}
                </button>
              )}

              {/* Instant Refresh Timer - hidden in OBS mode for a clean broadcast */}
              {!isStandaloneObs && (
                <button
                  id="btn-between-games-refresh"
                  onClick={triggerInstantRefresh}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#060c18] hover:bg-[#0b1b36] border border-slate-800 text-gray-200 text-xs font-mono transition-colors shadow-sm"
                  title="Force instant refresh from spectator API"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#1a83c5] ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{countdown}s</span>
                </button>
              )}

              {/* Fullscreen Toggle */}
              <button
                id="btn-toggle-fullscreen"
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-[#060c18] hover:bg-[#0b1b36] border border-slate-800 text-gray-400 hover:text-white transition-colors shadow-sm"
                title="Toggle Fullscreen for Stage / Monitor display"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* ================= TOP 3 PODIUM SPOTLIGHT (CYBER ESPORTS THEME) ================= */}
        {top3.length > 0 && (
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 max-w-5xl mx-auto my-1">
            {/* 2nd Place (Silver/Cyan Cyber) */}
            {top3[1] && (
              <CyberPodiumCard
                rank={2}
                team={top3[1]}
                isLatestWinner={Boolean(latestWinner && top3[1].teamId === latestWinner.teamId)}
                latestMatchNumber={latestWinner?.matchNumber}
                flagValue={top3[1].flagValue || resolveTeamFlagValue(top3[1].teamId, config.teamFlags, top3[1].teamName)}
                teamLogo={config.teamLogos?.[top3[1].teamId] || config.teamLogos?.[String(top3[1].teamId)] || config.teamLogos?.[top3[1].teamName] || (top3[1].teamName ? config.teamLogos?.[top3[1].teamName.trim().toLowerCase()] : undefined)}
              />
            )}

            {/* 1st Place (Gold Champion Cyber) */}
            {top3[0] && (
              <CyberPodiumCard
                rank={1}
                team={top3[0]}
                isLatestWinner={Boolean(latestWinner && top3[0].teamId === latestWinner.teamId)}
                latestMatchNumber={latestWinner?.matchNumber}
                flagValue={top3[0].flagValue || resolveTeamFlagValue(top3[0].teamId, config.teamFlags, top3[0].teamName)}
                teamLogo={config.teamLogos?.[top3[0].teamId] || config.teamLogos?.[String(top3[0].teamId)] || config.teamLogos?.[top3[0].teamName] || (top3[0].teamName ? config.teamLogos?.[top3[0].teamName.trim().toLowerCase()] : undefined)}
              />
            )}

            {/* 3rd Place (Bronze/Orange Cyber) */}
            {top3[2] && (
              <CyberPodiumCard
                rank={3}
                team={top3[2]}
                isLatestWinner={Boolean(latestWinner && top3[2].teamId === latestWinner.teamId)}
                latestMatchNumber={latestWinner?.matchNumber}
                flagValue={top3[2].flagValue || resolveTeamFlagValue(top3[2].teamId, config.teamFlags, top3[2].teamName)}
                teamLogo={config.teamLogos?.[top3[2].teamId] || config.teamLogos?.[String(top3[2].teamId)] || config.teamLogos?.[top3[2].teamName] || (top3[2].teamName ? config.teamLogos?.[top3[2].teamName.trim().toLowerCase()] : undefined)}
              />
            )}
          </div>
        )}

        {/* ================= 2-PAGE STANDINGS PRESENTATION (8 TEAMS PER PAGE, 20s AUTO-SLIDE) ================= */}
        <div className="w-full flex flex-col space-y-2">
          {/* Sleek Small Timer Bar Only */}
          {totalPages > 1 && (
            <div className="w-full flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#060c18]/90 border border-[#1a83c533] shadow-sm">
              <div className="flex items-center gap-2 text-xs font-mono text-[#38bdf8] flex-shrink-0">
                <Clock className={`w-3.5 h-3.5 ${!isSlidePaused ? 'animate-spin' : ''}`} />
                <span className="font-bold text-slate-200">
                  PAGE {currentPage} / {totalPages}
                </span>
                <span className="text-slate-500 font-normal hidden sm:inline">
                  ({slideIntervalSec}s AUTO-SLIDE)
                </span>
              </div>

              {/* Small timer progress bar */}
              <div className="flex-1 max-w-xs sm:max-w-md h-1.5 bg-[#03060f] rounded-full overflow-hidden border border-[#1a83c544] mx-2">
                <div
                  className="h-full bg-gradient-to-r from-[#1a83c5] via-[#38bdf8] to-[#ffb800] transition-all duration-100 ease-linear shadow-[0_0_8px_#38bdf8]"
                  style={{ width: `${slideProgress}%` }}
                />
              </div>

              {/* Compact page buttons & play/pause toggle */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={togglePauseSlide}
                  title={isSlidePaused ? 'Resume auto-sliding' : 'Pause auto-sliding'}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all border cursor-pointer ${
                    isSlidePaused
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-[#1a83c5]/15 text-[#38bdf8] border-[#1a83c5]/30 hover:bg-[#1a83c5]/25'
                  }`}
                >
                  {isSlidePaused ? 'PAUSED' : 'AUTO'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPage(1)}
                  className={`px-2 py-0.5 rounded text-[10px] font-rajdhani font-black transition-all cursor-pointer ${
                    currentPage === 1
                      ? 'bg-[#1a83c5] text-black shadow-[0_0_8px_#1a83c5]'
                      : 'bg-[#03060f] text-gray-400 hover:text-white border border-[#1a83c533]'
                  }`}
                >
                  P1
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPage(2)}
                  className={`px-2 py-0.5 rounded text-[10px] font-rajdhani font-black transition-all cursor-pointer ${
                    currentPage === 2
                      ? 'bg-[#1a83c5] text-black shadow-[0_0_8px_#1a83c5]'
                      : 'bg-[#03060f] text-gray-400 hover:text-white border border-[#1a83c533]'
                  }`}
                >
                  P2
                </button>
              </div>
            </div>
          )}

          {/* Teams Rows: Displayed below each other instead of scattered */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="w-full flex flex-col justify-start space-y-1.5 sm:space-y-2"
            >
              {displayedPageTeams.map(({ team, rank }) => (
                <CyberStageRow
                  key={team.teamId}
                  rank={rank}
                  team={team}
                  isLatestWinner={Boolean(latestWinner && team.teamId === latestWinner.teamId)}
                  flagValue={team.flagValue || resolveTeamFlagValue(team.teamId, config.teamFlags, team.teamName)}
                  teamLogo={config.teamLogos?.[team.teamId] || config.teamLogos?.[String(team.teamId)] || config.teamLogos?.[team.teamName] || (team.teamName ? config.teamLogos?.[team.teamName.trim().toLowerCase()] : undefined)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

/* Cyber Stage Column Header matching OBS Leaderboard Header aesthetic */
const CyberStageColumnHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="relative flex items-center justify-between h-[42px] sm:h-[46px] my-1 px-4 sm:px-6 rounded-[12px] bg-[#182234] border border-[#1e293b] select-none shadow-md">
    <div className="flex items-center gap-3">
      <span className="text-[#38bdf8] tracking-widest font-heading font-black text-xs sm:text-sm uppercase drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]">
        {title}
      </span>
    </div>
    <div className="flex items-center gap-3 sm:gap-6 text-right font-telemetry">
      <span className="w-10 text-center text-[#94a3b8] text-xs sm:text-sm font-bold">GP</span>
      <span className="w-14 text-center text-[#38bdf8] text-xs sm:text-sm font-bold">KILLS</span>
      <span className="w-16 sm:w-24 text-right text-[#ffb800] font-bold text-xs sm:text-sm md:text-base pr-1">PTS</span>
    </div>
  </div>
);

/* Cyber Stage Row: Matches EXACT OBS Leaderboard Cyber Visual Frame */
interface CyberStageRowProps {
  rank: number;
  team: UnifiedTeamStanding;
  isLatestWinner: boolean;
  flagValue?: string | null;
  teamLogo?: string | null;
}

const CyberStageRow: React.FC<CyberStageRowProps> = ({ rank, team, isLatestWinner, flagValue, teamLogo }) => {
  // Extract clean team name
  const displayTeamName = useMemo(() => {
    let rawTeamName = (team.teamName || '').trim();
    if (!rawTeamName || /^team\s*\d+$/i.test(rawTeamName)) {
      return rawTeamName ? rawTeamName.toUpperCase() : `TEAM #${team.teamId}`;
    }
    return rawTeamName;
  }, [team.teamName, team.teamId]);

  // Parse structured player list
  const parsedPlayers = useMemo(() => {
    if (team.roster && team.roster.length > 0) {
      return team.roster.map((r, idx) => ({
        uId: r.uId || idx + 1,
        playerName: r.playerName,
      }));
    }

    let rawTeamName = (team.teamName || '').trim();
    let names: string[] = [];
    if (rawTeamName.includes(' / ')) {
      names = rawTeamName.split(' / ').map((p) => p.trim()).filter(Boolean);
    } else if (rawTeamName.includes(' • ')) {
      names = rawTeamName.split(' • ').map((p) => p.trim()).filter(Boolean);
    }

    if (names.length === 0) {
      names = [`Player 1`, `Player 2`];
    }

    return names.map((name, idx) => ({
      uId: idx + 1,
      playerName: name,
    }));
  }, [team.roster, team.teamName]);

  // Podium Hierarchy Accent Border & Rank Badges
  const podiumStyles = useMemo(() => {
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
      id={`stage-cyber-row-${rank}`}
      style={{
        borderLeft: podiumStyles.borderLeft,
      }}
      className={`relative flex items-center justify-between min-h-[58px] sm:min-h-[66px] md:min-h-[72px] h-auto my-1 px-3 sm:px-5 py-2 select-none group transition-all duration-200 hover:scale-[1.002] rounded-[12px] bg-[#121824] border border-[#1e293b] hover:bg-[#172132] hover:border-[#334155] ${podiumStyles.glow}`}
    >
      {/* 1. RANK BADGE (#1, #2, ...) */}
      <div className="flex items-center justify-center min-w-[38px] xs:min-w-[46px] sm:min-w-[54px] flex-shrink-0">
        <div
          className={`font-telemetry font-bold text-xs sm:text-base md:text-lg px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md border tracking-wider flex items-center justify-center gap-1 ${podiumStyles.rankColor}`}
        >
          {rank === 1 && <Trophy className="w-3.5 h-3.5 text-[#ffb800] fill-[#ffb800] hidden xs:inline" />}
          #{rank}
        </div>
      </div>

      {/* 2. TEAM NAME */}
      <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0 px-3 sm:px-5 py-1 overflow-hidden">
        {/* Team Logo + Country Flag + Team Name + WWCD Badge if Latest Winner */}
        {teamLogo && (
          <img
            src={teamLogo}
            alt=""
            className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 object-contain flex-shrink-0"
          />
        )}
        {flagValue && (
          <TeamFlag
            flagValue={flagValue}
            teamId={team.teamId}
            isWinner={rank === 1}
            className={`w-5 h-3.5 sm:w-6 sm:h-4 md:w-7 md:h-4.5 object-cover rounded-[2px] shadow-sm flex-shrink-0 ${
              rank === 1 ? 'border border-[#ffb800] ring-1 ring-[rgba(255,184,0,0.5)]' : 'border border-white/20'
            }`}
          />
        )}
        <span
          className="font-heading font-black text-base xs:text-lg sm:text-2xl md:text-3xl text-[#f8fafc] tracking-wide truncate drop-shadow-sm leading-tight min-w-0 flex-shrink uppercase"
          dir="auto"
          title={displayTeamName}
        >
          {displayTeamName}
        </span>

        {/* WWCD BADGE: ONLY FOR THE LATEST GAME WINNER */}
        {isLatestWinner && (
          <span className="px-2.5 py-0.5 bg-[rgba(16,185,129,0.15)] text-[#10b981] border border-[rgba(16,185,129,0.35)] rounded-full text-[10px] sm:text-xs font-bold font-telemetry tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.25)] animate-pulse flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            <Trophy className="w-3 h-3 text-[#ffb800]" />
            <span>WWCD</span>
          </span>
        )}
      </div>

      {/* 3. STATS: [GP] [KILLS] [TOTAL PTS] */}
      <div className="flex items-center justify-end gap-3 sm:gap-6 pr-1 sm:pr-3 flex-shrink-0">
        {/* GP (Games Played) */}
        <div className="w-10 text-center" title={`${team.matchesPlayed} Matches Played`}>
          <span className="font-telemetry text-sm sm:text-base md:text-lg text-[#94a3b8] font-bold">
            {team.matchesPlayed}
          </span>
        </div>

        {/* TOTAL KILLS DISPLAY */}
        <div
          className="flex items-center justify-center gap-1 bg-[#0f1622] border border-[rgba(56,189,248,0.35)] px-2.5 sm:px-3 py-1 rounded-md text-center shadow-sm flex-shrink-0 min-w-[44px] sm:min-w-[54px]"
          title={`${team.totalKills} Total Tournament Kills`}
        >
          <span className="font-telemetry font-bold text-sm sm:text-base md:text-lg text-[#38bdf8] leading-none">
            {team.totalKills}
          </span>
          <span className="text-[9px] sm:text-[10px] font-telemetry font-bold text-[#38bdf8] leading-none">
            K
          </span>
        </div>

        {/* TOTAL POINTS DISPLAY (PTS) */}
        <div className="flex items-baseline justify-end min-w-[68px] sm:min-w-[92px] text-right pr-0.5 flex-shrink-0">
          <span className="font-telemetry font-bold text-xl xs:text-2xl sm:text-3xl md:text-4xl text-[#ffb800] tracking-tight leading-none">
            {team.totalPoints}
          </span>
          <span className="text-[10px] sm:text-xs font-telemetry font-bold text-[#94a3b8] ml-1.5 tracking-wider leading-none">
            PTS
          </span>
        </div>
      </div>
    </div>
  );
};

/* Cyber Podium Card: Matching the Cyber Esports Theme */
interface CyberPodiumCardProps {
  rank: number;
  team: UnifiedTeamStanding;
  isLatestWinner: boolean;
  latestMatchNumber?: number;
  flagValue?: string | null;
  teamLogo?: string | null;
}

const CyberPodiumCard: React.FC<CyberPodiumCardProps> = ({
  rank,
  team,
  isLatestWinner,
  latestMatchNumber,
  flagValue,
  teamLogo,
}) => {
  const isGold = rank === 1;
  const isSilver = rank === 2;

  const podiumInfo = useMemo(() => {
    if (isGold) {
      return {
        borderColor: 'border-[#ffb800]',
        borderLeft: '4px solid #ffb800',
        badgeBg: 'bg-[rgba(255,184,0,0.15)] text-[#ffb800] border-[rgba(255,184,0,0.40)]',
        glowShadow: 'shadow-[0_0_25px_rgba(255,184,0,0.25)]',
        label: 'TOURNAMENT LEADER',
        labelColor: 'text-[#ffb800]',
      };
    }
    if (isSilver) {
      return {
        borderColor: 'border-[#cbd5e1]',
        borderLeft: '4px solid #cbd5e1',
        badgeBg: 'bg-[rgba(203,213,225,0.15)] text-[#cbd5e1] border-[rgba(203,213,225,0.35)]',
        glowShadow: 'shadow-md',
        label: 'RUNNER UP',
        labelColor: 'text-[#cbd5e1]',
      };
    }
    return {
      borderColor: 'border-[#f97316]',
      borderLeft: '4px solid #f97316',
      badgeBg: 'bg-[rgba(249,115,22,0.15)] text-[#f97316] border-[rgba(249,115,22,0.35)]',
      glowShadow: 'shadow-md',
      label: '3RD PLACE',
      labelColor: 'text-[#f97316]',
    };
  }, [isGold, isSilver]);

  return (
    <div
      style={{ borderLeft: podiumInfo.borderLeft }}
      className={`relative rounded-[10px] bg-[#121824] border border-[#1e293b] p-2.5 sm:p-3 ${podiumInfo.glowShadow} flex flex-col justify-between overflow-hidden transition-all duration-200 hover:bg-[#172132] hover:border-[#334155] ${
        isGold ? 'order-1 md:order-2 scale-[1.01]' : isSilver ? 'order-2 md:order-1' : 'order-3'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-6 h-6 rounded-md flex items-center justify-center font-telemetry font-bold text-xs border ${podiumInfo.badgeBg}`}>
            #{rank}
          </span>
          <span className={`text-[10px] sm:text-xs font-heading font-black tracking-wider ${podiumInfo.labelColor}`}>
            {podiumInfo.label}
          </span>
        </div>

        {/* WWCD BADGE: ONLY IF THIS TEAM WON THE LATEST GAME */}
        {isLatestWinner && (
          <span className="flex items-center gap-1 text-[10px] sm:text-xs font-telemetry font-bold text-[#10b981] bg-[rgba(16,185,129,0.15)] px-2 py-0.5 rounded-full border border-[rgba(16,185,129,0.35)] shadow-[0_0_8px_rgba(16,185,129,0.25)] animate-pulse">
            <Trophy className="w-3 h-3 text-[#ffb800]" />
            <span>WWCD {latestMatchNumber ? `• M${latestMatchNumber}` : ''}</span>
          </span>
        )}
      </div>

      <div className="my-1.5 sm:my-2">
        <div className="flex items-center gap-2 min-w-0">
          {teamLogo && (
            <img
              src={teamLogo}
              alt=""
              className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
            />
          )}
          {flagValue && (
            <TeamFlag
              flagValue={flagValue}
              teamId={team.teamId}
              isWinner={isGold}
              className={`w-5 h-3.5 sm:w-6 sm:h-4 object-cover rounded-[2px] shadow-sm flex-shrink-0 ${
                isGold ? 'border border-[#ffb800] ring-1 ring-[rgba(255,184,0,0.5)]' : 'border border-white/20'
              }`}
            />
          )}
          <h3 className="text-sm sm:text-base md:text-lg font-heading font-black text-[#f8fafc] truncate tracking-wide uppercase">
            {team.teamName}
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-[#1e293b] text-[11px] sm:text-xs">
        <span className="text-[#94a3b8] font-telemetry font-bold">
          KILLS: <strong className="text-[#38bdf8] font-bold">{team.totalKills}</strong>
        </span>
        <span className="text-base sm:text-lg font-telemetry font-bold text-[#ffb800]">
          {team.totalPoints} <span className="text-[10px] text-[#94a3b8] font-bold">PTS</span>
        </span>
      </div>
    </div>
  );
};
