import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Crosshair,
  ShieldAlert,
  Save,
  X,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Sparkles,
  EyeOff,
  Eye,
  Star,
} from 'lucide-react';
import { SavedMatch, TeamMatchScore, TournamentConfig, PlayerRawInfo } from '../types/pubg';

interface EditMatchScoresModalProps {
  isOpen: boolean;
  match: SavedMatch | null;
  config: TournamentConfig;
  onSave: (updatedMatch: SavedMatch) => void;
  onClose: () => void;
}

interface EditableTeamData {
  teamId: number;
  teamName: string;
  placement: number;
  rankPoints: number;
  totalKills: number;
  killPoints: number;
  penaltyPoints: number;
  adjustmentReason: string;
  totalDamage: number;
  isWinner: boolean;
  players: PlayerRawInfo[];
}

export const EditMatchScoresModal: React.FC<EditMatchScoresModalProps> = ({
  isOpen,
  match,
  config,
  onSave,
  onClose,
}) => {
  const [teamsData, setTeamsData] = useState<Record<number, EditableTeamData>>({});
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const [excludeFromLeaderboard, setExcludeFromLeaderboard] = useState(false);
  const [customLabel, setCustomLabel] = useState('');

  // Initialize editable state whenever match changes
  useEffect(() => {
    if (!match) return;

    setExcludeFromLeaderboard(Boolean(match.excludeFromLeaderboard));
    setCustomLabel(match.customLabel || '');

    const initial: Record<number, EditableTeamData> = {};
    const scores = match.teamScores || {};

    (Object.values(scores) as TeamMatchScore[]).forEach((ts) => {
      const teamPlayers = (match.playerSnapshots || []).filter((p) => p.teamId === ts.teamId);
      initial[ts.teamId] = {
        teamId: ts.teamId,
        teamName: ts.teamName || `Team ${ts.teamId}`,
        placement: ts.placement || 1,
        rankPoints: ts.rankPoints ?? 0,
        totalKills: ts.totalKills ?? 0,
        killPoints: ts.killPoints ?? (ts.totalKills * (config.killPointsPerKill || 1)),
        penaltyPoints: ts.penaltyPoints ?? 0,
        adjustmentReason: ts.adjustmentReason ?? '',
        totalDamage: ts.totalDamage ?? 0,
        isWinner: Boolean(ts.isWinner || ts.placement === 1),
        players: teamPlayers.map((p) => ({ ...p })),
      };
    });

    setTeamsData(initial);
  }, [match, config.killPointsPerKill]);

  if (!isOpen || !match) return null;

  const killMultiplier = config.killPointsPerKill || 1;

  // Handle team rank change
  const handlePlacementChange = (teamId: number, newPlacement: number) => {
    const val = Math.max(1, Math.min(64, newPlacement || 1));
    const autoRankPoints = config.rankPointsTable[val] ?? 0;

    setTeamsData((prev) => {
      const current = prev[teamId];
      if (!current) return prev;
      return {
        ...prev,
        [teamId]: {
          ...current,
          placement: val,
          rankPoints: autoRankPoints,
          isWinner: val === 1,
        },
      };
    });
  };

  // Handle rank points change
  const handleRankPointsChange = (teamId: number, val: number) => {
    setTeamsData((prev) => {
      const current = prev[teamId];
      if (!current) return prev;
      return {
        ...prev,
        [teamId]: {
          ...current,
          rankPoints: isNaN(val) ? 0 : val,
        },
      };
    });
  };

  // Handle total kills change
  const handleKillsChange = (teamId: number, val: number) => {
    const kills = Math.max(0, val || 0);
    setTeamsData((prev) => {
      const current = prev[teamId];
      if (!current) return prev;
      return {
        ...prev,
        [teamId]: {
          ...current,
          totalKills: kills,
          killPoints: kills * killMultiplier,
        },
      };
    });
  };

  // Handle penalty / adjustment change (supports negative "mines" points and positive bonus)
  const handlePenaltyChange = (teamId: number, delta: number) => {
    setTeamsData((prev) => {
      const current = prev[teamId];
      if (!current) return prev;
      return {
        ...prev,
        [teamId]: {
          ...current,
          penaltyPoints: (current.penaltyPoints || 0) + delta,
        },
      };
    });
  };

  const handlePenaltyDirectInput = (teamId: number, val: number) => {
    setTeamsData((prev) => {
      const current = prev[teamId];
      if (!current) return prev;
      return {
        ...prev,
        [teamId]: {
          ...current,
          penaltyPoints: isNaN(val) ? 0 : val,
        },
      };
    });
  };

  const handleReasonChange = (teamId: number, reason: string) => {
    setTeamsData((prev) => {
      const current = prev[teamId];
      if (!current) return prev;
      return {
        ...prev,
        [teamId]: {
          ...current,
          adjustmentReason: reason,
        },
      };
    });
  };

  // Handle player kills change inside a team
  const handlePlayerKillsChange = (teamId: number, uId: number, newKills: number) => {
    const safeKills = Math.max(0, newKills || 0);
    setTeamsData((prev) => {
      const current = prev[teamId];
      if (!current) return prev;

      const updatedPlayers = current.players.map((p) =>
        p.uId === uId ? { ...p, killNum: safeKills } : p
      );
      const newTotalKills = updatedPlayers.reduce((sum, p) => sum + (p.killNum || 0), 0);

      return {
        ...prev,
        [teamId]: {
          ...current,
          players: updatedPlayers,
          totalKills: newTotalKills,
          killPoints: newTotalKills * killMultiplier,
        },
      };
    });
  };

  // Handle player damage change
  const handlePlayerDamageChange = (teamId: number, uId: number, newDamage: number) => {
    const safeDamage = Math.max(0, newDamage || 0);
    setTeamsData((prev) => {
      const current = prev[teamId];
      if (!current) return prev;

      const updatedPlayers = current.players.map((p) =>
        p.uId === uId ? { ...p, damage: safeDamage } : p
      );
      const newTotalDamage = updatedPlayers.reduce((sum, p) => sum + (p.damage || 0), 0);

      return {
        ...prev,
        [teamId]: {
          ...current,
          players: updatedPlayers,
          totalDamage: newTotalDamage,
        },
      };
    });
  };

  // Auto re-sort and calculate placements & rank points
  const handleAutoRecalculatePlacements = () => {
    const sorted = (Object.values(teamsData) as EditableTeamData[]).sort((a, b) => a.placement - b.placement);
    const updated: Record<number, EditableTeamData> = {};

    sorted.forEach((t, idx) => {
      const place = idx + 1;
      const pts = config.rankPointsTable[place] ?? 0;
      updated[t.teamId] = {
        ...t,
        placement: place,
        rankPoints: pts,
        isWinner: place === 1,
      };
    });

    setTeamsData(updated);
  };

  // Commit changes to match
  const handleSave = () => {
    const updatedTeamScores: Record<number, TeamMatchScore> = {};
    const updatedPlayers: PlayerRawInfo[] = [];

    (Object.values(teamsData) as EditableTeamData[]).forEach((td) => {
      const rankPts = Number(td.rankPoints) || 0;
      const killPts = Number(td.killPoints) || 0;
      const penalty = Number(td.penaltyPoints) || 0;
      const totalPts = Math.max(0, rankPts + killPts + penalty);

      updatedTeamScores[td.teamId] = {
        teamId: td.teamId,
        teamName: td.teamName,
        placement: td.placement,
        rankPoints: rankPts,
        killPoints: killPts,
        penaltyPoints: penalty,
        adjustmentReason: td.adjustmentReason,
        totalPoints: totalPts,
        totalKills: td.totalKills,
        totalDamage: td.totalDamage,
        isWinner: td.isWinner,
        aliveCount: 0,
        totalMembers: td.players.length || 4,
      };

      td.players.forEach((p) => {
        updatedPlayers.push({
          ...p,
          teamId: td.teamId,
          teamName: td.teamName,
          rank: td.placement,
        });
      });
    });

    const updatedMatch: SavedMatch = {
      ...match,
      playerSnapshots: updatedPlayers.length > 0 ? updatedPlayers : match.playerSnapshots,
      teamScores: updatedTeamScores,
      excludeFromLeaderboard,
      isExhibition: excludeFromLeaderboard,
      customLabel: customLabel.trim() || undefined,
    };

    onSave(updatedMatch);
    onClose();
  };

  const sortedTeams = (Object.values(teamsData) as EditableTeamData[]).sort((a, b) => a.placement - b.placement);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#121824] border border-[#1E293B] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B] bg-[#0B0E14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a83c5]/15 border border-[#1a83c5]/30 flex items-center justify-center text-[#1a83c5]">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white font-rajdhani uppercase tracking-wider">
                  Edit Game #{match.matchNumber} Scores &amp; Penalties
                </h3>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold font-rajdhani uppercase tracking-wider bg-[#1a83c5]/15 text-[#1a83c5] border border-[#1a83c5]/30">
                  MATCH EDITOR
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                Recorded at {match.dateStr} &bull; Adjust placements, kills, or apply minus/penalty scores directly
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoRecalculatePlacements}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-300 hover:text-white text-xs font-bold font-rajdhani uppercase tracking-wider transition-all cursor-pointer border border-[#334155]"
              title="Auto re-apply standard rank points based on current placement order"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#1a83c5]" />
              <span className="hidden sm:inline">Auto Rank Points</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1E293B] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Table of Teams */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {/* Special Game / Leaderboard Exclusion Setting */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              excludeFromLeaderboard
                ? 'bg-[#1E1B2E] border-slate-700 shadow-lg shadow-purple-500/10'
                : 'bg-[#0B0E14] border-[#1E293B]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    excludeFromLeaderboard
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-[#1E293B] text-slate-400 border border-[#334155]'
                  }`}
                >
                  {excludeFromLeaderboard ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold font-rajdhani uppercase tracking-wider text-white">
                      Hide Special Game From Leaderboard
                    </span>
                    {excludeFromLeaderboard ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold font-rajdhani uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-purple-400 text-purple-400" />
                        EXCLUDED FROM TOURNAMENT STANDINGS
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold font-rajdhani uppercase tracking-wider bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30">
                        COUNTED IN STANDINGS
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans">
                    When enabled, points, placements, and kills from this match are preserved in match history but completely excluded from cumulative tournament rankings, overall WWCD counts, and MVP stats.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-end sm:self-center">
                <input
                  type="checkbox"
                  checked={excludeFromLeaderboard}
                  onChange={(e) => setExcludeFromLeaderboard(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-[#1E293B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1a83c5]"></div>
              </label>
            </div>

            {/* Custom Special Game Label Input */}
            {excludeFromLeaderboard && (
              <div className="mt-3 pt-3 border-t border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <span className="text-xs font-bold font-rajdhani uppercase tracking-wider text-purple-300 flex-shrink-0">
                  Custom Game Badge / Label:
                </span>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. All-Stars Showmatch, Warm-Up Scrim, Exhibition"
                  className="w-full sm:max-w-md bg-[#0B0E14] border border-purple-500/40 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
              </div>
            )}
          </div>

          <div className="bg-[#0B0E14] border border-[#FFB800]/30 rounded-2xl p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#FFB800] flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-white font-bold font-rajdhani uppercase tracking-wider">Live Standings Sync:</span> Any score adjustments or minus/penalty points applied here will instantly recalculate tournament standings, update the Between Games Stage, and stream across OBS overlays!
            </div>
          </div>

          <div className="space-y-2.5">
            {sortedTeams.map((td) => {
              const rankPts = Number(td.rankPoints) || 0;
              const killPts = Number(td.killPoints) || 0;
              const penalty = Number(td.penaltyPoints) || 0;
              const totalPts = Math.max(0, rankPts + killPts + penalty);
              const isExpanded = expandedTeamId === td.teamId;

              return (
                <div
                  key={td.teamId}
                  className={`border rounded-2xl transition-all overflow-hidden ${
                    td.placement === 1
                      ? 'bg-[#0B0E14] border-[#FFB800]/50 shadow-md shadow-[#FFB800]/10'
                      : penalty < 0
                      ? 'bg-[#0B0E14] border-[#FF5200]/40'
                      : 'bg-[#0B0E14] border-[#1E293B]'
                  }`}
                >
                  {/* Team Row Main Summary */}
                  <div className="p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    {/* Rank & Team Name */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-slate-400 font-bold font-rajdhani uppercase tracking-wider">Rank</span>
                        <input
                          type="number"
                          min="1"
                          max="64"
                          value={td.placement}
                          onChange={(e) => handlePlacementChange(td.teamId, parseInt(e.target.value, 10))}
                          className="w-12 text-center bg-[#121824] border border-[#1E293B] rounded-xl py-1 text-sm font-extrabold text-[#FFB800] focus:outline-none focus:border-[#1a83c5] font-mono"
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-white font-rajdhani uppercase text-base tracking-wide">
                            {td.teamName}
                          </span>
                          {td.placement === 1 && (
                            <span className="text-xs" title="Winner (WWCD)">🍗</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ID: {td.teamId} &bull; {td.players.length} players
                        </span>
                      </div>
                    </div>

                    {/* Stats & Inputs Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:flex items-center gap-2 sm:gap-3 w-full md:w-auto">
                      {/* Rank Points */}
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-bold font-rajdhani uppercase tracking-wider">Placement Pts</span>
                        <input
                          type="number"
                          value={td.rankPoints}
                          onChange={(e) => handleRankPointsChange(td.teamId, parseInt(e.target.value, 10))}
                          className="w-20 text-center bg-[#121824] border border-[#1E293B] rounded-xl py-1 text-xs font-mono font-bold text-[#FFB800] focus:outline-none focus:border-[#1a83c5]"
                        />
                      </div>

                      {/* Total Kills */}
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-bold font-rajdhani uppercase tracking-wider">Total Kills</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={td.totalKills}
                            onChange={(e) => handleKillsChange(td.teamId, parseInt(e.target.value, 10))}
                            className="w-16 text-center bg-[#121824] border border-[#1E293B] rounded-xl py-1 text-xs font-mono font-bold text-[#1a83c5] focus:outline-none focus:border-[#1a83c5]"
                          />
                        </div>
                      </div>

                      {/* Minus / Penalty / Bonus Adjustment */}
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 font-bold font-rajdhani uppercase tracking-wider">Penalty / Bonus</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePenaltyChange(td.teamId, -1)}
                            className="w-6 h-7 rounded-lg bg-[#FF5200]/20 hover:bg-[#FF5200] text-[#FF5200] hover:text-white text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                            title="Minus 1 point"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            value={td.penaltyPoints}
                            onChange={(e) => handlePenaltyDirectInput(td.teamId, parseInt(e.target.value, 10))}
                            placeholder="0"
                            className={`w-14 text-center bg-[#121824] border rounded-xl py-1 text-xs font-mono font-bold focus:outline-none ${
                              td.penaltyPoints < 0
                                ? 'text-[#FF5200] border-[#FF5200]/50'
                                : td.penaltyPoints > 0
                                ? 'text-[#00FF66] border-[#00FF66]/50'
                                : 'text-slate-400 border-[#1E293B]'
                            }`}
                            title="Minus (penalty) or bonus point adjustments"
                          />
                          <button
                            type="button"
                            onClick={() => handlePenaltyChange(td.teamId, 1)}
                            className="w-6 h-7 rounded-lg bg-[#00FF66]/20 hover:bg-[#00FF66] text-[#00FF66] hover:text-black text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                            title="Add 1 point"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Total Points Awarded */}
                      <div className="flex flex-col items-end pl-2">
                        <span className="text-[9px] text-slate-400 font-bold font-rajdhani uppercase tracking-wider">Total Points</span>
                        <div className="flex items-baseline gap-1 py-1 font-mono">
                          <span className="font-extrabold text-lg text-[#FFB800]">
                            {totalPts}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">PTS</span>
                        </div>
                      </div>
                    </div>

                    {/* Expand Players Button */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => setExpandedTeamId(isExpanded ? null : td.teamId)}
                        className="px-3 py-1.5 rounded-xl bg-[#121824] hover:bg-[#1E293B] text-slate-300 text-xs font-bold font-rajdhani uppercase tracking-wider flex items-center gap-1 transition-colors border border-[#1E293B] cursor-pointer"
                      >
                        <span>Players ({td.players.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Optional Penalty Note Input */}
                  {td.penaltyPoints !== 0 && (
                    <div className="px-4 pb-3 pt-1 border-t border-[#1E293B] flex items-center gap-2 text-xs">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#FF5200] flex-shrink-0" />
                      <span className="text-slate-400 text-[11px] whitespace-nowrap font-rajdhani uppercase font-bold">Penalty Reason:</span>
                      <input
                        type="text"
                        value={td.adjustmentReason}
                        onChange={(e) => handleReasonChange(td.teamId, e.target.value)}
                        placeholder="e.g. Late join penalty, Rule 4.2 violation"
                        className="flex-1 bg-[#121824] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#1a83c5]"
                      />
                    </div>
                  )}

                  {/* Expandable Player List Editor */}
                  {isExpanded && (
                    <div className="p-4 bg-[#0B0E14] border-t border-[#1E293B] space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 font-rajdhani uppercase tracking-wider flex items-center gap-1 mb-2">
                        <Sparkles className="w-3 h-3 text-[#1a83c5]" />
                        <span>Individual Player Statistics for {td.teamName}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {td.players.map((p) => (
                          <div
                            key={p.uId}
                            className="bg-[#121824] border border-[#1E293B] p-2.5 rounded-xl flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-white text-xs block truncate font-rajdhani uppercase" title={p.playerName}>
                                {p.playerName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">UID: {p.uId}</span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Player Kills */}
                              <div className="flex items-center gap-1">
                                <Crosshair className="w-3 h-3 text-[#1a83c5]" />
                                <input
                                  type="number"
                                  min="0"
                                  value={p.killNum || 0}
                                  onChange={(e) =>
                                    handlePlayerKillsChange(td.teamId, p.uId, parseInt(e.target.value, 10))
                                  }
                                  className="w-12 text-center bg-[#0B0E14] border border-[#1E293B] rounded-lg py-0.5 text-xs font-mono font-bold text-[#1a83c5] focus:outline-none focus:border-[#1a83c5]"
                                  title="Player Kills"
                                />
                                <span className="text-[9px] text-slate-400 font-bold font-rajdhani">K</span>
                              </div>

                              {/* Player Damage */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={p.damage || 0}
                                  onChange={(e) =>
                                    handlePlayerDamageChange(td.teamId, p.uId, parseInt(e.target.value, 10))
                                  }
                                  className="w-16 text-center bg-[#0B0E14] border border-[#1E293B] rounded-lg py-0.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-[#1a83c5]"
                                  title="Player Damage"
                                />
                                <span className="text-[9px] text-slate-400 font-bold font-rajdhani">DMG</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#1E293B] bg-[#0B0E14] flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            Total Teams in Game #{match.matchNumber}: <strong className="text-white font-bold">{sortedTeams.length}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-slate-300 text-xs font-bold font-rajdhani uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00FF66] hover:brightness-110 text-black text-xs font-extrabold font-rajdhani uppercase tracking-wider shadow-lg shadow-[#00FF66]/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save &amp; Update Tournament Standings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
