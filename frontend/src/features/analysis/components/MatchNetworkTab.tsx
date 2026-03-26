import PassNetworkGraph from '@/shared/charts/PassNetworkGraph';
import { useMatchNetwork } from '@/features/analysis/hooks/useMatchAnalysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { ErrorState } from '@/shared/ui/ErrorState';

export default function MatchNetworkTab() {
    const { match, currentAnalysis, currentTeamId, currentTeamName, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();
    const networkQuery = useMatchNetwork(match.match_id, currentTeamId, { enabled: Boolean(currentAnalysis && currentTeamId) });

    if (!currentAnalysis || !currentTeamId || !currentTeamName) {
        return (
            <EmptyState
                title="Network view needs analysis"
                description="Run the match analysis first, then select a team to inspect its pass network."
                action={
                    <button className="btn btn-primary" onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </button>
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
        <div className="card network-hero-card theater-panel theater-panel-primary network-theater-card">
            <div className="card-header network-hero-header">
                <div>
                    <h3 className="card-title">Pass Network</h3>
                    <p className="card-subtitle">The graph is the primary object here. Use it to read structure, concentration, and passing rhythm at a glance.</p>
                    <div className="network-hero-meta">
                        <span className="network-meta-chip">Nodes {networkQuery.data?.nodes.length || 0}</span>
                        <span className="network-meta-chip">Edges {networkQuery.data?.edges.length || 0}</span>
                        <span className="network-meta-chip">Structure view</span>
                    </div>
                </div>
                <span className="tag">{currentTeamName}</span>
            </div>
            <div className="card-body network-hero-body">
                <PassNetworkGraph nodes={networkQuery.data?.nodes || []} edges={networkQuery.data?.edges || []} height={520} />
            </div>
        </div>
    );
}
