import { Link } from 'react-router-dom';
import { getMatchResult, getOpponentName } from '@/entities/analysis';
import { useTeamDetailsContext } from '@/features/teams/pages/TeamDetailsPage';
import { formatMatchDate } from '@/shared/lib/format';

export default function TeamMatchesTab() {
    const { matches, team, season } = useTeamDetailsContext();

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Team Matches</h3>
                <span className="results-count">{season} · {matches.length} matches</span>
            </div>
            <div className="card-body">
                <table className="players-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Opponent</th>
                            <th>Competition</th>
                            <th>Result</th>
                            <th>Workspace</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matches.map((match) => (
                            <tr key={match.match_id}>
                                <td>{formatMatchDate(match.match_date)}</td>
                                <td>{getOpponentName(match, team.team_id)}</td>
                                <td>{match.competition}</td>
                                <td>{getMatchResult(match, team.team_id)}</td>
                                <td>
                                    <Link className="btn btn-outline btn-sm" to={`/matches/${match.match_id}/overview`}>
                                        Open
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
