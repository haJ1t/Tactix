import { Link } from 'react-router-dom';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { useReports } from '@/features/reports/hooks/useReports';
import { StatCard } from '@/shared/ui/StatCard';
import { LoadingState } from '@/shared/ui/LoadingState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { formatDateTime, formatMatchDate } from '@/shared/lib/format';

export default function OverviewPage() {
    const matchesQuery = useMatches();
    const teamsQuery = useTeams();
    const reportsQuery = useReports();

    if (matchesQuery.isLoading || teamsQuery.isLoading) {
        return <LoadingState title="Loading overview" description="Building the latest workspace summary." />;
    }

    if (matchesQuery.isError || teamsQuery.isError) {
        return (
            <ErrorState
                title="Overview unavailable"
                description="Core dashboard metrics could not be loaded."
                onRetry={() => {
                    void matchesQuery.refetch();
                    void teamsQuery.refetch();
                }}
            />
        );
    }

    const latestReport = reportsQuery.data?.[0] || null;
    const recentReports = reportsQuery.data?.slice(0, 4) || [];

    return (
        <div className="workspace-stack">
            <div className="page-header">
                <h1 className="page-title">Overview</h1>
                <p className="page-subtitle">Track the current dataset, resume recent analysis, and move quickly into the right workspace.</p>
            </div>

            <div className="card overview-hero">
                <div className="card-body overview-hero-body">
                    <div className="overview-hero-copy">
                        <span className="overview-hero-eyebrow">Minimal analyst overview</span>
                        <h2 className="overview-hero-title">See the dataset, pick the next workspace, stay inside the signal.</h2>
                        <p className="overview-hero-text">
                            Tactix keeps match discovery, team season workspaces, and saved analysis in one clean operating surface for football intelligence work.
                        </p>
                        <div className="overview-hero-strip">
                            <div className="overview-hero-strip-item">
                                <span>Library</span>
                                <strong>{matchesQuery.data?.total || 0} matches</strong>
                            </div>
                            <div className="overview-hero-strip-item">
                                <span>Teams</span>
                                <strong>{teamsQuery.data?.total || 0} season workspaces</strong>
                            </div>
                            <div className="overview-hero-strip-item">
                                <span>Reports</span>
                                <strong>{reportsQuery.data?.length || 0} saved</strong>
                            </div>
                        </div>
                    </div>

                    <div className="overview-hero-panel">
                        <span className="overview-hero-panel-label">Next best move</span>
                        <div className="overview-hero-stat">
                            <strong>{latestReport ? `${latestReport.homeTeam} vs ${latestReport.awayTeam}` : 'Open matches'}</strong>
                            <span>{latestReport ? latestReport.competition : 'Start from the match library and launch a fresh analysis workspace.'}</span>
                        </div>
                        <div className="overview-hero-stat">
                            <div className="overview-hero-panel-actions">
                                <Link className="btn btn-primary" to="/matches">
                                    Browse Matches
                                </Link>
                                <Link className="btn btn-outline" to={latestReport ? `/reports/${latestReport.id}` : '/reports'}>
                                    {latestReport ? 'Open Latest Report' : 'Open Reports'}
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="snapshot-grid">
                <StatCard label="Matches in library" value={matchesQuery.data?.total || 0} tone="accent" />
                <StatCard label="Team seasons in library" value={teamsQuery.data?.total || 0} tone="success" />
                <StatCard label="Saved reports" value={reportsQuery.data?.length || 0} tone="warning" />
                <StatCard
                    label="Latest analyzed match"
                    value={latestReport ? `${latestReport.homeTeam} vs ${latestReport.awayTeam}` : 'No saved analysis yet'}
                />
            </div>

            <div className="grid grid-2">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Quick Actions</h3>
                    </div>
                    <div className="card-body overview-actions-grid">
                        <Link className="overview-action-card primary" to="/matches">
                            <span className="overview-action-label">Browse</span>
                            <strong>Matches</strong>
                            <p>Open the live fixture library and launch a workspace.</p>
                        </Link>
                        <Link className="overview-action-card" to="/teams">
                            <span className="overview-action-label">Review</span>
                            <strong>Team seasons</strong>
                            <p>Inspect season-scoped team profiles without cross-season noise.</p>
                        </Link>
                        <Link className="overview-action-card" to={latestReport ? `/reports/${latestReport.id}` : '/reports'}>
                            <span className="overview-action-label">Resume</span>
                            <strong>{latestReport ? 'Latest report' : 'Reports'}</strong>
                            <p>{latestReport ? 'Jump back into the most recent saved analysis output.' : 'Open the saved report library.'}</p>
                        </Link>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Latest Analysis</h3>
                    </div>
                    <div className="card-body">
                        {latestReport ? (
                            <div className="overview-analysis-card">
                                <div className="overview-analysis-top">
                                    <div>
                                        <span className="overview-analysis-label">Latest saved output</span>
                                        <h4 className="overview-analysis-title">{latestReport.homeTeam} vs {latestReport.awayTeam}</h4>
                                    </div>
                                    <span className="overview-analysis-score">{latestReport.scoreline}</span>
                                </div>

                                <div className="overview-analysis-grid">
                                    <div className="overview-analysis-item">
                                        <span>Competition</span>
                                        <strong>{latestReport.competition}</strong>
                                    </div>
                                    <div className="overview-analysis-item">
                                        <span>Match date</span>
                                        <strong>{formatMatchDate(latestReport.matchDate)}</strong>
                                    </div>
                                    <div className="overview-analysis-item">
                                        <span>Saved at</span>
                                        <strong>{formatDateTime(latestReport.createdAt)}</strong>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="page-subtitle">No analysis has been saved yet. Start from the matches library to create the first workspace report.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Recent Reports</h3>
                </div>
                <div className="card-body">
                    {recentReports.length > 0 ? (
                        <div className="stack-list">
                            {recentReports.map((report, index) => (
                                <Link key={report.id} className="list-row-link" to={`/reports/${report.id}`}>
                                    <div className="overview-report-row">
                                        <span className="overview-report-index">{String(index + 1).padStart(2, '0')}</span>
                                        <div>
                                            <strong>{report.homeTeam} vs {report.awayTeam}</strong>
                                            <p className="list-row-meta">
                                                {report.competition} · {formatMatchDate(report.matchDate)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="overview-report-side">
                                        <span className="tag">{report.scoreline}</span>
                                        <p className="list-row-meta">
                                            Saved {formatDateTime(report.createdAt)}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="page-subtitle">Saved reports will appear here once a match workspace report has been created.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
