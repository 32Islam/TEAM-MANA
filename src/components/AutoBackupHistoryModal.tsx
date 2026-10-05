import React from 'react';
import {
  History,
  Download,
  RotateCcw,
  Trash2,
  X,
  Plus,
  HardDrive,
  Gamepad2,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { AutoBackupItem, SavedMatch, TournamentConfig } from '../types/pubg';
import {
  loadAutoBackups,
  createAutoBackup,
  deleteAutoBackup,
  clearAutoBackups,
  exportTournamentBackupJson,
} from '../utils/storage';

interface AutoBackupHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  onRestoreBackup: (restoredConfig: TournamentConfig, restoredMatches: SavedMatch[]) => void;
}

export const AutoBackupHistoryModal: React.FC<AutoBackupHistoryModalProps> = ({
  isOpen,
  onClose,
  config,
  savedMatches,
  onRestoreBackup,
}) => {
  const [backups, setBackups] = React.useState<AutoBackupItem[]>([]);
  const [confirmRestoreId, setConfirmRestoreId] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const refreshBackups = React.useCallback(() => {
    setBackups(loadAutoBackups());
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      refreshBackups();
      setConfirmRestoreId(null);
      setSuccessMsg(null);
    }
  }, [isOpen, refreshBackups]);

  if (!isOpen) return null;

  const handleCreateManualBackup = () => {
    const item = createAutoBackup(config, savedMatches, 'manual');
    if (item) {
      refreshBackups();
      setSuccessMsg('Local backup snapshot created successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleDelete = (id: string) => {
    deleteAutoBackup(id);
    refreshBackups();
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all automatic backup snapshots?')) {
      clearAutoBackups();
      refreshBackups();
    }
  };

  const handleRestore = (item: AutoBackupItem) => {
    onRestoreBackup(item.config, item.matches);
    setSuccessMsg(`Restored tournament data from ${item.dateStr}!`);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  const getTriggerLabel = (trigger: AutoBackupItem['trigger']) => {
    switch (trigger) {
      case 'game_saved':
        return { label: 'Between-Games Snapshot', color: 'text-emerald-400 bg-[#00ff6615] border-[#00ff6644]' };
      case 'interval_10min':
        return { label: '10-Min Periodic Auto-Backup', color: 'text-sky-400 bg-[#1a83c515] border-[#1a83c544]' };
      case 'daily':
        return { label: 'Daily Session Backup', color: 'text-amber-400 bg-[#ffb80015] border-[#ffb80044]' };
      case 'manual':
      default:
        return { label: 'Manual Snapshot', color: 'text-purple-400 bg-purple-500/15 border-purple-500/40' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#10141f] border border-[#232f48] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#171e2e] to-[#10141f] border-b border-[#232f48] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#1a83c518] border border-[#1a83c544] text-sky-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className=" text-xl font-semibold text-white   tracking-wider">
                  Automatic Backup Vault
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold   bg-[#00ff6618] text-emerald-400 border border-[#00ff6633]">
                  10-Min &amp; Game Triggers
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Automatic rolling snapshots stored in browser storage to protect against accidental data loss.
              </p>
            </div>
          </div>
          <button
            id="btn-close-backup-history"
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#1a2233] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-5 py-3 bg-[#0a0d14] border-b border-[#1c273c] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <HardDrive className="w-4 h-4 text-sky-400" />
            <span>
              <strong className="text-white">{backups.length}</strong> rolling snapshots available
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-create-snapshot-now"
              type="button"
              onClick={handleCreateManualBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a83c518] hover:bg-sky-500 text-sky-400 hover:text-black border border-[#1a83c544] text-xs font-bold   tracking-wider transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Snapshot Now</span>
            </button>

            {backups.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-[#ff4b2b] hover:bg-[#ff4b2b15] text-xs transition-colors"
                title="Clear all auto backup snapshots"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-[#00ff6615] border border-[#00ff6644] text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Backup List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {backups.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border border-dashed border-[#1f2a3e] rounded-xl bg-[#0b0e17]">
              <History className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <p className="text-sm font-semibold text-gray-400">No Auto-Backup Snapshots Yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Snapshots will be automatically created every 10 minutes and whenever games are saved, or click "Snapshot Now" above.
              </p>
            </div>
          ) : (
            backups.map((item) => {
              const triggerInfo = getTriggerLabel(item.trigger);
              const isConfirming = confirmRestoreId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-[#0b0e17] border border-[#1f2a3e] hover:border-[#2d3a52] rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border   ${triggerInfo.color}`}>
                        {triggerInfo.label}
                      </span>
                      <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        {item.dateStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-300 pt-0.5">
                      <span className="flex items-center gap-1 font-mono text-sky-400 font-bold">
                        <Gamepad2 className="w-3.5 h-3.5" />
                        {item.matchCount} {item.matchCount === 1 ? 'Match' : 'Matches'}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400 truncate max-w-xs" title={item.config.name}>
                        {item.config.name}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => exportTournamentBackupJson(item.config, item.matches)}
                      className="p-1.5 rounded-lg bg-[#161e2e] hover:bg-[#232f48] text-gray-300 hover:text-white border border-[#232f48] text-xs transition-colors flex items-center gap-1"
                      title="Download this snapshot as a JSON file"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline text-[11px] font-mono">JSON</span>
                    </button>

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 bg-[#ff4b2b18] border border-[#ff4b2b44] p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => handleRestore(item)}
                          className="px-2 py-1 rounded bg-[#ff4b2b] text-white text-[11px] font-bold   hover:bg-[#e03d20] transition-colors"
                        >
                          Confirm Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRestoreId(null)}
                          className="px-1.5 py-1 text-gray-400 hover:text-white text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRestoreId(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#00ff6615] hover:bg-emerald-500 text-emerald-400 hover:text-black border border-[#00ff6644] text-xs font-bold   transition-all"
                        title="Restore tournament state to this snapshot"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-[#ff4b2b] hover:bg-[#ff4b2b15] transition-colors"
                      title="Delete this snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0a0d14] border-t border-[#1c273c] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">●</span>
            <span>Auto-saving every 10 min and on every finished game</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#161d2d] hover:bg-[#232f48] text-white text-xs font-bold  "
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
