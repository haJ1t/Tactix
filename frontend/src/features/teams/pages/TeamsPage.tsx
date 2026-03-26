import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';

export default function TeamsPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [segment, setSegment] = useState<'all' | 'national' | 'club'>('all');
    const teamsQuery = useTeams({ search, segment });

    if (teamsQuery.isLoading) {
        return <LoadingState title="Loading teams" description="Preparing the team discovery workspace." />;
    }

    if (teamsQuery.isError) {
        return (
            <ErrorState
                title="Teams unavailable"
                description="The team catalog could not be loaded."
                onRetry={() => void teamsQuery.refetch()}
            />
        );
    }

    return (
        <div className="workspace-stack">
            <div className="page-header">
                <h1 className="page-title">Teams</h1>
                <p className="page-subtitle">Browse season-scoped team workspaces so player pools and tactical profiles stay aligned with the correct campaign.</p>
            </div>

            <div className="snapshot-grid">
                <div className="snapshot-metric">
                    <span className="snapshot-label">Team seasons with match data</span>
                    <span className="snapshot-value">{teamsQuery.data?.total || 0}</span>
                </div>
                <div className="snapshot-metric">
                    <span className="snapshot-label">National team seasons</span>
                    <span className="snapshot-value">{teamsQuery.data?.nationalCount || 0}</span>
                </div>
                <div className="snapshot-metric">
                    <span className="snapshot-label">Club team seasons</span>
                    <span className="snapshot-value">{teamsQuery.data?.clubCount || 0}</span>
                </div>
                <div className="snapshot-metric">
                    <span className="snapshot-label">Current view</span>
                    <span className="snapshot-value">{teamsQuery.data?.teams.length || 0}</span>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Team Directory</h3>
                    <span className="results-count">{teamsQuery.data?.teams.length || 0} season entries</span>
                </div>
                <div className="card-body workspace-stack">
                    <div className="search-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            className="search-input"
                            placeholder="Search team or country"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>

                    <select className="form-select" value={segment} onChange={(event) => setSegment(event.target.value as typeof segment)}>
                        <option value="all">All team seasons</option>
                        <option value="national">National team seasons</option>
                        <option value="club">Club team seasons</option>
                    </select>

                    <div className="match-list">
                        {teamsQuery.data?.teams.map((team) => (
                            <div key={`${team.team_id}-${team.season}`} className="match-row workspace-list-row">
                                <div>
                                    <div className="match-row-header">
                                        <span className="match-row-team">{team.team_name}</span>
                                        <span className="tag">{team.season}</span>
                                        <span className="tag">{team.segment === 'national' ? 'National' : 'Club'}</span>
                                    </div>
                                    <div className="match-row-meta">
                                        <span>{team.country || 'Country n/a'}</span>
                                        <span className="match-row-score">{team.matchCount} matches</span>
                                    </div>
                                </div>
                                <div className="workspace-inline-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => navigate(`/teams/${team.team_id}/overview?season=${encodeURIComponent(team.season)}`)}
                                    >
                                        Open Team
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
