import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  User,
  Users,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  X,
  FileImage,
  RefreshCw,
  FolderArchive,
  Eye,
  Plus,
} from 'lucide-react';
import { TournamentConfig, SavedMatch, PlayerRawInfo } from '../types/pubg';
import { notifyConfigUpdated } from '../utils/storage';

interface PlayerPortraitsAdminProps {
  config: TournamentConfig;
  savedMatches?: SavedMatch[];
  activePlayers?: PlayerRawInfo[];
  onUpdateConfig: (updatedConfig: TournamentConfig) => void;
  showToast?: (msg: string) => void;
}

export const PlayerPortraitsAdmin: React.FC<PlayerPortraitsAdminProps> = ({
  config,
  savedMatches = [],
  activePlayers = [],
  onUpdateConfig,
  showToast = (_msg: string) => {},
}) => {
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const defaultPortraitInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);

  const [isBulkDragActive, setIsBulkDragActive] = useState<boolean>(false);
  const [isDefaultDragActive, setIsDefaultDragActive] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Manual single player upload state
  const [manualUidInput, setManualUidInput] = useState<string>('');
  const [manualUrlInput, setManualUrlInput] = useState<string>('');
  const [targetUidForUpload, setTargetUidForUpload] = useState<string | null>(null);

  // Known roster mapping: UID -> { playerName, teamName, teamId }
  const rosterMap = useMemo(() => {
    const map: Record<string, { playerName: string; teamName: string; teamId: number }> = {};

    // 1. From active players
    activePlayers.forEach((p) => {
      if (p.uId) {
        map[String(p.uId)] = {
          playerName: p.playerName || `Player #${p.uId}`,
          teamName: p.teamName || `Team #${p.teamId}`,
          teamId: p.teamId,
        };
      }
    });

    // 2. From saved matches
    savedMatches.forEach((m) => {
      (m.playerSnapshots || []).forEach((p) => {
        if (p.uId && !map[String(p.uId)]) {
          map[String(p.uId)] = {
            playerName: p.playerName || `Player #${p.uId}`,
            teamName: p.teamName || `Team #${p.teamId}`,
            teamId: p.teamId,
          };
        }
      });
    });

    return map;
  }, [activePlayers, savedMatches]);

  const portraitsMap = config.playerPortraits || {};
  const portraitUids = Object.keys(portraitsMap);

  // === 1. BULK PORTRAITS UPLOAD HANDLER ===
  const handleBulkUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validImageFiles = fileArray.filter((file) => file.type.startsWith('image/'));

    if (validImageFiles.length === 0) {
      setStatusMessage({
        text: 'No valid image files found. Please upload .png, .jpg, or .webp images.',
        type: 'error',
      });
      return;
    }

    const newPortraits: Record<string, string> = { ...(config.playerPortraits || {}) };
    let importedCount = 0;
    const skippedFiles: string[] = [];

    const readFileAsDataUrl = (file: File): Promise<{ uid: string; dataUrl: string } | null> => {
      return new Promise((resolve) => {
        // Parse filename: e.g. "512538234.png" -> "512538234"
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').trim();
        // Extract UID: strip non-alphanumeric or extract digits
        const cleanUid = nameWithoutExt.replace(/[^0-9a-zA-Z_-]/g, '').trim();

        if (!cleanUid) {
          skippedFiles.push(file.name);
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result) {
            resolve({ uid: cleanUid, dataUrl: result });
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    };

    const results = await Promise.all(validImageFiles.map(readFileAsDataUrl));

    results.forEach((item) => {
      if (item) {
        newPortraits[item.uid] = item.dataUrl;
        importedCount++;
      }
    });

    const updatedConfig: TournamentConfig = {
      ...config,
      playerPortraits: newPortraits,
    };

    onUpdateConfig(updatedConfig);
    notifyConfigUpdated(updatedConfig);

    const successMsg = `Successfully loaded and auto-linked ${importedCount} player portrait${
      importedCount > 1 ? 's' : ''
    } by UID!${skippedFiles.length > 0 ? ` (${skippedFiles.length} skipped - no valid UID in filename)` : ''}`;

    setStatusMessage({ text: successMsg, type: 'success' });
    showToast(successMsg);
  };

  // === 2. DEFAULT BLANK PORTRAIT UPLOAD HANDLER ===
  const handleDefaultPortraitUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ text: 'Please select a valid image file (.png, .jpg, .webp).', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        const updatedConfig: TournamentConfig = {
          ...config,
          defaultPlayerPortraitUrl: dataUrl,
        };
        onUpdateConfig(updatedConfig);
        notifyConfigUpdated(updatedConfig);

        const msg = 'Default blank player portrait uploaded successfully!';
        setStatusMessage({ text: msg, type: 'success' });
        showToast(msg);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDefaultPortrait = () => {
    const updatedConfig: TournamentConfig = {
      ...config,
      defaultPlayerPortraitUrl: undefined,
    };
    onUpdateConfig(updatedConfig);
    notifyConfigUpdated(updatedConfig);
    showToast('Default blank player portrait removed');
  };

  // === 3. DELETE SINGLE PORTRAIT ===
  const handleDeletePortrait = (uid: string) => {
    const copy = { ...(config.playerPortraits || {}) };
    delete copy[uid];

    const updatedConfig: TournamentConfig = {
      ...config,
      playerPortraits: copy,
    };
    onUpdateConfig(updatedConfig);
    notifyConfigUpdated(updatedConfig);
    showToast(`Removed portrait for UID: ${uid}`);
  };

  // === 4. CLEAR ALL PORTRAITS ===
  const handleClearAllPortraits = () => {
    if (portraitUids.length === 0) return;
    if (window.confirm(`Are you sure you want to delete all ${portraitUids.length} uploaded player portraits?`)) {
      const updatedConfig: TournamentConfig = {
        ...config,
        playerPortraits: {},
      };
      onUpdateConfig(updatedConfig);
      notifyConfigUpdated(updatedConfig);
      showToast('All player portraits cleared');
    }
  };

  // === 5. SINGLE UID URL ADDITION ===
  const handleAddManualPortrait = (e: React.FormEvent) => {
    e.preventDefault();
    const uid = manualUidInput.trim();
    const url = manualUrlInput.trim();

    if (!uid || !url) {
      setStatusMessage({ text: 'Please enter both Player UID and valid Image URL.', type: 'error' });
      return;
    }

    const updatedConfig: TournamentConfig = {
      ...config,
      playerPortraits: {
        ...(config.playerPortraits || {}),
        [uid]: url,
      },
    };
    onUpdateConfig(updatedConfig);
    notifyConfigUpdated(updatedConfig);

    setManualUidInput('');
    setManualUrlInput('');
    const msg = `Portrait linked to UID ${uid}!`;
    setStatusMessage({ text: msg, type: 'success' });
    showToast(msg);
  };

  // Filtered portraits for grid
  const filteredUids = useMemo(() => {
    if (!searchFilter.trim()) return portraitUids;
    const q = searchFilter.toLowerCase().trim();
    return portraitUids.filter((uid) => {
      const playerInfo = rosterMap[uid];
      const name = playerInfo?.playerName?.toLowerCase() || '';
      const team = playerInfo?.teamName?.toLowerCase() || '';
      return uid.toLowerCase().includes(q) || name.includes(q) || team.includes(q);
    });
  }, [portraitUids, searchFilter, rosterMap]);

  return (
    <div className="space-y-6">
      {/* Toast / Status banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between gap-2 animate-fadeIn ${
            statusMessage.type === 'success'
              ? 'bg-[#00FF66]/10 border-[#00FF66]/30 text-[#00FF66]'
              : 'bg-[#FF5200]/10 border-[#FF5200]/30 text-[#FF5200]'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP HEADER & EXPLANATION */}
      <div className="bg-[#0B0E14] border border-amber-400/40 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider">
                  Player Portraits Management (UID Linked)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-mono font-bold border border-amber-400/40">
                  {portraitUids.length} Loaded
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bulk upload player photos named by their in-game UID (e.g., <code className="text-amber-400 font-mono">512538234.png</code>). Portraits are automatically paired with tournament telemetry in the Match MVP overlay and broadcast graphics.
              </p>
            </div>
          </div>

          {portraitUids.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllPortraits}
              className="px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#FF5200]/20 text-slate-400 hover:text-[#FF5200] border border-[#334155] hover:border-[#FF5200]/40 text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Portraits ({portraitUids.length})</span>
            </button>
          )}
        </div>

        {/* TWO-COLUMN UPLOAD SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
          {/* COLUMN 1 & 2: BULK UID PICTURES DROPZONE */}
          <div className="lg:col-span-2 flex flex-col justify-between bg-[#121824] border border-[#1E293B] rounded-2xl p-4 sm:p-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-white font-rajdhani uppercase tracking-wider">
                    Bulk Upload Player Photos (Named &ldquo;UID.png&rdquo;)
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-[#0B0E14] px-2 py-0.5 rounded border border-[#1E293B]">
                  MULTIPLE FILES
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Select or drag a batch of player headshots. Name each file with the player&rsquo;s UID (e.g. <strong className="text-amber-300">512538234.png</strong>, <strong className="text-amber-300">512538235.jpg</strong>). The system strips the file extension and automatically assigns each photo to the corresponding UID.
              </p>

              {/* Hidden file input */}
              <input
                type="file"
                ref={bulkFileInputRef}
                multiple
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleBulkUploadFiles(e.target.files);
                  }
                  e.target.value = '';
                }}
              />

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsBulkDragActive(true);
                }}
                onDragLeave={() => setIsBulkDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsBulkDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleBulkUploadFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => bulkFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isBulkDragActive
                    ? 'border-amber-400 bg-amber-400/10 scale-[1.01]'
                    : 'border-amber-400/40 hover:border-amber-400 bg-[#0B0E14] hover:bg-[#0E131F]'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white font-rajdhani uppercase tracking-wider">
                    Click to select bulk player photos or drag & drop here
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports <span className="text-amber-400 font-mono">PNG, JPG, JPEG, WEBP</span> (Unlimited batch size)
                  </p>
                </div>
                <div className="text-[11px] font-mono text-slate-500 bg-[#162033] px-3 py-1 rounded-lg border border-[#1E293B]">
                  Example file: <span className="text-amber-300 font-bold">512538234.png</span> &rarr; auto linked to UID <span className="text-amber-300 font-bold">512538234</span>
                </div>
              </div>
            </div>

            {/* Quick single UID & image URL input form */}
            <form onSubmit={handleAddManualPortrait} className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col sm:flex-row items-stretch gap-2">
              <input
                type="text"
                placeholder="Player UID (e.g. 512538234)"
                value={manualUidInput}
                onChange={(e) => setManualUidInput(e.target.value)}
                className="bg-[#0B0E14] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono w-full sm:w-48"
              />
              <input
                type="text"
                placeholder="Portrait Image URL (or paste direct link)"
                value={manualUrlInput}
                onChange={(e) => setManualUrlInput(e.target.value)}
                className="bg-[#0B0E14] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono flex-1"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-400 hover:brightness-110 text-black text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Link UID</span>
              </button>
            </form>
          </div>

          {/* COLUMN 3: DEFAULT BLANK PORTRAIT UPLOAD (FALLBACK) */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-sky-400" />
                  <h4 className="text-sm font-bold text-white font-rajdhani uppercase tracking-wider">
                    Default Blank Portrait
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                  FALLBACK
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                If a player doesn&rsquo;t have a UID photo uploaded, this blank default silhouette / picture is shown on the MVP overlay.
              </p>

              {/* Hidden file input for default */}
              <input
                type="file"
                ref={defaultPortraitInputRef}
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDefaultPortraitUpload(file);
                  e.target.value = '';
                }}
              />

              {/* Current default portrait preview or upload box */}
              {config.defaultPlayerPortraitUrl ? (
                <div className="relative bg-[#0B0E14] border border-sky-400/40 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 rounded-xl bg-[#070e1c] border-2 border-sky-400 overflow-hidden shadow-lg mb-2 p-0.5">
                    <img
                      src={config.defaultPlayerPortraitUrl}
                      alt="Default Player Portrait"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  <span className="text-xs font-bold text-sky-300 font-rajdhani uppercase tracking-wider">
                    Custom Default Active
                  </span>
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Will be displayed for any unmapped player UID
                  </p>

                  <div className="flex items-center gap-2 mt-3 w-full">
                    <button
                      type="button"
                      onClick={() => defaultPortraitInputRef.current?.click()}
                      className="flex-1 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-slate-200 text-xs font-bold font-rajdhani uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Change Image
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveDefaultPortrait}
                      className="p-1.5 rounded-lg bg-[#FF5200]/20 hover:bg-[#FF5200]/30 text-[#FF5200] border border-[#FF5200]/40 transition-colors cursor-pointer"
                      title="Remove default picture"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDefaultDragActive(true);
                  }}
                  onDragLeave={() => setIsDefaultDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDefaultDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleDefaultPortraitUpload(file);
                  }}
                  onClick={() => defaultPortraitInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                    isDefaultDragActive
                      ? 'border-sky-400 bg-sky-400/10'
                      : 'border-[#1E293B] hover:border-sky-400/50 bg-[#0B0E14]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <User className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-white font-rajdhani uppercase tracking-wider">
                    Upload Blank Default Picture
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">
                    PNG, JPG, or WEBP (Square / portrait ratio)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PORTRAITS BROWSER & ROSTER GALLERY */}
      <div className="bg-[#0B0E14] border border-[#1E293B] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[#1E293B]">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-amber-400" />
            <h4 className="text-base font-extrabold text-white font-rajdhani uppercase tracking-wider">
              Loaded Player Portraits ({portraitUids.length})
            </h4>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search UID or Player Name..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-[#121824] border border-[#1E293B] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>
        </div>

        {portraitUids.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#1E293B] rounded-xl bg-[#121824]/50 p-6">
            <FileImage className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-300 font-rajdhani uppercase tracking-wider">
              No Player Portraits Uploaded Yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Drop your bulk player images named like <code className="text-amber-400 font-mono">512538234.png</code> into the bulk upload box above to populate player portraits.
            </p>
          </div>
        ) : filteredUids.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-mono">
            No player portraits match &ldquo;{searchFilter}&rdquo;
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredUids.map((uid) => {
              const dataUrl = portraitsMap[uid];
              const playerInfo = rosterMap[uid];

              return (
                <div
                  key={uid}
                  className="bg-[#121824] border border-[#1E293B] hover:border-amber-400/50 rounded-xl p-2.5 flex flex-col justify-between transition-all group shadow-sm"
                >
                  <div className="relative w-full aspect-square rounded-lg bg-[#0B0E14] border border-[#1E293B] overflow-hidden mb-2 flex items-center justify-center">
                    <img
                      src={dataUrl}
                      alt={`UID ${uid}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeletePortrait(uid)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/80 hover:bg-[#FF5200] text-slate-300 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Delete this portrait"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-mono font-bold text-amber-400 truncate" title={`UID: ${uid}`}>
                      #{uid}
                    </div>
                    {playerInfo ? (
                      <>
                        <div className="text-xs font-rajdhani font-black text-white uppercase truncate" title={playerInfo.playerName}>
                          {playerInfo.playerName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          {playerInfo.teamName}
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] font-mono text-slate-500 italic truncate">
                        Awaiting game match
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
