import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  Target,
  Flame,
  Clock,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Tv,
  Layers,
  Shield,
  Upload,
  Image as ImageIcon,
  Trash2,
  Tag,
  Check,
  Radio,
  Sliders,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import {
  TournamentConfig,
  SavedMatch,
  PlayerRawInfo,
  CumulativeTeamStats,
} from '../types/pubg';
import { getTeamSquadStats } from '../utils/teamStatsHelper';
import { TeamStatsCard } from './TeamStatsCard';
import { getTeamColor, resolveTeamDisplayName } from '../utils/pubgCalculations';
import { copyToClipboard } from '../utils/clipboard';

interface TeamStatsAdminProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers: PlayerRawInfo[];
  teamStandings?: CumulativeTeamStats[];
  onUpdateConfig: (updatedConfig: TournamentConfig) => void;
  onForceRefresh?: () => void;
  showToast?: (msg: string) => void;
}

export const TeamStatsAdmin: React.FC<TeamStatsAdminProps> = ({
  config,
  savedMatches,
  activePlayers,
  teamStandings = [],
  onUpdateConfig,
  onForceRefresh,
  showToast = (_msg: string) => {},
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [bgUrlInput, setBgUrlInput] = useState(config.teamStatsBackgroundImage || '');
  const [bgMeta, setBgMeta] = useState<{ width?: number; height?: number; sizeKb?: number } | null>(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [customLabelInput, setCustomLabelInput] = useState(config.teamStatsCustomLabel || '');
  const [previewTab, setPreviewTab] = useState<'stage' | 'hud'>('stage');
  const [nudgeStep, setNudgeStep] = useState<number>(20); // 5px (fine), 20px (normal), 50px (coarse)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if config updates from elsewhere
  useEffect(() => {
    if (config.teamStatsBackgroundImage !== undefined) {
      setBgUrlInput(config.teamStatsBackgroundImage || '');
    }
    if (config.teamStatsBackgroundImage) {
      const img = new Image();
      img.onload = () => {
        setBgMeta((prev) => ({
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeKb: prev?.sizeKb,
        }));
      };
      img.src = config.teamStatsBackgroundImage;
    } else {
      setBgMeta(null);
    }
  }, [config.teamStatsBackgroundImage]);

  useEffect(() => {
    if (config.teamStatsCustomLabel !== undefined) {
      setCustomLabelInput(config.teamStatsCustomLabel || '');
    }
  }, [config.teamStatsCustomLabel]);

  // Discover latest completed/saved match
  const latestMatch = useMemo(() => {
    if (!savedMatches || savedMatches.length === 0) return null;
    return [...savedMatches].sort(
      (a, b) => (b.matchNumber || 0) - (a.matchNumber || 0) || (b.timestamp || 0) - (a.timestamp || 0)
    )[0];
  }, [savedMatches]);

  // Current stage scale & offsets (with defaults)
  const currentStageScale = config.teamStatsStageScale ?? 1.0;
  const currentStageOffsetX = config.teamStatsStageOffsetX ?? 0;
  const currentStageOffsetY = config.teamStatsStageOffsetY ?? 0;

  // Discover all relevant teams (at least 1..18, plus any in saved matches or live game)
  const allTeamIds = useMemo(() => {
    const ids = new Set<number>();
    for (let i = 1; i <= 18; i++) {
      ids.add(i);
    }
    savedMatches.forEach((m) => {
      if (m.teamScores) {
        Object.keys(m.teamScores).forEach((k) => ids.add(Number(k)));
      }
    });
    activePlayers.forEach((p) => {
      if (p.teamId) ids.add(p.teamId);
    });
    return Array.from(ids).sort((a, b) => a - b);
  }, [savedMatches, activePlayers]);

  // Current selected team ID from config or local fallback
  const currentSelectedTeamId = useMemo(() => {
    if (config.selectedTeamStatsId !== undefined && config.selectedTeamStatsId !== null) {
      return config.selectedTeamStatsId;
    }
    if (activePlayers.length > 0 && activePlayers[0].teamId) {
      return activePlayers[0].teamId;
    }
    return 1;
  }, [config.selectedTeamStatsId, activePlayers]);

  // Handle selecting a team (immediately updates config without page refresh!)
  const handleSelectTeam = (teamId: number) => {
    const newConfig: TournamentConfig = {
      ...config,
      selectedTeamStatsId: teamId,
    };
    onUpdateConfig(newConfig);
    const resolvedName = resolveTeamDisplayName(teamId, undefined, newConfig, activePlayers.length > 0);
    showToast(`✓ Selected ${resolvedName} for Team Stats (Live synced to OBS)`);
  };

  // Toggle showing overlay on stream
  const handleToggleOverlay = () => {
    const nextVal = !config.showTeamStatsOverlay;
    const newConfig: TournamentConfig = {
      ...config,
      showTeamStatsOverlay: nextVal,
    };
    onUpdateConfig(newConfig);
    showToast(
      nextVal
        ? '📺 Team Stats overlay ENABLED on stream'
        : '🙈 Team Stats overlay HIDDEN from stream'
    );
  };

  // Change data source (auto, live, latest, tournament, match)
  const handleSourceChange = (source: 'auto' | 'live' | 'latest' | 'tournament' | 'match') => {
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsDataSource: source,
    };
    onUpdateConfig(newConfig);
    const label =
      source === 'live'
        ? 'LIVE GAME DATA'
        : source === 'latest'
        ? `LATEST MATCH ${latestMatch ? `(#${latestMatch.matchNumber})` : ''}`
        : source === 'tournament'
        ? 'OVERALL TOURNAMENT'
        : 'AUTO-DETECT';
    showToast(`📊 Team Stats data source set to: ${label} (Auto-synced)`);
  };

  // Stage Size Scaling Handlers
  const handleSetScale = (newScale: number) => {
    const clamped = Math.round(Math.min(2.0, Math.max(0.5, newScale)) * 100) / 100;
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsStageScale: clamped,
    };
    onUpdateConfig(newConfig);
  };

  const handleZoomIn = (delta = 0.05) => {
    handleSetScale(currentStageScale + delta);
  };

  const handleZoomOut = (delta = 0.05) => {
    handleSetScale(currentStageScale - delta);
  };

  // Arrow Nudge Handlers
  const handleNudge = (dx: number, dy: number) => {
    const newX = currentStageOffsetX + dx;
    const newY = currentStageOffsetY + dy;
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsStageOffsetX: newX,
      teamStatsStageOffsetY: newY,
    };
    onUpdateConfig(newConfig);
  };

  // Reset stage alignment to center (0, 0)
  const handleResetAlignment = () => {
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsStageOffsetX: 0,
      teamStatsStageOffsetY: 0,
    };
    onUpdateConfig(newConfig);
    showToast('✓ Stage position aligned to Center (0, 0)');
  };

  // Reset both size and position to defaults
  const handleResetAllStage = () => {
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsStageScale: 1.0,
      teamStatsStageOffsetX: 0,
      teamStatsStageOffsetY: 0,
    };
    onUpdateConfig(newConfig);
    showToast('✓ Stage size and position reset to default (100%, 0, 0)');
  };

  // Handle custom label update
  const handleCustomLabelSubmit = (labelVal: string) => {
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsCustomLabel: labelVal,
    };
    onUpdateConfig(newConfig);
    showToast(`🏷️ Overlay label updated to: "${labelVal || 'Default'}"`);
  };

  // Handle background image file upload (Preserves 100% full original resolution, uncompressed, uncropped)
  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('⚠️ Please upload an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setBgUrlInput(dataUrl);

        // Capture natural image resolution
        const img = new Image();
        img.onload = () => {
          setBgMeta({
            width: img.naturalWidth,
            height: img.naturalHeight,
            sizeKb: Math.round(file.size / 1024),
          });
        };
        img.src = dataUrl;

        // Apply immediately with 'contain' (ZERO crop) and '0' dim (full vibrancy)
        const initialConfig: TournamentConfig = {
          ...config,
          teamStatsBackgroundImage: dataUrl,
          teamStatsBgFit: config.teamStatsBgFit || 'contain',
          teamStatsBgDim: config.teamStatsBgDim ?? 0,
        };
        onUpdateConfig(initialConfig);
        showToast('✓ Full-resolution background loaded (Uncropped)!');

        // Asynchronously persist raw full-resolution binary to server to bypass browser storage quotas
        try {
          setIsUploadingBg(true);
          const res = await fetch('/api/tournament/upload-team-stats-bg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl, fileName: file.name }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.bgUrl) {
              onUpdateConfig({
                ...initialConfig,
                teamStatsBackgroundImage: data.bgUrl,
              });
              setBgUrlInput(data.bgUrl);
              showToast(`✓ Background saved at full resolution (${data.sizeBytes ? `${Math.round(data.sizeBytes / 1024)} KB` : 'uncompressed'})!`);
            }
          }
        } catch (uploadErr) {
          console.warn('Background server upload fallback to local dataUrl', uploadErr);
        } finally {
          setIsUploadingBg(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Apply background URL
  const handleApplyBgUrl = () => {
    const trimmed = bgUrlInput.trim();
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsBackgroundImage: trimmed,
      teamStatsBgFit: config.teamStatsBgFit || 'contain',
      teamStatsBgDim: config.teamStatsBgDim ?? 0,
    };
    onUpdateConfig(newConfig);
    showToast('✓ Background image URL updated (Full resolution, No Crop)!');
  };

  // Clear background
  const handleClearBg = async () => {
    setBgUrlInput('');
    setBgMeta(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsBackgroundImage: '',
    };
    onUpdateConfig(newConfig);
    try {
      await fetch('/api/tournament/reset-team-stats-bg', { method: 'POST' });
    } catch {}
    showToast('✓ Background removed. Default dark esports backdrop restored.');
  };

  // Change background fit mode (No crop: contain vs Fill 16:9 vs Cover)
  const handleBgFitChange = (fit: 'contain' | 'fill' | 'cover') => {
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsBgFit: fit,
    };
    onUpdateConfig(newConfig);
    const fitLabels = {
      contain: 'No Crop (Contain 100% of Image)',
      fill: 'Fill Stage 16:9 (No Crop)',
      cover: 'Cover (Cropped Edges)',
    };
    showToast(`🖼️ Background fit mode set to: ${fitLabels[fit]}`);
  };

  // Change background tint / dim level
  const handleBgDimChange = (dim: number) => {
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsBgDim: dim,
    };
    onUpdateConfig(newConfig);
  };

  // Change position
  const handlePositionChange = (pos: 'left-mid' | 'left-bottom' | 'right-mid' | 'top-left') => {
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsPosition: pos,
    };
    onUpdateConfig(newConfig);
    showToast(`📐 Overlay position updated to: ${pos.toUpperCase()}`);
  };

  // Change display mode (full stage broadcast vs docked hud)
  const handleDisplayModeChange = (mode: 'stage' | 'hud') => {
    const newConfig: TournamentConfig = {
      ...config,
      teamStatsDisplayMode: mode,
    };
    onUpdateConfig(newConfig);
    setPreviewTab(mode);
    showToast(
      mode === 'stage'
        ? '📺 Overlay mode set to: BROADCAST STAGE (1920x1080 Fullscreen)'
        : '📐 Overlay mode set to: DOCKED HUD (Compact Left-Mid)'
    );
  };

  // Copy link helper
  const handleCopyLink = async (key: string, url: string) => {
    await copyToClipboard(url);
    setCopiedKey(key);
    showToast('📋 Link copied to clipboard!');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Compute stats data for selected team
  const computedStats = useMemo(() => {
    return getTeamSquadStats(
      currentSelectedTeamId,
      activePlayers,
      savedMatches,
      config,
      teamStandings,
      config.teamStatsDataSource || 'auto',
      config.teamStatsSelectedMatchId
    );
  }, [
    currentSelectedTeamId,
    activePlayers,
    savedMatches,
    config,
    teamStandings,
  ]);

  // Construct OBS URLs
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const obsStageAlphaUrl = `${baseUrl}/?view=obs&layout=teamstats&transparent=true`;
  const obsHudAlphaUrl = `${baseUrl}/?view=obs&layout=teamstats&mode=hud&transparent=true`;
  const obsTeamUrl = `${baseUrl}/?view=obs&layout=teamstats&team=${currentSelectedTeamId}&transparent=true`;

  const presetLabels = [
    'OVERALL TOURNAMENT',
    'OVERALL STANDINGS',
    'LIVE MATCH',
    'FINALS',
    'DAY 1',
    'MATCH #1',
    'ROUND 3',
  ];

  return (
    <div id="admin-team-stats-container" className="space-y-6">
      {/* Top Header & Operational Banner */}
      <div className="bg-[#0b1322] border border-[#0099ff]/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#0099ff]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-6 bg-[#00d2ff] rounded-sm shadow-[0_0_8px_#00d2ff]" />
              <h2 className="text-xl sm:text-2xl font-black italic tracking-wide uppercase font-['Rajdhani',sans-serif] text-white flex items-center gap-2">
                <span>Team Stats Control Center</span>
                <span className="text-xs not-italic font-mono font-bold px-2 py-0.5 rounded-full bg-[#0099ff]/20 text-[#00d2ff] border border-[#0099ff]/40">
                  REAL-TIME SYNC
                </span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Choose any team below to immediately display their squad statistics on stream. Custom background upload, Live vs Tournament data toggle, and title overrides apply in real-time.
            </p>
          </div>

          {/* Quick Actions / Master Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Stream Overlay Toggle */}
            <button
              id="btn-toggle-team-stats-overlay"
              onClick={handleToggleOverlay}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-['Rajdhani',sans-serif] uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                config.showTeamStatsOverlay
                  ? 'bg-[#00ff66] hover:brightness-110 text-black shadow-[0_0_12px_rgba(0,255,102,0.4)]'
                  : 'bg-[#1e293b] hover:bg-[#334155] text-slate-300 border border-[#334155]'
              }`}
            >
              {config.showTeamStatsOverlay ? (
                <>
                  <Eye className="w-4 h-4" />
                  Stream Overlay: Visible
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  Stream Overlay: Hidden
                </>
              )}
            </button>

            {/* Manual Refresh / Poll Trigger */}
            {onForceRefresh && (
              <button
                onClick={onForceRefresh}
                className="px-3 py-2 rounded-xl bg-[#121f35] hover:bg-[#1a2d4d] text-[#00d2ff] border border-[#0099ff]/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Force refresh spectator API data now"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Data
              </button>
            )}
          </div>
        </div>

        {/* Live Status Indicators & Controls Bar */}
        <div className="mt-4 pt-3 border-t border-[#1b2b46] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Active Selection Badge */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">Current Featured Team:</span>
            <span className="px-2.5 py-1 rounded-lg bg-[#0099ff]/20 border border-[#00d2ff]/40 text-white font-bold font-['Rajdhani',sans-serif] text-sm flex items-center gap-1.5 shadow-[0_0_8px_rgba(0,210,255,0.2)]">
              <span className={`w-2 h-2 rounded-full ${computedStats.teamColor.bg}`} />
              TEAM #{currentSelectedTeamId} — {computedStats.teamName}
            </span>
          </div>

          {/* Display Mode Selector (Stage vs HUD) */}
          <div className="flex items-center gap-1 bg-[#061022] p-1 rounded-xl border border-[#1a83c5]/40">
            <span className="text-[10px] text-slate-400 font-mono px-2">STYLE:</span>
            {(['stage', 'hud'] as const).map((m) => {
              const isActive = (config.teamStatsDisplayMode || 'stage') === m;
              return (
                <button
                  key={m}
                  onClick={() => handleDisplayModeChange(m)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold uppercase transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1a83c5] text-white shadow-[0_0_10px_rgba(26,131,197,0.7)]'
                      : 'text-slate-400 hover:text-white hover:bg-[#121f35]'
                  }`}
                >
                  {m === 'stage' ? 'Broadcast Stage (1080p)' : 'Docked HUD (Small)'}
                </button>
              );
            })}
          </div>

          {/* Position Selector (when in HUD mode) */}
          <div className="flex items-center gap-1 bg-[#061022] p-1 rounded-xl border border-[#1a83c5]/40">
            <span className="text-[10px] text-slate-400 font-mono px-2">POSITION:</span>
            {(['left-mid', 'left-bottom', 'right-mid'] as const).map((pos) => {
              const isActive = (config.teamStatsPosition || 'left-mid') === pos;
              return (
                <button
                  key={pos}
                  onClick={() => handlePositionChange(pos)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold uppercase transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#00e1ff] text-black font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-[#121f35]'
                  }`}
                >
                  {pos === 'left-mid' ? 'Left-Mid (Default)' : pos === 'left-bottom' ? 'Bottom-Left' : 'Right-Mid'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================
          KEY CONTROLS ROW:
          1. Data Source Option (Live Game vs Latest Match vs Overall Tournament)
          2. Custom Label Input (Replaces "TOURNAMENT OVERALL")
          3. Full Stage Background Upload
          4. Stage Size & Position Alignment (Arrows Nudge & Scale)
          ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* CARD 1: Data Source Option */}
        <div className="bg-[#0b1322] border border-[#1a83c5]/40 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-[#00e1ff]" />
              <h3 className="text-sm font-bold uppercase font-['Rajdhani',sans-serif] tracking-wider text-white">
                1. Stats Data Source
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Choose whether the overlay displays live match stats, the latest completed match, or cumulative tournament standings.
            </p>

            {/* Toggle Option Buttons - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Option: Live Game */}
              <button
                onClick={() => handleSourceChange('live')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer text-center ${
                  config.teamStatsDataSource === 'live'
                    ? 'bg-[#00ff66]/15 border-[#00ff66] text-white shadow-[0_0_12px_rgba(0,255,102,0.3)]'
                    : 'bg-[#061022] hover:bg-[#0c1d3b] border-[#1b2b46] text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-black font-['Rajdhani',sans-serif] uppercase tracking-wider text-[#00ff66]">
                  <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse" />
                  Live Game
                </span>
                <span className="text-[10px] font-mono text-slate-400">Active match</span>
              </button>

              {/* Option: Latest Match */}
              <button
                onClick={() => handleSourceChange('latest')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer text-center ${
                  config.teamStatsDataSource === 'latest'
                    ? 'bg-[#00f0ff]/15 border-[#00f0ff] text-white shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                    : 'bg-[#061022] hover:bg-[#0c1d3b] border-[#1b2b46] text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-black font-['Rajdhani',sans-serif] uppercase tracking-wider text-[#00f0ff]">
                  ⚡ Latest Match
                </span>
                <span className="text-[10px] font-mono text-cyan-300/80 font-bold truncate max-w-[110px]">
                  {latestMatch ? `Game #${latestMatch.matchNumber}` : 'Most Recent'}
                </span>
              </button>

              {/* Option: Tournament Cumulative */}
              <button
                onClick={() => handleSourceChange('tournament')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer text-center ${
                  config.teamStatsDataSource === 'tournament'
                    ? 'bg-[#00e1ff]/15 border-[#00e1ff] text-white shadow-[0_0_12px_rgba(0,225,255,0.3)]'
                    : 'bg-[#061022] hover:bg-[#0c1d3b] border-[#1b2b46] text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-black font-['Rajdhani',sans-serif] uppercase tracking-wider text-[#00e1ff]">
                  🏆 Tournament
                </span>
                <span className="text-[10px] font-mono text-slate-400">Cumulative</span>
              </button>

              {/* Option: Auto-Detect */}
              <button
                onClick={() => handleSourceChange('auto')}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer text-center ${
                  !config.teamStatsDataSource || config.teamStatsDataSource === 'auto'
                    ? 'bg-[#1a83c5]/25 border-[#1a83c5] text-white shadow-[0_0_10px_rgba(26,131,197,0.4)]'
                    : 'bg-[#061022] hover:bg-[#0c1d3b] border-[#1b2b46] text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-black font-['Rajdhani',sans-serif] uppercase tracking-wider text-sky-400">
                  🔄 Auto-Detect
                </span>
                <span className="text-[10px] font-mono text-slate-400">Smart switch</span>
              </button>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#1b2b46] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Active mode:</span>
            <span className="text-white font-bold uppercase truncate max-w-[150px]">
              {config.teamStatsDataSource === 'live'
                ? '🔴 Live Match'
                : config.teamStatsDataSource === 'latest'
                ? `⚡ Latest (${latestMatch ? `Game #${latestMatch.matchNumber}` : 'Concluded'})`
                : config.teamStatsDataSource === 'tournament'
                ? '🏆 Tournament'
                : '🔄 Auto-Detect'}
            </span>
          </div>
        </div>

        {/* CARD 2: Custom Label (Replaces 'TOURNAMENT OVERALL') */}
        <div className="bg-[#0b1322] border border-[#1a83c5]/40 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#00e1ff]" />
                <h3 className="text-sm font-bold uppercase font-['Rajdhani',sans-serif] tracking-wider text-white">
                  2. Custom Header Label
                </h3>
              </div>
              {config.teamStatsCustomLabel && (
                <button
                  onClick={() => {
                    setCustomLabelInput('');
                    handleCustomLabelSubmit('');
                  }}
                  className="text-[10px] text-red-400 hover:underline cursor-pointer"
                >
                  Reset Default
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-2.5">
              Replaces the default <span className="text-slate-200 font-mono">"TOURNAMENT OVERALL"</span> text on the stats overlay with whatever you choose.
            </p>

            {/* Custom Input */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <input
                type="text"
                value={customLabelInput}
                onChange={(e) => setCustomLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomLabelSubmit(customLabelInput);
                }}
                placeholder="e.g. OVERALL STANDINGS or FINALS"
                className="w-full px-3 py-1.5 rounded-lg bg-[#061022] border border-[#1a83c5]/50 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-[#00e1ff]"
              />
              <button
                onClick={() => handleCustomLabelSubmit(customLabelInput)}
                className="px-3 py-1.5 rounded-lg bg-[#1a83c5] hover:bg-[#2092db] text-white text-xs font-bold font-['Rajdhani',sans-serif] uppercase cursor-pointer flex-shrink-0"
              >
                Set
              </button>
            </div>

            {/* Quick Preset Chips */}
            <div className="flex flex-wrap gap-1">
              {presetLabels.map((label) => (
                <button
                  key={label}
                  onClick={() => {
                    setCustomLabelInput(label);
                    handleCustomLabelSubmit(label);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    (config.teamStatsCustomLabel || '').toUpperCase() === label
                      ? 'bg-[#00e1ff] text-black font-extrabold shadow-sm'
                      : 'bg-[#061022] text-slate-400 hover:text-white hover:bg-[#121f35] border border-[#1b2b46]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#1b2b46] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Current on Overlay:</span>
            <span className="text-[#00e1ff] font-bold truncate max-w-[170px]">
              "{computedStats.matchLabel}"
            </span>
          </div>
        </div>

        {/* CARD 3: Custom Full Stage Background Upload (Full Resolution & No Crop) */}
        <div className="bg-[#0b1322] border border-[#1a83c5]/40 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#00e1ff]" />
                <h3 className="text-sm font-bold uppercase font-['Rajdhani',sans-serif] tracking-wider text-white">
                  3. Stage Background
                </h3>
              </div>
              {config.teamStatsBackgroundImage && (
                <button
                  onClick={handleClearBg}
                  className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                  title="Remove uploaded background"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Uploads use <strong className="text-emerald-400">100% full original resolution</strong> with <strong className="text-emerald-400">zero cropping</strong> by default.
            </p>

            {/* Upload File + URL Inputs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBgFileUpload}
                  className="hidden"
                  id="stage-bg-file-input"
                />
                <label
                  htmlFor="stage-bg-file-input"
                  className="w-full py-2 px-3 rounded-lg bg-[#121f35] hover:bg-[#1a2d4d] border border-[#1a83c5]/50 text-[#00e1ff] text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isUploadingBg ? 'Uploading Full Resolution...' : 'Upload Image File (PNG/JPG/WEBP)'}
                </label>
              </div>

              {/* Direct URL input */}
              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  value={bgUrlInput}
                  onChange={(e) => setBgUrlInput(e.target.value)}
                  placeholder="Or paste image URL..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#061022] border border-[#1b2b46] text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-[#00e1ff]"
                />
                <button
                  onClick={handleApplyBgUrl}
                  className="px-2.5 py-1.5 rounded-lg bg-[#081b3d] hover:bg-[#0e2a5f] border border-[#1a83c5]/60 text-slate-200 text-xs font-bold font-['Rajdhani',sans-serif] uppercase cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Controls when custom background is active */}
            {config.teamStatsBackgroundImage && (
              <div className="mt-2.5 pt-2.5 border-t border-[#1b2b46]/70 space-y-2">
                {/* Resolution & File details pill */}
                <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-[#061022] border border-[#1a83c5]/30 text-[11px] font-mono">
                  <span className="text-slate-400">Resolution:</span>
                  <span className="text-[#00ff66] font-bold">
                    {bgMeta?.width && bgMeta?.height
                      ? `${bgMeta.width} × ${bgMeta.height} px (Full Res)`
                      : 'Full Original Resolution'}
                  </span>
                </div>

                {/* Fit Mode Selector (Don't Crop) */}
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400 mb-1 flex items-center justify-between">
                    <span>Display Fit:</span>
                    <span className="text-sky-300 font-bold">
                      {config.teamStatsBgFit === 'fill'
                        ? 'Fit 16:9 Canvas (No Crop)'
                        : config.teamStatsBgFit === 'cover'
                        ? 'Cover (Cropped)'
                        : 'Full Image (No Crop)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => handleBgFitChange('contain')}
                      className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        (config.teamStatsBgFit || 'contain') === 'contain'
                          ? 'bg-[#00e1ff] text-black shadow-[0_0_8px_rgba(0,225,255,0.4)]'
                          : 'bg-[#061022] text-slate-400 hover:text-white border border-[#1b2b46]'
                      }`}
                      title="Shows 100% of the entire image with zero cropping"
                    >
                      ✓ No Crop
                    </button>
                    <button
                      onClick={() => handleBgFitChange('fill')}
                      className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        config.teamStatsBgFit === 'fill'
                          ? 'bg-[#00e1ff] text-black shadow-[0_0_8px_rgba(0,225,255,0.4)]'
                          : 'bg-[#061022] text-slate-400 hover:text-white border border-[#1b2b46]'
                      }`}
                      title="Stretches entire image to fill 16:9 broadcast stage without cutting edges"
                    >
                      Fill 16:9
                    </button>
                    <button
                      onClick={() => handleBgFitChange('cover')}
                      className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        config.teamStatsBgFit === 'cover'
                          ? 'bg-[#00e1ff] text-black shadow-[0_0_8px_rgba(0,225,255,0.4)]'
                          : 'bg-[#061022] text-slate-400 hover:text-white border border-[#1b2b46]'
                      }`}
                      title="Cuts outer edges to fill entire viewport"
                    >
                      Cover
                    </button>
                  </div>
                </div>

                {/* Dark Tint / Contrast Opacity Slider / Chips */}
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400 mb-1 flex items-center justify-between">
                    <span>Dark Tint / Contrast:</span>
                    <span className="text-[#00ff66] font-bold">
                      {(config.teamStatsBgDim ?? 0) === 0 ? '0% (Clear / Full Vibrancy)' : `${config.teamStatsBgDim}% Dim`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[0, 15, 30, 50].map((dim) => (
                      <button
                        key={dim}
                        onClick={() => handleBgDimChange(dim)}
                        className={`flex-1 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          (config.teamStatsBgDim ?? 0) === dim
                            ? 'bg-[#1a83c5] text-white'
                            : 'bg-[#061022] text-slate-400 hover:text-white border border-[#1b2b46]'
                        }`}
                      >
                        {dim === 0 ? 'Clear (0%)' : `${dim}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Background thumbnail indicator */}
          <div className="mt-3 pt-2 border-t border-[#1b2b46] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Status:</span>
            {config.teamStatsBackgroundImage ? (
              <span className="text-[#00ff66] font-bold flex items-center gap-1">
                <Check className="w-3 h-3" />
                Full Res Active ({config.teamStatsBgFit === 'fill' ? 'Fill 16:9' : config.teamStatsBgFit === 'cover' ? 'Cover' : 'No Crop'})
              </span>
            ) : (
              <span className="text-slate-400">Default Backdrop</span>
            )}
          </div>
        </div>

        {/* CARD 4: Stage Size & Position Alignment (Arrows Nudge & Size Scaling) */}
        <div className="bg-[#0b1322] border border-[#1a83c5]/40 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Move className="w-4 h-4 text-[#00e1ff]" />
                <h3 className="text-sm font-bold uppercase font-['Rajdhani',sans-serif] tracking-wider text-white">
                  4. Stage Size & Alignment
                </h3>
              </div>
              <button
                onClick={handleResetAllStage}
                className="text-[10px] text-sky-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset scale to 100% and offsets to (0, 0)"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2.5">
              Resize stage overlay and align table position with arrows. Auto-syncs live to all users & OBS.
            </p>

            {/* Scale / Size Adjustment */}
            <div className="bg-[#061022] p-2.5 rounded-xl border border-[#1b2b46] mb-2.5">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-300 font-bold flex items-center gap-1">
                  <Maximize2 className="w-3.5 h-3.5 text-[#00e1ff]" />
                  Size:
                </span>
                <span className="text-[#00e1ff] font-extrabold px-1.5 py-0.5 rounded bg-[#1a83c5]/20 border border-[#1a83c5]/40">
                  {Math.round(currentStageScale * 100)}%
                </span>
              </div>

              {/* Slider with Zoom In / Out Buttons */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => handleZoomOut(0.05)}
                  className="p-1 rounded-lg bg-[#0c1a33] hover:bg-[#12274d] text-slate-300 hover:text-white border border-[#1a83c5]/30 cursor-pointer"
                  title="Decrease size by 5%"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="0.6"
                  max="1.6"
                  step="0.02"
                  value={currentStageScale}
                  onChange={(e) => handleSetScale(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#0e1f3d] rounded-lg appearance-none cursor-pointer accent-[#00e1ff]"
                />
                <button
                  onClick={() => handleZoomIn(0.05)}
                  className="p-1 rounded-lg bg-[#0c1a33] hover:bg-[#12274d] text-slate-300 hover:text-white border border-[#1a83c5]/30 cursor-pointer"
                  title="Increase size by 5%"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Size Presets */}
              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                {[
                  { label: '80%', val: 0.8 },
                  { label: '100%', val: 1.0 },
                  { label: '120%', val: 1.2 },
                  { label: '140%', val: 1.4 },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleSetScale(item.val)}
                    className={`py-0.5 rounded transition-colors cursor-pointer ${
                      Math.abs(currentStageScale - item.val) < 0.03
                        ? 'bg-[#00e1ff] text-black font-extrabold shadow-sm'
                        : 'bg-[#0a1529] hover:bg-[#102242] text-slate-400 hover:text-white border border-[#152745]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Directional Arrows Nudge (D-Pad) */}
            <div className="bg-[#061022] p-2.5 rounded-xl border border-[#1b2b46]">
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-slate-300 font-bold">Align with Arrows:</span>
                {/* Step Size Selector */}
                <div className="flex items-center gap-1 bg-[#0a1529] p-0.5 rounded border border-[#152745] text-[10px]">
                  {[5, 20, 50].map((step) => (
                    <button
                      key={step}
                      onClick={() => setNudgeStep(step)}
                      className={`px-1.5 py-0.5 rounded font-mono cursor-pointer ${
                        nudgeStep === step
                          ? 'bg-[#1a83c5] text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {step}px
                    </button>
                  ))}
                </div>
              </div>

              {/* D-Pad Arrows Layout */}
              <div className="flex items-center justify-between gap-2">
                {/* Arrow Buttons Grid */}
                <div className="grid grid-cols-3 gap-1 w-28 mx-auto">
                  {/* Row 1 */}
                  <div />
                  <button
                    onClick={() => handleNudge(0, -nudgeStep)}
                    className="p-2 rounded-lg bg-[#0c1a33] hover:bg-[#163363] active:bg-[#00e1ff] active:text-black text-[#00e1ff] border border-[#1a83c5]/50 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                    title={`Nudge Up by ${nudgeStep}px`}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <div />

                  {/* Row 2 */}
                  <button
                    onClick={() => handleNudge(-nudgeStep, 0)}
                    className="p-2 rounded-lg bg-[#0c1a33] hover:bg-[#163363] active:bg-[#00e1ff] active:text-black text-[#00e1ff] border border-[#1a83c5]/50 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                    title={`Nudge Left by ${nudgeStep}px`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleResetAlignment}
                    className="p-2 rounded-lg bg-[#0a1529] hover:bg-[#102242] text-slate-400 hover:text-white border border-[#152745] flex items-center justify-center text-[10px] font-mono font-bold transition-all cursor-pointer"
                    title="Reset Position to Center (0, 0)"
                  >
                    ⌖
                  </button>
                  <button
                    onClick={() => handleNudge(nudgeStep, 0)}
                    className="p-2 rounded-lg bg-[#0c1a33] hover:bg-[#163363] active:bg-[#00e1ff] active:text-black text-[#00e1ff] border border-[#1a83c5]/50 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                    title={`Nudge Right by ${nudgeStep}px`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Row 3 */}
                  <div />
                  <button
                    onClick={() => handleNudge(0, nudgeStep)}
                    className="p-2 rounded-lg bg-[#0c1a33] hover:bg-[#163363] active:bg-[#00e1ff] active:text-black text-[#00e1ff] border border-[#1a83c5]/50 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                    title={`Nudge Down by ${nudgeStep}px`}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <div />
                </div>

                {/* Readout Coordinates */}
                <div className="flex flex-col gap-1 text-[10px] font-mono text-slate-400 pr-1">
                  <div className="flex items-center justify-between gap-1">
                    <span>X:</span>
                    <span className={`font-bold ${currentStageOffsetX !== 0 ? 'text-[#00e1ff]' : 'text-slate-300'}`}>
                      {currentStageOffsetX > 0 ? `+${currentStageOffsetX}` : currentStageOffsetX}px
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span>Y:</span>
                    <span className={`font-bold ${currentStageOffsetY !== 0 ? 'text-[#00e1ff]' : 'text-slate-300'}`}>
                      {currentStageOffsetY > 0 ? `+${currentStageOffsetY}` : currentStageOffsetY}px
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div className="mt-3 pt-2 border-t border-[#1b2b46] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Status:</span>
            <span className="text-[#00ff66] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse" />
              Auto-Synced to OBS
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Left (Team Selector Grid) & Right (Live Preview & OBS Specs) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Interactive Team Selector Grid */}
        <div className="xl:col-span-6 space-y-4">
          {/* Prominent Active Broadcast Team Banner - Tells the user immediately what team is featured on stream */}
          {(() => {
            const selectedLivePlayer = activePlayers.find((p) => p.teamId === currentSelectedTeamId);
            const currentSelectedName = resolveTeamDisplayName(
              currentSelectedTeamId,
              selectedLivePlayer?.teamName,
              config,
              activePlayers.length > 0
            );
            const currentSelectedPic =
              config.teamSquadPics?.[currentSelectedTeamId] ||
              config.teamSquadPics?.[String(currentSelectedTeamId)];
            const currentLiveSquad = activePlayers.filter((p) => p.teamId === currentSelectedTeamId);
            const currentAliveCount = currentLiveSquad.filter((p) => !p.bHasDied && p.health > 0).length;
            const currentLiveKills = currentLiveSquad.reduce((sum, p) => sum + (p.killNum || 0), 0);

            return (
              <div className="bg-gradient-to-r from-[#06142e] via-[#091f45] to-[#06142e] border-2 border-[#00d2ff] rounded-2xl p-4 shadow-[0_0_20px_rgba(0,210,255,0.25)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00d2ff]/10 rounded-full blur-xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {currentSelectedPic ? (
                      <img
                        src={currentSelectedPic}
                        alt={currentSelectedName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-contain bg-transparent border-2 border-[#00d2ff] shadow-[0_0_12px_rgba(0,210,255,0.5)] flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#040e22] border-2 border-[#00d2ff]/60 flex items-center justify-center text-[#00d2ff] shadow-[0_0_12px_rgba(0,210,255,0.3)] flex-shrink-0">
                        <Shield className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="px-2 py-0.5 rounded bg-[#00ff66]/20 border border-[#00ff66]/50 text-[#00ff66] font-mono font-bold text-[10px] tracking-wider uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse" />
                          ON AIR (ACTIVE TEAM)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#0099ff]/20 border border-[#0099ff]/40 text-[#00d2ff] font-mono font-bold text-[10px]">
                          SLOT #{currentSelectedTeamId}
                        </span>
                        {currentLiveSquad.length > 0 && (
                          <span className="text-[10px] font-mono font-bold text-slate-300">
                            • {currentAliveCount}/4 Alive • {currentLiveKills} Kills
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg sm:text-xl font-black uppercase font-['Rajdhani',sans-serif] text-white tracking-wide break-words leading-tight" title={currentSelectedName}>
                        {currentSelectedName}
                      </h3>
                    </div>
                  </div>

                  {/* Instant Switcher Dropdown */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                    <span className="text-xs font-mono text-slate-300 font-bold whitespace-nowrap">
                      Switch:
                    </span>
                    <select
                      value={currentSelectedTeamId}
                      onChange={(e) => handleSelectTeam(Number(e.target.value))}
                      className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-[#030a16] border border-[#00d2ff]/60 text-white font-['Rajdhani',sans-serif] font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#00d2ff] cursor-pointer"
                    >
                      {allTeamIds.map((tId) => {
                        const liveP = activePlayers.filter((p) => p.teamId === tId);
                        const name = resolveTeamDisplayName(tId, liveP[0]?.teamName, config, liveP.length > 0);
                        return (
                          <option key={`quick-switch-${tId}`} value={tId} className="bg-[#0b1322] text-white">
                            #{tId}: {name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-[#0b1322] border border-[#1b2b46] rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00d2ff]" />
                <h3 className="text-sm font-bold uppercase font-['Rajdhani',sans-serif] tracking-wider text-white">
                  Click A Team To Feature On Stats Overlay
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {allTeamIds.length} TEAMS • INSTANT OBS SYNC
              </span>
            </div>

            {/* Teams Grid (balanced for 18 teams with full name readability) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
              {allTeamIds.map((tId) => {
                const isSelected = tId === currentSelectedTeamId;
                const tColor = getTeamColor(tId);
                const liveTeamPlayers = activePlayers.filter((p) => p.teamId === tId);
                const isLive = liveTeamPlayers.length > 0;
                const aliveCount = liveTeamPlayers.filter((p) => !p.bHasDied && p.health > 0).length;
                const liveKills = liveTeamPlayers.reduce((s, p) => s + (p.killNum || 0), 0);
                const resolvedName = resolveTeamDisplayName(tId, liveTeamPlayers[0]?.teamName, config, isLive);
                const squadPic = config.teamSquadPics?.[tId] || config.teamSquadPics?.[String(tId)];

                // Check tournament standing for total points
                const standing = teamStandings.find((s) => s.teamId === tId);

                return (
                  <button
                    key={`team-btn-${tId}`}
                    id={`team-select-btn-${tId}`}
                    onClick={() => handleSelectTeam(tId)}
                    title={`Click to switch Team Stats broadcast to Team #${tId}: ${resolvedName}`}
                    className={`relative p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between border ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#0a234d] to-[#06142e] border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.35)] ring-2 ring-[#00f0ff]/60'
                        : 'bg-[#08101e] hover:bg-[#0d1c35] border-[#1b2b46] hover:border-[#0099ff]/60'
                    }`}
                  >
                    {/* Top Row: Team ID Badge & Live Status */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className={`text-[11px] font-mono font-black px-2 py-0.5 rounded border ${tColor.border} ${tColor.bg} ${tColor.text}`}>
                        #{tId}
                      </span>

                      {isLive ? (
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          aliveCount > 0
                            ? 'bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/40'
                            : 'bg-red-500/15 text-red-400 border border-red-500/40'
                        }`}>
                          {aliveCount}/4 ALIVE
                        </span>
                      ) : standing ? (
                        <span className="text-[10px] font-mono text-[#ffb800] font-bold">
                          {standing.totalPoints} PTS
                        </span>
                      ) : null}
                    </div>

                    {/* Team Photo + Full Team Name (No "tea..." truncation!) */}
                    <div className="flex items-start gap-2.5 my-1.5 w-full min-w-0">
                      {squadPic ? (
                        <img
                          src={squadPic}
                          alt={resolvedName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-lg object-contain bg-transparent border border-[#0099ff]/50 flex-shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#040e22] border border-[#1b2b46] flex items-center justify-center text-slate-400 flex-shrink-0 mt-0.5">
                          <Shield className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-xs sm:text-sm font-bold font-['Rajdhani',sans-serif] text-white uppercase tracking-wide leading-snug break-words"
                          title={resolvedName}
                        >
                          {resolvedName}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Stats: Kills and Active/Switch Status */}
                    <div className="pt-2 mt-1 border-t border-[#1b2b46]/60 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">
                        {isLive ? `${liveKills} Kills` : `${standing?.totalKills || 0} Kills`}
                      </span>

                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[#00f0ff] font-bold text-[10px] bg-[#00f0ff]/15 px-1.5 py-0.5 rounded border border-[#00f0ff]/40">
                          <CheckCircle2 className="w-3 h-3" />
                          ON AIR
                        </span>
                      ) : (
                        <span className="text-slate-400 hover:text-[#00d2ff] font-bold text-[10px]">
                          Switch ➔
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick OBS Link Box & Integration Help */}
          <div className="bg-[#0b1322] border border-[#1a83c5]/50 rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-[#00d2ff]" />
                <span className="text-xs font-bold font-['Rajdhani',sans-serif] uppercase tracking-wider text-white">
                  OBS Browser Source URLs (Team Stats)
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#00ff66] bg-[#00ff66]/10 px-2 py-0.5 rounded border border-[#00ff66]/30">
                100% TRANSPARENT
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Add either URL as a 1920×1080 Browser Source in OBS Studio to render the Team Stats overlay:
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Fullscreen Broadcast Stage URL */}
              <div className="bg-[#061022] p-2.5 rounded-xl border border-[#1a83c5]/35 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#00e1ff]">
                    1. FULL BROADCAST STAGE (Custom Background + Table & Team Up Above)
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">1920×1080 Stage</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs text-slate-200 font-mono truncate select-all">
                    {obsStageAlphaUrl}
                  </code>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={obsStageAlphaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-[#121f35] hover:bg-[#1a2d4d] text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Open Stage preview in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleCopyLink('obs-teamstats-stage', obsStageAlphaUrl)}
                      className="px-2.5 py-1 rounded-lg bg-[#1a83c5] hover:bg-[#2092db] text-white text-xs font-bold font-['Rajdhani',sans-serif] uppercase flex items-center gap-1 transition-colors cursor-pointer shadow-[0_0_8px_rgba(26,131,197,0.5)]"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedKey === 'obs-teamstats-stage' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 2: Docked HUD URL */}
              <div className="bg-[#061022] p-2.5 rounded-xl border border-[#1b2b46] flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-300">
                    2. DOCKED IN-GAME HUD (Compact Responsive Card)
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">Live In-Game HUD</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs text-slate-300 font-mono truncate select-all">
                    {obsHudAlphaUrl}
                  </code>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={obsHudAlphaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-[#121f35] hover:bg-[#1a2d4d] text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Open HUD preview in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleCopyLink('obs-teamstats-hud', obsHudAlphaUrl)}
                      className="px-2.5 py-1 rounded-lg bg-[#121f35] hover:bg-[#1a2d4d] text-slate-200 border border-[#1b2b46] text-xs font-bold font-['Rajdhani',sans-serif] uppercase flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedKey === 'obs-teamstats-hud' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Locked team URL option */}
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>Lock URL to strictly Team #{currentSelectedTeamId}:</span>
                <button
                  onClick={() => handleCopyLink('obs-locked-team', obsTeamUrl)}
                  className="text-[#00d2ff] hover:underline font-mono font-bold cursor-pointer"
                >
                  {copiedKey === 'obs-locked-team' ? '✓ Copied Locked URL' : 'Copy Locked Team URL'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Exact Live Graphic Preview */}
        <div className="xl:col-span-6 flex flex-col space-y-4">
          <div className="w-full bg-[#0b1322] border border-[#1b2b46] rounded-2xl p-4 shadow-md flex flex-col">
            {/* Header & Style Mode Switcher for Preview */}
            <div className="w-full flex items-center justify-between mb-4 pb-2 border-b border-[#1b2b46]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00f0ff]" />
                <h3 className="text-sm font-bold uppercase font-['Rajdhani',sans-serif] tracking-wider text-white">
                  Live Stream Overlay Preview
                </h3>
              </div>

              {/* Preview Style Tabs */}
              <div className="flex items-center gap-1 bg-[#061022] p-0.5 rounded-lg border border-[#1a83c5]/30">
                <button
                  onClick={() => setPreviewTab('stage')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase transition-all cursor-pointer ${
                    previewTab === 'stage'
                      ? 'bg-[#1a83c5] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Full Stage (1080p)
                </button>
                <button
                  onClick={() => setPreviewTab('hud')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase transition-all cursor-pointer ${
                    previewTab === 'hud'
                      ? 'bg-[#00e1ff] text-black font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Small HUD
                </button>
              </div>
            </div>

            {/* Preview Display Area */}
            {previewTab === 'stage' ? (
              /* Full Stage Mode Preview: Clean Table with Team Chosen Up Above It, Custom Background, No Logo */
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-[#1a83c5]/60 bg-[#050A1F] flex flex-col items-center justify-center p-4 shadow-[0_0_30px_rgba(26,131,197,0.3)]">
                {/* Uploaded Background Image (if configured) - Full resolution & uncropped by default */}
                {config.teamStatsBackgroundImage ? (
                  <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={config.teamStatsBackgroundImage}
                      alt="Uploaded Background"
                      className={
                        config.teamStatsBgFit === 'fill'
                          ? 'w-full h-full object-fill'
                          : config.teamStatsBgFit === 'cover'
                          ? 'w-full h-full object-cover'
                          : 'w-full h-full object-contain'
                      }
                      style={{ imageRendering: 'high-quality' }}
                    />
                    {(config.teamStatsBgDim ?? 0) > 0 && (
                      <div
                        className="absolute inset-0 bg-black transition-opacity duration-200"
                        style={{ opacity: (config.teamStatsBgDim ?? 0) / 100 }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-[#050A1F] z-0" />
                )}

                {/* Content: Team Chosen Above Table + Table (Scaled & Aligned) */}
                <div
                  className="relative z-10 w-full max-w-xl flex flex-col items-center text-center transition-transform duration-100 ease-out"
                  style={{
                    transform: `translate(${Math.round(currentStageOffsetX * 0.35)}px, ${Math.round(currentStageOffsetY * 0.35)}px) scale(${currentStageScale})`,
                    transformOrigin: 'center center',
                  }}
                >
                  {/* Label chosen in Admin Panel */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-8 h-[1.5px] bg-[#1a83c5]" />
                    <span className="px-2.5 py-0.5 rounded bg-[#1a83c5]/30 border border-[#1a83c5]/60 text-[#00e1ff] font-mono font-extrabold uppercase tracking-widest text-[10px] sm:text-xs">
                      {computedStats.matchLabel}
                    </span>
                    <span className="w-8 h-[1.5px] bg-[#1a83c5]" />
                  </div>

                  {/* Team Chosen Name Up Above Table (No logo, No team number) */}
                  <h2 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase font-['Rajdhani',sans-serif] tracking-wider text-white drop-shadow-[0_2px_15px_rgba(26,131,197,0.8)] leading-tight mb-3">
                    {computedStats.teamName}
                  </h2>

                  {/* The Main Stats Table */}
                  <div className="w-full rounded-lg overflow-hidden border border-[#1a83c5] bg-[#0A1535]/95 shadow-[0_0_20px_rgba(26,131,197,0.4)]">
                    <table className="w-full table-fixed border-collapse text-left">
                      <thead>
                        <tr className="border-b border-[#1a83c5] bg-[#0A1535]">
                          <th className="w-[26%] bg-[#1a83c5] px-2 py-1.5 text-center font-['Rajdhani',sans-serif] font-black text-xs sm:text-sm tracking-wider text-white uppercase border-r border-[#1a83c5]">
                            STATS
                          </th>
                          {computedStats.players.map((p, idx) => (
                            <th
                              key={`stage-prev-h-${idx}`}
                              className="px-1.5 py-1.5 text-center bg-[#071536] border-r border-[#1a83c5]/50 last:border-r-0"
                            >
                              <div className="truncate text-[10px] sm:text-xs font-['Rajdhani',sans-serif] font-black uppercase text-white">
                                {p.playerName}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="text-[10px] sm:text-xs font-mono">
                        <tr className="border-b border-[#1a83c5]/50 bg-[#0A1535]/90">
                          <td className="px-2 py-1.5 bg-[#050A1F] border-r border-[#1a83c5]/50 font-['Rajdhani',sans-serif] font-black text-white uppercase tracking-wider">
                            ELIMS
                          </td>
                          {computedStats.players.map((p, idx) => (
                            <td key={`stage-prev-k-${idx}`} className="text-center px-1 py-1.5 border-r border-[#1a83c5]/30 last:border-r-0 font-bold text-[#00ff66]">
                              {p.kills}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-[#1a83c5]/50 bg-[#071330]/90">
                          <td className="px-2 py-1.5 bg-[#04081c] border-r border-[#1a83c5]/50 font-['Rajdhani',sans-serif] font-black text-white uppercase tracking-wider">
                            DAMAGE
                          </td>
                          {computedStats.players.map((p, idx) => (
                            <td key={`stage-prev-d-${idx}`} className="text-center px-1 py-1.5 border-r border-[#1a83c5]/30 last:border-r-0 text-white">
                              {p.damage}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-[#1a83c5]/50 bg-[#0A1535]/90">
                          <td className="px-2 py-1.5 bg-[#050A1F] border-r border-[#1a83c5]/50 font-['Rajdhani',sans-serif] font-black text-white uppercase tracking-wider">
                            KNOCKS
                          </td>
                          {computedStats.players.map((p, idx) => (
                            <td key={`stage-prev-kn-${idx}`} className="text-center px-1 py-1.5 border-r border-[#1a83c5]/30 last:border-r-0 text-purple-300">
                              {p.knockouts}
                            </td>
                          ))}
                        </tr>
                        <tr className="bg-[#071330]/90">
                          <td className="px-2 py-1.5 bg-[#04081c] border-r border-[#1a83c5]/50 font-['Rajdhani',sans-serif] font-black text-white uppercase tracking-wider">
                            TIME
                          </td>
                          {computedStats.players.map((p, idx) => (
                            <td key={`stage-prev-t-${idx}`} className="text-center px-1 py-1.5 border-r border-[#1a83c5]/30 last:border-r-0 text-slate-300 text-[9px] sm:text-[10px]">
                              {p.survivalTimeFormatted}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Floating Scale & Offset Badge in Preview */}
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#020510]/85 border border-[#1a83c5]/50 text-[10px] font-mono text-[#00e1ff] backdrop-blur-sm shadow-md">
                  <span>Size: {Math.round(currentStageScale * 100)}%</span>
                  <span className="text-slate-500">•</span>
                  <span>
                    Offset: ({currentStageOffsetX > 0 ? `+${currentStageOffsetX}` : currentStageOffsetX}px,{' '}
                    {currentStageOffsetY > 0 ? `+${currentStageOffsetY}` : currentStageOffsetY}px)
                  </span>
                </div>
              </div>
            ) : (
              /* Small HUD Mode Preview: Responsive TeamStatsCard */
              <div className="relative p-4 rounded-xl bg-[#020510]/80 border border-[#0099ff]/20 shadow-inner flex items-center justify-center overflow-x-auto w-full">
                <TeamStatsCard
                  stats={computedStats}
                  tournamentName={config.name || 'VIRTUOCITY BATTLEGROUND'}
                  isCompact={true}
                />
              </div>
            )}

            {/* Card Specs and Dimensions Info */}
            <div className="w-full mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded-xl bg-[#061022] border border-[#1b2b46]">
                <div className="text-[10px] text-slate-400">ACTIVE STYLE</div>
                <div className="text-white font-bold uppercase">{config.teamStatsDisplayMode || 'stage'} Mode</div>
              </div>
              <div className="p-2 rounded-xl bg-[#061022] border border-[#1b2b46]">
                <div className="text-[10px] text-slate-400">DATA SOURCE</div>
                <div className="text-[#00d2ff] font-bold uppercase truncate">
                  {config.teamStatsDataSource === 'latest' ? 'Latest Match' : config.teamStatsDataSource || 'auto'}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#061022] border border-[#1b2b46]">
                <div className="text-[10px] text-slate-400">CUSTOM LABEL</div>
                <div className="text-white font-bold truncate">{config.teamStatsCustomLabel || 'Default'}</div>
              </div>
              <div className="p-2 rounded-xl bg-[#061022] border border-[#1b2b46]">
                <div className="text-[10px] text-slate-400">STAGE BG</div>
                <div className={config.teamStatsBackgroundImage ? 'text-[#00ff66] font-bold text-[11px] truncate' : 'text-slate-400 text-[11px]'}>
                  {config.teamStatsBackgroundImage
                    ? config.teamStatsBgFit === 'fill'
                      ? 'Fill 16:9'
                      : config.teamStatsBgFit === 'cover'
                      ? 'Cover'
                      : 'Full Res (No Crop)'
                    : 'Default'}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#061022] border border-[#1b2b46]">
                <div className="text-[10px] text-slate-400">STAGE SIZE</div>
                <div className="text-[#00e1ff] font-bold">{Math.round(currentStageScale * 100)}%</div>
              </div>
              <div className="p-2 rounded-xl bg-[#061022] border border-[#1b2b46]">
                <div className="text-[10px] text-slate-400">ALIGNMENT</div>
                <div className="text-white font-bold truncate">
                  {currentStageOffsetX > 0 ? `+${currentStageOffsetX}` : currentStageOffsetX},{' '}
                  {currentStageOffsetY > 0 ? `+${currentStageOffsetY}` : currentStageOffsetY}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

