import { useTeamDetailsContext } from '@/features/teams/pages/TeamDetailsPage';

export default function TeamOverviewTab() {
    const { aggregateAnalysis, matches, team, analyzedMatches, season } = useTeamDetailsContext();

    return (
        <div className="workspace-stack">
            <div className="snapshot-grid">
                <div className="snapshot-metric">
                    <span className="snapshot-label">Matches in library</span>
                    <span className="snapshot-value">{matches.length}</span>
                </div>
                <div className="snapshot-metric">
                    <span className="snapshot-label">Matches analyzed</span>
                    <span className="snapshot-value">{analyzedMatches}</span>
                </div>
                <div className="snapshot-metric">
                    <span className="snapshot-label">Wins / Draws / Losses</span>
                    <span className="snapshot-value">{aggregateAnalysis.wins} / {aggregateAnalysis.draws} / {aggregateAnalysis.losses}</span>
                </div>
                <div className="snapshot-metric">
                    <span className="snapshot-label">Total passes</span>
                    <span className="snapshot-value">{aggregateAnalysis.totalPasses}</span>
                </div>
            </div>

            <div className="grid grid-2">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Aggregate Network Profile</h3>
                    </div>
                    <div className="card-body detail-list">
                        <div className="stat-item">
                            <span className="stat-label">Team</span>
                            <span className="stat-value">{team.team_name}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Season</span>
                            <span className="stat-value">{season}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Average density</span>
                            <span className="stat-value">{(aggregateAnalysis.avgDensity * 100).toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Average clustering</span>
                            <span className="stat-value">{aggregateAnalysis.avgClustering.toFixed(3)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Average reciprocity</span>
                            <span className="stat-value">{(aggregateAnalysis.avgReciprocity * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Recent Match Sample</h3>
                    </div>
                    <div className="card-body">
                        <div className="stack-list">
                            {matches.slice(0, 5).map((match) => (
                                <div className="list-row-link" key={match.match_id}>
                                    <div>
                                        <strong>{match.home_team?.team_name} vs {match.away_team?.team_name}</strong>
                                        <p className="list-row-meta">{match.competition} · {match.match_date}</p>
                                    </div>
                                    <span className="tag">{match.home_score} - {match.away_score}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
