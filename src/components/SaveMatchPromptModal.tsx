import React, { useState } from 'react';
import { Trophy, AlertCircle, CheckCircle2, XCircle, ShieldCheck, Flame, Star, EyeOff } from 'lucide-react';
import { PlayerRawInfo } from '../types/pubg';

export interface PendingMatchSaveInfo {
  players: PlayerRawInfo[];
  matchNumber: number;
  reason: string;
  winnerTeamName: string;
  totalKills: number;
  playerCount: number;
  teamCount: number;
}

export interface SaveMatchOptions {
  excludeFromLeaderboard?: boolean;
  customLabel?: string;
}

interface SaveMatchPromptModalProps {
  pendingMatch: PendingMatchSaveInfo;
  onConfirm: (options?: SaveMatchOptions) => void;
  onDiscard: () => void;
}

export const SaveMatchPromptModal: React.FC<SaveMatchPromptModalProps> = ({
  pendingMatch,
  onConfirm,
  onDiscard,
}) => {
  const [excludeFromLeaderboard, setExcludeFromLeaderboard] = useState<boolean>(false);
  const [customLabel, setCustomLabel] = useState<string>('');

  const handleConfirm = () => {
    onConfirm({
      excludeFromLeaderboard,
      customLabel: customLabel.trim() || undefined,
    });
  };
  return (
    <div
      id="save-match-prompt-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#151821] border-2 border-[#ffb800] rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(255,184,0,0.25)] overflow-hidden flex flex-col text-white">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#1c1404] via-[#241a05] to-[#151821] border-b border-[#ffb80044] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffb80020] border border-[#ffb80066] flex items-center justify-center text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400   block">
                Tournament Admin Prompt
              </span>
              <h3 className="text-xl font-semibold italic tracking-wide    text-white">
                Save Game #{pendingMatch.matchNumber}?
              </h3>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#ffb80020] text-amber-400 border border-[#ffb80044] font-bold">
            {pendingMatch.reason}
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            The game has concluded. As requested, the system will not save matches automatically. Please confirm if you want to commit this match into official tournament standings.
          </p>

          {/* Match Summary Card */}
          <div className="bg-[#0b0e14] border border-[#2d3548] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1f2638]">
              <span className="text-xs text-gray-400   font-bold flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Chicken Dinner Winner
              </span>
              <span className="text-base font-semibold italic  text-emerald-400  ">
                {pendingMatch.winnerTeamName}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#121622] p-2.5 rounded-lg border border-[#1f2638]">
                <span className="text-[10px] text-gray-500   font-bold block mb-0.5">
                  Lobby Players
                </span>
                <span className="text-sm font-mono font-bold text-white flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {pendingMatch.playerCount} Players ({pendingMatch.teamCount} Teams)
                </span>
              </div>

              <div className="bg-[#121622] p-2.5 rounded-lg border border-[#1f2638]">
                <span className="text-[10px] text-gray-500   font-bold block mb-0.5">
                  Total Match Kills
                </span>
                <span className="text-sm font-mono font-bold text-[#ff4b2b] flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-[#ff4b2b]" />
                  {pendingMatch.totalKills} Kills
                </span>
              </div>
            </div>

            {/* Validation & Anti-Duplicate Badges */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-[#00ff6615] px-2.5 py-0.5 rounded-full border border-[#00ff6633]">
                <ShieldCheck className="w-3 h-3" />
                Full Lobby Verified (Min 8 players, 2+ teams)
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1a83c5] bg-[#1a83c515] px-2.5 py-0.5 rounded-full border border-[#1a83c533]">
                <CheckCircle2 className="w-3 h-3" />
                No Duplicate Detected
              </span>
            </div>
          </div>

          {/* Leaderboard Counting / Special Game Option */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5 space-y-2.5">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                id="toggle-prompt-exclude-special"
                type="checkbox"
                checked={excludeFromLeaderboard}
                onChange={(e) => setExcludeFromLeaderboard(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-slate-400 bg-slate-950 border-slate-600 focus:ring-[#a855f7] cursor-pointer"
              />
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-slate-300 fill-slate-400" />
                  <span className="text-xs font-bold    tracking-wider text-white">
                    Hide from Leaderboard (Special / Exhibition Game)
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Save this match in match history and scorecards, but do NOT count points or kills towards overall tournament standings.
                </p>
              </div>
            </label>

            {excludeFromLeaderboard && (
              <div className="pt-1.5 border-t border-[#a855f7]/20 flex items-center gap-2">
                <span className="text-[11px] text-slate-300 font-bold">Custom Tag:</span>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Exhibition, Showmatch, Warmup"
                  className="flex-1 bg-slate-950 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#c084fc]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#0e1118] border-t border-[#1f2638] flex items-center justify-end gap-3">
          <button
            id="btn-discard-pending-match"
            type="button"
            onClick={onDiscard}
            className="px-4 py-2.5 rounded-xl bg-[#222838] hover:bg-[#2d3548] text-gray-300 hover:text-white text-xs font-bold   tracking-wider transition-colors flex items-center gap-1.5"
          >
            <XCircle className="w-4 h-4 text-gray-400" />
            <span>Don't Save (Discard)</span>
          </button>
          <button
            id="btn-confirm-save-match"
            type="button"
            onClick={handleConfirm}
            className={`px-6 py-2.5 rounded-xl text-xs font-semibold   tracking-wider shadow-lg transition-all flex items-center gap-2 active:scale-[0.98] ${
              excludeFromLeaderboard
                ? 'bg-slate-700 hover:bg-slate-600 text-white shadow-[#a855f7]/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[#00ff6633]'
            }`}
          >
            {excludeFromLeaderboard ? (
              <>
                <Star className="w-4 h-4 fill-white text-white" />
                <span>Save as Special Game #{pendingMatch.matchNumber}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-black" />
                <span>Yes, Save Game #{pendingMatch.matchNumber}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
