import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import AppLayout from '../components/layout/AppLayout';
import { Match, NetworkData, TeamAnalysis } from '../types';
import { matchService } from '../services/matchService';

export default function MatchDetailsPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const [match, setMatch] = useState<Match | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
    const [networkData, setNetworkData] = useState<NetworkData | null>(null);
    const [analysis, setAnalysis] = useState<{ [key: string]: TeamAnalysis } | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const networkRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (matchId) {
            loadMatch(parseInt(matchId));
        }
    }, [matchId]);

    useEffect(() => {
        if (networkData && networkRef.current) {
            drawNetwork();
        }
    }, [networkData]);

    const loadMatch = async (id: number) => {
        try {
            setLoading(true);
            const data = await matchService.getMatch(id);
            setMatch(data);
            if (data.home_team) {
                setSelectedTeam(data.home_team.team_id);
            }
        } catch (error) {
            console.error('Failed to load match:', error);
        } finally {
            setLoading(false);
        }
    };

    const runAnalysis = async () => {
        if (!matchId) return;

        try {
            setAnalyzing(true);
            // Use ML-enhanced analysis
            const data = await matchService.analyzeMatchML(parseInt(matchId), selectedTeam || undefined);
            setAnalysis(data.analysis);

            // Load network data
            const network = await matchService.getNetwork(parseInt(matchId), selectedTeam || undefined);
            setNetworkData(network);
        } catch (error) {
            console.error('Failed to run analysis:', error);
        } finally {
            setAnalyzing(false);
        }
    };

    const drawNetwork = () => {
        if (!networkRef.current || !networkData) return;

        const container = networkRef.current;
        container.innerHTML = '';

        const width = container.clientWidth;
        const height = container.clientHeight;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Draw pitch
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', '#1a5c3a');

        // Draw pitch lines
        const pitchGroup = svg.append('g');

        // Center circle
        pitchGroup.append('circle')
            .attr('cx', width / 2)
            .attr('cy', height / 2)
            .attr('r', 40)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(255,255,255,0.5)')
            .attr('stroke-width', 1);

        // Center line
        pitchGroup.append('line')
            .attr('x1', width / 2)
            .attr('y1', 0)
            .attr('x2', width / 2)
            .attr('y2', height)
            .attr('stroke', 'rgba(255,255,255,0.5)')
            .attr('stroke-width', 1);

        // Penalty boxes
        const boxWidth = width * 0.15;
        const boxHeight = height * 0.5;

        pitchGroup.append('rect')
            .attr('x', 0)
            .attr('y', (height - boxHeight) / 2)
            .attr('width', boxWidth)
            .attr('height', boxHeight)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(255,255,255,0.5)')
            .attr('stroke-width', 1);

        pitchGroup.append('rect')
            .attr('x', width - boxWidth)
            .attr('y', (height - boxHeight) / 2)
            .attr('width', boxWidth)
            .attr('height', boxHeight)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(255,255,255,0.5)')
            .attr('stroke-width', 1);

        // Scale positions
        const xScale = d3.scaleLinear().domain([0, 120]).range([30, width - 30]);
        const yScale = d3.scaleLinear().domain([0, 80]).range([20, height - 20]);

        // Draw edges
        const edgeGroup = svg.append('g');
        networkData.edges?.forEach((edge: any) => {
            const source = networkData.nodes?.find((n: any) => n.id === edge.source);
            const target = networkData.nodes?.find((n: any) => n.id === edge.target);

            if (source && target) {
                edgeGroup.append('line')
                    .attr('x1', xScale(source.x || 60))
                    .attr('y1', yScale(source.y || 40))
                    .attr('x2', xScale(target.x || 60))
                    .attr('y2', yScale(target.y || 40))
                    .attr('stroke', 'rgba(255,255,255,0.4)')
                    .attr('stroke-width', Math.min(edge.weight || 1, 5));
            }
        });

        // Draw nodes
        const nodeGroup = svg.append('g');
        networkData.nodes?.forEach((node: any) => {
            const x = xScale(node.x || 60);
            const y = yScale(node.y || 40);

            nodeGroup.append('circle')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', 16)
                .attr('fill', '#e63946')
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);

            nodeGroup.append('text')
                .attr('x', x)
                .attr('y', y + 4)
                .attr('text-anchor', 'middle')
                .attr('fill', 'white')
                .attr('font-size', '10px')
                .attr('font-weight', 'bold')
                .text(node.name?.split(' ').pop()?.slice(0, 3) || node.id);
        });
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

    if (!match) {
        return (
            <AppLayout title="Match Not Found">
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <p>Match not found</p>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                        Back to Dashboard
                    </button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="App Name">
            {/* Match Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="team-badge-large">
                        <div className="badge">{match.home_team?.team_name?.[0] || 'H'}</div>
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                        {match.home_team?.team_name} <span style={{ color: '#64748b', fontWeight: 400 }}>vs</span> {match.away_team?.team_name}
                    </h2>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="btn btn-success"
                        onClick={runAnalysis}
                        disabled={analyzing}
                    >
                        {analyzing ? 'Analyzing...' : '✓ Analyze'}
                    </button>
                    <button className="btn btn-outline">× Help</button>
                </div>
            </div>

            {/* Team Selector */}
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

            <div className="grid grid-2">
                {/* Left Column */}
                <div>
                    {/* Match Stats */}
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header">
                            <h3 className="card-title">Match Stats</h3>
                            <span className="score-display">{match.home_score} - {match.away_score}</span>
                        </div>
                        <div className="card-body">
                            <div className="stat-item">
                                <span className="stat-label">📅 Date</span>
                                <span className="stat-value">{match.match_date}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">🏆 Competition</span>
                                <span className="stat-value">{match.competition}</span>
                            </div>
                            {currentAnalysis && (
                                <>
                                    <div className="stat-item">
                                        <span className="stat-label">⚽ Total Passes</span>
                                        <span className="stat-value">{currentAnalysis.network_statistics?.total_passes || 0}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">📊 Network Density</span>
                                        <span className="stat-value">{((currentAnalysis.network_statistics?.density || 0) * 100).toFixed(1)}%</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Network Metrics */}
                    {currentAnalysis && (
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Network Metrics</h3>
                            </div>
                            <div className="card-body">
                                <div className="metric-row">
                                    <div className="metric-icon">📊</div>
                                    <span className="metric-label">Avg Clustering</span>
                                    <span className="metric-value">{currentAnalysis.network_statistics?.avg_clustering?.toFixed(2) || 0}</span>
                                </div>
                                <div className="metric-row">
                                    <div className="metric-icon">🔗</div>
                                    <span className="metric-label">Reciprocity</span>
                                    <span className="metric-value">{((currentAnalysis.network_statistics?.reciprocity || 0) * 100).toFixed(1)}%</span>
                                </div>
                                {currentAnalysis.player_metrics?.slice(0, 3).map((player: any, idx: number) => (
                                    <div className="metric-row" key={player.player_id}>
                                        <div className="metric-icon">🎯</div>
                                        <span className="metric-label">
                                            {player.player_name || player.name || `Player ${idx + 1}`} Betweenness
                                        </span>
                                        <span className="metric-value">{player.betweenness_centrality?.toFixed(2) || 0}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div>
                    {/* Pass Network */}
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header">
                            <h3 className="card-title">Pass Network</h3>
                        </div>
                        <div className="card-body" style={{ padding: 12 }}>
                            <div
                                ref={networkRef}
                                className="pass-network-container"
                                style={{ height: 280 }}
                            >
                                {!networkData && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '100%',
                                        color: 'rgba(255,255,255,0.6)'
                                    }}>
                                        Click "Analyze" to generate network
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Key Players */}
                    {currentAnalysis && (
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Key Players</h3>
                            </div>
                            <div className="card-body">
                                {currentAnalysis.player_metrics?.slice(0, 4).map((player: any, idx: number) => (
                                    <div className="player-item" key={player.player_id}>
                                        <div className="player-avatar" style={{
                                            background: idx === 0 ? '#c7a41c' : idx === 1 ? '#a855f7' : '#1e3a5f'
                                        }}>
                                            {(player.player_name || player.name || 'P')?.[0]?.toUpperCase() || 'P'}
                                        </div>
                                        <div className="player-info">
                                            <h4>{player.player_name || player.name || `Player ${player.player_id}`}</h4>
                                            <p>Betweenness: {player.betweenness_centrality?.toFixed(3) || 0}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Analysis Summary Link */}
            {currentAnalysis && (
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate(`/analysis/${matchId}`)}
                    >
                        View Full Analysis Summary →
                    </button>
                </div>
            )}
        </AppLayout>
    );
}
