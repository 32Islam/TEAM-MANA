import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  RotateCcw,
  AlertTriangle,
  Globe,
  Zap,
  CheckCircle2,
  XCircle,
  Hash,
  Pause,
  Play,
  Trophy,
  EyeOff,
  Clock,
  Sliders,
  ArrowUp,
  ArrowDown,
  Cloud,
  HardDrive,
  Flame,
  Check,
} from 'lucide-react';
import { TournamentConfig, TournamentMode } from '../types/pubg';
import {
  DEFAULT_CONFIG,
  SCORING_PRESETS,
  DEFAULT_TIE_BREAKER_RULES,
} from '../utils/pubgCalculations';
import { fetchSpectatorApi, normalizeApiUrl } from '../utils/spectatorApi';
import { VirtuocityLogo } from './VirtuocityLogo';
import { LogoUploadSlot } from './LogoUploadSlot';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TournamentConfig;
  onSave: (newConfig: TournamentConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [formData, setFormData] = useState<TournamentConfig>({ ...config });
  const [testStatus, setTestStatus] = useState<{
    testing: boolean;
    success?: boolean;
    message?: string;
  }>({ testing: false });

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...config, totalMatches: config.totalMatches || 5 });
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleTestUrl = async () => {
    const normalized = normalizeApiUrl(formData.apiUrl);
    setFormData((prev) => ({ ...prev, apiUrl: normalized }));
    setTestStatus({ testing: true });

    try {
      const result = await fetchSpectatorApi(normalized, 4000);
      if (result.success) {
        setTestStatus({
          testing: false,
          success: true,
          message: `Connected successfully! (${result.latencyMs}ms via ${result.via}) - ${result.data.length} players found.`,
        });
      } else {
        setTestStatus({
          testing: false,
          success: false,
          message: result.error || 'Cannot reach URL',
        });
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      setTestStatus({
        testing: false,
        success: false,
        message: err,
      });
    }
  };

  const handlePresetMain = () => {
    setFormData((prev) => ({ ...prev, apiUrl: 'https://main.yousery.tech/gettotalplayerlist' }));
    setTestStatus({ testing: false });
  };

  const handlePresetLocal = () => {
    setFormData((prev) => ({ ...prev, apiUrl: 'http://127.0.0.1:10086/getplayerlist' }));
    setTestStatus({ testing: false });
  };

  const handlePresetNgrok = () => {
    if (!formData.apiUrl.includes('ngrok')) {
      setFormData((prev) => ({ ...prev, apiUrl: 'https://your-tunnel.ngrok-free.app/getplayerlist' }));
    }
    setTestStatus({ testing: false });
  };

  const handleRankPointChange = (rank: number, val: string) => {
    const num = parseInt(val, 10) || 0;
    setFormData((prev) => ({
      ...prev,
      rankPointsTable: {
        ...prev.rankPointsTable,
        [rank]: num,
      },
    }));
  };

  const handleResetDefaults = () => {
    if (confirm('Reset tournament settings and point rules to defaults?')) {
      setFormData({ ...DEFAULT_CONFIG });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#1a1a1f] border border-[#2d2d35] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d35] bg-[#121216]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-500 text-black font-semibold px-2 py-0.5 rounded text-[10px] tracking-tighter  ">
                SETTINGS
              </span>
              <h2 className="text-lg font-bold  text-white   tracking-wider">
                Tournament & Scoring Rules
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              Customize local spectator API port, game mode, and esports point distribution
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-[#2d2d35] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Section 1: Tournament Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold   tracking-widest text-amber-400">
              1. Basic Tournament Setup
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold tracking-wider text-gray-400 mb-1.5">
                  Tournament Title
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#121216] border border-[#2d2d35] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#ffb800]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold tracking-wider text-gray-400 mb-1.5">
                  Tournament Mode
                </label>
                <select
                  value={formData.mode}
                  onChange={(e) =>
                    setFormData({ ...formData, mode: e.target.value as TournamentMode })
                  }
                  className="w-full bg-[#121216] border border-[#2d2d35] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#ffb800]"
                >
                  <option value="squad">Squad (4 players / team)</option>
                  <option value="trio">Trio (3 players / team)</option>
                  <option value="duo">Duo (2 players / team)</option>
                  <option value="solo">Solo (1 player / team)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-wider text-gray-400 mb-1.5">
                  OBS Default Theme
                </label>
                <select
                  value={formData.obsTheme || 'vibrant'}
                  onChange={(e) =>
                    setFormData({ ...formData, obsTheme: e.target.value as any })
                  }
                  className="w-full bg-[#121216] border border-[#2d2d35] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#1a83c5]"
                >
                  <option value="transparent">Transparent (Overlay Alpha)</option>
                  <option value="vibrant">Vibrant Esports</option>
                  <option value="dark-esports">Dark Esports (#050A1F)</option>
                  <option value="neon">Neon Glow</option>
                </select>
              </div>
            </div>

            {/* Stage Logo Setting & PNG Upload Slot */}
            <div className="p-3.5 rounded-xl bg-[#121216] border border-[#2d2d35] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold   tracking-wider text-white flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-[#1a83c5]" />
                    Tournament Stage & Broadcast Logo (PNG Slot)
                  </label>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Upload your tournament PNG logo or emblem. Applied across Between-Games stage and OBS broadcast.
                  </p>
                </div>
              </div>

              <LogoUploadSlot
                currentLogoUrl={formData.logoUrl}
                onLogoChange={(newUrl) => setFormData({ ...formData, logoUrl: newUrl })}
              />

              {/* Toggle to Hide Main Logo on Between-Games Stage Leaderboard (Default: Enabled) */}
              <div className="pt-2 border-t border-[#2d2d35]/60 flex items-center justify-between gap-3">
                <div>
                  <label className="text-xs font-bold tracking-wider text-white flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5 text-[#1a83c5]" />
                    Hide Main Logo on Between-Games Stage Leaderboard
                  </label>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Default: Hidden. Keeps the stage leaderboard clean and focused on standings. Toggle off if you wish to display the large logo.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={formData.hideBetweenGamesLogo !== false}
                    onChange={(e) =>
                      setFormData({ ...formData, hideBetweenGamesLogo: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#2d2d35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1a83c5]"></div>
                </label>
              </div>
            </div>

            {/* Total Rounds / Matches Editor */}
            <div className="p-3.5 rounded-xl bg-[#121216] border border-[#2d2d35] space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold   tracking-wider text-white flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-amber-400" />
                    Total Tournament Rounds (Scheduled Matches)
                  </label>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Controls how many games are played. Leaderboard displays progress (e.g. 3 of 5) and finishes when reached.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, totalMatches: Math.max(1, (prev.totalMatches || 5) - 1) }))}
                    className="w-8 h-8 rounded-lg bg-[#2d2d35] hover:bg-[#3d3d45] text-white font-bold flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formData.totalMatches || 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        totalMatches: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    className="w-16 bg-[#1a1a1f] border border-[#ffb80066] rounded-lg px-2 py-1.5 text-center font-semibold  text-base text-amber-400 focus:outline-none focus:border-[#ffb800]"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, totalMatches: (prev.totalMatches || 5) + 1 }))}
                    className="w-8 h-8 rounded-lg bg-[#2d2d35] hover:bg-[#3d3d45] text-white font-bold flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quick Presets for Total Rounds */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-gray-500 font-bold   mr-1">Quick Presets:</span>
                {[3, 4, 5, 6, 8, 10, 12, 16].map((rounds) => (
                  <button
                    key={rounds}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, totalMatches: rounds }))}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      (formData.totalMatches || 5) === rounds
                        ? 'bg-amber-500 text-black font-semibold'
                        : 'bg-[#222228] hover:bg-[#2d2d35] text-gray-300'
                    }`}
                  >
                    {rounds} Rounds
                  </button>
                ))}
              </div>
            </div>

            {/* Upcoming Games Status (Active vs Paused / No More Games) */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              formData.isPaused
                ? 'bg-[#ffb80015] border-[#ffb80055]'
                : 'bg-[#121216] border-[#2d2d35]'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold   tracking-wider text-white flex items-center gap-1.5">
                    {formData.isPaused ? (
                      <Pause className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    Pause Tournament &bull; No More Upcoming Games
                  </span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    When paused, the stream overlay stops showing &quot;Upcoming Game Getting Ready&quot; and locks in official <strong>Final Tournament Standings</strong>.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.isPaused)}
                    onChange={(e) =>
                      setFormData({ ...formData, isPaused: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#2d2d35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Local Spectate API Connection */}
          <div className="space-y-4 pt-4 border-t border-[#2d2d35]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold   tracking-widest text-amber-400">
                2. Live Spectate Data Connection (ngrok or Localhost)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePresetMain}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-[#00ff6615] border border-[#00ff6644] px-2.5 py-1 rounded hover:bg-[#00ff6625] transition-colors"
                  title="Official API: https://main.yousery.tech/gettotalplayerlist"
                >
                  <Zap className="w-3 h-3" />
                  main.yousery.tech
                </button>
                <button
                  type="button"
                  onClick={handlePresetNgrok}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#1a83c5] bg-[#1a83c515] border border-[#1a83c544] px-2 py-1 rounded hover:bg-[#1a83c525] transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  ngrok Link
                </button>
                <button
                  type="button"
                  onClick={handlePresetLocal}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-300 bg-[#2d2d35] border border-[#3d3d45] px-2 py-1 rounded hover:bg-[#3d3d45] transition-colors"
                >
                  <Globe className="w-3 h-3" />
                  127.0.0.1
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold   tracking-wider text-gray-400 mb-1.5">
                  Spectator API Endpoint URL (e.g. your ngrok tunnel link)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                    placeholder="https://xxxx.ngrok-free.app/getplayerlist"
                    className="flex-1 bg-[#121216] border border-[#2d2d35] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#ffb800]"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleTestUrl}
                    disabled={testStatus.testing}
                    className="px-3 py-2 bg-[#2d2d35] hover:bg-amber-500 hover:text-black text-white rounded-lg text-xs font-bold   transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {testStatus.testing ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold   tracking-wider text-gray-400 mb-1.5">
                  Live Polling Speed
                </label>
                <select
                  value={formData.pollInterval}
                  onChange={(e) =>
                    setFormData({ ...formData, pollInterval: Number(e.target.value) })
                  }
                  className="w-full bg-[#121216] border border-[#2d2d35] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#ffb800]"
                >
                  <option value={1000}>1.0 second (Fastest)</option>
                  <option value={1500}>1.5 seconds (Recommended)</option>
                  <option value={2000}>2.0 seconds</option>
                  <option value={3000}>3.0 seconds</option>
                </select>
              </div>
            </div>

            {/* Test result banner */}
            {testStatus.message && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                  testStatus.success
                    ? 'bg-[#00ff6610] border-[#00ff6644] text-emerald-400'
                    : 'bg-[#ff4b2b10] border-[#ff4b2b44] text-[#ff4b2b]'
                }`}
              >
                {testStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="font-mono">{testStatus.message}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#121216] border border-[#ffb80044] text-amber-400 text-xs flex gap-2.5">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
              <div>
                <strong className="font-bold block mb-0.5 text-white">Using ngrok locally:</strong>
                Run <code className="bg-black/60 px-1.5 py-0.5 rounded text-amber-400 font-mono">ngrok http 10086</code> in your command prompt. Copy the Forwarding HTTPS link (e.g. <code className="bg-black/60 px-1.5 py-0.5 rounded text-[#1a83c5] font-mono">https://xxxx.ngrok-free.app</code>) and paste it here. Free ngrok browser warning pages and CORS headers are automatically handled!
              </div>
            </div>
          </div>

          {/* Section 3: Points & Scoring */}
          <div className="space-y-4 pt-4 border-t border-[#2d2d35]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                3. Esports Scoring Points Matrix & System Presets
              </h3>
            </div>

            {/* Quick Scoring Presets */}
            <div className="p-3 rounded-xl bg-[#121824] border border-[#1e293b] space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold uppercase tracking-wider font-rajdhani">
                <span>Select Official Scoring System Preset:</span>
                <span className="text-[10px] text-amber-400 font-mono">1-Click Apply</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(SCORING_PRESETS).map(([key, preset]) => {
                  const isCurrent =
                    formData.killPointsPerKill === preset.killPoints &&
                    formData.rankPointsTable[1] === preset.rankPoints[1] &&
                    formData.rankPointsTable[2] === preset.rankPoints[2] &&
                    formData.rankPointsTable[3] === preset.rankPoints[3];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          scoringPreset: key as any,
                          killPointsPerKill: preset.killPoints,
                          rankPointsTable: { ...preset.rankPoints },
                        }));
                      }}
                      className={`px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-amber-500/20 border-amber-400/80 text-white shadow-[0_0_12px_rgba(255,184,0,0.3)]'
                          : 'bg-[#0f1622] border-[#1e293b] text-slate-300 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase font-rajdhani">{key}</span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{preset.name}</div>
                      <div className="text-[10px] text-amber-400 font-mono mt-1">
                        1st: {preset.rankPoints[1]} pts • Kill: {preset.killPoints}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 font-rajdhani">
                  Points Per Kill (Elimination Multiplier)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={formData.killPointsPerKill}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        killPointsPerKill: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full bg-[#121824] border border-[#1e293b] rounded-lg px-3 py-2 text-white text-xs font-bold font-mono focus:outline-none focus:border-[#ffb800]"
                  />
                  <span className="text-xs text-slate-400 font-mono flex-shrink-0">pts / kill</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 font-rajdhani">
                  OBS Stream Refresh Interval
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={2}
                    max={120}
                    value={formData.streamRefreshInterval}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        streamRefreshInterval: Math.max(2, parseInt(e.target.value, 10) || 3),
                      })
                    }
                    className="w-full bg-[#121216] border border-[#2d2d35] rounded-lg px-3 py-2 text-white text-xs font-bold font-mono focus:outline-none focus:border-[#ffb800]"
                  />
                  <span className="text-gray-400 text-xs font-mono">seconds</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 font-rajdhani">
                  Placement / Rank Points Table (Placements 1 to 18)
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Editable Per Rank</span>
              </div>
              <div className="grid grid-cols-3 xs:grid-cols-6 md:grid-cols-9 gap-2">
                {Array.from({ length: 18 }, (_, i) => i + 1).map((rank) => (
                  <div key={rank} className="bg-[#121824] p-2 rounded-xl border border-[#1e293b] text-center">
                    <span className="block text-[11px] font-bold text-slate-400 font-mono">#{rank}</span>
                    <input
                      type="number"
                      min={0}
                      value={formData.rankPointsTable[rank] ?? 0}
                      onChange={(e) => handleRankPointChange(rank, e.target.value)}
                      className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg px-1.5 py-1 text-center text-xs font-bold text-amber-400 focus:outline-none focus:border-[#ffb800] mt-1 font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Tie Breaker Priority Rules */}
          <div className="space-y-4 pt-4 border-t border-[#2d2d35]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-sky-400" />
                4. Competition Tie Breaker Priority Order
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      tieBreakerRules: ['wwcd', 'placement_points', 'kills', 'damage', 'recent_match', 'highest_single_match'],
                    }))
                  }
                  className="px-2 py-0.5 rounded text-[10px] font-bold font-rajdhani uppercase bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 transition-colors"
                >
                  Reset Official SUPER
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              When two or more teams tie on total points, their rank is resolved step-by-step using this exact priority order. Reorder using the up/down arrows:
            </p>

            {/* Tie Breaker Reorderable List */}
            <div className="space-y-1.5">
              {(formData.tieBreakerRules || DEFAULT_TIE_BREAKER_RULES).map((ruleKey, idx, arr) => {
                const ruleDetails: Record<string, { title: string; desc: string }> = {
                  wwcd: { title: '1st Place Wins (WWCD)', desc: 'Total number of first-place chicken dinners' },
                  placement_points: { title: 'Accumulated Placement Points', desc: 'Total points earned from rank/placement' },
                  kills: { title: 'Total Kills (Eliminations)', desc: 'Total frags across all tournament matches' },
                  damage: { title: 'Total Damage Dealt', desc: 'Cumulative combat damage across the tournament' },
                  recent_match: { title: 'Most Recent Match Placement', desc: 'Higher placement in the latest game played' },
                  highest_single_match: { title: 'Highest Single-Match Score', desc: 'Best single match total points performance' },
                };
                const rule = ruleDetails[ruleKey] || { title: ruleKey, desc: '' };

                return (
                  <div
                    key={ruleKey}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#121824] border border-[#1e293b] hover:border-[#334155] transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-[#182234] border border-sky-400/40 text-sky-400 font-mono text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white font-rajdhani uppercase tracking-wide truncate">
                          {rule.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{rule.desc}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          if (idx === 0) return;
                          const nextRules = [...(formData.tieBreakerRules || DEFAULT_TIE_BREAKER_RULES)];
                          const temp = nextRules[idx - 1];
                          nextRules[idx - 1] = nextRules[idx];
                          nextRules[idx] = temp;
                          setFormData((prev) => ({ ...prev, tieBreakerRules: nextRules }));
                        }}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          idx === 0
                            ? 'opacity-30 border-transparent text-slate-600 cursor-not-allowed'
                            : 'bg-[#182234] border-[#1e293b] text-slate-300 hover:text-white hover:border-sky-400 cursor-pointer'
                        }`}
                        title="Move Up in Priority"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === arr.length - 1}
                        onClick={() => {
                          if (idx === arr.length - 1) return;
                          const nextRules = [...(formData.tieBreakerRules || DEFAULT_TIE_BREAKER_RULES)];
                          const temp = nextRules[idx + 1];
                          nextRules[idx + 1] = nextRules[idx];
                          nextRules[idx] = temp;
                          setFormData((prev) => ({ ...prev, tieBreakerRules: nextRules }));
                        }}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          idx === arr.length - 1
                            ? 'opacity-30 border-transparent text-slate-600 cursor-not-allowed'
                            : 'bg-[#182234] border-[#1e293b] text-slate-300 hover:text-white hover:border-sky-400 cursor-pointer'
                        }`}
                        title="Move Down in Priority"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Overlay & Broadcast FX */}
          <div className="pt-4 border-t border-[#2d2d35] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              5. Stream Overlay & Broadcast HUD Triggers
            </h3>

            {/* Top 4 HUD Auto-Hide Control */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#121824] border border-[#1e293b]">
              <div>
                <span className="text-xs font-bold tracking-wider text-white block font-rajdhani uppercase">
                  Top 4 HUD: Keep Hidden Until Top 4 Teams Alive
                </span>
                <span className="text-[11px] text-gray-400">
                  When enabled, Top 4 HUD stays hidden in the background during gameplay until 4 teams remain alive, then automatically slides into view!
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={formData.top4HudAutoHideUntilTop4 !== false}
                  onChange={(e) =>
                    setFormData({ ...formData, top4HudAutoHideUntilTop4: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2d2d35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00FF66]"></div>
              </label>
            </div>

            {/* Team Stats Trigger Display Duration */}
            <div className="p-3.5 rounded-xl bg-[#121824] border border-[#1e293b] space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold tracking-wider text-white flex items-center gap-1.5 font-rajdhani uppercase">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    Team Stats Pop Overlay Trigger Duration (20s Default)
                  </span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    When triggered by admin, overlay displays for this duration then automatically returns to hidden until triggered again.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={formData.teamStatsTriggerDurationSeconds ?? 20}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        teamStatsTriggerDurationSeconds: Math.max(5, parseInt(e.target.value, 10) || 20),
                      })
                    }
                    className="w-16 bg-[#0a0d14] border border-[#1e293b] rounded-lg px-2 py-1.5 text-center font-bold text-sm text-sky-400 focus:outline-none focus:border-sky-400 font-mono"
                  />
                  <span className="text-xs font-mono text-gray-400">sec</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#1e293b]">
                <span className="text-[10px] text-gray-500 font-bold mr-1">Presets:</span>
                {[10, 15, 20, 25, 30, 45].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, teamStatsTriggerDurationSeconds: sec }))}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      (formData.teamStatsTriggerDurationSeconds ?? 20) === sec
                        ? 'bg-sky-500 text-black font-semibold'
                        : 'bg-[#182234] hover:bg-[#223049] text-gray-300'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#121216] border border-[#2d2d35]">
              <div>
                <span className="text-xs font-bold   tracking-wider text-white block">
                  Animate Placement & Standings Changes
                </span>
                <span className="text-[11px] text-gray-400">
                  Enables smooth sliding spring animations in the side overlay when teams change rank or score points.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={formData.animatePlacementChanges !== false}
                  onChange={(e) =>
                    setFormData({ ...formData, animatePlacementChanges: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2d2d35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#121216] border border-[#2d2d35]">
              <div>
                <span className="text-xs font-bold   tracking-wider text-white block">
                  Auto-Prompt / Auto-Save on Match End
                </span>
                <span className="text-[11px] text-gray-400">
                  Saves playerInfoList to cache even if API drops post-match.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={formData.autoSaveOnMatchEnd}
                  onChange={(e) =>
                    setFormData({ ...formData, autoSaveOnMatchEnd: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2d2d35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Between Games Stage Page Slider Time */}
            <div className="p-3.5 rounded-xl bg-[#121216] border border-[#2d2d35] space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold tracking-wider text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    Between Games Stage Leaderboard Slide Time
                  </span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    How many seconds each 8-team page displays before automatically cycling to the next page.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        stageSlideIntervalSeconds: Math.max(0, (prev.stageSlideIntervalSeconds ?? 20) - 5),
                      }))
                    }
                    className="w-8 h-8 rounded-lg bg-[#2d2d35] hover:bg-[#3d3d45] text-white font-bold flex items-center justify-center text-sm cursor-pointer"
                  >
                    -5
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={formData.stageSlideIntervalSeconds ?? 20}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stageSlideIntervalSeconds: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-16 bg-[#1a1a1f] border border-[#1a83c566] rounded-lg px-2 py-1.5 text-center font-semibold text-base text-sky-400 focus:outline-none focus:border-[#1a83c5]"
                  />
                  <span className="text-xs font-mono text-gray-400">sec</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        stageSlideIntervalSeconds: Math.min(180, (prev.stageSlideIntervalSeconds ?? 20) + 5),
                      }))
                    }
                    className="w-8 h-8 rounded-lg bg-[#2d2d35] hover:bg-[#3d3d45] text-white font-bold flex items-center justify-center text-sm cursor-pointer"
                  >
                    +5
                  </button>
                </div>
              </div>
              {/* Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#1E293B]">
                <span className="text-[10px] text-gray-500 font-bold mr-1">Presets:</span>
                {[5, 10, 15, 20, 25, 30, 45, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, stageSlideIntervalSeconds: sec }))}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      (formData.stageSlideIntervalSeconds ?? 20) === sec
                        ? 'bg-[#1a83c5] text-black font-semibold'
                        : 'bg-[#222228] hover:bg-[#2d2d35] text-gray-300'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, stageSlideIntervalSeconds: 0 }))}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    (formData.stageSlideIntervalSeconds ?? 20) === 0
                      ? 'bg-amber-500 text-black font-semibold'
                      : 'bg-[#222228] hover:bg-[#2d2d35] text-gray-300'
                  }`}
                >
                  Pause Auto-Slide
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Automatic Backup & Data Loss Protection */}
          <div className="pt-4 border-t border-[#2d2d35] space-y-4">
            <h3 className="text-xs font-bold   tracking-widest text-sky-400 flex items-center gap-1.5">
              <span>🛡️</span>
              <span>5. Automatic Backup &amp; Data Loss Protection</span>
            </h3>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#121216] border border-[#2d2d35]">
              <div>
                <span className="text-xs font-bold   tracking-wider text-white block">
                  Enable Periodic Rolling Auto-Backups
                </span>
                <span className="text-[11px] text-gray-400">
                  Automatically saves rolling snapshots in browser storage every 10 minutes and after each game.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={formData.enableAutoBackup !== false}
                  onChange={(e) =>
                    setFormData({ ...formData, enableAutoBackup: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2d2d35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold   tracking-wider text-gray-400 mb-1.5">
                  Auto-Backup Interval
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={formData.autoBackupIntervalMinutes || 10}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        autoBackupIntervalMinutes: Math.max(3, parseInt(e.target.value, 10) || 10),
                      })
                    }
                    className="w-full bg-[#121216] border border-[#2d2d35] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#1a83c5]"
                  />
                  <span className="text-gray-400 text-xs">minutes</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold   tracking-wider text-gray-400 mb-1.5">
                  Unexported File Reminder Prompt
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={formData.exportReminderHours || 2}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        exportReminderHours: Math.max(1, parseInt(e.target.value, 10) || 2),
                      })
                    }
                    className="w-full bg-[#121216] border border-[#2d2d35] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#1a83c5]"
                  />
                  <span className="text-gray-400 text-xs">hours</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Operator Security & Multi-Device Concurrency Lock */}
          <div className="pt-4 border-t border-[#2d2d35] space-y-4">
            <h3 className="text-xs font-bold   tracking-widest text-emerald-400 flex items-center gap-1.5">
              <span>🔒</span>
              <span>6. Operator Safety &amp; Single-Device Admin Lock</span>
            </h3>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#121216] border border-[#2d2d35]">
              <div>
                <span className="text-xs font-bold   tracking-wider text-white block">
                  Enforce Single-Device Admin Lock
                </span>
                <span className="text-[11px] text-gray-400">
                  Ensures only one device can operate the Admin Panel at any time, preventing conflicting edits, duplicate match uploads, or glitches.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={formData.enableSingleAdminLock !== false}
                  onChange={(e) =>
                    setFormData({ ...formData, enableSingleAdminLock: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2d2d35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          {/* Section 7: Google Drive Cloud Auto-Save */}
          <div className="pt-4 border-t border-[#2d2d35] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#4285F4] flex items-center gap-1.5 font-rajdhani">
              <Cloud className="w-4 h-4 text-[#4285F4]" />
              7. Google Drive Cloud Auto-Backup After Each Game
            </h3>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#121824] border border-[#1e293b]">
              <div>
                <span className="text-xs font-bold tracking-wider text-white block font-rajdhani uppercase">
                  Auto-Save Tournament &amp; Matches to Google Drive
                </span>
                <span className="text-[11px] text-gray-400">
                  Automatically uploads a full JSON snapshot of tournament standings and matches to your designated Google Drive folder after each game.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={formData.enableGoogleDriveAutoSave !== false}
                  onChange={(e) =>
                    setFormData({ ...formData, enableGoogleDriveAutoSave: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#2d2d35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4285F4]"></div>
              </label>
            </div>

            <div className="p-3.5 rounded-xl bg-[#121824] border border-[#1e293b] space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 font-rajdhani">
                Google Drive Target Folder Name
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.googleDriveFolderName || 'PUBG Tournament Backups'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      googleDriveFolderName: e.target.value.trim() || 'PUBG Tournament Backups',
                    })
                  }
                  placeholder="PUBG Tournament Backups"
                  className="w-full bg-[#0a0d14] border border-[#1e293b] rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#4285F4]"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                The application will automatically find or create this folder in your connected Google Drive to store JSON archives.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-[#2d2d35]">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#2d2d35] hover:bg-[#3d3d45] text-gray-300 text-xs font-bold   tracking-wider"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:brightness-110 text-black text-xs font-semibold   tracking-wider shadow-lg shadow-[#ffb80022] transition-all"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
