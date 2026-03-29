import { GitBranch, Circle, ArrowRightLeft } from 'lucide-react';
import PassNetworkGraph from '@/shared/charts/PassNetworkGraph';
import { useMatchNetwork } from '@/features/analysis/hooks/useMatchAnalysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { GlassCard, FadeInUp, ShimmerButton } from '@/shared/ui/motion';

export default function MatchNetworkTab() {
    const { match, currentAnalysis, currentTeamId, currentTeamName, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();
    const networkQuery = useMatchNetwork(match.match_id, currentTeamId, { enabled: Boolean(currentAnalysis && currentTeamId) });

    if (!currentAnalysis || !currentTeamId || !currentTeamName) {
        return (
            <EmptyState
                title="Network view needs analysis"
                description="Run the match analysis first, then select a team to inspect its pass network."
                action={
                    <ShimmerButton onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </ShimmerButton>
                }
            />
        );
    }

    if (networkQuery.isLoading) {
        return <LoadingState title="Loading network" description={`Preparing ${currentTeamName}'s pass network.`} compact />;
    }

    if (networkQuery.isError) {
        return (
            <ErrorState
                title="Network unavailable"
                description="Pass network data could not be loaded for the selected team."
                onRetry={() => void networkQuery.refetch()}
            />
        );
    }

    return (
        <GlassCard className="p-6" hover={false}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <GitBranch className="w-4 h-4 text-primary-400" />
                        <h3 className="text-base font-semibold text-white">Pass Network</h3>
                    </div>
                    <p className="text-xs text-[#94A3B8] max-w-md">
                        The graph is the primary object here. Use it to read structure, concentration, and passing rhythm at a glance.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <span className="tag-glow inline-flex items-center gap-1">
                            <Circle className="w-3 h-3" />
                            Nodes {networkQuery.data?.nodes.length || 0}
                        </span>
                        <span className="tag-glow inline-flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" />
                            Edges {networkQuery.data?.edges.length || 0}
                        </span>
                        <span className="tag-blue">Structure view</span>
                    </div>
                </div>
                <span className="tag-glow text-primary-400 font-medium">{currentTeamName}</span>
            </div>

            <FadeInUp delay={0.1}>
                <div className="rounded-xl overflow-hidden border border-white/[0.04] bg-black/20">
                    <PassNetworkGraph nodes={networkQuery.data?.nodes || []} edges={networkQuery.data?.edges || []} height={520} />
                </div>
            </FadeInUp>
        </GlassCard>
    );
}
