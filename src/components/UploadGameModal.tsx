import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, X, ShieldAlert, Trophy, Users, Flame } from 'lucide-react';
import { PlayerRawInfo, SavedMatch, TeamMatchScore, TournamentConfig } from '../types/pubg';
import {
  validateMatchFullness,
  findDuplicateMatch,
  calculateMatchTeamScores,
} from '../utils/pubgCalculations';

interface UploadGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  onAddUploadedMatches: (matches: SavedMatch[]) => void;
  showToast: (msg: string) => void;
}

export const UploadGameModal: React.FC<UploadGameModalProps> = ({
  isOpen,
  onClose,
  config,
  savedMatches,
  onAddUploadedMatches,
  showToast,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{
    matchesToAdd: SavedMatch[];
    warnings: string[];
    fileName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setError(null);
    setParsedPreview(null);

    if (!file.name.endsWith('.json')) {
      setError('Please select a valid .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        // Extract list of candidate matches
        let candidateSnapshotsList: PlayerRawInfo[][] = [];
        let importedSavedMatches: SavedMatch[] = [];

        if (parsed.matches && Array.isArray(parsed.matches)) {
          // Tournament backup format
          for (const m of parsed.matches) {
            if (m.playerSnapshots && Array.isArray(m.playerSnapshots)) {
              candidateSnapshotsList.push(m.playerSnapshots);
            }
          }
        } else if (Array.isArray(parsed)) {
          // Either array of SavedMatch OR array of PlayerRawInfo
          if (parsed.length > 0 && ('playerSnapshots' in parsed[0])) {
            for (const m of parsed) {
              if (m.playerSnapshots && Array.isArray(m.playerSnapshots)) {
                candidateSnapshotsList.push(m.playerSnapshots);
              }
            }
          } else if (parsed.length > 0 && ('uId' in parsed[0] || 'teamId' in parsed[0])) {
            // Single raw match player list
            candidateSnapshotsList.push(parsed as PlayerRawInfo[]);
          }
        } else if (parsed.playerSnapshots && Array.isArray(parsed.playerSnapshots)) {
          // Single saved match format
          candidateSnapshotsList.push(parsed.playerSnapshots);
        } else if (parsed.playerInfoList && Array.isArray(parsed.playerInfoList)) {
          // Raw spectator API JSON response
          candidateSnapshotsList.push(parsed.playerInfoList);
        } else if (parsed.data && Array.isArray(parsed.data)) {
          candidateSnapshotsList.push(parsed.data);
        }

        if (candidateSnapshotsList.length === 0) {
          setError('Could not recognize any valid PUBG player snapshot or match data in this file.');
          return;
        }

        const validMatches: SavedMatch[] = [];
        const warnings: string[] = [];
        let currentMatchCount = savedMatches.length;

        for (let i = 0; i < candidateSnapshotsList.length; i++) {
          const snap = candidateSnapshotsList[i];
          const matchLabel = candidateSnapshotsList.length > 1 ? `Game ${i + 1}` : 'Uploaded Game';

          // 1. Fullness check
          const fullness = validateMatchFullness(snap);
          if (!fullness.isFull) {
            warnings.push(`⚠️ ${matchLabel} skipped: ${fullness.reason}`);
            continue;
          }

          // 2. Duplicate check against existing savedMatches and newly queued matches
          const dupExisting = findDuplicateMatch([...savedMatches, ...validMatches], snap);
          if (dupExisting) {
            warnings.push(
              `⚠️ ${matchLabel} skipped: Identical game already saved as Game #${dupExisting.matchNumber}.`
            );
            continue;
          }

          // 3. Build SavedMatch
          currentMatchCount++;
          const scores = calculateMatchTeamScores(snap, config, true);
          const newMatch: SavedMatch = {
            id: `uploaded_${Date.now()}_${i}`,
            matchNumber: currentMatchCount,
            timestamp: Date.now(),
            dateStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            playerSnapshots: snap,
            teamScores: scores,
          };
          validMatches.push(newMatch);
        }

        if (validMatches.length === 0) {
          setError(
            warnings.length > 0
              ? warnings.join(' | ')
              : 'No valid full, non-duplicate games could be imported from this file.'
          );
          return;
        }

        setParsedPreview({
          matchesToAdd: validMatches,
          warnings,
          fileName: file.name,
        });
      } catch (err: any) {
        setError(`Failed to parse JSON file: ${err?.message || 'Invalid syntax'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!parsedPreview || parsedPreview.matchesToAdd.length === 0) return;
    onAddUploadedMatches(parsedPreview.matchesToAdd);
    showToast(`✅ Successfully uploaded ${parsedPreview.matchesToAdd.length} game(s) into tournament!`);
    onClose();
  };

  return (
    <div
      id="upload-game-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="bg-[#1a1a1f] border border-[#2d2d35] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2d2d35] bg-[#121216] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1a83c520] border border-[#1a83c544] flex items-center justify-center text-[#1a83c5]">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold    tracking-wider text-white">
                Upload Saved Game File
              </h3>
              <p className="text-xs text-gray-400">
                Import match JSON with automatic fullness verification & duplicate protection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#2d2d35] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
              dragActive
                ? 'border-[#1a83c5] bg-[#1a83c510]'
                : 'border-[#2d2d35] hover:border-[#1a83c566] bg-[#121216]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-[#222838] flex items-center justify-center text-[#1a83c5] mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-200 mb-1">
              Click to browse or drag and drop match JSON
            </p>
            <p className="text-xs text-gray-500">
              Supports single match JSON, raw spectator responses, or tournament backup exports
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-[#ff4b2b15] border border-[#ff4b2b44] text-[#ff4b2b] text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed Preview */}
          {parsedPreview && (
            <div className="space-y-3 bg-[#121216] border border-[#2d2d35] rounded-xl p-4">
              <div className="flex items-center justify-between border-b border-[#2d2d35] pb-2">
                <span className="text-xs font-mono text-gray-400">File: {parsedPreview.fileName}</span>
                <span className="text-xs font-bold text-emerald-400 bg-[#00ff6615] px-2.5 py-0.5 rounded-full border border-[#00ff6633]">
                  {parsedPreview.matchesToAdd.length} Valid Game(s) Ready
                </span>
              </div>

              {/* Match List Preview */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {parsedPreview.matchesToAdd.map((m) => {
                  const scoresList = Object.values(m.teamScores) as TeamMatchScore[];
                  const winner = scoresList.find((s) => s.placement === 1);
                  const kills = scoresList.reduce((sum, s) => sum + s.totalKills, 0);

                  return (
                    <div
                      key={m.id}
                      className="bg-[#1a1a1f] border border-[#2d2d35] rounded-lg p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-400  text-sm">
                          GAME #{m.matchNumber}
                        </span>
                        <span className="text-gray-400">
                          {m.playerSnapshots.length} Players
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-amber-400" />
                          <strong className="text-emerald-400 ">
                            {winner?.teamName || 'Winner'}
                          </strong>
                        </span>
                        <span className="text-[#ff4b2b] font-mono font-bold flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {kills} Kills
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Warnings (e.g. skipped incomplete or duplicate games) */}
              {parsedPreview.warnings.length > 0 && (
                <div className="pt-2 border-t border-[#2d2d35] space-y-1">
                  {parsedPreview.warnings.map((w, idx) => (
                    <p key={idx} className="text-[11px] text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>{w}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#121216] border-t border-[#2d2d35] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2d2d35] hover:bg-[#3d3d45] text-gray-300 text-xs font-bold   tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!parsedPreview || parsedPreview.matchesToAdd.length === 0}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-[#1aff7a] text-black text-xs font-semibold   tracking-wider shadow-lg shadow-[#00ff6622] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-black" />
            <span>Add Game(s) to Standings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
