import { useTeamDetailsContext } from '@/features/teams/pages/TeamDetailsPage';

export default function TeamPlayersTab() {
    const { aggregateAnalysis, season } = useTeamDetailsContext();

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Top Aggregate Players</h3>
                <span className="results-count">{season}</span>
            </div>
            <div className="card-body">
                <table className="players-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Player</th>
                            <th>Avg betweenness</th>
                            <th>Appearances</th>
                        </tr>
                    </thead>
                    <tbody>
                        {aggregateAnalysis.topPlayers.map((player, index) => (
                            <tr key={player.player_id}>
                                <td>{index + 1}</td>
                                <td>{player.player_name}</td>
                                <td>{player.avgBetweenness.toFixed(3)}</td>
                                <td>{player.appearances}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
