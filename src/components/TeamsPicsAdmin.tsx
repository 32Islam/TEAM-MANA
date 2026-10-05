import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  Link,
  Eye,
  RefreshCw,
  Users,
  Flag,
  Globe,
  Search,
  Check,
  X,
} from 'lucide-react';
import { TournamentConfig, SavedMatch, PlayerRawInfo } from '../types/pubg';
import { getTeamColor } from '../utils/pubgCalculations';
import { WINNER_CELEBRATION_DURATION_MS } from './WinnerCelebration';
import {
  POPULAR_COUNTRIES,
  getTeamFlagUrl,
  getCountryName,
  getCountryEmoji,
} from '../utils/flagHelper';
import { notifyConfigUpdated } from '../utils/storage';
import { TeamFlag } from './TeamFlag';

interface TeamsPicsAdminProps {
  config: TournamentConfig;
  savedMatches?: SavedMatch[];
  activePlayers?: PlayerRawInfo[];
  onUpdateConfig: (updatedConfig: TournamentConfig) => void;
  showToast?: (msg: string) => void;
}

export const TeamsPicsAdmin: React.FC<TeamsPicsAdminProps> = ({
  config,
  savedMatches = [],
  activePlayers = [],
  onUpdateConfig,
  showToast = (_msg: string) => {},
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<number>(1);
  const [urlInput, setUrlInput] = useState<string>('');
  const [showUrlModal, setShowUrlModal] = useState<boolean>(false);

  // Custom Flag URL modal state
  const [selectedFlagTeamId, setSelectedFlagTeamId] = useState<number | null>(null);
  const [flagUrlInput, setFlagUrlInput] = useState<string>('');
  const [showFlagUrlModal, setShowFlagUrlModal] = useState<boolean>(false);

  const [isTesting, setIsTesting] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any stale/expired test win trigger from previous sessions
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pubg_test_win_trigger');
      if (raw) {
        const data = JSON.parse(raw);
        if (!data?.timestamp || Date.now() - data.timestamp >= 7000 || data.timestamp < 0) {
          localStorage.removeItem('pubg_test_win_trigger');
        }
      }
    } catch {}
  }, []);

  // Discover all relevant teams (at least 1..18, plus any teams in saved matches or live players)
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

  const teamSquadPics = config.teamSquadPics || {};
  const teamFlags = config.teamFlags || {};
  const isFlagsEnabled = config.showTeamFlags !== false;

  // Toggle display of flags on overlays
  const handleToggleShowFlags = () => {
    const nextVal = !isFlagsEnabled;
    const nextConfig: TournamentConfig = {
      ...config,
      showTeamFlags: nextVal,
    };
    onUpdateConfig(nextConfig);
    notifyConfigUpdated(nextConfig);
    showToast(
      nextVal
        ? '🚩 Team Country Flags active on Top 4 HUD & Winner Celebration!'
        : '🏳️ Team Flags muted on stream.'
    );
  };

  // Set country flag for a team
  const handleSetFlag = (teamId: number, flagVal: string) => {
    const trimmed = flagVal.trim();
    if (!trimmed) {
      handleRemoveFlag(teamId);
      return;
    }
    const updatedFlags = {
      ...teamFlags,
      [teamId]: trimmed,
      [String(teamId)]: trimmed,
    };
    const nextConfig: TournamentConfig = {
      ...config,
      teamFlags: updatedFlags,
    };
    onUpdateConfig(nextConfig);
    notifyConfigUpdated(nextConfig);
    const country = getCountryName(trimmed);
    showToast(`🚩 ${country} flag assigned to Team #${teamId}!`);
  };

  // Remove country flag
  const handleRemoveFlag = (teamId: number) => {
    const updatedFlags = { ...teamFlags };
    delete updatedFlags[teamId];
    delete updatedFlags[String(teamId)];
    const nextConfig: TournamentConfig = {
      ...config,
      teamFlags: updatedFlags,
    };
    onUpdateConfig(nextConfig);
    notifyConfigUpdated(nextConfig);
    showToast(`Flag cleared for Team #${teamId}.`);
  };

  // Handle uploading custom flag file
  const handleCustomFlagUpload = (teamId: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('❌ Please select a valid image file (PNG, JPG, SVG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 320;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/png');
          handleSetFlag(teamId, compressed);
        } else {
          handleSetFlag(teamId, rawDataUrl);
        }
      };
      img.onerror = () => handleSetFlag(teamId, rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Custom flag URL submit
  const handleCustomFlagUrlSubmit = (teamId: number) => {
    if (!flagUrlInput.trim()) return;
    handleSetFlag(teamId, flagUrlInput.trim());
    setFlagUrlInput('');
    setShowFlagUrlModal(false);
  };

  // Handle uploading squad image file (auto-compress / resize to base64)
  const handleFileUpload = (teamId: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('❌ Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) return;

      // Compress and scale down huge raw images to prevent localStorage quota exhaustion
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        // Strictly enable alpha channel support for RGBA mode transparency
        const ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) {
          // Clear any canvas contents with full transparent pixels
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          // Strictly export as PNG to preserve transparent background and alpha channel
          const compressed = canvas.toDataURL('image/png');

          const updatedPics = {
            ...teamSquadPics,
            [teamId]: compressed,
            [String(teamId)]: compressed,
          };
          const newCfg: TournamentConfig = {
            ...config,
            teamSquadPics: updatedPics,
          };
          onUpdateConfig(newCfg);
          notifyConfigUpdated(newCfg);
          showToast(`📸 4-Player Squad image successfully mapped to Team #${teamId}!`);
        }
      };
      img.onerror = () => {
        const updatedPics = {
          ...teamSquadPics,
          [teamId]: rawDataUrl,
          [String(teamId)]: rawDataUrl,
        };
        const newCfg: TournamentConfig = {
          ...config,
          teamSquadPics: updatedPics,
        };
        onUpdateConfig(newCfg);
        notifyConfigUpdated(newCfg);
        showToast(`📸 Squad image mapped to Team #${teamId}!`);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleUrlSubmit = (teamId: number) => {
    if (!urlInput.trim()) return;
    const updatedPics = {
      ...teamSquadPics,
      [teamId]: urlInput.trim(),
      [String(teamId)]: urlInput.trim(),
    };
    const newCfg: TournamentConfig = {
      ...config,
      teamSquadPics: updatedPics,
    };
    onUpdateConfig(newCfg);
    notifyConfigUpdated(newCfg);
    setUrlInput('');
    setShowUrlModal(false);
    showToast(`📸 4-Player Squad image URL mapped to Team #${teamId}!`);
  };

  const handleDeleteSquadPic = (teamId: number) => {
    const updatedPics = { ...teamSquadPics };
    delete updatedPics[teamId];
    delete updatedPics[String(teamId)];

    const newCfg: TournamentConfig = {
      ...config,
      teamSquadPics: updatedPics,
    };
    onUpdateConfig(newCfg);
    notifyConfigUpdated(newCfg);
    showToast(`Squad image removed for Team #${teamId}.`);
  };

  // Cancel / dismiss active test celebration immediately
  const handleCancelCelebration = () => {
    if (testTimerRef.current) {
      clearTimeout(testTimerRef.current);
      testTimerRef.current = null;
    }
    setIsTesting(null);
    try {
      localStorage.removeItem('pubg_test_win_trigger');
      localStorage.setItem('pubg_test_win_cancel', String(Date.now()));
      window.dispatchEvent(new CustomEvent('CANCEL_WINNER_CELEBRATION'));
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('pubg_winner_celebration_channel');
        bc.postMessage({ type: 'WINNER_CANCEL' });
        setTimeout(() => {
          try {
            bc.close();
          } catch {}
        }, 1000);
      }
    } catch {}
    showToast('Winner celebration dismissed.');
  };

  // Trigger test animation on overlays & local preview
  const handleTestWinnerCelebration = (teamId: number) => {
    if (isTesting === teamId) {
      handleCancelCelebration();
      return;
    }

    if (testTimerRef.current) {
      clearTimeout(testTimerRef.current);
    }

    setIsTesting(teamId);
    const teamName =
      config.customTeamNames?.[teamId] ||
      config.customTeamNames?.[String(teamId)] ||
      `TEAM #${teamId}`;

    const payload = {
      teamId,
      teamName,
      timestamp: Date.now(),
    };

    // 1. Dispatch local window event
    try {
      window.dispatchEvent(
        new CustomEvent('TRIGGER_WINNER_CELEBRATION', { detail: payload })
      );
    } catch {}

    // 2. Broadcast to all open overlay windows / OBS browser sources
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('pubg_winner_celebration_channel');
        bc.postMessage({ type: 'WINNER_TRIGGER', winner: payload });
        setTimeout(() => {
          try {
            bc.close();
          } catch {}
        }, 15000);
      } catch (e) {
        console.warn('BroadcastChannel trigger error', e);
      }
    }

    // 3. Set localStorage to ensure reliable trigger across tabs & OBS browser sources
    try {
      localStorage.setItem(
        'pubg_test_win_trigger',
        JSON.stringify({ ...payload, _t: Date.now() })
      );
    } catch {}

    showToast(`🎉 Triggered 7-Second Winner Celebration for ${teamName}!`);
    testTimerRef.current = setTimeout(() => {
      setIsTesting(null);
      try {
        localStorage.removeItem('pubg_test_win_trigger');
      } catch {}
    }, WINNER_CELEBRATION_DURATION_MS);
  };

  const mappedPicsCount = Object.keys(teamSquadPics).filter(
    (k) => !isNaN(Number(k))
  ).length;

  const mappedFlagsCount = Object.keys(teamFlags).filter(
    (k) => !isNaN(Number(k))
  ).length;

  // Filtered teams list based on search
  const filteredTeamIds = useMemo(() => {
    if (!searchFilter.trim()) return allTeamIds;
    const query = searchFilter.toLowerCase().trim();
    return allTeamIds.filter((teamId) => {
      const teamName = (
        config.customTeamNames?.[teamId] ||
        config.customTeamNames?.[String(teamId)] ||
        `TEAM #${teamId}`
      ).toLowerCase();
      const flagVal = teamFlags[teamId] || teamFlags[String(teamId)] || '';
      const country = getCountryName(flagVal).toLowerCase();
      return (
        String(teamId).includes(query) ||
        teamName.includes(query) ||
        country.includes(query)
      );
    });
  }, [allTeamIds, searchFilter, config.customTeamNames, teamFlags]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-[#0A1535]/80 border border-[#1a83c5] rounded-2xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Geometric accent */}
        <div className="absolute top-2 right-2 pointer-events-none">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M 24 16 L 24 4 L 20 0 L 8 0" stroke="#f1223e" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a83c5] to-[#0A1A3A] border border-[#1a83c5]/80 flex items-center justify-center text-white shadow-[0_0_15px_rgba(26,131,197,0.6)] flex-shrink-0">
              <Users className="w-6 h-6 text-[#00d2ff]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase bg-[#1a83c5]/20 text-[#1a83c5] border border-[#1a83c5]/40 px-2 py-0.5 rounded">
                  ESPORTS BROADCAST ASSETS
                </span>
                <span className="text-xs text-sky-400 font-mono font-bold">
                  {mappedFlagsCount} of {allTeamIds.length} Flags Assigned
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  • {mappedPicsCount} of {allTeamIds.length} Squad Pics Mapped
                </span>
              </div>
              <h2 className="text-2xl font-rajdhani font-black uppercase tracking-wider text-white mt-1">
                Teams Pics &amp; Flags Management
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                Assign <strong>Team Country Flags</strong> (e.g. 🇸🇦 Saudi Arabia, 🇮🇳 India, 🇵🇰 Pakistan) and <strong>4-player squad pictures</strong> to each Team ID. Flags appear dynamically on the <strong>Top 4 HUD</strong> and in the <strong>Winner Celebration banner</strong>.
              </p>
            </div>
          </div>

          {/* Master Controls: Flags Toggle & Test Celebration */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Master Flags Visibility Toggle */}
            <button
              type="button"
              onClick={handleToggleShowFlags}
              className={`px-3.5 py-2.5 rounded-xl border font-rajdhani font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md ${
                isFlagsEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/60 hover:bg-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Toggle whether country flags show on Top 4 HUD and Winner celebrations"
            >
              <Flag className="w-4 h-4" />
              <span>Flags on Top 4 &amp; Win:</span>
              <span className="font-mono text-[11px] font-black underline">
                {isFlagsEnabled ? 'ENABLED' : 'MUTED'}
              </span>
            </button>

            {/* Test Celebration button or Dismiss button */}
            {isTesting !== null ? (
              <button
                onClick={handleCancelCelebration}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-rajdhani font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.5)] active:scale-95 animate-pulse"
                title="Click to cancel celebration immediately"
              >
                <X className="w-4 h-4" />
                <span>Dismiss Celebration (Team #{isTesting})</span>
              </button>
            ) : (
              <button
                onClick={() => handleTestWinnerCelebration(selectedTeamId)}
                className="px-4 py-2.5 rounded-xl bg-[#1a83c5] hover:bg-[#146ba3] text-white font-rajdhani font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(26,131,197,0.4)] active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Test Winner Celebration (7s)</span>
              </button>
            )}
          </div>
        </div>

        {/* Search / Filter Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter teams by Name, ID, or Country..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#050A1F] border border-[#1a83c5]/40 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#00d2ff]"
            />
          </div>
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="text-xs text-slate-400 hover:text-white font-mono"
            >
              Clear filter ({filteredTeamIds.length} shown)
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BULK TEAM LOGOS UPLOAD (BY TEAM ID: 004.png, 4.jpg, etc.)                 */}
      {/* ========================================================================= */}
      <div className="bg-[#121824] border border-[#38bdf8]/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/40 flex items-center justify-center text-[#38bdf8] flex-shrink-0 mt-0.5">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 px-2 py-0.5 rounded">
                  BATCH ASSETS INGESTION
                </span>
                <span className="text-xs text-amber-400 font-mono font-bold">
                  {mappedFlagsCount} Logos / Flags Active
                </span>
              </div>
              <h3 className="text-lg font-heading font-black uppercase tracking-wider text-white mt-1">
                Upload Bulk Team Logos by ID (e.g. 004.png, 4.jpg)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                Select multiple logo files at once. The system parses the Team ID directly from each filename (e.g. <code className="bg-[#0a0d14] px-1.5 py-0.5 rounded text-amber-400 font-mono">004.png</code> or <code className="bg-[#0a0d14] px-1.5 py-0.5 rounded text-sky-400 font-mono">4.jpg</code> for Team #4, <code className="bg-[#0a0d14] px-1.5 py-0.5 rounded text-emerald-400 font-mono">team_12.png</code> for Team #12) and maps them across all broadcast stream overlays!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <label className="px-4 py-2.5 rounded-xl bg-[#38bdf8] hover:bg-[#0284c7] text-black font-heading font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-[#38bdf8]/20 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Select Bulk Logo Files</span>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;

                  const fileList: File[] = Array.from(files);
                  let successCount = 0;
                  const mappedIds: number[] = [];
                  const updatedFlags = { ...teamFlags };

                  // Process all selected files
                  let processedCount = 0;
                  fileList.forEach((file: File) => {
                    // Extract ID from filename: e.g. "004.png" -> 4, "team_04.jpg" -> 4
                    const match = file.name.match(/\d+/);
                    if (!match) {
                      processedCount++;
                      return;
                    }

                    const parsedId = parseInt(match[0], 10);
                    if (isNaN(parsedId) || parsedId < 1) {
                      processedCount++;
                      return;
                    }

                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const rawData = evt.target?.result as string;
                      if (!rawData) {
                        processedCount++;
                        return;
                      }

                      // Resize / optimize logo to 256px max width/height to avoid storage quota limits
                      const img = new Image();
                      img.onload = () => {
                        const maxDim = 256;
                        const canvas = document.createElement('canvas');
                        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                        canvas.width = Math.round(img.width * scale);
                        canvas.height = Math.round(img.height * scale);
                        const ctx = canvas.getContext('2d', { alpha: true });
                        if (ctx) {
                          ctx.clearRect(0, 0, canvas.width, canvas.height);
                          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                          const optimizedDataUrl = canvas.toDataURL('image/png');
                          updatedFlags[parsedId] = optimizedDataUrl;
                          updatedFlags[String(parsedId)] = optimizedDataUrl;
                        } else {
                          updatedFlags[parsedId] = rawData;
                          updatedFlags[String(parsedId)] = rawData;
                        }

                        successCount++;
                        mappedIds.push(parsedId);
                        processedCount++;

                        if (processedCount === fileList.length) {
                          const newCfg: TournamentConfig = {
                            ...config,
                            teamFlags: updatedFlags,
                          };
                          onUpdateConfig(newCfg);
                          notifyConfigUpdated(newCfg);
                          showToast(
                            `✅ Successfully imported ${successCount} team logos: (IDs: ${mappedIds.sort((a,b)=>a-b).join(', ')})!`
                          );
                        }
                      };
                      img.onerror = () => {
                        updatedFlags[parsedId] = rawData;
                        updatedFlags[String(parsedId)] = rawData;
                        successCount++;
                        mappedIds.push(parsedId);
                        processedCount++;

                        if (processedCount === fileList.length) {
                          const newCfg: TournamentConfig = {
                            ...config,
                            teamFlags: updatedFlags,
                          };
                          onUpdateConfig(newCfg);
                          notifyConfigUpdated(newCfg);
                          showToast(
                            `✅ Successfully imported ${successCount} team logos: (IDs: ${mappedIds.sort((a,b)=>a-b).join(', ')})!`
                          );
                        }
                      };
                      img.src = rawData;
                    };
                    reader.readAsDataURL(file);
                  });

                  e.target.value = '';
                }}
              />
            </label>

            {mappedFlagsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Clear all uploaded team logos and country flags?')) {
                    const newCfg: TournamentConfig = {
                      ...config,
                      teamFlags: {},
                    };
                    onUpdateConfig(newCfg);
                    notifyConfigUpdated(newCfg);
                    showToast('🗑️ Cleared all team logos.');
                  }
                }}
                className="px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold font-rajdhani uppercase tracking-wider transition-colors cursor-pointer"
              >
                Clear All Logos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Teams with Country Flag Selector & Squad Image Upload */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTeamIds.map((teamId) => {
          const squadPic =
            teamSquadPics[teamId] || teamSquadPics[String(teamId)];
          const teamName =
            config.customTeamNames?.[teamId] ||
            config.customTeamNames?.[String(teamId)] ||
            `TEAM #${teamId}`;
          const isCurrentlyTesting = isTesting === teamId;

          const flagVal = teamFlags[teamId] || teamFlags[String(teamId)] || '';
          const flagUrl = getTeamFlagUrl(flagVal);
          const countryName = getCountryName(flagVal);
          const isCustomFlag =
            Boolean(flagVal) &&
            (flagVal.startsWith('http') || flagVal.startsWith('data:image/'));

          return (
            <div
              key={teamId}
              id={`card-team-pic-${teamId}`}
              className={`relative bg-[#0A1535]/80 border rounded-2xl p-4 transition-all flex flex-col justify-between ${
                squadPic || flagVal
                  ? 'border-[#1a83c5] hover:border-[#00d2ff] shadow-lg'
                  : 'border-[#1a83c5]/30 hover:border-[#1a83c5] border-dashed'
              } ${
                isCurrentlyTesting
                  ? 'ring-2 ring-[#f1223e] shadow-[0_0_20px_rgba(241,34,62,0.5)]'
                  : ''
              }`}
            >
              <div>
                {/* Top row: Team ID, Team Name & Status Badges */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <span className="text-white font-sans font-bold text-sm block truncate">
                        {teamName}
                      </span>
                      <span className="text-[10px] font-mono text-[#00d2ff]">
                        TEAM ID: {teamId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {flagVal ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center gap-1"
                        title={`Country: ${countryName}`}
                      >
                        <Flag className="w-2.5 h-2.5" />
                        <span>FLAG</span>
                      </span>
                    ) : null}

                    {squadPic ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>PIC</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-400 bg-black/40 border border-slate-800">
                        NO PIC
                      </span>
                    )}
                  </div>
                </div>

                {/* --- 1. TEAM COUNTRY FLAG SECTION --- */}
                <div className="bg-[#050A1F]/90 border border-[#1a83c5]/40 rounded-xl p-2.5 mb-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 font-bold flex items-center gap-1.5 uppercase">
                      <Flag className="w-3.5 h-3.5 text-[#00d2ff]" />
                      Team Country Flag
                    </span>
                    {flagVal ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveFlag(teamId)}
                        className="text-red-400 hover:text-red-300 text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                        title="Remove flag"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-normal">None Set</span>
                    )}
                  </div>

                  {/* Active Flag Live Preview */}
                  {flagVal ? (
                    <div className="flex items-center gap-2.5 bg-[#0A1535] p-2 rounded-lg border border-[#1a83c5]/50 shadow-inner">
                      <TeamFlag
                        flagValue={flagVal}
                        teamId={teamId}
                        className="w-10 h-6 sm:w-11 sm:h-7 rounded border border-white/30 shadow-md flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold font-sans text-white block truncate">
                          {countryName}
                        </span>
                        <span className="text-[10px] font-mono text-[#00d2ff] block">
                          Visible on Top 4 HUD &amp; Win
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Country Flag Dropdown Selector */}
                  <div className="space-y-1.5">
                    <select
                      value={isCustomFlag ? '__custom__' : flagVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setSelectedFlagTeamId(teamId);
                          setShowFlagUrlModal(true);
                        } else if (val) {
                          handleSetFlag(teamId, val);
                        } else {
                          handleRemoveFlag(teamId);
                        }
                      }}
                      className="w-full bg-[#0A1535] border border-[#1a83c5]/60 rounded-lg px-2.5 py-1.5 text-xs text-white font-sans focus:outline-none focus:border-[#00d2ff] cursor-pointer"
                    >
                      <option value="">-- Select Country Flag --</option>
                      <optgroup label="⭐ Popular Esports Flags">
                        <option value="sa">🇸🇦 Saudi Arabia</option>
                        <option value="in">🇮🇳 India</option>
                        <option value="pk">🇵🇰 Pakistan</option>
                        <option value="np">🇳🇵 Nepal</option>
                        <option value="bd">🇧🇩 Bangladesh</option>
                        <option value="ae">🇦🇪 United Arab Emirates</option>
                        <option value="kw">🇰🇼 Kuwait</option>
                        <option value="qa">🇶🇦 Qatar</option>
                        <option value="bh">🇧🇭 Bahrain</option>
                        <option value="om">🇴🇲 Oman</option>
                        <option value="eg">🇪🇬 Egypt</option>
                        <option value="jo">🇯🇴 Jordan</option>
                        <option value="iq">🇮🇶 Iraq</option>
                        <option value="tr">🇹🇷 Turkey</option>
                        <option value="mn">🇲🇳 Mongolia</option>
                        <option value="kz">🇰🇿 Kazakhstan</option>
                        <option value="mm">🇲🇲 Myanmar</option>
                      </optgroup>
                      <optgroup label="🌍 All Countries (A-Z)">
                        {POPULAR_COUNTRIES.map((c) => (
                          <option key={`country-${teamId}-${c.code}`} value={c.code}>
                            {c.emoji} {c.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="⚙️ Custom Upload / URL">
                        <option value="__custom__">🔗 Custom Flag Image / URL...</option>
                      </optgroup>
                    </select>

                    {/* Quick 1-Click Common Esports Flag Chips */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">Quick:</span>
                      <button
                        type="button"
                        onClick={() => handleSetFlag(teamId, 'sa')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                          flagVal === 'sa'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/80 font-bold'
                            : 'bg-[#0A1535] text-slate-300 border-slate-700 hover:border-[#00d2ff]'
                        }`}
                        title="Set Saudi Arabia Flag"
                      >
                        🇸🇦 KSA
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFlag(teamId, 'np')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                          flagVal === 'np'
                            ? 'bg-red-500/20 text-red-400 border-red-500/80 font-bold'
                            : 'bg-[#0A1535] text-slate-300 border-slate-700 hover:border-[#00d2ff]'
                        }`}
                        title="Set Nepal Flag"
                      >
                        🇳🇵 NEP
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFlag(teamId, 'in')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                          flagVal === 'in'
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/80 font-bold'
                            : 'bg-[#0A1535] text-slate-300 border-slate-700 hover:border-[#00d2ff]'
                        }`}
                        title="Set India Flag"
                      >
                        🇮🇳 IND
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFlag(teamId, 'pk')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                          flagVal === 'pk'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/80 font-bold'
                            : 'bg-[#0A1535] text-slate-300 border-slate-700 hover:border-[#00d2ff]'
                        }`}
                        title="Set Pakistan Flag"
                      >
                        🇵🇰 PAK
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFlag(teamId, 'bd')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                          flagVal === 'bd'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/80 font-bold'
                            : 'bg-[#0A1535] text-slate-300 border-slate-700 hover:border-[#00d2ff]'
                        }`}
                        title="Set Bangladesh Flag"
                      >
                        🇧🇩 BD
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFlag(teamId, 'ae')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                          flagVal === 'ae'
                            ? 'bg-sky-500/20 text-sky-400 border-sky-500/80 font-bold'
                            : 'bg-[#0A1535] text-slate-300 border-slate-700 hover:border-[#00d2ff]'
                        }`}
                        title="Set UAE Flag"
                      >
                        🇦🇪 UAE
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFlag(teamId, 'qa')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                          flagVal === 'qa'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/80 font-bold'
                            : 'bg-[#0A1535] text-slate-300 border-slate-700 hover:border-[#00d2ff]'
                        }`}
                        title="Set Qatar Flag"
                      >
                        🇶🇦 QAT
                      </button>
                    </div>
                  </div>
                </div>

                {/* --- 2. 4-PLAYER SQUAD PICTURE SECTION --- */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 font-bold flex items-center gap-1 uppercase">
                      <ImageIcon className="w-3.5 h-3.5 text-[#1a83c5]" />
                      Squad Photo (Winner Popup)
                    </span>
                  </div>

                  <div
                    className="relative w-full h-[120px] rounded-xl overflow-hidden border border-[#1a83c5]/40 flex items-center justify-center group"
                    style={{ background: 'transparent' }}
                  >
                    {squadPic ? (
                      <>
                        <img
                          src={squadPic}
                          alt={`${teamName} 4-Player Squad`}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          style={{ background: 'transparent' }}
                        />
                        {/* Hover controls overlay */}
                        <div className="absolute inset-0 bg-[#050A1F]/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label
                            htmlFor={`file-upload-${teamId}`}
                            className="p-2 rounded-lg bg-[#1a83c5] hover:bg-[#146ba3] text-white text-xs font-bold cursor-pointer transition-colors shadow-md"
                            title="Replace squad picture"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteSquadPic(teamId)}
                            className="p-2 rounded-lg bg-[#f1223e] hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-md cursor-pointer"
                            title="Remove squad picture"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      /* Empty Upload Prompt Area */
                      <label
                        htmlFor={`file-upload-${teamId}`}
                        className="w-full h-full flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-[#0A1535] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-xl bg-[#1a83c5]/15 text-[#1a83c5] flex items-center justify-center mb-1 border border-[#1a83c5]/30">
                          <Upload className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-rajdhani font-bold text-white uppercase tracking-wider">
                          Upload 4-Player Squad Pic
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono">
                          PNG, JPG or Click to browse
                        </span>
                      </label>
                    )}

                    <input
                      id={`file-upload-${teamId}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(teamId, file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Action Buttons: URL, Custom Flag File, & Test Win */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTeamId(teamId);
                    setShowUrlModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#050A1F] hover:bg-[#101D42] text-[#1a83c5] hover:text-white border border-[#1a83c5]/40 text-xs font-mono transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Paste direct squad image URL"
                >
                  <Link className="w-3 h-3" />
                  <span>Pic URL</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    isCurrentlyTesting
                      ? handleCancelCelebration()
                      : handleTestWinnerCelebration(teamId)
                  }
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-rajdhani font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    isCurrentlyTesting
                      ? 'bg-[#f1223e] text-white animate-pulse'
                      : 'bg-[#1a83c5]/20 hover:bg-[#1a83c5] text-[#1a83c5] hover:text-white border border-[#1a83c5]/50'
                  }`}
                  title={
                    isCurrentlyTesting
                      ? 'Click to cancel/dismiss celebration'
                      : "Preview 7-second slide-in animation on overlays with this team's flag & pic"
                  }
                >
                  {isCurrentlyTesting ? (
                    <>
                      <X className="w-3 h-3" />
                      <span>Dismiss (7s)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Test Win</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Squad Pic URL Input Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#050A1F] border border-[#1a83c5] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-rajdhani font-bold text-white uppercase tracking-wider">
                Map Squad Pic via URL (Team #{selectedTeamId})
              </h3>
              <button
                onClick={() => setShowUrlModal(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Enter direct URL of the 4-player squad picture for Team #{selectedTeamId}:
            </p>

            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/squad_pic.jpg"
              className="w-full px-3 py-2 bg-[#0A1535] border border-[#1a83c5] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[#00d2ff]"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUrlModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-gray-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUrlSubmit(selectedTeamId)}
                className="px-4 py-2 rounded-xl bg-[#1a83c5] hover:bg-[#146ba3] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Save URL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Flag URL / File Upload Modal */}
      {showFlagUrlModal && selectedFlagTeamId !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#050A1F] border border-[#00d2ff] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-rajdhani font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Flag className="w-5 h-5 text-[#00d2ff]" />
                Custom Flag for Team #{selectedFlagTeamId}
              </h3>
              <button
                onClick={() => setShowFlagUrlModal(false)}
                className="text-gray-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Option A: Direct Image URL */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Option 1: Paste Flag Image URL (PNG, SVG, JPG)
                </label>
                <input
                  type="text"
                  value={flagUrlInput}
                  onChange={(e) => setFlagUrlInput(e.target.value)}
                  placeholder="https://example.com/country-flag.png"
                  className="w-full px-3 py-2 bg-[#0A1535] border border-[#1a83c5] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[#00d2ff]"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 my-2 text-slate-500 text-xs font-mono">
                <div className="flex-1 h-px bg-slate-800" />
                <span>OR</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Option B: Upload File */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Option 2: Upload Flag File from Computer
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && selectedFlagTeamId !== null) {
                      handleCustomFlagUpload(selectedFlagTeamId, file);
                      setShowFlagUrlModal(false);
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1a83c5] file:text-white hover:file:bg-[#146ba3] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowFlagUrlModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-gray-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCustomFlagUrlSubmit(selectedFlagTeamId)}
                className="px-4 py-2 rounded-xl bg-[#00d2ff] hover:bg-cyan-400 text-black text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Save Flag URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
