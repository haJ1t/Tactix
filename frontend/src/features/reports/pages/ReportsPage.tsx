import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { useDeleteReport, useGenerateReport, useImportLegacyReport, useReports } from '@/features/reports/hooks/useReports';
import { reportService } from '@/features/reports/services/reportService';
import { formatDateTime, formatMatchDate } from '@/shared/lib/format';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';

export default function ReportsPage() {
    const navigate = useNavigate();
    const matchesQuery = useMatches();
    const reportsQuery = useReports();
    const generateReportMutation = useGenerateReport();
    const importLegacyMutation = useImportLegacyReport();
    const deleteReportMutation = useDeleteReport();
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

    const selectedMatch = useMemo(
        () => matchesQuery.data?.matches.find((match) => match.match_id === selectedMatchId) || null,
        [matchesQuery.data?.matches, selectedMatchId]
    );

    if (matchesQuery.isLoading || reportsQuery.isLoading) {
        return <LoadingState title="Loading reports" description="Preparing backend artifacts and legacy report references." />;
    }

    if (matchesQuery.isError || reportsQuery.isError) {
        return (
            <ErrorState
                title="Reports unavailable"
                description="The report library or match catalog could not be loaded."
                onRetry={() => {
                    void matchesQuery.refetch();
                    void reportsQuery.refetch();
                }}
            />
        );
    }

    const generateReport = async () => {
        if (!selectedMatchId) {
            return;
        }

        const created = await generateReportMutation.mutateAsync(selectedMatchId);
        navigate(`/reports/${created.id}`);
    };

    const downloadPdf = (reportId: string) => {
        window.open(reportService.getDownloadUrl(reportId), '_blank', 'noopener');
    };

    return (
        <div className="workspace-stack">
            <div className="page-header">
                <h1 className="page-title">Reports</h1>
                <p className="page-subtitle">Generate backend analyst dossiers, reopen them later, and keep legacy browser reports available until you convert them to PDF.</p>
            </div>

            <div className="card theater-panel">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Generate Analyst Report</h3>
                        <p className="card-subtitle">Create a backend-rendered English PDF dossier for a single match.</p>
                    </div>
                </div>
                <div className="card-body workspace-stack">
                    <select className="form-select" value={selectedMatchId || ''} onChange={(event) => setSelectedMatchId(Number(event.target.value) || null)}>
                        <option value="">Select a match...</option>
                        {matchesQuery.data?.matches.map((match) => (
                            <option key={match.match_id} value={match.match_id}>
                                {match.home_team?.team_name} vs {match.away_team?.team_name} ({formatMatchDate(match.match_date)})
                            </option>
                        ))}
                    </select>

                    <div className="workspace-inline-actions">
                        <button
                            className="btn btn-primary"
                            onClick={() => void generateReport()}
                            disabled={!selectedMatchId || generateReportMutation.isPending}
                        >
                            {generateReportMutation.isPending ? 'Generating PDF dossier...' : 'Generate Analyst Report'}
                        </button>
                        {selectedMatch ? (
                            <span className="workspace-segment-caption">
                                {selectedMatch.home_team?.team_name} vs {selectedMatch.away_team?.team_name} · {selectedMatch.competition}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="card theater-panel">
                <div className="card-header">
                    <h3 className="card-title">Generated PDF Artifacts</h3>
                    <span className="results-count">{reportsQuery.generatedReports.length} dossiers</span>
                </div>
                <div className="card-body">
                    {reportsQuery.generatedReports.length > 0 ? (
                        <div className="stack-list">
                            {reportsQuery.generatedReports.map((report) => (
                                <div className="list-row-link" key={report.id}>
                                    <div>
                                        <strong>{report.home_team} vs {report.away_team}</strong>
                                        <p className="list-row-meta">
                                            {report.competition || 'Competition unavailable'} · {formatMatchDate(report.match_date || '')} · Generated {formatDateTime(report.created_at)}
                                        </p>
                                    </div>
                                    <div className="workspace-inline-actions">
                                        <span className="tag">{report.scoreline || 'N/A'}</span>
                                        <Link className="btn btn-outline btn-sm" to={`/reports/${report.id}`}>
                                            Open
                                        </Link>
                                        <button className="btn btn-outline btn-sm" onClick={() => downloadPdf(report.id)}>
                                            Download PDF
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => void deleteReportMutation.mutateAsync(report.id)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <h3>No PDF dossiers yet</h3>
                            <p>Generate an analyst report above to create the first backend artifact.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="card theater-panel">
                <div className="card-header">
                    <h3 className="card-title">Legacy Browser Reports</h3>
                    <span className="results-count">{reportsQuery.legacyReports.length} legacy items</span>
                </div>
                <div className="card-body">
                    {reportsQuery.legacyReports.length > 0 ? (
                        <div className="stack-list">
                            {reportsQuery.legacyReports.map((report) => (
                                <div className="list-row-link" key={report.id}>
                                    <div>
                                        <strong>{report.matchSummary.homeTeam} vs {report.matchSummary.awayTeam}</strong>
                                        <p className="list-row-meta">
                                            {report.matchSummary.competition} · {formatMatchDate(report.matchSummary.matchDate)} · Saved {formatDateTime(report.createdAt)}
                                        </p>
                                    </div>
                                    <div className="workspace-inline-actions">
                                        <span className="tag">Legacy</span>
                                        <Link className="btn btn-outline btn-sm" to={`/reports/${report.id}`}>
                                            Open
                                        </Link>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => void importLegacyMutation.mutateAsync(report).then((created) => navigate(`/reports/${created.id}`))}
                                        >
                                            Convert to PDF
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <h3>No legacy reports waiting</h3>
                            <p>Browser-local reports will appear here until you convert them into backend PDF dossiers.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
