import { useTeamDetailsContext } from '@/features/teams/pages/TeamDetailsPage';
import { FadeInUp, GlassCard, AnimatedCounter, StaggerContainer, StaggerItem } from '@/shared/ui/motion';
import { BarChart3, TrendingUp, Network, Activity } from 'lucide-react';

export default function TeamOverviewTab() {
    const { aggregateAnalysis, matches, team, analyzedMatches, season } = useTeamDetailsContext();

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FadeInUp delay={0}>
                    <GlassCard hover={false} className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/15">
                                <BarChart3 className="h-4 w-4 text-primary-400" />
                            </div>
                            <span className="text-sm text-[#94A3B8]">Matches in Library</span>
                        </div>
                        <AnimatedCounter value={matches.length} className="text-2xl font-bold text-white" />
                    </GlassCard>
                </FadeInUp>
                <FadeInUp delay={0.05}>
                    <GlassCard hover={false} className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                                <TrendingUp className="h-4 w-4 text-blue-400" />
                            </div>
                            <span className="text-sm text-[#94A3B8]">Matches Analyzed</span>
                        </div>
                        <AnimatedCounter value={analyzedMatches} className="text-2xl font-bold text-white" />
                    </GlassCard>
                </FadeInUp>
                <FadeInUp delay={0.1}>
                    <GlassCard hover={false} className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
                                <Activity className="h-4 w-4 text-emerald-400" />
                            </div>
                            <span className="text-sm text-[#94A3B8]">W / D / L</span>
                        </div>
                        <span className="text-2xl font-bold text-white">
                            {aggregateAnalysis.wins} / {aggregateAnalysis.draws} / {aggregateAnalysis.losses}
                        </span>
                    </GlassCard>
                </FadeInUp>
                <FadeInUp delay={0.15}>
                    <GlassCard hover={false} className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                                <Network className="h-4 w-4 text-amber-400" />
                            </div>
                            <span className="text-sm text-[#94A3B8]">Total Passes</span>
                        </div>
                        <AnimatedCounter value={aggregateAnalysis.totalPasses} className="text-2xl font-bold text-white" />
                    </GlassCard>
                </FadeInUp>
            </div>

            {/* Two Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Network Profile */}
                <FadeInUp delay={0.2}>
                    <GlassCard hover={false} className="p-6 h-full">
                        <h3 className="text-lg font-semibold text-white mb-5">Aggregate Network Profile</h3>
                        <div className="space-y-4">
                            {[
                                { label: 'Team', value: team.team_name },
                                { label: 'Season', value: season },
                                { label: 'Average Density', value: `${(aggregateAnalysis.avgDensity * 100).toFixed(1)}%` },
                                { label: 'Average Clustering', value: aggregateAnalysis.avgClustering.toFixed(3) },
                                { label: 'Average Reciprocity', value: `${(aggregateAnalysis.avgReciprocity * 100).toFixed(1)}%` },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                                    <span className="text-sm text-[#94A3B8]">{item.label}</span>
                                    <span className="text-sm font-medium text-white">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                </FadeInUp>

                {/* Recent Matches */}
                <FadeInUp delay={0.25}>
                    <GlassCard hover={false} className="p-6 h-full">
                        <h3 className="text-lg font-semibold text-white mb-5">Recent Match Sample</h3>
                        <StaggerContainer className="space-y-3">
                            {matches.slice(0, 5).map((match) => (
                                <StaggerItem key={match.match_id}>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-white truncate">
                                                {match.home_team?.team_name} vs {match.away_team?.team_name}
                                            </p>
                                            <p className="text-xs text-[#94A3B8] mt-0.5">
                                                {match.competition} · {match.match_date}
                                            </p>
                                        </div>
                                        <span className="tag-glow ml-3 shrink-0">
                                            {match.home_score} - {match.away_score}
                                        </span>
                                    </div>
                                </StaggerItem>
                            ))}
                        </StaggerContainer>
                    </GlassCard>
                </FadeInUp>
            </div>
        </div>
    );
}
