import React from 'react';
import { Trophy, Flame, CheckCircle2, Clock, Play, Sparkles, Star } from 'lucide-react';
import { SavedMatch, TeamMatchScore, TournamentConfig } from '../types/pubg';
import { calculateTournamentStandings } from '../utils/pubgCalculations';

interface TournamentProgressBarProps {
  config: TournamentConfig;
  savedMatches: SavedMatch[];
  onUpdateTotalMatches?: (total: number) => void;
  onOpenMatchScorecard?: (match: SavedMatch) => void;
}

export const TournamentProgressBar: React.FC<TournamentProgressBarProps> = ({
  config,
  savedMatches,
  onOpenMatchScorecard,
}) => {
  const totalMatches = Math.max(1, config.totalMatches || 5);
  const rankedMatches = React.useMemo(() => savedMatches.filter((m) => !m.excludeFromLeaderboard), [savedMatches]);
  const specialMatches = React.useMemo(() => savedMatches.filter((m) => m.excludeFromLeaderboard), [savedMatches]);
  const completedCount = rankedMatches.length;
  const specialCount = specialMatches.length;
  const progressPercent = Math.min(100, Math.round((completedCount / totalMatches) * 100));
  const remainingCount = Math.max(0, totalMatches - completedCount);
  const nextMatchNumber = completedCount + 1;

  // Calculate current leader
  const standings = React.useMemo(() => {
    return calculateTournamentStandings(savedMatches, config).teamStandings;
  }, [savedMatches, config]);

  const currentLeader = standings.length > 0 ? standings[0] : null;

  // Lifecycle Status Determination
  let statusBadge = {
    label: 'Not Started',
    color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    icon: <Clock className="w-3.5 h-3.5 text-gray-400" />,
    description: `Ready for Game 1 of ${totalMatches}`,
  };

  if (completedCount >= totalMatches) {
    statusBadge = {
      label: 'Tournament Concluded',
      color: 'bg-[#ffb80020] text-amber-400 border-[#ffb80055]',
      icon: <Trophy className="w-3.5 h-3.5 text-amber-400" />,
      description: `All ${totalMatches} matches completed • Winner declared`,
    };
  } else if (completedCount === totalMatches - 1) {
    statusBadge = {
      label: 'Championship Decider (Final Game)',
      color: 'bg-[#ff4b2b20] text-[#ff4b2b] border-[#ff4b2b55] animate-pulse',
      icon: <Flame className="w-3.5 h-3.5 text-[#ff4b2b]" />,
      description: `Final Game #${nextMatchNumber} will decide the champion`,
    };
  } else if (completedCount > 0) {
    statusBadge = {
      label: `In Progress • Match ${nextMatchNumber} of ${totalMatches}`,
      color: 'bg-[#00ff6620] text-emerald-400 border-[#00ff6655]',
      icon: <Play className="w-3.5 h-3.5 text-emerald-400 fill-[#00ff66]" />,
      description: `${remainingCount} game${remainingCount === 1 ? '' : 's'} remaining`,
    };
  }

  // Create match segments array (capped at 24 for clean visual rendering)
  const renderSegmentBlocks = totalMatches <= 24;
  const segments = Array.from({ length: totalMatches }, (_, idx) => {
    const matchNum = idx + 1;
    const matchData = rankedMatches[idx];
    const isCompleted = idx < completedCount;
    const isNext = idx === completedCount;
    const isFuture = idx > completedCount;

    let winnerName = '';
    if (matchData) {
      const scores = Object.values(matchData.teamScores || {}) as TeamMatchScore[];
      const winner = scores.find((s) => s.placement === 1);
      winnerName = winner?.teamName || '';
    }

    return {
      matchNum,
      isCompleted,
      isNext,
      isFuture,
      matchData,
      winnerName,
    };
  });

  return (
    <div
      id="tournament-lifecycle-progress-card"
      className="bg-[#121824]/95 border border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 relative overflow-hidden backdrop-blur-md"
    >
      {/* Background Subtle Tactical Radial Glow */}
      <div
        className="absolute -right-16 -top-16 w-56 h-56 rounded-full pointer-events-none blur-3xl opacity-15 transition-all duration-700"
        style={{
          backgroundColor:
            completedCount >= totalMatches
              ? '#FFB800'
              : completedCount > 0
              ? '#1a83c5'
              : '#FF5200',
        }}
      />

      {/* Header Row: Title, Lifecycle Stage Badge, Percentage */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E293B] text-amber-400 shadow-inner">
            <Trophy className="w-5 h-5 text-[#FFB800]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h4 className="text-base font-bold font-rajdhani uppercase tracking-wider text-white">
                Tournament Stage Tracker
              </h4>
              <span
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold font-rajdhani tracking-wider uppercase border flex items-center gap-1.5 ${statusBadge.color}`}
              >
                {statusBadge.icon}
                <span>{statusBadge.label}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{statusBadge.description}</p>
          </div>
        </div>

        {/* Right Metric Box */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="bg-[#0B0E14] border border-[#1E293B] rounded-xl px-4 py-2 flex items-center gap-3.5 shadow-inner">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-rajdhani">
                Completed
              </div>
              <div className="text-xs font-rajdhani tabular-nums">
                <span className="text-xl font-bold text-[#1a83c5]">
                  {completedCount}
                </span>
                <span className="text-slate-500 mx-1 font-semibold">/</span>
                <span className="text-white font-bold text-base">{totalMatches}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-[#1E293B]" />

            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-rajdhani">
                Progress
              </div>
              <div className="text-xl font-bold font-rajdhani tabular-nums text-[#FFB800]">
                {progressPercent}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Visual Progress Bar */}
      <div className="space-y-2.5 relative z-10">
        {/* Continuous Bar Track */}
        <div className="h-3.5 bg-[#0B0E14] border border-[#1E293B] rounded-full overflow-hidden p-0.5 shadow-inner relative">
          <div
            className={`h-full rounded-full transition-all duration-700 relative overflow-hidden ${
              completedCount >= totalMatches
                ? 'bg-gradient-to-r from-[#1a83c5] via-[#FFB800] to-[#10B981] shadow-[0_0_12px_rgba(255,184,0,0.5)]'
                : 'bg-gradient-to-r from-[#1a83c5] via-[#FF5200] to-[#FFB800] shadow-[0_0_10px_rgba(26, 131, 197,0.4)]'
            }`}
            style={{ width: `${Math.max(completedCount === 0 ? 0 : 4, progressPercent)}%` }}
          >
            {/* Animated Light Sheen */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full -translate-x-full animate-[shimmer_2s_infinite]" />
          </div>
        </div>

        {/* Segmented Match Blocks (when total matches <= 24) */}
        {renderSegmentBlocks && (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1.5 pt-1">
            {segments.map((seg) => {
              if (seg.isCompleted) {
                const isSpecial = Boolean(seg.matchData?.excludeFromLeaderboard);
                return (
                  <button
                    key={seg.matchNum}
                    type="button"
                    onClick={() => seg.matchData && onOpenMatchScorecard?.(seg.matchData)}
                    className={`group relative flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all cursor-pointer border ${
                      isSpecial
                        ? 'bg-purple-950/20 hover:bg-purple-950/40 border-purple-500/40'
                        : 'bg-[#162032] hover:bg-[#1E2B44] border-[#2A3B5A] hover:border-[#1a83c5]/60 shadow-sm'
                    }`}
                    title={`Game #${seg.matchNum} Completed${
                      isSpecial ? ' (Special Game - Excluded from Standings)' : ''
                    }${
                      seg.winnerName ? ` • Winner: ${seg.winnerName}` : ''
                    }. Click to view scorecard.`}
                  >
                    <div
                      className={`flex items-center gap-1 text-[11px] font-bold font-rajdhani ${
                        isSpecial ? 'text-purple-400' : 'text-[#1a83c5]'
                      }`}
                    >
                      {isSpecial ? (
                        <Star className="w-3 h-3 fill-purple-400" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                      )}
                      <span>G#{seg.matchNum}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-300 truncate w-full px-0.5 mt-0.5">
                      {isSpecial
                        ? seg.matchData?.customLabel || 'Exhibition'
                        : seg.winnerName ? seg.winnerName.slice(0, 8) : 'Done'}
                    </span>
                  </button>
                );
              }

              if (seg.isNext) {
                return (
                  <div
                    key={seg.matchNum}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#FFB800]/10 border border-[#FFB800] text-center shadow-lg shadow-[#FFB800]/15 animate-pulse"
                    title={`Game #${seg.matchNum} • Next Active Game`}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-bold font-rajdhani text-[#FFB800]">
                      <Play className="w-2.5 h-2.5 fill-[#FFB800]" />
                      <span>G#{seg.matchNum}</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#FFB800] uppercase tracking-wider font-rajdhani">
                      LIVE NEXT
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={seg.matchNum}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#0B0E14] border border-[#1E293B] text-center opacity-60"
                  title={`Game #${seg.matchNum} (Upcoming)`}
                >
                  <span className="text-[11px] font-bold font-rajdhani text-slate-500">
                    G#{seg.matchNum}
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase font-rajdhani font-semibold">Wait</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Quick Summary Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#1E293B] text-xs text-slate-400 relative z-10">
        <div className="flex items-center gap-4 flex-wrap font-rajdhani font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
            <span>
              <strong className="text-white font-bold">{completedCount}</strong> Official Game{completedCount === 1 ? '' : 's'} Completed
              {specialCount > 0 && (
                <span className="text-purple-400 font-medium ml-1.5">
                  (+{specialCount} excluded)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF5200] shadow-[0_0_6px_#FF5200]" />
            <span>
              <strong className="text-white font-bold">{remainingCount}</strong> Remaining
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#1a83c5] shadow-[0_0_6px_#1a83c5]" />
            <span>
              <strong className="text-white font-bold">{totalMatches}</strong> Scheduled
            </span>
          </div>
        </div>

        {/* Current Standings Leader Banner */}
        {currentLeader ? (
          <div className="flex items-center gap-2 bg-[#0B0E14] px-3 py-1.5 rounded-xl border border-[#1E293B] shadow-sm">
            <span className="text-[11px] text-slate-400 uppercase font-rajdhani font-bold tracking-wider">Leader:</span>
            <span className="text-xs font-bold font-rajdhani text-[#FFB800] uppercase tracking-wide flex items-center gap-1.5">
              <span>🍗 {currentLeader.teamName}</span>
              <span className="text-slate-400 font-mono text-[11px]">
                ({currentLeader.totalPoints} pts • {currentLeader.wins || 0}W)
              </span>
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 italic">
            Save match #1 to establish tournament leaderboard
          </div>
        )}
      </div>
    </div>
  );
};
