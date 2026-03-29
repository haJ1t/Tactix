import { Radar, Shield } from 'lucide-react';
import { getTopPatterns, getTopTactics } from '@/entities/analysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { GlassCard, FadeInUp, AnimatedBar, StaggerContainer, StaggerItem, ShimmerButton } from '@/shared/ui/motion';

export default function MatchTacticsTab() {
    const { currentAnalysis, currentTeamName, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();

    if (!currentAnalysis || !currentTeamName) {
        return (
            <EmptyState
                title="Tactical signals need analysis"
                description="Run the workspace analysis to surface tactical patterns and counter-tactic recommendations."
                action={
                    <ShimmerButton onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </ShimmerButton>
                }
            />
        );
    }

    const patterns = getTopPatterns(currentAnalysis, 6);
    const tactics = getTopTactics(currentAnalysis, 6);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pattern Signals */}
            <FadeInUp delay={0.05}>
                <GlassCard className="p-6 h-full border-primary-500/10" hover={false}>
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Radar className="w-4 h-4 text-primary-400" />
                                <h3 className="text-base font-semibold text-white">Pattern Signals</h3>
                            </div>
                            <p className="text-xs text-[#94A3B8]">High-confidence signals shaping the team's attacking and possession identity.</p>
                        </div>
                        <span className="tag-glow">{currentTeamName}</span>
                    </div>

                    {patterns.length > 0 ? (
                        <StaggerContainer className="space-y-3" staggerDelay={0.06}>
                            {patterns.map((pattern) => (
                                <StaggerItem key={`${pattern.pattern_type}-${pattern.confidence_score}`}>
                                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-sm font-medium text-white capitalize">
                                                    {pattern.pattern_type.replace(/_/g, ' ')}
                                                </span>
                                                <span className="block text-[10px] text-[#94A3B8] mt-0.5">Signal confidence</span>
                                            </div>
                                            <span className="tag-glow text-primary-400 font-bold text-xs">
                                                {(pattern.confidence_score * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <AnimatedBar
                                            value={pattern.confidence_score}
                                            max={1}
                                            color="rgb(99,102,241)"
                                        />
                                    </div>
                                </StaggerItem>
                            ))}
                        </StaggerContainer>
                    ) : (
                        <p className="text-sm text-[#94A3B8]">No tactical patterns were returned for this team.</p>
                    )}
                </GlassCard>
            </FadeInUp>

            {/* Counter Tactics */}
            <FadeInUp delay={0.15}>
                <GlassCard className="p-6 h-full" hover={false}>
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Shield className="w-4 h-4 text-primary-400" />
                                <h3 className="text-base font-semibold text-white">Counter Tactics</h3>
                            </div>
                            <p className="text-xs text-[#94A3B8]">Analyst-style responses ordered by immediate tactical relevance.</p>
                        </div>
                        <span className="tag-blue">Priority order</span>
                    </div>

                    {tactics.length > 0 ? (
                        <StaggerContainer className="space-y-3" staggerDelay={0.06}>
                            {tactics.map((tactic, index) => (
                                <StaggerItem key={`${tactic.tactic_type}-${index}`}>
                                    <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                        <div className="w-7 h-7 rounded-lg bg-primary-500/15 border border-primary-500/25 flex items-center justify-center shrink-0">
                                            <span className="text-xs font-bold text-primary-400">{index + 1}</span>
                                        </div>
                                        <span className="text-sm text-[#94A3B8] leading-relaxed pt-0.5">{tactic.recommendation}</span>
                                    </div>
                                </StaggerItem>
                            ))}
                        </StaggerContainer>
                    ) : (
                        <p className="text-sm text-[#94A3B8]">No counter-tactic recommendations were returned for this team.</p>
                    )}
                </GlassCard>
            </FadeInUp>
        </div>
    );
}
