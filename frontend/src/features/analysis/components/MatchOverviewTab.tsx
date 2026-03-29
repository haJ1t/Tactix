import { useMemo } from 'react';
import { Network, Target, TrendingUp, BarChart3 } from 'lucide-react';
import { buildOverviewInsights, getTeamStats, getTopPlayers, getTopPatterns } from '@/entities/analysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatPercent } from '@/shared/lib/format';
import { FadeInUp, GlassCard, AnimatedCounter, AnimatedBar, StaggerContainer, StaggerItem, ShimmerButton } from '@/shared/ui/motion';

export default function MatchOverviewTab() {
    const { match, currentAnalysis, currentTeamName, homeAnalysis, awayAnalysis, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();

    const overview = useMemo(() => {
        const homeStats = getTeamStats(homeAnalysis);
        const awayStats = getTeamStats(awayAnalysis);
        const totalPasses = homeStats.totalPasses + awayStats.totalPasses;
        const passShareHome = totalPasses ? homeStats.totalPasses / totalPasses : 0.5;
        const homeName = match.home_team?.team_name || 'Home';
        const awayName = match.away_team?.team_name || 'Away';

        return {
            homeStats,
            awayStats,
            totalPasses,
            passShareHome,
            passShareAway: 1 - passShareHome,
            insights: buildOverviewInsights({
                homeStats,
                awayStats,
                homeName,
                awayName,
                homeGoals: match.home_score,
                awayGoals: match.away_score,
                homePatterns: getTopPatterns(homeAnalysis).map((pattern) => pattern.pattern_type),
                awayPatterns: getTopPatterns(awayAnalysis).map((pattern) => pattern.pattern_type),
                passShareHome,
            }),
        };
    }, [awayAnalysis, homeAnalysis, match]);

    if (!currentAnalysis || !currentTeamName) {
        return (
            <EmptyState
                title="Analysis not available yet"
                description="Run the match analysis to unlock the overview, network, players, tactics, and report tabs."
                action={
                    <ShimmerButton onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </ShimmerButton>
                }
            />
        );
    }

    const selectedStats = getTeamStats(currentAnalysis);
    const topPlayers = getTopPlayers(currentAnalysis, currentTeamName, 5);
    const selectedTeamPassShare = currentTeamName === match.home_team?.team_name ? overview.passShareHome : overview.passShareAway;

    return (
        <div className="space-y-6">
            {/* Top Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Selected lens', value: currentTeamName, icon: Target },
                    { label: 'Total passes', value: selectedStats.totalPasses, icon: Network, isNumber: true },
                    { label: 'Pass share', value: formatPercent(selectedTeamPassShare), icon: BarChart3 },
                    { label: 'xG total', value: selectedStats.xgTotal.toFixed(2), icon: TrendingUp },
                ].map((stat, i) => (
                    <FadeInUp key={stat.label} delay={i * 0.05}>
                        <GlassCard className="p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium">{stat.label}</span>
                                    <strong className="block text-lg text-white mt-1">
                                        {stat.isNumber ? <AnimatedCounter value={stat.value as number} /> : stat.value}
                                    </strong>
                                </div>
                                <stat.icon className="w-4 h-4 text-primary-400 opacity-60" />
                            </div>
                        </GlassCard>
                    </FadeInUp>
                ))}
            </div>

            {/* Match Story + Team Profile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Match Story */}
                <FadeInUp delay={0.1}>
                    <GlassCard className="p-6 h-full" hover={false}>
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <h3 className="text-base font-semibold text-white">Match Story</h3>
                                <p className="text-xs text-[#94A3B8] mt-0.5">The clearest signals from the shared match analysis.</p>
                            </div>
                            <span className="tag-glow"><AnimatedCounter value={overview.totalPasses} /> total passes</span>
                        </div>

                        <div className="space-y-5">
                            {/* Pass share bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-white font-medium">{match.home_team?.team_name} <span className="text-primary-400">{formatPercent(overview.passShareHome)}</span></span>
                                    <span className="text-white font-medium">{match.away_team?.team_name} <span className="text-primary-400">{formatPercent(overview.passShareAway)}</span></span>
                                </div>
                                <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden flex">
                                    <AnimatedBar value={overview.passShareHome} max={1} color="rgb(99,102,241)" className="flex-1" />
                                </div>
                            </div>

                            {/* Stat row */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Tracked players', value: selectedStats.players },
                                    { label: 'Patterns found', value: selectedStats.patterns },
                                    { label: 'Shot volume', value: selectedStats.shots },
                                    { label: 'Reciprocity', value: formatPercent(selectedStats.reciprocity) },
                                ].map((s) => (
                                    <div key={s.label} className="text-center">
                                        <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] block">{s.label}</span>
                                        <strong className="text-sm text-white block mt-0.5">
                                            {typeof s.value === 'number' ? <AnimatedCounter value={s.value} /> : s.value}
                                        </strong>
                                    </div>
                                ))}
                            </div>

                            {/* Insights */}
                            {overview.insights.length > 0 ? (
                                <StaggerContainer className="space-y-2" staggerDelay={0.06}>
                                    {overview.insights.map((insight) => (
                                        <StaggerItem key={insight}>
                                            <div className="flex items-start gap-2 text-sm">
                                                <span className="text-primary-400 mt-0.5 shrink-0">&#8226;</span>
                                                <span className="text-[#94A3B8] leading-relaxed">{insight}</span>
                                            </div>
                                        </StaggerItem>
                                    ))}
                                </StaggerContainer>
                            ) : (
                                <p className="text-sm text-[#94A3B8]">No strong match differentials were detected from the current network and shot profile.</p>
                            )}
                        </div>
                    </GlassCard>
                </FadeInUp>

                {/* Team Profile */}
                <FadeInUp delay={0.2}>
                    <GlassCard className="p-6 h-full" hover={false}>
                        <div className="mb-5">
                            <h3 className="text-base font-semibold text-white">Selected Team Profile</h3>
                            <p className="text-xs text-[#94A3B8] mt-0.5">Compact orientation before moving into deeper tabs.</p>
                        </div>

                        <div className="space-y-3">
                            {[
                                { label: 'Network density', value: formatPercent(selectedStats.density) },
                                { label: 'Average clustering', value: formatPercent(selectedStats.clustering) },
                                { label: 'Average path length', value: selectedStats.avgPathLength.toFixed(2) },
                                { label: 'xG per shot', value: selectedStats.xgPerShot.toFixed(2) },
                                { label: 'High xG shots', value: String(selectedStats.highXgShots) },
                            ].map((item, i) => (
                                <FadeInUp key={item.label} delay={0.25 + i * 0.04}>
                                    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                        <span className="text-sm text-[#94A3B8]">{item.label}</span>
                                        <span className="text-sm font-medium text-white">{item.value}</span>
                                    </div>
                                </FadeInUp>
                            ))}
                        </div>
                    </GlassCard>
                </FadeInUp>
            </div>

            {/* Key Connectors */}
            <FadeInUp delay={0.15}>
                <GlassCard className="p-6" hover={false}>
                    <div className="mb-5">
                        <h3 className="text-base font-semibold text-white">Key Connectors</h3>
                        <p className="text-xs text-[#94A3B8] mt-0.5">The players carrying structure and progression for {currentTeamName}.</p>
                    </div>

                    <StaggerContainer className="space-y-3" staggerDelay={0.06}>
                        {topPlayers.map((player, index) => (
                            <StaggerItem key={player.player_id}>
                                <div className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${
                                    index < 3
                                        ? 'bg-primary-500/[0.04] border-primary-500/10'
                                        : 'bg-white/[0.01] border-white/[0.04]'
                                }`}>
                                    <span className={`text-xs font-bold w-6 text-center ${index < 3 ? 'text-primary-400' : 'text-[#94A3B8]'}`}>
                                        {index + 1}
                                    </span>

                                    <div className="w-9 h-9 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-sm font-bold text-primary-400 shrink-0">
                                        {(player.player_name || player.name || '?')[0]}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white truncate">{player.player_name || player.name}</div>
                                        <div className="text-[10px] text-[#94A3B8]">Impact {player.impactScore.toFixed(3)}</div>
                                    </div>

                                    <div className="hidden sm:flex items-center gap-4 text-xs text-[#94A3B8]">
                                        <div className="text-center">
                                            <span className="block text-[10px] uppercase tracking-wider">Degree</span>
                                            <span className="text-white font-medium">{player.degree_centrality.toFixed(3)}</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="block text-[10px] uppercase tracking-wider">Betweenness</span>
                                            <span className="text-white font-medium">{player.betweenness_centrality.toFixed(3)}</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="block text-[10px] uppercase tracking-wider">PageRank</span>
                                            <span className="text-white font-medium">{player.pagerank.toFixed(3)}</span>
                                        </div>
                                    </div>

                                    <div className="w-24 hidden md:block">
                                        <AnimatedBar value={player.impactScore} max={topPlayers[0]?.impactScore || 1} color="rgb(99,102,241)" />
                                    </div>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>
                </GlassCard>
            </FadeInUp>
        </div>
    );
}
