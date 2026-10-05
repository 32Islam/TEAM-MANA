import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Tv,
  CheckCircle2,
} from 'lucide-react';

interface AdminPasswordGateProps {
  onUnlock: (password: string, rememberDevice: boolean) => boolean;
  onNavigateToLeaderboard: () => void;
  showToast?: (msg: string) => void;
}

export const AdminPasswordGate: React.FC<AdminPasswordGateProps> = ({
  onUnlock,
  onNavigateToLeaderboard,
  showToast,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setErrorMsg('Please enter the administrator password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    // Quick verification
    setTimeout(() => {
      const ok = onUnlock(password, rememberDevice);
      if (ok) {
        setIsSuccess(true);
        if (showToast) {
          showToast('🔓 Admin console unlocked successfully!');
        }
      } else {
        setIsSubmitting(false);
        setErrorMsg('Access Denied: Incorrect administrator password.');
        inputRef.current?.select();
      }
    }, 200);
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center p-4 sm:p-6 select-none">
      <div className="bg-gradient-to-b from-[#0e1628] via-[#091020] to-[#050811] border border-[#1e2e4a] rounded-3xl max-w-lg w-full p-6 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Glow backdrop styling */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Security Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121d33] border border-[#23385c] text-amber-400 font-mono text-[11px] font-bold uppercase tracking-wider">
          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          <span>Restricted Admin Access</span>
        </div>

        {/* Lock Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div
            className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 shadow-xl ${
              isSuccess
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-emerald-500/30 scale-105'
                : errorMsg
                ? 'bg-red-500/15 border-red-500/60 text-red-400 shadow-red-500/20 animate-shake'
                : 'bg-gradient-to-br from-amber-500/20 to-amber-600/5 border-amber-500/50 text-amber-400 shadow-amber-500/20'
            }`}
          >
            {isSuccess ? (
              <Unlock className="w-10 h-10 animate-bounce" />
            ) : (
              <Lock className="w-10 h-10" />
            )}
          </div>
        </div>

        {/* Headings */}
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-rajdhani font-black uppercase tracking-wider text-white">
            {isSuccess ? 'Access Granted' : 'Admin Panel Locked'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            Enter the tournament administrator password to manage match points, spectator telemetry, and live overlays.
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Password Input Group */}
          <div className="space-y-2 text-left">
            <label
              htmlFor="admin-password-input"
              className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider"
            >
              Administrator Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="admin-password-input"
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                disabled={isSubmitting || isSuccess}
                placeholder="Enter admin password..."
                autoComplete="current-password"
                className={`w-full pl-10 pr-11 py-3 bg-[#060c18] border rounded-xl text-white font-mono text-sm placeholder-slate-500 transition-all focus:outline-none ${
                  errorMsg
                    ? 'border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-[#1e2e4a] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error Message Box */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300 text-xs font-mono animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Remember Device Checkbox */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer hover:text-slate-300">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded bg-[#060c18] border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="font-mono text-[11px]">Remember on this device</span>
            </label>
            <span className="text-[10px] font-mono text-slate-500">Secure Session</span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              id="btn-submit-admin-password"
              type="submit"
              disabled={isSubmitting || isSuccess || !password.trim()}
              className={`w-full py-3 px-5 rounded-xl font-rajdhani font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                isSuccess
                  ? 'bg-emerald-500 text-black shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Unlocked! Loading Panel...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Unlock Admin Panel</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onNavigateToLeaderboard}
              className="w-full py-2.5 px-4 rounded-xl bg-[#091020] hover:bg-[#121c33] text-slate-400 hover:text-white border border-[#1e2e4a] font-rajdhani font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Return to Public Leaderboard</span>
            </button>
          </div>
        </form>

        {/* Security Footer Note */}
        <div className="pt-2 border-t border-[#1a2842] flex items-center justify-center gap-2 text-[11px] font-mono text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
          <span>Protected Tournament Management Engine</span>
        </div>
      </div>
    </div>
  );
};
