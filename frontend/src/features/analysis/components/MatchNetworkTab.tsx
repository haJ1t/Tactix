import { useDeferredValue, useMemo, useState } from 'react';
import { GitBranch, Circle, ArrowRightLeft, Filter } from 'lucide-react';
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
    const [minPasses, setMinPasses] = useState(1);
    const deferredMinPasses = useDeferredValue(minPasses);

    const { maxWeight, visibleEdgeCount } = useMemo(() => {
        const edges = networkQuery.data?.edges ?? [];
        const max = edges.reduce((acc, e) => (e.weight > acc ? e.weight : acc), 0);
        const visible = edges.filter((e) => e.weight >= deferredMinPasses).length;
        return { maxWeight: max, visibleEdgeCount: visible };
    }, [deferredMinPasses, networkQuery.data?.edges]);

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

    const totalEdges = networkQuery.data?.edges.length ?? 0;
    const totalNodes = networkQuery.data?.nodes.length ?? 0;
    const sliderMax = Math.max(1, maxWeight);

    return (
        <GlassCard className="p-6" hover={false}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <GitBranch className="w-4 h-4 text-primary-400" />
                        <h3 className="text-base font-semibold text-white">Pass Network</h3>
                    </div>
                    <p className="text-xs text-[#94A3B8] max-w-md">
                        Hover a connection to see pass counts between two players, or a node to inspect that player's metrics.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="tag-glow inline-flex items-center gap-1">
                            <Circle className="w-3 h-3" />
                            Nodes {totalNodes}
                        </span>
                        <span className="tag-glow inline-flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" />
                            Edges {visibleEdgeCount}
                            {minPasses > 1 && <span className="text-[#94A3B8]">/ {totalEdges}</span>}
                        </span>
                    </div>
                </div>
                <span className="tag-glow text-primary-400 font-medium">{currentTeamName}</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-3">
                    <Filter className="w-4 h-4 text-primary-400 flex-shrink-0" />
                    <div>
                        <div className="text-xs font-medium text-white">Minimum passes</div>
                        <div className="text-[11px] text-[#94A3B8]">
                            Hide weak connections to reduce clutter
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min={1}
                        max={sliderMax}
                        step={1}
                        value={Math.min(minPasses, sliderMax)}
                        onChange={(e) => setMinPasses(Number(e.target.value))}
                        className="pass-network-slider w-40 sm:w-48"
                        aria-label="Minimum pass threshold"
                    />
                    <div className="flex items-baseline gap-1 min-w-[3.5rem] justify-end">
                        <span className="text-sm font-semibold text-white">{minPasses}</span>
                        <span className="text-[11px] text-[#94A3B8]">/ {sliderMax}</span>
                    </div>
                </div>
            </div>

            <FadeInUp delay={0.1}>
                <div className="mx-auto max-w-5xl rounded-xl overflow-hidden border border-white/[0.04] bg-black/20">
                    <PassNetworkGraph
                        nodes={networkQuery.data?.nodes || []}
                        edges={networkQuery.data?.edges || []}
                        minPasses={deferredMinPasses}
                    />
                </div>
            </FadeInUp>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#94A3B8]">
                <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-[#3b82f6] border border-white/60" />
                    <span>Low pass volume</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-[#f59e0b] border border-white/60" />
                    <span>High pass volume</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-block w-6 h-[3px] rounded-full bg-white/70" />
                    <span>Thicker line = more passes</span>
                </div>
            </div>
        </GlassCard>
    );
}
