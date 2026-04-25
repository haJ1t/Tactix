import { useTeamDetailsContext } from '@/features/teams/pages/TeamDetailsPage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FadeInUp, GlassCard, StaggerContainer, StaggerItem, ShimmerButton } from '@/shared/ui/motion';
import { Shapes, Lightbulb } from 'lucide-react';

export default function TeamPatternsTab() {
    const { aggregateAnalysis, season, analyzedMatches, analysisRequested, isAnalysisPending, requestAnalysis } =
        useTeamDetailsContext();

    if (analyzedMatches === 0) {
        return (
            <EmptyState
                title={analysisRequested ? 'Analysis still warming up' : 'Patterns need manual analysis'}
                description={
                    analysisRequested
                        ? 'No successful sample analyses are available yet for this season.'
                        : 'Run sample analysis to generate aggregate pattern and tactic recommendations for this team season.'
                }
                action={
                    <ShimmerButton onClick={requestAnalysis} disabled={isAnalysisPending}>
                        {isAnalysisPending ? 'Running sample analysis...' : 'Run Sample Analysis'}
                    </ShimmerButton>
                }
            />
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Common Patterns */}
            <FadeInUp delay={0}>
                <GlassCard hover={false} className="p-6 h-full">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
                                <Shapes className="h-4.5 w-4.5 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Common Patterns</h3>
                        </div>
                        <span className="text-sm text-[#94A3B8]">{season}</span>
                    </div>

                    <StaggerContainer className="flex flex-wrap gap-3">
                        {aggregateAnalysis.commonPatterns.map((pattern) => (
                            <StaggerItem key={pattern.pattern_type}>
                                <div className="tag-glow inline-flex items-center gap-2 px-4 py-2">
                                    <span className="text-sm text-white">{pattern.pattern_type.replace(/_/g, ' ')}</span>
                                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-500/20 px-1.5 text-xs font-bold text-primary-400">
                                        {pattern.count}
                                    </span>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>
                </GlassCard>
            </FadeInUp>

            {/* Suggested Tactics */}
            <FadeInUp delay={0.1}>
                <GlassCard hover={false} className="p-6 h-full">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
                                <Lightbulb className="h-4.5 w-4.5 text-amber-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Suggested Tactics</h3>
                        </div>
                        <span className="text-sm text-[#94A3B8]">{season}</span>
                    </div>

                    <StaggerContainer className="space-y-3">
                        {aggregateAnalysis.suggestedTactics.map((tactic, index) => (
                            <StaggerItem key={`${tactic.tactic_type}-${index}`}>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                                        {index + 1}
                                    </span>
                                    <p className="text-sm text-[#94A3B8] leading-relaxed">{tactic.recommendation}</p>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>
                </GlassCard>
            </FadeInUp>
        </div>
    );
}
