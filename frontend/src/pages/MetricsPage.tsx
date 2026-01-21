import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Match, TeamAnalysis } from '../types';
import { matchService } from '../services/matchService';

interface MatchMetrics {
    match: Match;
    homeAnalysis: TeamAnalysis | null;
    awayAnalysis: TeamAnalysis | null;
}

export default function MetricsPage() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [metrics, setMetrics] = useState<MatchMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
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

    const handleSelectMatch = async (match: Match) => {
        setSelectedMatch(match);
        try {
            setAnalyzing(true);
            const analysisData = await matchService.analyzeMatchML(match.match_id);
            const analysis = analysisData.analysis;

            const homeTeamName = match.home_team?.team_name || '';
            const awayTeamName = match.away_team?.team_name || '';

            setMetrics({
                match,
                homeAnalysis: analysis[homeTeamName] || null,
                awayAnalysis: analysis[awayTeamName] || null,
            });
        } catch (error) {
            console.error('Failed to analyze match:', error);
        } finally {
            setAnalyzing(false);
        }
    };

    const getTopPlayers = (analysis: TeamAnalysis | null) => {
        if (!analysis?.player_metrics) return [];
        return [...analysis.player_metrics]
            .sort((a, b) => (b.betweenness_centrality || 0) - (a.betweenness_centrality || 0))
            .slice(0, 5);
    };

    return (
        <AppLayout title="Metrics">
            <div className="page-header">
                <h1 className="page-title">Performance Metrics</h1>
                <p className="page-subtitle">Analyze player and team network statistics</p>
            </div>

            <div className="metrics-layout">
                {/* Match Selector */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-header">
                        <h3 className="card-title">Select Match for Analysis</h3>
                    </div>
                    <div className="card-body">
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 20 }}>
                                <div className="spinner" style={{ margin: '0 auto' }}></div>
                            </div>
                        ) : (
                            <div className="match-selector-grid">
                                {matches.slice(0, 6).map((match) => (
                                    <div
                                        key={match.match_id}
                                        className={`match-selector-item ${selectedMatch?.match_id === match.match_id ? 'selected' : ''}`}
                                        onClick={() => handleSelectMatch(match)}
                                    >
                                        <div className="match-teams">
                                            <span className="team-name">{match.home_team?.team_name || 'Home'}</span>
                                            <span className="vs-badge">vs</span>
                                            <span className="team-name">{match.away_team?.team_name || 'Away'}</span>
                                        </div>
                                        <div className="match-meta">
                                            <span>{match.match_date}</span>
                                            <span className="score-badge">{match.home_score} - {match.away_score}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Metrics Display */}
                {analyzing ? (
                    <div style={{ textAlign: 'center', padding: 60 }}>
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                        <p style={{ marginTop: 16, color: '#64748b' }}>Analyzing match metrics...</p>
                    </div>
                ) : metrics ? (
                    <>
                        {/* Overview Stats */}
                        <div className="grid grid-4" style={{ marginBottom: 24 }}>
                            <div className="stat-card">
                                <div className="stat-icon blue">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 6v6l4 2" />
                                    </svg>
                                </div>
                                <div className="stat-content">
                                    <span className="stat-number">
                                        {(metrics.homeAnalysis?.network_statistics?.total_passes || 0) +
                                         (metrics.awayAnalysis?.network_statistics?.total_passes || 0)}
                                    </span>
                                    <span className="stat-label-text">Total Passes</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon green">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                                <div className="stat-content">
                                    <span className="stat-number">
                                        {((metrics.homeAnalysis?.network_statistics?.density || 0) * 100).toFixed(0)}%
                                    </span>
                                    <span className="stat-label-text">Home Density</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon purple">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                </div>
                                <div className="stat-content">
                                    <span className="stat-number">
                                        {(metrics.homeAnalysis?.player_metrics?.length || 0) +
                                         (metrics.awayAnalysis?.player_metrics?.length || 0)}
                                    </span>
                                    <span className="stat-label-text">Players Analyzed</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon orange">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                </div>
                                <div className="stat-content">
                                    <span className="stat-number">
                                        {(metrics.homeAnalysis?.patterns?.length || 0) +
                                         (metrics.awayAnalysis?.patterns?.length || 0)}
                                    </span>
                                    <span className="stat-label-text">Patterns Found</span>
                                </div>
                            </div>
                        </div>

                        {/* Team Comparison */}
                        <div className="grid grid-2" style={{ marginBottom: 24 }}>
                            {/* Home Team */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">{metrics.match.home_team?.team_name || 'Home Team'}</h3>
                                    <span className="team-score">{metrics.match.home_score}</span>
                                </div>
                                <div className="card-body">
                                    <div className="metrics-grid">
                                        <div className="metric-item">
                                            <span className="metric-name">Network Density</span>
                                            <div className="metric-bar-container">
                                                <div
                                                    className="metric-bar blue"
                                                    style={{ width: `${(metrics.homeAnalysis?.network_statistics?.density || 0) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="metric-val">
                                                {((metrics.homeAnalysis?.network_statistics?.density || 0) * 100).toFixed(1)}%
                                            </span>
                                        </div>

                                        <div className="metric-item">
                                            <span className="metric-name">Clustering</span>
                                            <div className="metric-bar-container">
                                                <div
                                                    className="metric-bar green"
                                                    style={{ width: `${(metrics.homeAnalysis?.network_statistics?.avg_clustering || 0) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="metric-val">
                                                {(metrics.homeAnalysis?.network_statistics?.avg_clustering || 0).toFixed(2)}
                                            </span>
                                        </div>

                                        <div className="metric-item">
                                            <span className="metric-name">Reciprocity</span>
                                            <div className="metric-bar-container">
                                                <div
                                                    className="metric-bar purple"
                                                    style={{ width: `${(metrics.homeAnalysis?.network_statistics?.reciprocity || 0) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="metric-val">
                                                {((metrics.homeAnalysis?.network_statistics?.reciprocity || 0) * 100).toFixed(1)}%
                                            </span>
                                        </div>

                                        <div className="metric-item">
                                            <span className="metric-name">Total Passes</span>
                                            <span className="metric-val large">
                                                {metrics.homeAnalysis?.network_statistics?.total_passes || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Away Team */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">{metrics.match.away_team?.team_name || 'Away Team'}</h3>
                                    <span className="team-score">{metrics.match.away_score}</span>
                                </div>
                                <div className="card-body">
                                    <div className="metrics-grid">
                                        <div className="metric-item">
                                            <span className="metric-name">Network Density</span>
                                            <div className="metric-bar-container">
                                                <div
                                                    className="metric-bar blue"
                                                    style={{ width: `${(metrics.awayAnalysis?.network_statistics?.density || 0) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="metric-val">
                                                {((metrics.awayAnalysis?.network_statistics?.density || 0) * 100).toFixed(1)}%
                                            </span>
                                        </div>

                                        <div className="metric-item">
                                            <span className="metric-name">Clustering</span>
                                            <div className="metric-bar-container">
                                                <div
                                                    className="metric-bar green"
                                                    style={{ width: `${(metrics.awayAnalysis?.network_statistics?.avg_clustering || 0) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="metric-val">
                                                {(metrics.awayAnalysis?.network_statistics?.avg_clustering || 0).toFixed(2)}
                                            </span>
                                        </div>

                                        <div className="metric-item">
                                            <span className="metric-name">Reciprocity</span>
                                            <div className="metric-bar-container">
                                                <div
                                                    className="metric-bar purple"
                                                    style={{ width: `${(metrics.awayAnalysis?.network_statistics?.reciprocity || 0) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="metric-val">
                                                {((metrics.awayAnalysis?.network_statistics?.reciprocity || 0) * 100).toFixed(1)}%
                                            </span>
                                        </div>

                                        <div className="metric-item">
                                            <span className="metric-name">Total Passes</span>
                                            <span className="metric-val large">
                                                {metrics.awayAnalysis?.network_statistics?.total_passes || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Players Comparison */}
                        <div className="grid grid-2">
                            {/* Home Team Players */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Top Players - {metrics.match.home_team?.team_name}</h3>
                                </div>
                                <div className="card-body" style={{ padding: 0 }}>
                                    <table className="players-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Player</th>
                                                <th>Betweenness</th>
                                                <th>PageRank</th>
                                                <th>Degree</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getTopPlayers(metrics.homeAnalysis).map((player, idx) => (
                                                <tr key={player.player_id}>
                                                    <td>{idx + 1}</td>
                                                    <td>
                                                        <div className="player-cell">
                                                            <div className="player-mini-avatar">
                                                                {(player.player_name || 'P')[0]}
                                                            </div>
                                                            {player.player_name || `Player ${player.player_id}`}
                                                        </div>
                                                    </td>
                                                    <td>{player.betweenness_centrality?.toFixed(3) || '0.000'}</td>
                                                    <td>{player.pagerank?.toFixed(3) || '0.000'}</td>
                                                    <td>{player.degree_centrality?.toFixed(3) || '0.000'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Away Team Players */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Top Players - {metrics.match.away_team?.team_name}</h3>
                                </div>
                                <div className="card-body" style={{ padding: 0 }}>
                                    <table className="players-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Player</th>
                                                <th>Betweenness</th>
                                                <th>PageRank</th>
                                                <th>Degree</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getTopPlayers(metrics.awayAnalysis).map((player, idx) => (
                                                <tr key={player.player_id}>
                                                    <td>{idx + 1}</td>
                                                    <td>
                                                        <div className="player-cell">
                                                            <div className="player-mini-avatar">
                                                                {(player.player_name || 'P')[0]}
                                                            </div>
                                                            {player.player_name || `Player ${player.player_id}`}
                                                        </div>
                                                    </td>
                                                    <td>{player.betweenness_centrality?.toFixed(3) || '0.000'}</td>
                                                    <td>{player.pagerank?.toFixed(3) || '0.000'}</td>
                                                    <td>{player.degree_centrality?.toFixed(3) || '0.000'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* View Full Analysis Button */}
                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate(`/match/${metrics.match.match_id}`)}
                            >
                                View Full Match Analysis
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M3 3v18h18" />
                                <path d="M18 9l-5 5-4-4-3 3" />
                            </svg>
                        </div>
                        <h3>Select a Match</h3>
                        <p>Choose a match from above to view detailed metrics and player statistics</p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
