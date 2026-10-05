import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Flame,
  Users,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Info,
} from 'lucide-react';
import { TournamentConfig, SavedMatch, PlayerRawInfo } from '../types/pubg';
import { UnifiedTeamStanding } from './StreamLeaderboard';
import { resolveTeamFlagValue } from '../utils/flagHelper';
import { TeamFlag } from './TeamFlag';
import { TeamDetailsModal } from './TeamDetailsModal';
import { VirtuocityLogo } from './VirtuocityLogo';

interface PublicLeaderboardProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  activePlayers: PlayerRawInfo[];
  unifiedStandings: UnifiedTeamStanding[];
  onManualRefresh: () => void;
  onNavigateToAdmin?: () => void;
}

export const PublicLeaderboard: React.FC<PublicLeaderboardProps> = ({
  config,
  savedMatches,
  activePlayers,
  unifiedStandings,
  onManualRefresh,
  onNavigateToAdmin,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<UnifiedTeamStanding | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto refresh periodically
  useEffect(() => {
    const timer = setInterval(() => {
      onManualRefresh();
    }, (config.pollInterval || 3000) * 2);
    return () => clearInterval(timer);
  }, [config.pollInterval, onManualRefresh]);

  const handleManualRefreshClick = () => {
    setIsRefreshing(true);
    onManualRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleCopyPublicLink = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/?view=public`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // ignore
    }
  };

  // Filtered teams list based on search
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return unifiedStandings;
    const q = searchQuery.toLowerCase();
    return unifiedStandings.filter((t) => {
      const nameMatch = t.teamName.toLowerCase().includes(q);
      const playerMatch = t.roster.some((p) => p.playerName.toLowerCase().includes(q));
      return nameMatch || playerMatch || String(t.teamId) === q;
    });
  }, [unifiedStandings, searchQuery]);

  const completedMatches = savedMatches.filter((m) => !m.excludeFromLeaderboard).length;
  const totalScheduled = config.totalMatches || 5;
  const isLiveActive = activePlayers && activePlayers.length > 0;

  // Calculate confirmed chicken dinners (WWCD) directly from savedMatches ensuring exactly 1 winner per match
  const teamWinsMap = useMemo(() => {
    const byId: Record<number, number> = {};
    savedMatches
      .filter((m) => !m.excludeFromLeaderboard)
      .forEach((m) => {
        if (!m.teamScores) return;
        const scores = Object.values(m.teamScores) as any[];
        if (scores.length === 0) return;
        const winner =
          scores.find((s) => s.isWinner && s.placement === 1) ||
          scores.find((s) => s.isWinner) ||
          scores.find((s) => s.placement === 1);
        if (winner && winner.teamId !== undefined && winner.teamId !== null) {
          const tid = Number(winner.teamId);
          byId[tid] = (byId[tid] || 0) + 1;
        }
      });
    return byId;
  }, [savedMatches]);

  return (
    <div className="min-h-screen bg-[#070b14] text-[#f8fafc] flex flex-col font-outfit selection:bg-[#ffb800] selection:text-black">
      {/* Top Public Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0a0f1c]/95 border-b border-[#1e293b] backdrop-blur-xl px-4 py-3 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <VirtuocityLogo size="sm" customUrl={config.logoUrl} glow={false} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-heading font-black uppercase text-white tracking-wider">
                  {config.name || 'PUBG MOBILE TOURNAMENT'}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-heading font-black tracking-widest bg-[#182234] text-[#ffb800] border border-[rgba(255,184,0,0.4)]">
                  {config.mode ? config.mode.toUpperCase() : 'SQUAD'}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  {isLiveActive ? 'LIVE MATCH ACTIVE' : 'PUBLIC STANDINGS'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Official Live Standings &bull; Match {completedMatches} of {totalScheduled} &bull; Click any Team Name to view detailed stats
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPublicLink}
              className="px-3 py-1.5 rounded-xl bg-[#121824] hover:bg-[#1a2336] text-slate-300 hover:text-white border border-[#1e293b] text-xs font-heading font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Copy shareable link to this public leaderboard"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5 text-[#38bdf8]" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Leaderboard'}</span>
            </button>

            <button
              type="button"
              onClick={handleManualRefreshClick}
              className="p-1.5 rounded-xl bg-[#121824] hover:bg-[#1a2336] text-slate-300 hover:text-white border border-[#1e293b] transition-all cursor-pointer"
              title="Refresh standings"
            >
              <RefreshCw className={`w-4 h-4 text-[#38bdf8] ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {onNavigateToAdmin && (
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="px-3 py-1.5 rounded-xl bg-[#ffb800]/15 hover:bg-[#ffb800]/25 text-[#ffb800] border border-[#ffb800]/30 text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-6 space-y-4">
        {/* Quick Info & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0d1424] border border-[#1e293b] p-3 sm:p-4 rounded-2xl shadow-md">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-[#ffb800]" />
              <span>Ranked Games: <strong className="text-white font-telemetry">{completedMatches}</strong> / {totalScheduled}</span>
            </div>
            <span>&bull;</span>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Info className="w-4 h-4 text-[#38bdf8]" />
              <span className="hidden sm:inline">Click on any <strong>Team Name</strong> below to view player rosters and match scores.</span>
              <span className="sm:hidden">Tap any <strong>Team Name</strong> for stats.</span>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team or player..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#070b14] border border-[#1e293b] focus:border-[#38bdf8] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Public Leaderboard Table */}
        <div className="bg-[#0b101d] border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm select-none">
              <thead className="bg-[#101728] text-slate-400 font-heading font-black uppercase tracking-wider text-[11px] sm:text-xs border-b border-[#1e293b]">
                <tr>
                  <th className="py-3 px-3 sm:px-4 w-12 sm:w-16 text-center">#</th>
                  <th className="py-3 px-3 sm:px-4">TEAM (CLICK NAME FOR STATS)</th>
                  <th className="py-3 px-2 sm:px-3 text-center w-16">MATCHES</th>
                  <th className="py-3 px-2 sm:px-3 text-center w-16 text-[#10b981]">WWCD</th>
                  <th className="py-3 px-2 sm:px-3 text-center w-16 text-[#38bdf8]">KILLS</th>
                  <th className="py-3 px-2 sm:px-3 text-center w-20 text-slate-300">PLACE PTS</th>
                  <th className="py-3 px-3 sm:px-5 text-right w-24 sm:w-28 text-[#ffb800]">TOTAL PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/70 font-outfit">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      No matching teams found.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((team, idx) => {
                    const rank = idx + 1;
                    const flagVal = resolveTeamFlagValue(team.teamId, config.teamFlags, team.teamName);
                    const teamLogo = config.teamLogos?.[team.teamId] || config.teamLogos?.[String(team.teamId)];

                    let borderLeftStyle = '4px solid #1e293b';
                    let rankBadgeStyle = 'text-[#94a3b8] bg-[#0f1622] border-[#1e293b]';
                    let rowBg = 'hover:bg-[#121a2c]/80';

                    if (rank === 1) {
                      borderLeftStyle = '4px solid #ffb800';
                      rankBadgeStyle = 'text-[#ffb800] bg-[rgba(255,184,0,0.15)] border-[rgba(255,184,0,0.40)] font-bold';
                      rowBg = 'bg-[#151c2c]/40 hover:bg-[#182338]/80';
                    } else if (rank === 2) {
                      borderLeftStyle = '4px solid #cbd5e1';
                      rankBadgeStyle = 'text-[#cbd5e1] bg-[rgba(203,213,225,0.15)] border-[rgba(203,213,225,0.35)] font-bold';
                    } else if (rank === 3) {
                      borderLeftStyle = '4px solid #f97316';
                      rankBadgeStyle = 'text-[#f97316] bg-[rgba(249,115,22,0.15)] border-[rgba(249,115,22,0.35)] font-bold';
                    } else if (rank >= 4 && rank <= 8) {
                      borderLeftStyle = '4px solid #38bdf8';
                      rankBadgeStyle = 'text-[#38bdf8] bg-[rgba(56,189,248,0.12)] border-[rgba(56,189,248,0.35)]';
                    }

                    return (
                      <tr
                        key={team.teamId}
                        style={{ borderLeft: borderLeftStyle }}
                        className={`transition-colors ${rowBg}`}
                      >
                        {/* Rank Badge */}
                        <td className="py-3 px-3 sm:px-4 text-center">
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg mx-auto flex items-center justify-center font-telemetry font-bold text-xs sm:text-sm border ${rankBadgeStyle}`}>
                            {rank}
                          </div>
                        </td>

                        {/* Team Name Column - Clickable for details! */}
                        <td className="py-3 px-3 sm:px-4">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            {teamLogo && (
                              <img
                                src={teamLogo}
                                alt=""
                                className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0"
                              />
                            )}
                            {flagVal && (
                              <TeamFlag
                                flagValue={flagVal}
                                teamId={team.teamId}
                                isWinner={rank === 1}
                                className="w-6 h-4 sm:w-7 sm:h-4.5 object-cover rounded shadow-sm border border-white/20 flex-shrink-0"
                              />
                            )}

                            {/* INTERACTIVE TEAM NAME BUTTON */}
                            <button
                              type="button"
                              onClick={() => setSelectedTeam(team)}
                              className="text-left font-heading font-black text-sm sm:text-base md:text-lg uppercase text-white hover:text-[#38bdf8] transition-colors truncate tracking-wide flex items-center gap-1.5 group cursor-pointer"
                              title={`Click to view ${team.teamName} full stats & roster`}
                            >
                              <span className="group-hover:underline underline-offset-4 decoration-[#38bdf8]">
                                {team.teamName}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#38bdf8] transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                            </button>

                            {rank === 1 && (
                              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-heading font-bold uppercase bg-[rgba(255,184,0,0.15)] text-[#ffb800] border border-[rgba(255,184,0,0.40)] flex-shrink-0">
                                <Trophy className="w-3 h-3" />
                                Leader
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Matches Played */}
                        <td className="py-3 px-2 sm:px-3 text-center font-telemetry font-bold text-slate-300">
                          {team.matchesPlayed || completedMatches}
                        </td>

                        {/* WWCD Wins */}
                        <td className="py-3 px-2 sm:px-3 text-center">
                          {(() => {
                            const tid = team.teamId;
                            const wwcdCount = teamWinsMap[tid] ?? (team.totalWins || (team as any).wins || (team as any).wwcd || 0);
                            return wwcdCount > 0 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-[#10b981]">
                                🍗 {wwcdCount}
                              </span>
                            ) : (
                              <span className="text-slate-600">0</span>
                            );
                          })()}
                        </td>

                        {/* Kills */}
                        <td className="py-3 px-2 sm:px-3 text-center font-telemetry font-bold text-[#38bdf8]">
                          {team.totalKills || 0}
                        </td>

                        {/* Placement Points */}
                        <td className="py-3 px-2 sm:px-3 text-center font-telemetry text-slate-300">
                          {team.totalPlacementPoints || 0}
                        </td>

                        {/* Total Points */}
                        <td className="py-3 px-3 sm:px-5 text-right font-telemetry font-bold text-base sm:text-xl text-[#ffb800]">
                          {team.totalPoints || 0}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Team Details Modal when clicking any Team Name */}
      {selectedTeam && (
        <TeamDetailsModal
          team={selectedTeam}
          config={config}
          savedMatches={savedMatches}
          activePlayers={activePlayers}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
};
