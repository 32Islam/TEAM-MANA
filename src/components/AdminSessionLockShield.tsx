import React, { useState } from 'react';
import {
  ShieldAlert,
  Zap,
  Tv,
  Radio,
  Lock,
  Unlock,
  AlertTriangle,
  Monitor,
  Smartphone,
  Laptop,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { AdminSessionInfo } from '../utils/adminSessionLock';

interface AdminSessionLockShieldProps {
  activeSession: AdminSessionInfo | null;
  currentDeviceName: string;
  onForceTakeover: () => void;
  onNavigateToLeaderboard: () => void;
  onDisableLock?: () => void;
}

export const AdminSessionLockShield: React.FC<AdminSessionLockShieldProps> = ({
  activeSession,
  currentDeviceName,
  onForceTakeover,
  onNavigateToLeaderboard,
  onDisableLock,
}) => {
  const [isConfirmingTakeover, setIsConfirmingTakeover] = useState(false);
  const [isTakingOver, setIsTakingOver] = useState(false);

  const holderName = activeSession?.deviceName || 'Another Device / Browser';
  const acquiredDateStr = activeSession?.acquiredAt
    ? new Date(activeSession.acquiredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Recently';

  const handleTakeover = () => {
    setIsTakingOver(true);
    onForceTakeover();
    setTimeout(() => {
      setIsTakingOver(false);
      setIsConfirmingTakeover(false);
    }, 1200);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6">
      <div className="bg-gradient-to-b from-[#111827] via-[#0d131f] to-[#080d16] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Glow backdrop */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#ff4b2b]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Lock Shield Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-2xl bg-[#ff4b2b]/15 border-2 border-[#ff4b2b]/40 flex items-center justify-center text-[#ff4b2b] shadow-xl shadow-[#ff4b2b]/20">
            <Lock className="w-10 h-10 animate-pulse" />
          </div>
          <span className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full text-[10px] font-semibold   tracking-wider bg-[#ff4b2b] text-white shadow-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            LOCKED
          </span>
        </div>

        {/* Header */}
        <div className="space-y-2 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff4b2b]/10 border border-[#ff4b2b]/30 text-[#ff6b4a] text-xs font-mono font-bold tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" />
            SINGLE-DEVICE CONCURRENCY SHIELD ACTIVE
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold    tracking-wider text-white">
            Admin Panel Active on Another Device
          </h2>
          <p className="text-sm text-gray-300 max-w-lg mx-auto leading-relaxed">
            To eliminate data glitches, accidental duplicate uploads, and conflicting score edits, only one device is permitted to operate the Admin Panel at a time.
          </p>
        </div>

        {/* Active Session Info Box */}
        <div className="bg-[#090e18] border border-[#1e2c44] rounded-2xl p-5 text-left space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1b283d] pb-3">
            <span className="text-xs font-bold   tracking-wider text-gray-400 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              Active Controller Session
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-[#00ff66]/30">
              LIVE WRITE ACCESS
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500 block mb-0.5">Holding Device:</span>
              <span className="text-white font-bold text-sm flex items-center gap-1.5">
                <Laptop className="w-4 h-4 text-sky-400" />
                {holderName}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">Session Started:</span>
              <span className="text-gray-300 font-mono">{acquiredDateStr}</span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-gray-400 flex items-center gap-2 border-t border-[#1b283d]/60">
            <span className="text-gray-500">Your Current Device:</span>
            <span className="text-sky-400 font-medium">{currentDeviceName}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          {!isConfirmingTakeover ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmingTakeover(true)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#ff4b2b] to-[#ff6b4a] hover:brightness-110 text-white font-semibold text-xs   tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#ff4b2b]/25 transition-all"
              >
                <Zap className="w-4 h-4" />
                Force Takeover Control
              </button>

              <button
                type="button"
                onClick={onNavigateToLeaderboard}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#141f33] hover:bg-[#1b2a45] text-gray-200 hover:text-white font-bold text-xs   tracking-wider flex items-center justify-center gap-2 border border-slate-800 transition-all"
              >
                <Tv className="w-4 h-4 text-sky-400" />
                View Leaderboard &amp; Stream
              </button>
            </div>
          ) : (
            <div className="bg-[#1f1414] border border-[#ff4b2b]/50 rounded-2xl p-4 text-center space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-center gap-2 text-[#ff6b4a] text-xs font-bold   tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                Confirm Force Takeover?
              </div>
              <p className="text-xs text-gray-300 max-w-md mx-auto">
                This will immediately revoke write access from <strong>{holderName}</strong> and transfer full tournament administrative control to this device.
              </p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsConfirmingTakeover(false)}
                  className="px-4 py-2 rounded-xl bg-[#2a2a35] hover:bg-[#383845] text-gray-300 text-xs font-bold   transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTakeover}
                  disabled={isTakingOver}
                  className="px-5 py-2 rounded-xl bg-[#ff4b2b] hover:bg-[#ff6b4a] text-white text-xs font-semibold   tracking-wider flex items-center gap-1.5 shadow-lg shadow-[#ff4b2b]/30 transition-all"
                >
                  {isTakingOver ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Claiming Control...
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Yes, Claim Admin Session
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {onDisableLock && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onDisableLock}
                className="text-[11px] text-gray-500 hover:text-gray-300 underline transition-colors"
              >
                Turn off single-device lock in tournament settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
