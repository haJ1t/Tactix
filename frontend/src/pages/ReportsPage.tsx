import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Match, TeamAnalysis } from '../types';
import { matchService } from '../services/matchService';

interface ReportData {
    match: Match;
    homeAnalysis: TeamAnalysis | null;
    awayAnalysis: TeamAnalysis | null;
    generatedAt: string;
}

export default function ReportsPage() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [reports, setReports] = useState<ReportData[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadMatches();
    }, []);

    const loadMatches = async () => {
        try {
            setLoading(true);
            const data = await matchService.getMatches();
            setMatches(data.matches || []);
        } catch (error) {
            console.error('Failed to load matches:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async (matchId: number) => {
        const match = matches.find(m => m.match_id === matchId);
        if (!match) return;

        try {
            setGenerating(true);
            setSelectedMatch(matchId);

            const analysisData = await matchService.analyzeMatchML(matchId);
            const analysis = analysisData.analysis;

            const homeTeamName = match.home_team?.team_name || '';
            const awayTeamName = match.away_team?.team_name || '';

            const newReport: ReportData = {
                match,
                homeAnalysis: analysis[homeTeamName] || null,
                awayAnalysis: analysis[awayTeamName] || null,
                generatedAt: new Date().toLocaleString(),
            };

            setReports(prev => {
                const filtered = prev.filter(r => r.match.match_id !== matchId);
                return [newReport, ...filtered];
            });
        } catch (error) {
            console.error('Failed to generate report:', error);
        } finally {
            setGenerating(false);
            setSelectedMatch(null);
        }
    };

    const exportReport = (report: ReportData) => {
        const data = {
            matchInfo: {
                homeTeam: report.match.home_team?.team_name,
                awayTeam: report.match.away_team?.team_name,
                score: `${report.match.home_score} - ${report.match.away_score}`,
                date: report.match.match_date,
                competition: report.match.competition,
            },
            homeTeamAnalysis: report.homeAnalysis ? {
                networkStats: report.homeAnalysis.network_statistics,
                topPlayers: report.homeAnalysis.player_metrics?.slice(0, 5),
                patterns: report.homeAnalysis.patterns,
                counterTactics: report.homeAnalysis.counter_tactics,
            } : null,
            awayTeamAnalysis: report.awayAnalysis ? {
                networkStats: report.awayAnalysis.network_statistics,
                topPlayers: report.awayAnalysis.player_metrics?.slice(0, 5),
                patterns: report.awayAnalysis.patterns,
                counterTactics: report.awayAnalysis.counter_tactics,
            } : null,
            generatedAt: report.generatedAt,
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tactix-report-${report.match.match_id}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const deleteReport = (matchId: number) => {
        setReports(prev => prev.filter(r => r.match.match_id !== matchId));
    };

    return (
        <AppLayout title="Reports">
            <div className="page-header">
                <h1 className="page-title">Analysis Reports</h1>
                <p className="page-subtitle">Generate and export tactical analysis reports</p>
            </div>

            <div className="reports-layout">
                {/* Generate New Report */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-header">
                        <h3 className="card-title">Generate New Report</h3>
                    </div>
                    <div className="card-body">
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 20 }}>
                                <div className="spinner" style={{ margin: '0 auto' }}></div>
                            </div>
                        ) : (
                            <div className="report-generator">
                                <div className="match-dropdown">
                                    <select
                                        className="form-select"
                                        value={selectedMatch || ''}
                                        onChange={(e) => setSelectedMatch(Number(e.target.value) || null)}
                                        disabled={generating}
                                    >
                                        <option value="">Select a match...</option>
                                        {matches.map((match) => (
                                            <option key={match.match_id} value={match.match_id}>
                                                {match.home_team?.team_name} vs {match.away_team?.team_name} ({match.match_date})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => selectedMatch && generateReport(selectedMatch)}
                                    disabled={!selectedMatch || generating}
                                >
                                    {generating ? (
                                        <>
                                            <span className="btn-spinner"></span>
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                                <line x1="12" y1="18" x2="12" y2="12" />
                                                <line x1="9" y1="15" x2="15" y2="15" />
                                            </svg>
                                            Generate Report
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reports List */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Generated Reports</h3>
                        <span className="reports-count">{reports.length} reports</span>
                    </div>
                    <div className="card-body" style={{ padding: reports.length === 0 ? 40 : 0 }}>
                        {reports.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <path d="M3 9h18" />
                                        <path d="M9 21V9" />
                                    </svg>
                                </div>
                                <h3>No Reports Generated</h3>
                                <p>Select a match above and click "Generate Report" to create your first analysis report</p>
                            </div>
                        ) : (
                            <div className="reports-list">
                                {reports.map((report) => (
                                    <div key={report.match.match_id} className="report-item">
                                        <div className="report-info">
                                            <div className="report-header">
                                                <h4>
                                                    {report.match.home_team?.team_name} vs {report.match.away_team?.team_name}
                                                </h4>
                                                <span className="report-score">
                                                    {report.match.home_score} - {report.match.away_score}
                                                </span>
                                            </div>
                                            <div className="report-meta">
                                                <span>{report.match.competition}</span>
                                                <span className="meta-divider">|</span>
                                                <span>{report.match.match_date}</span>
                                                <span className="meta-divider">|</span>
                                                <span className="generated-time">Generated: {report.generatedAt}</span>
                                            </div>
                                            <div className="report-stats">
                                                <div className="report-stat">
                                                    <span className="stat-label-small">Home Passes</span>
                                                    <span className="stat-value-small">
                                                        {report.homeAnalysis?.network_statistics?.total_passes || 0}
                                                    </span>
                                                </div>
                                                <div className="report-stat">
                                                    <span className="stat-label-small">Away Passes</span>
                                                    <span className="stat-value-small">
                                                        {report.awayAnalysis?.network_statistics?.total_passes || 0}
                                                    </span>
                                                </div>
                                                <div className="report-stat">
                                                    <span className="stat-label-small">Patterns</span>
                                                    <span className="stat-value-small">
                                                        {(report.homeAnalysis?.patterns?.length || 0) +
                                                         (report.awayAnalysis?.patterns?.length || 0)}
                                                    </span>
                                                </div>
                                                <div className="report-stat">
                                                    <span className="stat-label-small">Tactics</span>
                                                    <span className="stat-value-small">
                                                        {(report.homeAnalysis?.counter_tactics?.length || 0) +
                                                         (report.awayAnalysis?.counter_tactics?.length || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="report-actions">
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => navigate(`/analysis/${report.match.match_id}`)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                                View
                                            </button>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => exportReport(report)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                Export
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => deleteReport(report.match.match_id)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Stats */}
                {reports.length > 0 && (
                    <div className="grid grid-3" style={{ marginTop: 24 }}>
                        <div className="stat-card compact">
                            <div className="stat-icon blue small">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                            </div>
                            <div className="stat-content">
                                <span className="stat-number">{reports.length}</span>
                                <span className="stat-label-text">Total Reports</span>
                            </div>
                        </div>

                        <div className="stat-card compact">
                            <div className="stat-icon green small">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            </div>
                            <div className="stat-content">
                                <span className="stat-number">
                                    {reports.reduce((acc, r) =>
                                        acc + (r.homeAnalysis?.patterns?.length || 0) + (r.awayAnalysis?.patterns?.length || 0), 0
                                    )}
                                </span>
                                <span className="stat-label-text">Patterns Detected</span>
                            </div>
                        </div>

                        <div className="stat-card compact">
                            <div className="stat-icon purple small">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
                                </svg>
                            </div>
                            <div className="stat-content">
                                <span className="stat-number">
                                    {reports.reduce((acc, r) =>
                                        acc + (r.homeAnalysis?.counter_tactics?.length || 0) + (r.awayAnalysis?.counter_tactics?.length || 0), 0
                                    )}
                                </span>
                                <span className="stat-label-text">Tactics Generated</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
