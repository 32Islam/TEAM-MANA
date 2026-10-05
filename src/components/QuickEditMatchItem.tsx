import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Edit3,
  Trash2,
  Download,
  Eye,
  EyeOff,
  Star,
  Zap,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  RotateCcw,
  User,
  Shield,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { SavedMatch, TeamMatchScore, TournamentConfig, PlayerRawInfo } from '../types/pubg';
import { exportSingleMatchJson } from '../utils/storage';

interface QuickEditMatchItemProps {
  match: SavedMatch;
  config: TournamentConfig;
  isQuickEditActive: boolean;
  onToggleQuickEdit: () => void;
  onUpdateMatch?: (updatedMatch: SavedMatch) => void;
  onDeleteMatch: (id: string) => void;
  onOpenScorecard: (match: SavedMatch) => void;
  onOpenFullEditModal: (match: SavedMatch) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

interface EditableTeamState {
  teamId: number;
  teamName: string;
  placement: number;
  rankPoints: number;
  penaltyPoints: number;
  adjustmentReason: string;
  totalDamage: number;
  isWinner: boolean;
  players: PlayerRawInfo[];
}

export const QuickEditMatchItem: React.FC<QuickEditMatchItemProps> = ({
  match,
  config,
  isQuickEditActive,
  onToggleQuickEdit,
  onUpdateMatch,
  onDeleteMatch,
  onOpenScorecard,
  onOpenFullEditModal,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<number, boolean>>({});

  const killMultiplier = config.killPointsPerKill || 1;

  // Build current editable teams structure from the match prop
  const teamsList = useMemo(() => {
    const scores = match.teamScores || {};
    const teams: EditableTeamState[] = [];

    (Object.values(scores) as TeamMatchScore[]).forEach((ts) => {
      const teamPlayers = (match.playerSnapshots || []).filter((p) => p.teamId === ts.teamId);
      teams.push({
        teamId: ts.teamId,
        teamName: ts.teamName || `Team ${ts.teamId}`,
        placement: ts.placement || 99,
        rankPoints: ts.rankPoints ?? 0,
        penaltyPoints: ts.penaltyPoints ?? 0,
        adjustmentReason: ts.adjustmentReason ?? '',
        totalDamage: ts.totalDamage ?? 0,
        isWinner: Boolean(ts.isWinner || ts.placement === 1),
        players: teamPlayers.map((p) => ({ ...p })),
      });
    });

    // Sort by placement ascending
    teams.sort((a, b) => a.placement - b.placement);
    return teams;
  }, [match]);

  // Helper to commit a modified match state
  const commitMatchUpdate = (updatedTeams: EditableTeamState[]) => {
    if (!onUpdateMatch) return;

    const updatedTeamScores: Record<number, TeamMatchScore> = {};
    const updatedPlayers: PlayerRawInfo[] = [];

    updatedTeams.forEach((td) => {
      const totalKills = td.players.reduce((sum, p) => sum + (Number(p.killNum) || 0), 0);
      const totalDamage = td.players.reduce((sum, p) => sum + (Number(p.damage) || 0), 0);
      const rankPts = Number(td.rankPoints) || 0;
      const killPts = totalKills * killMultiplier;
      const penalty = Number(td.penaltyPoints) || 0;
      const totalPts = Math.max(0, rankPts + killPts + penalty);

      updatedTeamScores[td.teamId] = {
        teamId: td.teamId,
        teamName: td.teamName.trim() || `Team ${td.teamId}`,
        placement: td.placement,
        rankPoints: rankPts,
        killPoints: killPts,
        penaltyPoints: penalty,
        adjustmentReason: td.adjustmentReason,
        totalPoints: totalPts,
        totalKills,
        totalDamage,
        isWinner: td.isWinner,
        aliveCount: 0,
        totalMembers: td.players.length || 4,
      };

      td.players.forEach((p) => {
        updatedPlayers.push({
          ...p,
          teamId: td.teamId,
          teamName: td.teamName.trim() || `Team ${td.teamId}`,
          rank: td.placement,
        });
      });
    });

    const updatedMatch: SavedMatch = {
      ...match,
      teamScores: updatedTeamScores,
      playerSnapshots: updatedPlayers,
    };

    onUpdateMatch(updatedMatch);
    setShowSavedFeedback(true);
    setTimeout(() => setShowSavedFeedback(false), 2000);
  };

  // Handle inline team name change
  const handleTeamNameChange = (teamId: number, newName: string) => {
    const updated = teamsList.map((t) => (t.teamId === teamId ? { ...t, teamName: newName } : t));
    commitMatchUpdate(updated);
  };

  // Handle inline player kill count change
  const handlePlayerKillsChange = (teamId: number, uId: number, newKills: number) => {
    const safeKills = Math.max(0, Math.min(99, newKills || 0));
    const updated = teamsList.map((t) => {
      if (t.teamId !== teamId) return t;
      const updatedPlayers = t.players.map((p) =>
        p.uId === uId ? { ...p, killNum: safeKills } : p
      );
      return { ...t, players: updatedPlayers };
    });
    commitMatchUpdate(updated);
  };

  // Toggle single team accordion in quick edit
  const toggleTeamExpansion = (teamId: number) => {
    setExpandedTeams((prev) => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  // Toggle match leaderboard exclusion (Special Game / Exhibition)
  const handleToggleLeaderboardExclusion = () => {
    if (!onUpdateMatch) return;
    const isExcluding = !match.excludeFromLeaderboard;
    const updatedMatch: SavedMatch = {
      ...match,
      excludeFromLeaderboard: isExcluding,
      isExhibition: isExcluding,
    };
    onUpdateMatch(updatedMatch);
    setShowSavedFeedback(true);
    setTimeout(() => setShowSavedFeedback(false), 2000);
  };

  // Update match custom special label
  const handleUpdateCustomLabel = (label: string) => {
    if (!onUpdateMatch) return;
    const updatedMatch: SavedMatch = {
      ...match,
      customLabel: label,
    };
    onUpdateMatch(updatedMatch);
  };

  // Filter teams by search
  const filteredTeams = useMemo(() => {
    if (!searchTerm.trim()) return teamsList;
    const term = searchTerm.toLowerCase();
    return teamsList.filter((t) => {
      if (t.teamName.toLowerCase().includes(term)) return true;
      if (String(t.placement).includes(term)) return true;
      return t.players.some((p) => p.playerName.toLowerCase().includes(term));
    });
  }, [teamsList, searchTerm]);

  // Scores summary
  const scoresList = Object.values(match.teamScores || {}) as TeamMatchScore[];
  const winner = scoresList.find((ts) => ts.placement === 1);
  const totalKillsInMatch = scoresList.reduce((acc, t) => acc + (t.totalKills || 0), 0);

  return (
    <div
      id={`match-history-card-${match.id}`}
      className={`bg-[#121824]/95 border rounded-xl p-4 transition-all space-y-3.5 backdrop-blur-md ${
        isQuickEditActive
          ? 'border-[#FFB800] ring-1 ring-[#FFB800]/40 shadow-xl shadow-[#FFB800]/10 bg-[#162032]'
          : 'border-[#1E293B] hover:border-[#FFB800]/50 shadow-lg'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-bold text-base font-rajdhani text-[#FFB800] tracking-wider uppercase">
            GAME #{match.matchNumber}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">{match.dateStr}</span>
          {match.excludeFromLeaderboard && (
            <span
              onClick={handleToggleLeaderboardExclusion}
              className="px-2.5 py-0.5 rounded text-[10px] font-bold font-rajdhani tracking-wider uppercase bg-purple-950/40 text-purple-300 border border-purple-500/50 flex items-center gap-1 cursor-pointer hover:bg-purple-900/50 transition-colors shadow-sm"
              title="Click to toggle: This game is currently HIDDEN from cumulative tournament standings"
            >
              <Star className="w-3 h-3 fill-purple-400" />
              <span>{match.customLabel || 'Special Game (Excluded)'}</span>
            </span>
          )}
          {isQuickEditActive && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-rajdhani uppercase tracking-wider bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/50 flex items-center gap-1 animate-pulse">
              <Zap className="w-3 h-3" />
              <span>Quick Edit Active</span>
            </span>
          )}
          {showSavedFeedback && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-rajdhani uppercase text-[#10B981] bg-[#10B981]/20 border border-[#10B981]/50 flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Synced!</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Reorder Buttons (Move Up / Down) */}
          {(onMoveUp || onMoveDown) && (
            <div className="flex items-center bg-[#0B0E14] rounded-lg p-0.5 border border-[#1E293B] mr-1">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={isFirst || !onMoveUp}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1E293B] disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
                title={isFirst ? 'Already first match' : 'Move match earlier (up in list)'}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={isLast || !onMoveDown}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1E293B] disabled:opacity-20 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
                title={isLast ? 'Already last match' : 'Move match later (down in list)'}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick toggle for Leaderboard Exclusion */}
          <button
            type="button"
            onClick={handleToggleLeaderboardExclusion}
            className={`p-1.5 rounded-lg transition-colors ${
              match.excludeFromLeaderboard
                ? 'text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/50'
                : 'text-slate-400 hover:text-white hover:bg-[#1E293B]'
            }`}
            title={
              match.excludeFromLeaderboard
                ? 'Game is hidden from leaderboard. Click to re-include in tournament standings'
                : 'Hide game from leaderboard (Mark as Special Game / Exhibition)'
            }
          >
            {match.excludeFromLeaderboard ? (
              <EyeOff className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Quick Edit Toggle on Card */}
          <button
            id={`btn-quick-edit-match-${match.id}`}
            type="button"
            onClick={onToggleQuickEdit}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-rajdhani uppercase tracking-wider transition-all border ${
              isQuickEditActive
                ? 'bg-[#FFB800] text-black border-[#FFB800] shadow-md shadow-[#FFB800]/30'
                : 'text-[#FFB800] bg-[#FFB800]/10 hover:bg-[#FFB800] hover:text-black border-[#FFB800]/30'
            }`}
            title={isQuickEditActive ? 'Close Quick Edit Mode' : 'Toggle Quick Inline Editing for this Game'}
          >
            <Zap className="w-3 h-3" />
            <span className="hidden sm:inline">{isQuickEditActive ? 'Editing' : 'Quick Edit'}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenFullEditModal(match)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#1a83c5] hover:bg-[#1a83c5]/10 transition-colors"
            title={`Full Edit for Game #${match.matchNumber} (Scores & Penalties)`}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exportSingleMatchJson(match)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E293B] transition-colors"
            title="Download match JSON"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteMatch(match.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF5200] hover:bg-[#FF5200]/10 transition-colors"
            title={`Delete Game #${match.matchNumber} from tournament`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Summary Box (when not in quick edit or as overview) */}
      {!isQuickEditActive && (
        <div className="flex items-center justify-between text-xs bg-[#0B0E14] p-3 rounded-xl border border-[#1E293B]">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold font-rajdhani tracking-wider block">Winner 🍗</span>
            <strong className="text-[#10B981] font-bold text-sm font-rajdhani tracking-wide">
              {winner ? winner.teamName : 'None'}
            </strong>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold font-rajdhani tracking-wider block">Total Eliminations</span>
            <strong className="text-[#FF5200] font-rajdhani tabular-nums text-base font-bold">
              {totalKillsInMatch} KILLS
            </strong>
          </div>
        </div>
      )}

      {/* QUICK EDIT INLINE VIEW */}
      {isQuickEditActive && (
        <div className="space-y-3 pt-2.5 border-t border-[#1E293B]">
          {/* Quick Filter Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap bg-[#0B0E14] p-2.5 rounded-xl border border-[#1E293B]">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter teams or players..."
                className="w-full bg-[#121824] border border-[#1E293B] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFB800]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const allExpanded: Record<number, boolean> = {};
                  const isAnyClosed = teamsList.some((t) => !expandedTeams[t.teamId]);
                  teamsList.forEach((t) => {
                    allExpanded[t.teamId] = isAnyClosed;
                  });
                  setExpandedTeams(allExpanded);
                }}
                className="text-xs font-bold font-rajdhani uppercase tracking-wider text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-[#1E293B] transition-colors"
              >
                {teamsList.some((t) => !expandedTeams[t.teamId]) ? 'Expand All' : 'Collapse All'}
              </button>
            </div>
          </div>

          {/* Special Game / Leaderboard Exclusion Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-[#0B0E14] border border-purple-500/30">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  match.excludeFromLeaderboard
                    ? 'bg-purple-950/50 text-purple-300 border border-purple-500/40'
                    : 'bg-[#121824] text-slate-400 border border-[#1E293B]'
                }`}
              >
                {match.excludeFromLeaderboard ? (
                  <EyeOff className="w-4 h-4 text-purple-400" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold font-rajdhani uppercase tracking-wider text-white flex items-center gap-1.5">
                  Leaderboard Standings Inclusion
                  {match.excludeFromLeaderboard && (
                    <span className="text-[10px] text-purple-300 font-normal">
                      (Hidden from Standings)
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  {match.excludeFromLeaderboard
                    ? 'Points & kills from this match do NOT count towards overall tournament rankings.'
                    : 'Match points and kills count normally towards tournament standings.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {match.excludeFromLeaderboard && (
                <input
                  type="text"
                  value={match.customLabel || ''}
                  onChange={(e) => handleUpdateCustomLabel(e.target.value)}
                  placeholder="Tag (e.g. Showmatch)"
                  className="bg-[#121824] border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs text-white w-36 focus:outline-none focus:border-purple-400"
                  title="Custom badge label for this game"
                />
              )}
              <button
                type="button"
                onClick={handleToggleLeaderboardExclusion}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-rajdhani uppercase tracking-wider transition-all border ${
                  match.excludeFromLeaderboard
                    ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-sm'
                    : 'bg-[#1E293B] hover:bg-[#2A3B5A] text-slate-300 hover:text-white border-[#334155]'
                }`}
              >
                {match.excludeFromLeaderboard ? 'Excluded (Hidden)' : 'Exclude Game'}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            ✏️ Direct inline edit: type new team names and adjust player kill counts with stepper buttons. Standings recalculate instantly.
          </p>

          {/* Teams and Players list */}
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredTeams.map((team) => {
              const isExpanded = expandedTeams[team.teamId] ?? true;
              const currentTeamKills = team.players.reduce(
                (sum, p) => sum + (Number(p.killNum) || 0),
                0
              );
              const killPts = currentTeamKills * killMultiplier;
              const totalPts = Math.max(0, team.rankPoints + killPts + team.penaltyPoints);

              return (
                <div
                  key={team.teamId}
                  className="bg-[#0E1420] border border-[#1E293B] rounded-xl p-3 space-y-2.5 transition-all hover:border-[#334155]"
                >
                  {/* Team Top Row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                      {/* Placement Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-bold font-rajdhani tracking-wider ${
                          team.placement === 1
                            ? 'bg-[#FFB800] text-black shadow-md shadow-[#FFB800]/20'
                            : team.placement <= 3
                            ? 'bg-[#1a83c5]/20 text-[#1a83c5] border border-[#1a83c5]/40'
                            : 'bg-[#1E293B] text-slate-300'
                        }`}
                      >
                        #{team.placement}
                        {team.placement === 1 && ' 🍗'}
                      </span>

                      {/* Team Name Input */}
                      <div className="flex-1 max-w-xs">
                        <input
                          type="text"
                          value={team.teamName}
                          onChange={(e) => handleTeamNameChange(team.teamId, e.target.value)}
                          placeholder={`Team ${team.teamId}`}
                          className="w-full bg-[#121824] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs font-bold text-white font-rajdhani uppercase tracking-wider focus:outline-none focus:border-[#FFB800]"
                          title="Click to edit team name"
                        />
                      </div>
                    </div>

                    {/* Team Metrics Pill & Accordion Toggle */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-xs font-rajdhani tabular-nums bg-[#0B0E14] px-3 py-1 rounded-lg border border-[#1E293B]">
                        <span className="text-slate-400">
                          Kills:{' '}
                          <strong className="text-[#FF5200] font-bold">{currentTeamKills}</strong>
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-400">
                          Pts:{' '}
                          <strong className="text-[#10B981] font-bold">{totalPts}</strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleTeamExpansion(team.teamId)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E293B]"
                        title={isExpanded ? 'Collapse players' : 'Expand players'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Player Roster Inline Kill Controls */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-[#1E293B] pl-2 space-y-2 bg-[#0B0E14]/80 p-2.5 rounded-lg">
                      {team.players.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">No player records recorded for this team.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {team.players.map((player) => (
                            <div
                              key={player.uId || player.playerName}
                              className="flex items-center justify-between bg-[#121824] px-3 py-1.5 rounded-lg border border-[#1E293B] gap-2"
                            >
                              <div className="flex items-center gap-1.5 truncate flex-1">
                                <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span
                                  className="text-xs font-semibold text-slate-200 truncate"
                                  title={player.playerName}
                                >
                                  {player.playerName}
                                </span>
                              </div>

                              {/* Kill Count Stepper & Input */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[10px] text-slate-400 uppercase font-rajdhani font-bold mr-0.5">
                                  Kills:
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePlayerKillsChange(
                                      team.teamId,
                                      player.uId,
                                      (Number(player.killNum) || 0) - 1
                                    )
                                  }
                                  className="w-5 h-5 rounded bg-[#1E293B] hover:bg-[#FF5200] hover:text-white text-slate-300 flex items-center justify-center text-xs font-bold transition-colors"
                                  title="Decrease kill count"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={99}
                                  value={player.killNum ?? 0}
                                  onChange={(e) =>
                                    handlePlayerKillsChange(
                                      team.teamId,
                                      player.uId,
                                      parseInt(e.target.value, 10) || 0
                                    )
                                  }
                                  className="w-10 text-center bg-[#0B0E14] border border-[#1E293B] rounded py-0.5 text-xs font-rajdhani font-bold tabular-nums text-[#FF5200] focus:outline-none focus:border-[#FFB800]"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePlayerKillsChange(
                                      team.teamId,
                                      player.uId,
                                      (Number(player.killNum) || 0) + 1
                                    )
                                  }
                                  className="w-5 h-5 rounded bg-[#1E293B] hover:bg-[#10B981] hover:text-black text-slate-300 flex items-center justify-center text-xs font-bold transition-colors"
                                  title="Increase kill count"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Card Footer Actions */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-1 font-rajdhani font-semibold">
        <span>{match.playerSnapshots.length} Players Recorded</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenScorecard(match)}
            className="text-[#FFB800] hover:underline font-bold uppercase tracking-wider text-xs flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Scorecard</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenFullEditModal(match)}
            className="text-[#1a83c5] hover:underline font-bold uppercase tracking-wider text-xs flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Placements &amp; Penalties</span>
          </button>
        </div>
      </div>
    </div>
  );
};
