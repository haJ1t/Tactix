import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Match, TeamAnalysis } from '../types';
import { matchService } from '../services/matchService';

export default function AnalysisSummaryPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const [match, setMatch] = useState<Match | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
    const [analysis, setAnalysis] = useState<{ [key: string]: TeamAnalysis } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (matchId) {
            loadData(parseInt(matchId));
        }
    }, [matchId]);

    const loadData = async (id: number) => {
        try {
            setLoading(true);
            const matchData = await matchService.getMatch(id);
            setMatch(matchData);

            if (matchData.home_team) {
                setSelectedTeam(matchData.home_team.team_id);
            }

            // Run ML analysis
            const analysisData = await matchService.analyzeMatchML(id);
            setAnalysis(analysisData.analysis);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentTeamName = selectedTeam === match?.home_team?.team_id
        ? match?.home_team?.team_name
        : match?.away_team?.team_name;

    const currentAnalysis = analysis && currentTeamName ? analysis[currentTeamName] : null;

    if (loading) {
        return (
            <AppLayout title="Loading...">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <div className="spinner"></div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="App Name">
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h1 className="page-title">Analysis Summary</h1>
                <button className="btn btn-outline" onClick={() => navigate(`/match/${matchId}`)}>
                    ← Back to Match
                </button>
            </div>

            {/* Team Selector */}
            {match && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    <button
                        className={`btn ${selectedTeam === match.home_team?.team_id ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setSelectedTeam(match.home_team?.team_id || null)}
                    >
                        {match.home_team?.team_name}
                    </button>
                    <button
                        className={`btn ${selectedTeam === match.away_team?.team_id ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setSelectedTeam(match.away_team?.team_id || null)}
                    >
                        {match.away_team?.team_name}
                    </button>
                </div>
            )}

            <div className="analysis-grid">
                {/* Left Column - Metrics */}
                <div>
                    {/* Key Metrics Card */}
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header">
                            <h3 className="card-title">Key Metrics</h3>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>📊</span>
                        </div>
                        <div className="card-body">
                            {currentAnalysis && (
                                <>
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Network Density</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                                {((currentAnalysis.network_statistics?.density || 0) * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill blue"
                                                style={{ width: `${(currentAnalysis.network_statistics?.density || 0) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Avg Clustering</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                                {(currentAnalysis.network_statistics?.avg_clustering || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill green"
                                                style={{ width: `${(currentAnalysis.network_statistics?.avg_clustering || 0) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Reciprocity</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                                {((currentAnalysis.network_statistics?.reciprocity || 0) * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill blue"
                                                style={{ width: `${(currentAnalysis.network_statistics?.reciprocity || 0) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Passes</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                                {currentAnalysis.network_statistics?.total_passes || 0}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Counter-Tactic Suggestions */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Counter-Tactic Suggestions</h3>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>AI Generated</span>
                        </div>
                        <div className="card-body">
                            {currentAnalysis?.counter_tactics?.slice(0, 5).map((tactic: any, idx: number) => (
                                <div className="suggestion-item" key={idx}>
                                    <div className="suggestion-number">{idx + 1}</div>
                                    <div className="suggestion-text">
                                        <strong>{tactic.target_player_name || 'Key Player'}</strong>
                                        {' '}{tactic.recommendation}
                                    </div>
                                </div>
                            ))}
                            {(!currentAnalysis?.counter_tactics || currentAnalysis.counter_tactics.length === 0) && (
                                <p style={{ color: '#64748b', textAlign: 'center' }}>
                                    No counter-tactics available. Run analysis first.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Players & Patterns */}
                <div>
                    {/* Top Players */}
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header">
                            <h3 className="card-title">Key Players</h3>
                        </div>
                        <div className="card-body">
                            <table style={{ width: '100%', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ color: '#64748b' }}>
                                        <th style={{ textAlign: 'left', padding: '8px 0' }}>#</th>
                                        <th style={{ textAlign: 'left', padding: '8px 0' }}>Player</th>
                                        <th style={{ textAlign: 'right', padding: '8px 0' }}>Betweenness</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentAnalysis?.player_metrics?.slice(0, 5).map((player: any, idx: number) => (
                                        <tr key={player.player_id}>
                                            <td style={{ padding: '8px 0' }}>{idx + 1}</td>
                                            <td style={{ padding: '8px 0', fontWeight: 500 }}>
                                                {player.player_name || player.name || `Player ${player.player_id}`}
                                            </td>
                                            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                                                {player.betweenness_centrality?.toFixed(2) || 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Detected Patterns */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Detected Patterns</h3>
                            <span style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                background: '#22c55e',
                                color: 'white',
                                borderRadius: 4
                            }}>
                                ML
                            </span>
                        </div>
                        <div className="card-body">
                            {currentAnalysis?.patterns?.slice(0, 5).map((pattern: any, idx: number) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '10px 0',
                                    borderBottom: idx < 4 ? '1px solid #e2e8f0' : 'none'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                            {pattern.pattern_type}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            {pattern.evidence?.algorithm || 'Rule-based'}
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        color: pattern.confidence_score > 0.7 ? '#22c55e' : '#f59e0b'
                                    }}>
                                        {(pattern.confidence_score * 100).toFixed(0)}%
                                    </div>
                                </div>
                            ))}
                            {(!currentAnalysis?.patterns || currentAnalysis.patterns.length === 0) && (
                                <p style={{ color: '#64748b', textAlign: 'center' }}>
                                    No patterns detected. Run analysis first.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
