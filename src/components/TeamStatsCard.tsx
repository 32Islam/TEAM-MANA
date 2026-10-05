import React from 'react';
import { Shield } from 'lucide-react';
import { ComputedTeamStats } from '../utils/teamStatsHelper';

// Crisp White SVG Icons as specified by user
export const CrosshairIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 text-white' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="8" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

export const StarburstIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 text-white' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2l2.4 5.2L20 5.2l-2.6 5.6L23 12l-5.6 1.2L20 18.8l-5.6-2L12 22l-2.4-5.2L4 18.8l2.6-5.6L1 12l5.6-1.2L4 5.2l5.6 2L12 2z" />
  </svg>
);

export const ThreePersonTeamIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 text-white' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    {/* Center Captain */}
    <circle cx="12" cy="7" r="3" />
    <path d="M7.5 19v-1.2c0-2.2 2-3.8 4.5-3.8s4.5 1.6 4.5 3.8V19H7.5z" />
    {/* Left Teammate */}
    <circle cx="5" cy="9.5" r="2.2" />
    <path d="M1.5 19v-1c0-1.8 1.4-3 3.3-3.2.7.9 1.8 1.6 3.2 1.9V19H1.5z" />
    {/* Right Teammate */}
    <circle cx="19" cy="9.5" r="2.2" />
    <path d="M22.5 19v-1c0-1.8-1.4-3-3.3-3.2-.7.9-1.8 1.6-3.2 1.9V19h6.5z" />
  </svg>
);

export const ClockIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 text-white' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </svg>
);

interface TeamStatsCardProps {
  stats: ComputedTeamStats;
  tournamentName?: string;
  className?: string;
  isCompact?: boolean;
}

export const TeamStatsCard: React.FC<TeamStatsCardProps> = ({
  stats,
  tournamentName = 'VIRTUOCITY BATTLEGROUND',
  className = '',
  isCompact = false,
}) => {
  const {
    teamId,
    teamName,
    isLiveGame,
    alivePlayersCount,
    totalKills,
    totalDamage,
    totalKnockouts,
    placement,
    players,
    matchLabel,
  } = stats;

  return (
    <div
      id={`team-stats-card-${teamId}`}
      className={`relative select-none text-[#f8fafc] font-outfit w-full max-w-[560px] ${className}`}
    >
      {/* Outer Card Container */}
      <div className="relative overflow-hidden rounded-[14px] bg-[#121824] border border-[#1e293b] shadow-[0_10px_40px_rgba(0,0,0,0.7)]">
        {/* Glowing Top Cyan Border Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#38bdf8] to-transparent shadow-[0_0_12px_rgba(56,189,248,0.4)]" />

        {/* HEADER SECTION */}
        <div className="relative z-10 pt-4 pb-3 px-4 sm:px-6 flex flex-col items-center justify-center text-center border-b border-[#1e293b] bg-[#182234]/80">
          {/* Top Title: TEAM STATS */}
          <div className="flex items-center gap-3">
            <span className="w-8 sm:w-14 h-[1.5px] bg-gradient-to-r from-transparent to-[#38bdf8]" />
            <h1 className="font-heading font-black tracking-widest uppercase text-xs sm:text-sm text-[#38bdf8] leading-none">
              TEAM STATS
            </h1>
            <span className="w-8 sm:w-14 h-[1.5px] bg-gradient-to-l from-transparent to-[#38bdf8]" />
          </div>

          {/* Team Name */}
          <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-black uppercase tracking-wide text-[#f8fafc] break-words max-w-full drop-shadow-md mt-1 leading-tight" title={teamName}>
            {teamName}
          </h2>

          {/* Status & Summary Stats Bar */}
          <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 mt-1.5 text-[11px] sm:text-xs font-telemetry text-[#94a3b8]">
            <span className="px-2.5 py-0.5 rounded-full bg-[#0f1622] border border-[rgba(56,189,248,0.35)] text-[#38bdf8] font-bold uppercase tracking-wider text-[10px] sm:text-[11px]">
              {matchLabel}
            </span>

            {isLiveGame && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.35)] text-[#10b981] font-bold text-[10px] sm:text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
                {alivePlayersCount}/4 ALIVE
              </span>
            )}

            {placement !== undefined && (
              <span className="text-[#ffb800] font-bold">
                RANK #{placement}
              </span>
            )}
            <span className="text-[#334155]">•</span>
            <span className="text-white font-bold">
              {totalKills} <span className="text-[#38bdf8] text-[10px]">ELIMS</span>
            </span>
            <span className="text-[#334155]">•</span>
            <span className="text-white font-bold">
              {totalDamage} <span className="text-[#ffb800] text-[10px]">DMG</span>
            </span>
            <span className="text-[#334155]">•</span>
            <span className="text-white font-bold">
              {totalKnockouts} <span className="text-[#ef4444] text-[10px]">KNOCKS</span>
            </span>
          </div>
        </div>

        {/* THE MAIN STATS TABLE */}
        <div className="relative z-10 p-3 sm:p-4 w-full">
          <div className="border border-[#1e293b] rounded-[10px] overflow-hidden bg-[#0f1622] shadow-inner w-full">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b border-[#1e293b] bg-[#182234]">
                  {/* Top Left Cell: STATS */}
                  <th className="w-[30%] sm:w-[28%] bg-[#182234] px-2.5 sm:px-3 py-2 text-center font-heading font-black text-xs sm:text-sm tracking-wider text-[#38bdf8] uppercase border-r border-[#1e293b]">
                    STATS
                  </th>

                  {/* 4 Squad Player Columns */}
                  {players.map((p, idx) => (
                    <th
                      key={`hdr-p-${p.uId || idx}`}
                      className="w-[17.5%] sm:w-[18%] px-1 sm:px-1.5 py-2 text-center bg-[#121824] border-r border-[#1e293b] last:border-r-0"
                    >
                      <div className="flex flex-col items-center justify-center min-w-0">
                        <span
                          className={`text-[10px] sm:text-xs font-heading font-black uppercase tracking-tight truncate w-full ${
                            p.isAlive
                              ? 'text-[#f8fafc]'
                              : 'text-[#64748b] line-through decoration-[#ef4444]/80'
                          }`}
                          title={p.playerName}
                        >
                          {p.playerName}
                        </span>
                        {isLiveGame && (
                          <span
                            className={`text-[8px] sm:text-[9px] font-telemetry font-bold px-1.5 py-0.2 rounded-full mt-0.5 ${
                              p.isAlive
                                ? 'bg-[rgba(16,185,129,0.15)] text-[#10b981]'
                                : 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]'
                            }`}
                          >
                            {p.isAlive ? 'ALIVE' : 'OUT'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* ROW 1: ELIMS */}
                <tr className="border-b border-[#1e293b] bg-[#121824] hover:bg-[#172132] transition-colors">
                  <td className="px-2.5 sm:px-3 py-2 bg-[#0f1622] border-r border-[#1e293b] flex items-center gap-1.5 sm:gap-2">
                    <CrosshairIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#38bdf8] flex-shrink-0" />
                    <span className="font-heading font-black tracking-wider text-[10px] sm:text-xs text-[#cbd5e1] uppercase truncate">
                      ELIMS
                    </span>
                  </td>
                  {players.map((p, idx) => (
                    <td
                      key={`kills-${p.uId || idx}`}
                      className="px-1 sm:px-1.5 py-2 text-center border-r border-[#1e293b] last:border-r-0"
                    >
                      <span
                        className={`font-telemetry font-bold text-xs sm:text-base ${
                          p.kills > 0 ? 'text-[#10b981]' : 'text-[#64748b]'
                        }`}
                      >
                        {p.kills}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* ROW 2: DAMAGE */}
                <tr className="border-b border-[#1e293b] bg-[#121824] hover:bg-[#172132] transition-colors">
                  <td className="px-2.5 sm:px-3 py-2 bg-[#0f1622] border-r border-[#1e293b] flex items-center gap-1.5 sm:gap-2">
                    <StarburstIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ffb800] flex-shrink-0" />
                    <span className="font-heading font-black tracking-wider text-[10px] sm:text-xs text-[#cbd5e1] uppercase truncate">
                      DAMAGE
                    </span>
                  </td>
                  {players.map((p, idx) => (
                    <td
                      key={`dmg-${p.uId || idx}`}
                      className="px-1 sm:px-1.5 py-2 text-center border-r border-[#1e293b] last:border-r-0"
                    >
                      <span
                        className={`font-telemetry font-bold text-[11px] sm:text-sm ${
                          p.damage > 0 ? 'text-white' : 'text-[#64748b]'
                        }`}
                      >
                        {p.damage}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* ROW 3: KNOCKOUTS */}
                <tr className="border-b border-[#1e293b] bg-[#121824] hover:bg-[#172132] transition-colors">
                  <td className="px-2.5 sm:px-3 py-2 bg-[#0f1622] border-r border-[#1e293b] flex items-center gap-1.5 sm:gap-2">
                    <ThreePersonTeamIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ef4444] flex-shrink-0" />
                    <span className="font-heading font-black tracking-wider text-[10px] sm:text-xs text-[#cbd5e1] uppercase truncate">
                      KNOCKOUTS
                    </span>
                  </td>
                  {players.map((p, idx) => (
                    <td
                      key={`knocks-${p.uId || idx}`}
                      className="px-1 sm:px-1.5 py-2 text-center border-r border-[#1e293b] last:border-r-0"
                    >
                      <span
                        className={`font-telemetry font-bold text-[11px] sm:text-sm ${
                          p.knockouts > 0 ? 'text-[#ef4444]' : 'text-[#64748b]'
                        }`}
                      >
                        {p.knockouts}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* ROW 4: SURVIVAL TIME */}
                <tr className="bg-[#121824] hover:bg-[#172132] transition-colors">
                  <td className="px-2.5 sm:px-3 py-2 bg-[#0f1622] border-r border-[#1e293b] flex items-center gap-1.5 sm:gap-2">
                    <ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#38bdf8] flex-shrink-0" />
                    <span className="font-heading font-black tracking-wider text-[9px] sm:text-xs text-[#cbd5e1] uppercase truncate">
                      SURVIVAL
                    </span>
                  </td>
                  {players.map((p, idx) => (
                    <td
                      key={`time-${p.uId || idx}`}
                      className="px-1 sm:px-1.5 py-2 text-center border-r border-[#1e293b] last:border-r-0"
                    >
                      <span className="font-telemetry font-bold text-[10px] sm:text-xs text-[#cbd5e1] truncate block">
                        {p.survivalTimeFormatted}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="relative z-10 py-1.5 px-4 bg-[#0a0d14] border-t border-[#1e293b] flex items-center justify-between text-[10px] font-telemetry text-[#94a3b8]">
          <span className="text-[#38bdf8] font-bold">●</span>
          <span className="font-heading font-black uppercase tracking-widest text-[#94a3b8] truncate">
            {tournamentName}
          </span>
          <span className="text-[#38bdf8] font-bold">●</span>
        </div>
      </div>
    </div>
  );
};
