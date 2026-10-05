import React from 'react';
import { ShieldAlert, Download, FileSpreadsheet, Clock, CheckCircle, X } from 'lucide-react';
import { SavedMatch, TournamentConfig } from '../types/pubg';
import { exportTournamentBackupJson, exportStandingsCsv, snoozeBackupReminder } from '../utils/storage';

interface BackupReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  lastExportTimestamp: number | null;
  lastAutoBackupTimestamp: number | null;
  onExportSuccess?: () => void;
}

export const BackupReminderModal: React.FC<BackupReminderModalProps> = ({
  isOpen,
  onClose,
  config,
  savedMatches,
  lastExportTimestamp,
  lastAutoBackupTimestamp,
  onExportSuccess,
}) => {
  if (!isOpen) return null;

  const hoursSinceExport = lastExportTimestamp
    ? ((Date.now() - lastExportTimestamp) / (1000 * 60 * 60)).toFixed(1)
    : null;

  const handleDownloadJson = () => {
    exportTournamentBackupJson(config, savedMatches);
    if (onExportSuccess) onExportSuccess();
    onClose();
  };

  const handleDownloadCsv = () => {
    exportStandingsCsv(config, savedMatches);
    if (onExportSuccess) onExportSuccess();
    onClose();
  };

  const handleSnooze = (hours: number) => {
    snoozeBackupReminder(hours);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#121622] border border-[#ffb80066] rounded-2xl max-w-lg w-full overflow-hidden shadow-[0_0_50px_rgba(255,184,0,0.25)]">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-[#1c2233] to-[#121622] border-b border-[#2d3a52] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#ffb80018] border border-[#ffb80055] text-amber-400 flex-shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400   block">
                DATA PROTECTION &amp; RECOVERY ADVISORY
              </span>
              <h3 className=" text-xl font-semibold text-white   tracking-wider">
                Tournament Backup Recommended
              </h3>
            </div>
          </div>
          <button
            id="btn-close-backup-reminder"
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#1a2233] transition-colors"
            title="Close reminder"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Status Metrics Box */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0b0e17] border border-[#1f2a3e] rounded-xl p-3">
              <span className="text-[10px] font-bold text-gray-400   tracking-wider block mb-0.5">
                Saved Matches
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold  text-sky-400">
                  {savedMatches.length}
                </span>
                <span className="text-[10px] text-gray-500 font-mono font-bold  ">
                  GAMES IN CACHE
                </span>
              </div>
            </div>

            <div className="bg-[#0b0e17] border border-[#1f2a3e] rounded-xl p-3">
              <span className="text-[10px] font-bold text-gray-400   tracking-wider block mb-0.5">
                Last Manual Export
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold font-mono text-amber-400">
                  {hoursSinceExport ? `${hoursSinceExport}h ago` : 'Never (This Session)'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            You have active tournament data that hasn’t been downloaded to an external backup recently.
            While browser-based auto-backups run every 10 minutes and between games, exporting an official
            <strong className="text-white font-bold"> .JSON</strong> file guarantees 100% data safety against accidental browser cache clears or power interruptions.
          </p>

          <div className="p-3 bg-[#00ff660c] border border-[#00ff6633] rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="text-[11px] text-gray-300">
              <span className="text-emerald-400 font-bold   block">Rolling Auto-Backup Active</span>
              Last background local snapshot captured at{' '}
              <span className="font-mono text-white">
                {lastAutoBackupTimestamp
                  ? new Date(lastAutoBackupTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Just now'}
              </span>.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              id="btn-reminder-download-json"
              type="button"
              onClick={handleDownloadJson}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#ffb800] to-[#ff9100] text-black  font-semibold text-base   tracking-wider hover:opacity-95 transition-all shadow-lg shadow-[#ffb80025] cursor-pointer"
            >
              <Download className="w-5 h-5" />
              <span>Download Full Tournament Backup (.JSON)</span>
            </button>

            <button
              id="btn-reminder-download-csv"
              type="button"
              onClick={handleDownloadCsv}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00ff6618] hover:bg-emerald-500 text-emerald-400 hover:text-black border border-[#00ff6644]  font-bold text-sm   tracking-wider transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Standings Spreadsheet (.CSV)</span>
            </button>
          </div>
        </div>

        {/* Modal Footer / Snooze Options */}
        <div className="p-4 bg-[#0a0d14] border-t border-[#1f2a3e] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>Remind later:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-snooze-1h"
              type="button"
              onClick={() => handleSnooze(1)}
              className="px-2.5 py-1 rounded bg-[#161d2d] hover:bg-[#232f48] text-gray-300 hover:text-white font-mono text-[11px] transition-colors"
            >
              +1 Hour
            </button>
            <button
              id="btn-snooze-3h"
              type="button"
              onClick={() => handleSnooze(3)}
              className="px-2.5 py-1 rounded bg-[#161d2d] hover:bg-[#232f48] text-gray-300 hover:text-white font-mono text-[11px] transition-colors"
            >
              +3 Hours
            </button>
            <button
              id="btn-dismiss-reminder"
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded text-gray-400 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
