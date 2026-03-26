import { getTopPlayers } from '@/entities/analysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';

export default function MatchPlayersTab() {
    const { currentAnalysis, currentTeamName, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();

    if (!currentAnalysis || !currentTeamName) {
        return (
            <EmptyState
                title="Player rankings need analysis"
                description="Run the workspace analysis to calculate player influence and centrality rankings."
                action={
                    <button className="btn btn-primary" onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </button>
                }
            />
        );
    }

    const players = getTopPlayers(currentAnalysis, currentTeamName, 10);
    const leaders = players.slice(0, 3);

    return (
        <div className="workspace-stack">
            <div className="grid grid-3 editorial-leaders-grid">
                {leaders.map((player, index) => (
                    <div key={player.player_id} className="card leader-card theater-panel theater-spotlight-card">
                        <div className="card-body workspace-stack">
                            <span className="leader-rank">#{index + 1}</span>
                            <div className="leader-name-row">
                                <div className="player-mini-avatar">{(player.player_name || player.name || '?')[0]}</div>
                                <div>
                                    <div className="player-name">{player.player_name || player.name}</div>
                                    <div className="player-meta">{currentTeamName}</div>
                                </div>
                            </div>
                            <div className="leader-metrics">
                                <div className="leader-metric"><span>Impact</span><strong>{player.impactScore.toFixed(3)}</strong></div>
                                <div className="leader-metric"><span>Betweenness</span><strong>{player.betweenness_centrality.toFixed(3)}</strong></div>
                                <div className="leader-metric"><span>PageRank</span><strong>{player.pagerank.toFixed(3)}</strong></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card theater-panel players-ranking-panel">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Full Influence Ranking</h3>
                        <p className="card-subtitle">A calmer ranking table for the rest of the squad signal hierarchy.</p>
                    </div>
                    <span className="tag">{currentTeamName}</span>
                </div>
                <div className="card-body">
                    <table className="players-table players-table-editorial">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Player</th>
                                <th>Impact</th>
                                <th>Betweenness</th>
                                <th>PageRank</th>
                                <th>Degree</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((player, index) => (
                                <tr key={player.player_id}>
                                    <td>{index + 1}</td>
                                    <td>{player.player_name || player.name}</td>
                                    <td>{player.impactScore.toFixed(3)}</td>
                                    <td>{player.betweenness_centrality.toFixed(3)}</td>
                                    <td>{player.pagerank.toFixed(3)}</td>
                                    <td>{player.degree_centrality.toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
