import { useNavigate, useParams } from 'react-router-dom';
import { useDeleteReport, useImportLegacyReport, useReport } from '@/features/reports/hooks/useReports';
import { reportService } from '@/features/reports/services/reportService';
import { downloadTextFile } from '@/shared/lib/download';
import { formatDateTime, formatMatchDate } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/EmptyState';
import { LoadingState } from '@/shared/ui/LoadingState';

export default function ReportDetailsPage() {
    const navigate = useNavigate();
    const { reportId } = useParams<{ reportId: string }>();
    const reportQuery = useReport(reportId || null);
    const deleteReportMutation = useDeleteReport();
    const importLegacyMutation = useImportLegacyReport();

    if (reportQuery.isLoading) {
        return <LoadingState title="Loading report" description="Preparing the analyst dossier details." compact />;
    }

    if (!reportQuery.data) {
        return (
            <EmptyState
                title="Report not found"
                description="The requested report no longer exists or has not been created on this browser yet."
                action={
                    <button className="btn btn-primary" onClick={() => navigate('/reports')}>
                        Back to Reports
                    </button>
                }
            />
        );
    }

    const deleteAndExit = async () => {
        if (reportQuery.data?.kind !== 'artifact') {
            return;
        }

        await deleteReportMutation.mutateAsync(reportQuery.data.artifact.id);
        navigate('/reports');
    };

    if (reportQuery.data.kind === 'legacy') {
        const report = reportQuery.data.legacy;

        return (
            <div className="workspace-stack">
                <div className="page-header">
                    <h1 className="page-title">Legacy Report</h1>
                    <p className="page-subtitle">This browser-local report is still readable, but the primary artifact system is now backend-generated PDF dossiers.</p>
                </div>

                <div className="grid grid-2">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Match Summary</h3>
                        </div>
                        <div className="card-body detail-list">
                            <div className="stat-item">
                                <span className="stat-label">Match</span>
                                <span className="stat-value">{report.matchSummary.homeTeam} vs {report.matchSummary.awayTeam}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Score</span>
                                <span className="stat-value">{report.matchSummary.score}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Competition</span>
                                <span className="stat-value">{report.matchSummary.competition}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Saved at</span>
                                <span className="stat-value">{formatDateTime(report.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Actions</h3>
                        </div>
                        <div className="card-body workspace-stack">
                            <button className="btn btn-primary" onClick={() => void importLegacyMutation.mutateAsync(report).then((created) => navigate(`/reports/${created.id}`))}>
                                Convert to PDF
                            </button>
                            <button
                                className="btn btn-outline"
                                onClick={() => downloadTextFile(JSON.stringify(report, null, 2), `legacy_report_${report.id}.json`, 'application/json')}
                            >
                                Export JSON
                            </button>
                            <button className="btn btn-outline" onClick={() => navigate('/reports')}>
                                Back to Reports
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const report = reportQuery.data.artifact;

    return (
        <div className="workspace-stack">
            <div className="page-header">
                <h1 className="page-title">Report Details</h1>
                <p className="page-subtitle">Backend-generated analyst dossier for {report.home_team} vs {report.away_team}.</p>
            </div>

            <div className="grid grid-2">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Artifact Metadata</h3>
                    </div>
                    <div className="card-body detail-list">
                        <div className="stat-item">
                            <span className="stat-label">Match</span>
                            <span className="stat-value">{report.home_team} vs {report.away_team}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Score</span>
                            <span className="stat-value">{report.scoreline || 'Unavailable'}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Competition</span>
                            <span className="stat-value">{report.competition || 'Unavailable'}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Match date</span>
                            <span className="stat-value">{formatMatchDate(report.match_date || '')}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Created</span>
                            <span className="stat-value">{formatDateTime(report.created_at)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Source</span>
                            <span className="stat-value">{report.source_kind.replace('_', ' ')}</span>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Actions</h3>
                    </div>
                    <div className="card-body workspace-stack">
                        <button className="btn btn-primary" onClick={() => window.open(reportService.getDownloadUrl(report.id), '_blank', 'noopener')}>
                            Download PDF
                        </button>
                        <button className="btn btn-danger" onClick={() => void deleteAndExit()}>
                            Delete Report
                        </button>
                        <button className="btn btn-outline" onClick={() => navigate('/reports')}>
                            Back to Reports
                        </button>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Executive Summary</h3>
                </div>
                <div className="card-body workspace-stack">
                    <p className="page-subtitle">{report.snapshot_summary.executive_summary || 'Summary unavailable.'}</p>
                    <p className="page-subtitle">{report.snapshot_summary.match_story || 'Match story unavailable.'}</p>
                </div>
            </div>

            <div className="grid grid-2">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Section Summary</h3>
                    </div>
                    <div className="card-body workspace-stack">
                        {report.snapshot_summary.section_summary.length > 0 ? (
                            report.snapshot_summary.section_summary.map((section) => (
                                <div className="list-row-link" key={section.id}>
                                    <div>
                                        <strong>{section.title}</strong>
                                        <p className="list-row-meta">{section.detail}</p>
                                    </div>
                                    <span className="tag">{section.status}</span>
                                </div>
                            ))
                        ) : (
                            <p className="page-subtitle">Section summary is not available for this artifact.</p>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Team Summary</h3>
                    </div>
                    <div className="card-body workspace-stack">
                        {report.snapshot_summary.team_summaries.length > 0 ? (
                            report.snapshot_summary.team_summaries.map((team) => (
                                <div className="detail-list" key={team.team_name}>
                                    <div className="stat-item">
                                        <span className="stat-label">Team</span>
                                        <span className="stat-value">{team.team_name}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Passes</span>
                                        <span className="stat-value">{team.total_passes}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Patterns</span>
                                        <span className="stat-value">{team.patterns}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Counter tactics</span>
                                        <span className="stat-value">{team.counter_tactics}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Shots / xG</span>
                                        <span className="stat-value">{team.shots} / {team.xg_total.toFixed(2)}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Top connector</span>
                                        <span className="stat-value">{team.top_connector || 'Unavailable'}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="page-subtitle">Team summary is not available for this artifact.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Final Conclusion</h3>
                </div>
                <div className="card-body">
                    <p className="page-subtitle">{report.snapshot_summary.final_conclusion || 'Conclusion unavailable.'}</p>
                </div>
            </div>
        </div>
    );
}
