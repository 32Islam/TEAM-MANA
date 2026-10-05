import React from 'react';
import { Trophy, Crosshair, Skull, Shield, X, Users, Award, ExternalLink } from 'lucide-react';
import { TournamentConfig, SavedMatch, TeamMatchScore, PlayerRawInfo } from '../types/pubg';
import { UnifiedTeamStanding } from './StreamLeaderboard';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { TeamFlag } from './TeamFlag';

interface TeamDetailsModalProps {
  team: UnifiedTeamStanding | null;
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers?: PlayerRawInfo[];
  onClose: () => void;
}

export const TeamDetailsModal: React.FC<TeamDetailsModalProps> = ({
  team,
  config,
  savedMatches,
  activePlayers = [],
  onClose,
}) => {
  if (!team) return null;

  const flagVal = resolveTeamFlagValue(team.teamId, config.teamFlags, team.teamName);
  const teamLogo = config.teamLogos?.[team.teamId] || config.teamLogos?.[String(team.teamId)];
  const squadPic = config.teamSquadPics?.[team.teamId] || config.teamSquadPics?.[String(team.teamId)];

  // Ranked saved matches only
  const rankedMatches = (savedMatches || []).filter((m) => !m.excludeFromLeaderboard);

  // Match breakdown for this team
  const matchBreakdown = rankedMatches.map((m) => {
    const score = m.teamScores?.[team.teamId];
    return {
      matchNumber: m.matchNumber,
      dateStr: m.dateStr,
      placement: score?.placement ?? null,
      isWinner: Boolean(score?.isWinner || score?.placement === 1),
      kills: score?.totalKills ?? 0,
      damage: score?.totalDamage ?? 0,
      rankPoints: score?.rankPoints ?? 0,
      totalPoints: score?.totalPoints ?? 0,
      penaltyPoints: score?.penaltyPoints ?? 0,
    };
  });

  // Calculate roster members
  const roster = (team.roster && team.roster.length > 0)
    ? team.roster
    : [
        { uId: 1, playerName: `${team.teamName}_Player1`, isAlive: true, kills: 0, damage: 0 },
        { uId: 2, playerName: `${team.teamName}_Player2`, isAlive: true, kills: 0, damage: 0 },
        { uId: 3, playerName: `${team.teamName}_Player3`, isAlive: true, kills: 0, damage: 0 },
        { uId: 4, playerName: `${team.teamName}_Player4`, isAlive: true, kills: 0, damage: 0 },
      ];

  const totalMatchesCount = Math.max(1, team.matchesPlayed || rankedMatches.length);
  const avgKills = ((team.totalKills || 0) / totalMatchesCount).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0c121e] border-2 border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Glow Bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#38bdf8] via-[#ffb800] to-[#10b981]" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#1e293b] flex items-center justify-between gap-3 bg-[#080d16]">
          <div className="flex items-center gap-3 min-w-0">
            {teamLogo ? (
              <img
                src={teamLogo}
                alt=""
                className="w-11 h-11 sm:w-13 sm:h-13 object-contain rounded-full bg-black/70 border-2 border-white/20 p-1 flex-shrink-0 shadow-lg"
              />
            ) : (
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#182234] border border-[#38bdf8]/40 flex items-center justify-center text-[#38bdf8] font-heading font-black text-lg flex-shrink-0">
                #{team.teamId}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {flagVal && (
                  <TeamFlag
                    flagValue={flagVal}
                    teamId={team.teamId}
                    className="w-6 h-4 sm:w-7 sm:h-4.5 object-cover rounded shadow border border-white/30 flex-shrink-0"
                  />
                )}
                <h2 className="text-xl sm:text-2xl font-heading font-black uppercase text-white tracking-wider truncate">
                  {team.teamName}
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#182234] text-[#38bdf8] border border-[#38bdf8]/30">
                  TEAM #{team.teamId}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-outfit mt-0.5">
                Official Tournament Team Roster &amp; Match Performance Breakdown
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#172132] hover:bg-[#202d44] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 border border-[#1e293b]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto no-scrollbar font-outfit text-white">
          {/* Squad picture if uploaded */}
          {squadPic && (
            <div className="w-full rounded-xl overflow-hidden border border-[#1e293b] bg-black/40 max-h-48 flex items-center justify-center">
              <img src={squadPic} alt="" className="w-full h-full object-cover max-h-48" />
            </div>
          )}

          {/* 4 Stat Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-[#121824] border border-[#1e293b] p-3 rounded-xl text-center shadow-sm">
              <span className="text-[10px] sm:text-xs font-bold font-heading text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                Total Points
              </span>
              <span className="text-2xl sm:text-3xl font-telemetry font-bold text-[#ffb800] leading-none">
                {team.totalPoints}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                {team.totalPlacementPoints || 0} Place Pts
              </span>
            </div>

            <div className="bg-[#121824] border border-[#1e293b] p-3 rounded-xl text-center shadow-sm">
              <span className="text-[10px] sm:text-xs font-bold font-heading text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                Tournament Kills
              </span>
              <span className="text-2xl sm:text-3xl font-telemetry font-bold text-[#38bdf8] leading-none">
                {team.totalKills}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                Avg {avgKills} / game
              </span>
            </div>

            <div className="bg-[#121824] border border-[#1e293b] p-3 rounded-xl text-center shadow-sm">
              <span className="text-[10px] sm:text-xs font-bold font-heading text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                Dinners (WWCD)
              </span>
              <span className="text-2xl sm:text-3xl font-telemetry font-bold text-[#10b981] leading-none">
                {team.totalWins ?? team.pastWins ?? 0}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                Victories
              </span>
            </div>

            <div className="bg-[#121824] border border-[#1e293b] p-3 rounded-xl text-center shadow-sm">
              <span className="text-[10px] sm:text-xs font-bold font-heading text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                Games Played
              </span>
              <span className="text-2xl sm:text-3xl font-telemetry font-bold text-white leading-none">
                {team.matchesPlayed || rankedMatches.length}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                Matches
              </span>
            </div>
          </div>

          {/* Squad Roster Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-heading font-black uppercase tracking-wider text-[#38bdf8] border-b border-[#1e293b] pb-1.5">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Active Squad Roster
              </span>
              <span className="text-slate-400 text-[11px] font-mono lowercase">
                {roster.length} players
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roster.map((player, idx) => {
                const portrait = config.playerPortraits?.[String(player.uId)] || config.defaultPlayerPortraitUrl;
                const isAlive = player.isAlive !== false;

                return (
                  <div
                    key={player.uId || idx}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isAlive
                        ? 'bg-[#121824] border-[#1e293b]'
                        : 'bg-[#0a0f18] border-[#162030] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {portrait ? (
                        <img
                          src={portrait}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover bg-black/60 border border-white/20 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#182234] border border-[#1e293b] flex items-center justify-center font-bold text-xs text-[#38bdf8] flex-shrink-0">
                          {idx + 1}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-heading font-black text-sm uppercase text-white truncate block">
                          {player.playerName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          UID: {player.uId}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-2 font-telemetry">
                      {player.kills !== undefined && (
                        <span className="text-xs font-bold text-[#38bdf8] bg-[#38bdf8]/10 px-2 py-0.5 rounded border border-[#38bdf8]/30">
                          {player.kills} K
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                        isAlive
                          ? 'bg-[rgba(16,185,129,0.15)] text-[#10b981] border border-[rgba(16,185,129,0.35)]'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      }`}>
                        {isAlive ? 'ALIVE' : 'ELIM'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Match-by-Match History Breakdown */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-heading font-black uppercase tracking-wider text-[#ffb800] border-b border-[#1e293b] pb-1.5">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4" />
                Match-by-Match Breakdown
              </span>
              <span className="text-slate-400 text-[11px] font-mono">
                {matchBreakdown.length} Games Recorded
              </span>
            </div>

            {matchBreakdown.length === 0 ? (
              <div className="text-center py-6 text-slate-500 border border-dashed border-[#1e293b] rounded-xl text-xs">
                No official matches saved yet. Stats will appear as matches conclude.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f1622] text-slate-400 font-heading font-black uppercase tracking-wider border-b border-[#1e293b]">
                    <tr>
                      <th className="py-2.5 px-3">Match</th>
                      <th className="py-2.5 px-3">Place</th>
                      <th className="py-2.5 px-3 text-center">Kills</th>
                      <th className="py-2.5 px-3 text-center">Damage</th>
                      <th className="py-2.5 px-3 text-center">Place Pts</th>
                      <th className="py-2.5 px-3 text-right">Total Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]/60 font-telemetry">
                    {matchBreakdown.map((m) => (
                      <tr key={m.matchNumber} className="hover:bg-[#121824]/60 transition-colors">
                        <td className="py-2 px-3 font-bold text-white font-mono">
                          Game #{m.matchNumber}
                        </td>
                        <td className="py-2 px-3">
                          {m.placement ? (
                            <span className={`inline-flex items-center gap-1 font-bold ${
                              m.isWinner ? 'text-[#10b981]' : m.placement <= 3 ? 'text-[#ffb800]' : 'text-slate-300'
                            }`}>
                              #{m.placement}
                              {m.isWinner && <Trophy className="w-3 h-3 text-[#ffb800]" />}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-[#38bdf8]">
                          {m.kills}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">
                          {m.damage || 0}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-300">
                          {m.rankPoints}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[#ffb800] text-sm">
                          {m.totalPoints} PTS
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#1e293b] bg-[#080d16] flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400 font-mono">
            {config.name || 'PUBG MOBILE ESPORTS'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-heading font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
