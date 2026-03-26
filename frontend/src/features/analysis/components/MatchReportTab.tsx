import { useNavigate } from 'react-router-dom';
import { useGenerateReport } from '@/features/reports/hooks/useReports';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';

export default function MatchReportTab() {
    const navigate = useNavigate();
    const { match, analysis, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();
    const generateReportMutation = useGenerateReport();

    if (!analysis) {
        return (
            <EmptyState
                title="Report preview needs analysis"
                description="Run the match analysis first so the PDF dossier can be generated from a complete backend snapshot."
                action={
                    <button className="btn btn-primary" onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </button>
                }
            />
        );
    }

    const generateReport = async () => {
        const created = await generateReportMutation.mutateAsync(match.match_id);
        navigate(`/reports/${created.id}`);
    };

    return (
        <div className="grid grid-2 report-theater-grid">
            <div className="card insight-panel theater-panel">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Analyst Dossier Preview</h3>
                        <p className="card-subtitle">The backend report will render both teams, tactical pattern signals, counter-plans, pass-network views, and shot-quality interpretation.</p>
                    </div>
                </div>
                <div className="card-body">
                    <div className="detail-list">
                        <div className="stat-item">
                            <span className="stat-label">Match</span>
                            <span className="stat-value">{match.home_team?.team_name} vs {match.away_team?.team_name}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Score</span>
                            <span className="stat-value">{match.home_score} - {match.away_score}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Competition</span>
                            <span className="stat-value">{match.competition}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Coverage</span>
                            <span className="stat-value">Executive summary, pass networks, tactics, shot quality, and final conclusion.</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card insight-panel insight-panel-primary theater-panel theater-panel-primary report-save-panel">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Generate PDF Dossier</h3>
                        <p className="card-subtitle">Create a backend-stored English report artifact that can be reopened later and downloaded as a PDF.</p>
                    </div>
                </div>
                <div className="card-body workspace-stack">
                    <div className="report-assurance-list">
                        <div className="report-assurance-item">
                            <span className="report-assurance-label">Render</span>
                            <strong>Backend PDF generation keeps layout, headings, and dossier structure consistent.</strong>
                        </div>
                        <div className="report-assurance-item">
                            <span className="report-assurance-label">Artifact</span>
                            <strong>Saved reports remain available from the Reports library and can be downloaded later.</strong>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => void generateReport()} disabled={generateReportMutation.isPending}>
                        {generateReportMutation.isPending ? 'Generating dossier...' : 'Generate Analyst Report'}
                    </button>
                </div>
            </div>
        </div>
    );
}
