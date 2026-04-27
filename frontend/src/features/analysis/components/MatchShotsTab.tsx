import { Crosshair, Target, Ruler, Flame } from 'lucide-react';
import { getTeamStats } from '@/entities/analysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { GlassCard, FadeInUp, AnimatedCounter, AnimatedBar, ShimmerButton } from '@/shared/ui/motion';

export default function MatchShotsTab() {
    const { currentAnalysis, currentTeamName, homeAnalysis, awayAnalysis, runAnalysis, isRunningAnalysis, match } = useMatchWorkspaceContext();

    // Empty state branch
    if (!currentAnalysis || !currentTeamName) {
        return (
            <EmptyState
                title="Shot quality needs analysis"
                description="Run the workspace analysis to calculate xG, shot volume, and chance quality."
                action={
                    <ShimmerButton onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </ShimmerButton>
                }
            />
        );
    }

    // Per-team shot stats
    const selectedStats = getTeamStats(currentAnalysis);
    const homeStats = getTeamStats(homeAnalysis);
    const awayStats = getTeamStats(awayAnalysis);
    const maxXg = Math.max(homeStats.xgTotal, awayStats.xgTotal, 0.1);

    return (
        <div className="space-y-6">
            {/* Selected Team Shot Profile */}
            <FadeInUp delay={0.05}>
                <GlassCard className="p-6 border-primary-500/10" hover={false}>
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Crosshair className="w-4 h-4 text-primary-400" />
                                <h3 className="text-base font-semibold text-white">Selected Team Shot Profile</h3>
                            </div>
                            <p className="text-xs text-[#94A3B8]">Start with the active team, then compare the two sides below.</p>
                        </div>
                        <span className="tag-glow">{currentTeamName}</span>
                    </div>

                    <div className="space-y-5">
                        {/* Stat grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Shots', value: selectedStats.shots, icon: Target },
                                { label: 'xG total', value: selectedStats.xgTotal.toFixed(2), icon: Flame },
                                { label: 'xG per shot', value: selectedStats.xgPerShot.toFixed(2), icon: Crosshair },
                                { label: 'High xG shots', value: selectedStats.highXgShots, icon: Ruler },
                            ].map((stat) => (
                                <div key={stat.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                                    <stat.icon className="w-4 h-4 text-primary-400 mx-auto mb-2 opacity-60" />
                                    <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] block">{stat.label}</span>
                                    <strong className="text-lg text-white block mt-0.5">
                                        {typeof stat.value === 'number' ? <AnimatedCounter value={stat.value} /> : stat.value}
                                    </strong>
                                </div>
                            ))}
                        </div>

                        {/* Distance and angle */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                <span className="text-xs text-[#94A3B8]">Average shot distance</span>
                                <strong className="block text-xl text-white mt-1">{selectedStats.avgShotDistance.toFixed(1)}</strong>
                            </div>
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                <span className="text-xs text-[#94A3B8]">Average shot angle</span>
                                <strong className="block text-xl text-white mt-1">{selectedStats.avgShotAngle.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>
                </GlassCard>
            </FadeInUp>

            {/* Chance Quality Comparison */}
            <FadeInUp delay={0.15}>
                <GlassCard className="p-6" hover={false}>
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <h3 className="text-base font-semibold text-white">Chance Quality Comparison</h3>
                            <p className="text-xs text-[#94A3B8] mt-0.5">Two compact sides of the same finishing profile.</p>
                        </div>
                        <span className="tag-glow">{currentTeamName}</span>
                    </div>

                    {/* xG comparison bar */}
                    <div className="mb-6 space-y-2">
                        <div className="text-xs text-[#94A3B8] font-medium mb-2">xG Comparison</div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-white font-medium w-28 truncate">{match.home_team?.team_name || 'Home'}</span>
                                <div className="flex-1">
                                    <AnimatedBar value={homeStats.xgTotal} max={maxXg} color="var(--home)" />
                                </div>
                                <span className="text-xs text-primary-400 font-medium w-10 text-right">{homeStats.xgTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-white font-medium w-28 truncate">{match.away_team?.team_name || 'Away'}</span>
                                <div className="flex-1">
                                    <AnimatedBar value={awayStats.xgTotal} max={maxXg} color="var(--away)" />
                                </div>
                                <span className="text-xs text-[var(--away)] font-medium w-10 text-right">{awayStats.xgTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Side by side cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { name: match.home_team?.team_name || 'Home', stats: homeStats, accent: 'border-primary-500/10' },
                            { name: match.away_team?.team_name || 'Away', stats: awayStats, accent: 'border-[rgba(66,111,143,0.18)]' },
                        ].map((team) => (
                            <GlassCard key={team.name} className={`p-4 ${team.accent}`} hover={false}>
                                <h4 className="text-sm font-semibold text-white mb-3">{team.name}</h4>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Shots', value: team.stats.shots },
                                        { label: 'xG', value: team.stats.xgTotal.toFixed(2) },
                                        { label: 'xG/Shot', value: team.stats.xgPerShot.toFixed(2) },
                                        { label: 'Avg shot distance', value: team.stats.avgShotDistance.toFixed(1) },
                                        { label: 'High xG shots', value: team.stats.highXgShots },
                                    ].map((row) => (
                                        <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                                            <span className="text-xs text-[#94A3B8]">{row.label}</span>
                                            <strong className="text-xs text-white">{row.value}</strong>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                </GlassCard>
            </FadeInUp>
        </div>
    );
}
