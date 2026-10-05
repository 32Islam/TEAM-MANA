import React from 'react';
import {
  Sliders,
  Tv,
  Download,
  Upload,
  ExternalLink,
  Flame,
  Trophy,
  Crown,
  FileSpreadsheet,
  ShieldCheck,
  Lock,
  Globe,
} from 'lucide-react';
import { TournamentConfig } from '../types/pubg';
import { VirtuocityLogo } from './VirtuocityLogo';

interface NavbarProps {
  currentView: 'admin' | 'leaderboard' | 'public';
  setCurrentView: (v: 'admin' | 'leaderboard' | 'public') => void;
  config: TournamentConfig;
  savedMatchCount: number;
  isApiConnected: boolean;
  connectionVia?: 'direct' | 'proxy';
  connectionLatency?: number;
  isAdminAuthenticated?: boolean;
  onLockAdmin?: () => void;
  onOpenSettings: () => void;
  onOpenBackupVault?: () => void;
  onExportJson: () => void;
  onExportCsv?: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPopoutObs: (
    layout?: 'overlay' | 'wide' | 'top4' | 'teamstats' | 'elimination' | 'mvp',
    scope?: 'latest' | 'all',
    variant?: 'fullscreen' | 'popup'
  ) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  config,
  savedMatchCount,
  isApiConnected,
  connectionVia = 'direct',
  connectionLatency = 0,
  isAdminAuthenticated = false,
  onLockAdmin,
  onOpenSettings,
  onOpenBackupVault,
  onExportJson,
  onExportCsv,
  onImportJson,
  onPopoutObs,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isNgrok = config.apiUrl.toLowerCase().includes('ngrok');
  let shortHost = 'main.yousery.tech';
  try {
    const u = new URL(config.apiUrl);
    shortHost = u.hostname;
    if (shortHost.length > 22) {
      shortHost = shortHost.slice(0, 20) + '...';
    }
  } catch {
    shortHost = config.apiUrl.slice(0, 22);
  }

  return (
    <header className="bg-[#0a0d14] border-b border-[#1e293b] border-l-4 border-l-[#ffb800] sticky top-0 z-50 px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.6)] font-outfit">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <VirtuocityLogo size="sm" customUrl={config.logoUrl} glow={false} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-heading font-black tracking-wider uppercase text-[#f8fafc]">
                {config.name}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-heading font-black tracking-widest bg-[#121824] text-[#ffb800] border border-[rgba(255,184,0,0.4)]">
                {config.mode}
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] font-medium">
              Tournament Leaderboard &bull; <span className="text-[#ffb800] font-telemetry font-bold">{savedMatchCount} Games Cached</span>
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-[#0f1622] p-1 rounded-xl border border-[#1e293b] flex-wrap gap-1">
          <button
            id="nav-btn-public"
            onClick={() => setCurrentView('public')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-heading font-black tracking-wider uppercase transition-all cursor-pointer ${
              currentView === 'public'
                ? 'bg-[#38bdf8] text-black shadow-[0_0_15px_rgba(56,189,248,0.35)] font-black'
                : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#172132]'
            }`}
            title="Open Public Standings & Team Stats"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Public Leaderboard</span>
          </button>

          <button
            id="nav-btn-leaderboard"
            onClick={() => setCurrentView('leaderboard')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-heading font-black tracking-wider uppercase transition-all cursor-pointer ${
              currentView === 'leaderboard'
                ? 'bg-[#ffb800] text-black shadow-[0_0_15px_rgba(255,184,0,0.35)]'
                : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#172132]'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Leaderboard (OBS)
          </button>
          <button
            id="nav-btn-admin"
            onClick={() => setCurrentView('admin')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-heading font-black tracking-wider uppercase transition-all cursor-pointer ${
              currentView === 'admin'
                ? 'bg-[#ffb800] text-black shadow-[0_0_15px_rgba(255,184,0,0.35)]'
                : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#172132]'
            }`}
          >
            {isAdminAuthenticated ? (
              <Sliders className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-[#ffb800]" />
            )}
            <span>Admin Panel</span>
            {!isAdminAuthenticated && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-telemetry font-bold bg-[rgba(255,184,0,0.15)] text-[#ffb800] border border-[rgba(255,184,0,0.4)]">
                LOCKED
              </span>
            )}
          </button>

          {/* Quick Lock Action if Authenticated and viewing Admin */}
          {currentView === 'admin' && isAdminAuthenticated && onLockAdmin && (
            <button
              id="nav-btn-lock-admin"
              onClick={onLockAdmin}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-telemetry font-bold tracking-wider bg-[rgba(239,68,68,0.15)] hover:bg-[rgba(239,68,68,0.25)] text-[#ef4444] border border-[rgba(239,68,68,0.35)] transition-colors cursor-pointer"
              title="Lock Admin Console immediately"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          )}
        </div>

        {/* Live Status & Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Connection Status Badge */}
          <button
            id="btn-nav-connection-status"
            onClick={onOpenSettings}
            className="flex items-center gap-2 bg-[#0f1622] hover:bg-[#121824] px-3 py-1.5 rounded-lg border border-[#1e293b] transition-colors text-left cursor-pointer"
            title={`Click to configure API link: ${config.apiUrl}`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isApiConnected
                  ? 'bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : 'bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.6)]'
              }`}
            ></div>
            <div className="flex flex-col">
              <span
                className={`text-[11px] font-telemetry font-bold leading-tight ${
                  isApiConnected ? 'text-[#10b981]' : 'text-[#ef4444]'
                }`}
              >
                {isApiConnected
                  ? `${isNgrok ? 'NGROK' : 'LIVE API'} ONLINE (${connectionLatency}ms)`
                  : `${isNgrok ? 'NGROK' : 'API'} OFFLINE`}
              </span>
              <span className="text-[9px] text-[#64748b] font-telemetry leading-tight">
                {shortHost}
              </span>
            </div>
          </button>

          {/* Popout OBS In-Game Overlay Button */}
          <button
            id="btn-popout-obs"
            onClick={() => onPopoutObs('overlay')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[rgba(56,189,248,0.12)] hover:bg-[rgba(56,189,248,0.22)] text-[#38bdf8] border border-[rgba(56,189,248,0.35)] text-xs font-heading font-black tracking-wider uppercase transition-all"
            title="Pop out compact In-Game OBS overlay for streaming"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span className="hidden sm:inline">OBS In-Game</span>
            <span className="sm:hidden">OBS</span>
          </button>

          {/* Popout Top 4 Live HUD Overlay Button */}
          <button
            id="btn-popout-top4"
            onClick={() => onPopoutObs('top4')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[rgba(16,185,129,0.12)] hover:bg-[rgba(16,185,129,0.22)] text-[#10b981] border border-[rgba(16,185,129,0.35)] text-xs font-heading font-black tracking-wider uppercase transition-all shadow-[0_0_8px_rgba(16,185,129,0.15)]"
            title="Pop out wide Top 4 Live Teams Overlay (Top-of-Screen HUD)"
          >
            <Flame className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="hidden sm:inline">Top 4 HUD</span>
            <span className="sm:hidden">Top 4</span>
          </button>

          {/* Popout Between-Games Stage Button */}
          <button
            id="btn-popout-stage"
            onClick={() => onPopoutObs('wide')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[rgba(255,184,0,0.15)] hover:bg-[rgba(255,184,0,0.25)] text-[#ffb800] border border-[rgba(255,184,0,0.40)] text-xs font-heading font-black tracking-wider uppercase transition-all shadow-[0_0_10px_rgba(255,184,0,0.2)]"
            title="Pop out Widescreen Between-Games Stage Leaderboard"
          >
            <Trophy className="w-3.5 h-3.5 text-[#ffb800]" />
            <span className="hidden sm:inline">Between Games Stage</span>
            <span className="sm:hidden">Stage</span>
          </button>

          {/* Popout Full Screen Match MVP Button */}
          <button
            id="btn-popout-mvp"
            onClick={() => onPopoutObs('mvp', 'latest')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[rgba(56,189,248,0.15)] hover:bg-[rgba(56,189,248,0.25)] text-[#38bdf8] border border-[rgba(56,189,248,0.40)] text-xs font-heading font-black tracking-wider uppercase transition-all shadow-[0_0_10px_rgba(56,189,248,0.25)]"
            title="Pop out Full Screen Match MVP Overlay (Latest Match / Tournament)"
          >
            <Crown className="w-3.5 h-3.5 text-[#ffb800]" />
            <span className="hidden md:inline">Match MVP</span>
            <span className="md:hidden">MVP</span>
          </button>

          {/* Export / Backup Buttons */}
          {onOpenBackupVault && (
            <button
              id="nav-btn-backup-vault"
              onClick={onOpenBackupVault}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#121824] hover:bg-[#172132] text-[#38bdf8] border border-[#1e293b] text-xs font-heading font-black tracking-wider uppercase transition-all shadow-sm"
              title="Open Automatic Backup Vault (10-min & game rolling backups)"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vault</span>
            </button>
          )}

          {onExportCsv && (
            <button
              id="nav-btn-export-csv"
              onClick={onExportCsv}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[rgba(16,185,129,0.12)] hover:bg-[rgba(16,185,129,0.22)] text-[#10b981] border border-[rgba(16,185,129,0.35)] text-xs font-heading font-black tracking-wider uppercase transition-all shadow-sm"
              title="Export tournament standings as CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          )}

          <button
            id="btn-export-json"
            onClick={onExportJson}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#121824] hover:bg-[#172132] text-[#cbd5e1] border border-[#1e293b] text-xs font-telemetry font-bold transition-all"
            title="Export all tournament data & match history as JSON"
          >
            <Download className="w-3.5 h-3.5 text-[#94a3b8]" />
            <span>JSON</span>
          </button>

          <button
            id="btn-import-json-trigger"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#121824] hover:bg-[#172132] text-[#cbd5e1] border border-[#1e293b] text-xs font-telemetry font-bold transition-all"
            title="Import tournament JSON"
          >
            <Upload className="w-3.5 h-3.5 text-[#94a3b8]" />
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImportJson}
              accept=".json"
              className="hidden"
            />
          </button>
        </div>
      </div>
    </header>
  );
};
