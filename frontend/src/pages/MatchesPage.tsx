import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Match, Team, TeamAnalysis } from '../types';
import { matchService } from '../services/matchService';
import { teamService } from '../services/teamService';

interface TeamWithMatches extends Team {
    matches: Match[];
    matchCount: number;
}

interface TeamAggregateAnalysis {
    totalMatches: number;
    wins: number;
    draws: number;
    losses: number;
    totalPasses: number;
    avgDensity: number;
    avgClustering: number;
    avgReciprocity: number;
    topPlayers: Array<{
        player_id: number;
        player_name: string;
        avgBetweenness: number;
        appearances: number;
    }>;
    commonPatterns: Array<{
        pattern_type: string;
        count: number;
        avgConfidence: number;
    }>;
    suggestedTactics: Array<{
        tactic_type: string;
        recommendation: string;
        frequency: number;
    }>;
}

export default function MatchesPage() {
    const [teams, setTeams] = useState<TeamWithMatches[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<TeamWithMatches | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [teamAnalysis, setTeamAnalysis] = useState<TeamAggregateAnalysis | null>(null);
    const [matchAnalysis, setMatchAnalysis] = useState<TeamAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzingTeam, setAnalyzingTeam] = useState(false);
    const [analyzingMatch, setAnalyzingMatch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [teamsData, matchesData] = await Promise.all([
                teamService.getTeams(),
                matchService.getMatches(),
            ]);

            const allMatches = matchesData.matches || [];

            // Group matches by team
            const teamsWithMatches: TeamWithMatches[] = (teamsData.teams || []).map((team: Team) => {
                const teamMatches = allMatches.filter(
                    (m) => m.home_team?.team_id === team.team_id || m.away_team?.team_id === team.team_id
                );
                return {
                    ...team,
                    matches: teamMatches,
                    matchCount: teamMatches.length,
                };
            }).filter((t: TeamWithMatches) => t.matchCount > 0);

            setTeams(teamsWithMatches);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTeam = async (team: TeamWithMatches) => {
        setSelectedTeam(team);
        setSelectedMatch(null);
        setMatchAnalysis(null);

        try {
            setAnalyzingTeam(true);

            // Analyze all matches for this team and aggregate
            const analysisResults: TeamAnalysis[] = [];

            for (const match of team.matches.slice(0, 5)) { // Limit to 5 matches for performance
                try {
                    const result = await matchService.analyzeMatchML(match.match_id, team.team_id);
                    const teamName = team.team_name;
                    if (result.analysis && result.analysis[teamName]) {
                        analysisResults.push(result.analysis[teamName]);
                    }
                } catch (e) {
                    console.warn(`Failed to analyze match ${match.match_id}`, e);
                }
            }

            // Aggregate the analysis results
            const aggregated = aggregateTeamAnalysis(team, analysisResults);
            setTeamAnalysis(aggregated);
        } catch (error) {
            console.error('Failed to analyze team:', error);
        } finally {
            setAnalyzingTeam(false);
        }
    };

    const handleSelectMatch = async (match: Match) => {
        if (!selectedTeam) return;

        setSelectedMatch(match);

        try {
            setAnalyzingMatch(true);
            const result = await matchService.analyzeMatchML(match.match_id, selectedTeam.team_id);
            const teamName = selectedTeam.team_name;
            if (result.analysis && result.analysis[teamName]) {
                setMatchAnalysis(result.analysis[teamName]);
            }
        } catch (error) {
            console.error('Failed to analyze match:', error);
        } finally {
            setAnalyzingMatch(false);
        }
    };

    const aggregateTeamAnalysis = (team: TeamWithMatches, results: TeamAnalysis[]): TeamAggregateAnalysis => {
        if (results.length === 0) {
            return {
                totalMatches: team.matchCount,
                wins: 0,
                draws: 0,
                losses: 0,
                totalPasses: 0,
                avgDensity: 0,
                avgClustering: 0,
                avgReciprocity: 0,
                topPlayers: [],
                commonPatterns: [],
                suggestedTactics: [],
            };
        }

        // Calculate win/draw/loss
        let wins = 0, draws = 0, losses = 0;
        team.matches.forEach((match) => {
            const isHome = match.home_team?.team_id === team.team_id;
            const teamScore = isHome ? match.home_score : match.away_score;
            const opponentScore = isHome ? match.away_score : match.home_score;
            if (teamScore > opponentScore) wins++;
            else if (teamScore < opponentScore) losses++;
            else draws++;
        });

        // Aggregate network statistics
        const totalPasses = results.reduce((sum, r) => sum + (r.network_statistics?.total_passes || 0), 0);
        const avgDensity = results.reduce((sum, r) => sum + (r.network_statistics?.density || 0), 0) / results.length;
        const avgClustering = results.reduce((sum, r) => sum + (r.network_statistics?.avg_clustering || 0), 0) / results.length;
        const avgReciprocity = results.reduce((sum, r) => sum + (r.network_statistics?.reciprocity || 0), 0) / results.length;

        // Aggregate top players
        const playerMap = new Map<number, { player_name: string; totalBetweenness: number; appearances: number }>();
        results.forEach((r) => {
            r.player_metrics?.forEach((p) => {
                const existing = playerMap.get(p.player_id);
                if (existing) {
                    existing.totalBetweenness += p.betweenness_centrality || 0;
                    existing.appearances++;
                } else {
                    playerMap.set(p.player_id, {
                        player_name: p.player_name,
                        totalBetweenness: p.betweenness_centrality || 0,
                        appearances: 1,
                    });
                }
            });
        });
        const topPlayers = Array.from(playerMap.entries())
            .map(([player_id, data]) => ({
                player_id,
                player_name: data.player_name,
                avgBetweenness: data.totalBetweenness / data.appearances,
                appearances: data.appearances,
            }))
            .sort((a, b) => b.avgBetweenness - a.avgBetweenness)
            .slice(0, 5);

        // Aggregate patterns
        const patternMap = new Map<string, { count: number; totalConfidence: number }>();
        results.forEach((r) => {
            r.patterns?.forEach((p) => {
                const existing = patternMap.get(p.pattern_type);
                if (existing) {
                    existing.count++;
                    existing.totalConfidence += p.confidence_score;
                } else {
                    patternMap.set(p.pattern_type, { count: 1, totalConfidence: p.confidence_score });
                }
            });
        });
        const commonPatterns = Array.from(patternMap.entries())
            .map(([pattern_type, data]) => ({
                pattern_type,
                count: data.count,
                avgConfidence: data.totalConfidence / data.count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Aggregate tactics
        const tacticMap = new Map<string, { recommendation: string; count: number }>();
        results.forEach((r) => {
            r.counter_tactics?.forEach((t) => {
                const existing = tacticMap.get(t.tactic_type);
                if (existing) {
                    existing.count++;
                } else {
                    tacticMap.set(t.tactic_type, { recommendation: t.recommendation, count: 1 });
                }
            });
        });
        const suggestedTactics = Array.from(tacticMap.entries())
            .map(([tactic_type, data]) => ({
                tactic_type,
                recommendation: data.recommendation,
                frequency: data.count,
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5);

        return {
            totalMatches: team.matchCount,
            wins,
            draws,
            losses,
            totalPasses,
            avgDensity,
            avgClustering,
            avgReciprocity,
            topPlayers,
            commonPatterns,
            suggestedTactics,
        };
    };

    const getMatchResult = (match: Match, teamId: number): 'W' | 'D' | 'L' => {
        const isHome = match.home_team?.team_id === teamId;
        const teamScore = isHome ? match.home_score : match.away_score;
        const opponentScore = isHome ? match.away_score : match.home_score;
        if (teamScore > opponentScore) return 'W';
        if (teamScore < opponentScore) return 'L';
        return 'D';
    };

    const getOpponentName = (match: Match, teamId: number): string => {
        const isHome = match.home_team?.team_id === teamId;
        return isHome ? match.away_team?.team_name || 'Unknown' : match.home_team?.team_name || 'Unknown';
    };

    const filteredTeams = teams.filter((team) =>
        team.team_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout title="Matches">
            <div className="page-header">
                <h1 className="page-title">Teams & Matches</h1>
                <p className="page-subtitle">Select a team to view aggregate analysis and individual match tactics</p>
            </div>

            <div className="teams-layout">
                {/* Left Panel - Teams List */}
                <div className="teams-sidebar">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Teams</h3>
                            <span className="badge">{teams.length}</span>
                        </div>
                        <div className="card-body" style={{ padding: 0 }}>
                            <div className="teams-search">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search teams..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            {loading ? (
                                <div className="loading-state">
                                    <div className="spinner"></div>
                                </div>
                            ) : (
                                <div className="teams-list">
                                    {filteredTeams.map((team) => (
                                        <div
                                            key={team.team_id}
                                            className={`team-item ${selectedTeam?.team_id === team.team_id ? 'selected' : ''}`}
                                            onClick={() => handleSelectTeam(team)}
                                        >
                                            <div className="team-avatar">
                                                {team.team_name[0]}
                                            </div>
                                            <div className="team-details">
                                                <span className="team-name">{team.team_name}</span>
                                                <span className="team-meta">{team.matchCount} matches</span>
                                            </div>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="teams-content">
                    {!selectedTeam ? (
                        <div className="empty-state-large">
                            <div className="empty-icon">
                                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <h3>Select a Team</h3>
                            <p>Choose a team from the list to view their aggregate performance analysis and match-by-match tactics</p>
                        </div>
                    ) : analyzingTeam ? (
                        <div className="loading-state-large">
                            <div className="spinner"></div>
                            <p>Analyzing {selectedTeam.team_name}'s performance...</p>
                        </div>
                    ) : (
                        <>
                            {/* Team Header */}
                            <div className="team-header-card">
                                <div className="team-header-info">
                                    <div className="team-large-avatar">
                                        {selectedTeam.team_name[0]}
                                    </div>
                                    <div>
                                        <h2>{selectedTeam.team_name}</h2>
                                        <p>{selectedTeam.country || 'Unknown Country'}</p>
                                    </div>
                                </div>
                                <div className="team-record">
                                    <div className="record-item win">
                                        <span className="record-value">{teamAnalysis?.wins || 0}</span>
                                        <span className="record-label">Wins</span>
                                    </div>
                                    <div className="record-item draw">
                                        <span className="record-value">{teamAnalysis?.draws || 0}</span>
                                        <span className="record-label">Draws</span>
                                    </div>
                                    <div className="record-item loss">
                                        <span className="record-value">{teamAnalysis?.losses || 0}</span>
                                        <span className="record-label">Losses</span>
                                    </div>
                                </div>
                            </div>

                            {/* Aggregate Analysis */}
                            {teamAnalysis && (
                                <div className="aggregate-section">
                                    <h3 className="section-title">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 3v18h18" />
                                            <path d="m18 9-5 5-4-4-3 3" />
                                        </svg>
                                        Aggregate Analysis
                                    </h3>

                                    {/* Stats Grid */}
                                    <div className="stats-grid">
                                        <div className="mini-stat-card">
                                            <span className="mini-stat-value">{teamAnalysis.totalPasses}</span>
                                            <span className="mini-stat-label">Total Passes</span>
                                        </div>
                                        <div className="mini-stat-card">
                                            <span className="mini-stat-value">{(teamAnalysis.avgDensity * 100).toFixed(1)}%</span>
                                            <span className="mini-stat-label">Avg Density</span>
                                        </div>
                                        <div className="mini-stat-card">
                                            <span className="mini-stat-value">{teamAnalysis.avgClustering.toFixed(2)}</span>
                                            <span className="mini-stat-label">Avg Clustering</span>
                                        </div>
                                        <div className="mini-stat-card">
                                            <span className="mini-stat-value">{(teamAnalysis.avgReciprocity * 100).toFixed(1)}%</span>
                                            <span className="mini-stat-label">Avg Reciprocity</span>
                                        </div>
                                    </div>

                                    <div className="analysis-grid-3">
                                        {/* Top Players */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h4 className="card-title">Key Players</h4>
                                            </div>
                                            <div className="card-body">
                                                {teamAnalysis.topPlayers.length > 0 ? (
                                                    teamAnalysis.topPlayers.map((player, idx) => (
                                                        <div className="mini-player-item" key={player.player_id}>
                                                            <span className="player-rank">{idx + 1}</span>
                                                            <div className="player-mini-info">
                                                                <span className="player-name-sm">{player.player_name}</span>
                                                                <span className="player-stat-sm">
                                                                    Avg Betweenness: {player.avgBetweenness.toFixed(3)}
                                                                </span>
                                                            </div>
                                                            <span className="appearances-badge">{player.appearances} matches</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="no-data">No player data available</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Common Patterns */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h4 className="card-title">Common Patterns</h4>
                                            </div>
                                            <div className="card-body">
                                                {teamAnalysis.commonPatterns.length > 0 ? (
                                                    teamAnalysis.commonPatterns.map((pattern, idx) => (
                                                        <div className="pattern-item" key={idx}>
                                                            <div className="pattern-info">
                                                                <span className="pattern-name">{pattern.pattern_type.replace(/_/g, ' ')}</span>
                                                                <span className="pattern-confidence">
                                                                    {(pattern.avgConfidence * 100).toFixed(0)}% confidence
                                                                </span>
                                                            </div>
                                                            <span className="pattern-count">{pattern.count}x</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="no-data">No patterns detected</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Suggested Counter Tactics */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h4 className="card-title">Counter Tactics</h4>
                                                <span className="ai-badge">AI</span>
                                            </div>
                                            <div className="card-body">
                                                {teamAnalysis.suggestedTactics.length > 0 ? (
                                                    teamAnalysis.suggestedTactics.map((tactic, idx) => (
                                                        <div className="tactic-item" key={idx}>
                                                            <div className="tactic-badge">{tactic.tactic_type.replace(/_/g, ' ')}</div>
                                                            <p className="tactic-desc">{tactic.recommendation}</p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="no-data">No tactics generated</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Team Matches */}
                            <div className="matches-section">
                                <h3 className="section-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="m15 9-6 6M9 9l6 6" />
                                    </svg>
                                    Matches ({selectedTeam.matchCount})
                                </h3>
                                <p className="section-subtitle">Select a specific match for detailed tactical analysis</p>

                                <div className="matches-grid">
                                    {selectedTeam.matches.map((match) => {
                                        const result = getMatchResult(match, selectedTeam.team_id);
                                        const isHome = match.home_team?.team_id === selectedTeam.team_id;

                                        return (
                                            <div
                                                key={match.match_id}
                                                className={`match-card ${selectedMatch?.match_id === match.match_id ? 'selected' : ''}`}
                                                onClick={() => handleSelectMatch(match)}
                                            >
                                                <div className="match-card-header">
                                                    <span className={`result-badge ${result.toLowerCase()}`}>{result}</span>
                                                    <span className="match-date">{match.match_date}</span>
                                                </div>
                                                <div className="match-card-body">
                                                    <div className="match-teams-display">
                                                        <span className={isHome ? 'team-highlight' : ''}>{match.home_team?.team_name}</span>
                                                        <span className="match-score">
                                                            {match.home_score} - {match.away_score}
                                                        </span>
                                                        <span className={!isHome ? 'team-highlight' : ''}>{match.away_team?.team_name}</span>
                                                    </div>
                                                </div>
                                                <div className="match-card-footer">
                                                    <span className="competition-tag">{match.competition}</span>
                                                    <span className="home-away-tag">{isHome ? 'Home' : 'Away'}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Selected Match Analysis */}
                            {selectedMatch && (
                                <div className="match-analysis-section">
                                    <h3 className="section-title">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                        </svg>
                                        Match Analysis: {selectedTeam.team_name} vs {getOpponentName(selectedMatch, selectedTeam.team_id)}
                                    </h3>

                                    {analyzingMatch ? (
                                        <div className="loading-state">
                                            <div className="spinner"></div>
                                            <p>Analyzing match...</p>
                                        </div>
                                    ) : matchAnalysis ? (
                                        <div className="match-analysis-content">
                                            {/* Match Network Stats */}
                                            <div className="analysis-row">
                                                <div className="card flex-1">
                                                    <div className="card-header">
                                                        <h4 className="card-title">Network Statistics</h4>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="stats-list">
                                                            <div className="stat-row">
                                                                <span>Total Passes</span>
                                                                <strong>{matchAnalysis.network_statistics?.total_passes || 0}</strong>
                                                            </div>
                                                            <div className="stat-row">
                                                                <span>Network Density</span>
                                                                <strong>{((matchAnalysis.network_statistics?.density || 0) * 100).toFixed(1)}%</strong>
                                                            </div>
                                                            <div className="stat-row">
                                                                <span>Clustering</span>
                                                                <strong>{matchAnalysis.network_statistics?.avg_clustering?.toFixed(2) || 0}</strong>
                                                            </div>
                                                            <div className="stat-row">
                                                                <span>Reciprocity</span>
                                                                <strong>{((matchAnalysis.network_statistics?.reciprocity || 0) * 100).toFixed(1)}%</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="card flex-1">
                                                    <div className="card-header">
                                                        <h4 className="card-title">Key Players</h4>
                                                    </div>
                                                    <div className="card-body">
                                                        {matchAnalysis.player_metrics?.slice(0, 4).map((player, idx) => (
                                                            <div className="mini-player-item" key={player.player_id}>
                                                                <span className="player-rank">{idx + 1}</span>
                                                                <div className="player-mini-info">
                                                                    <span className="player-name-sm">{player.player_name}</span>
                                                                    <span className="player-stat-sm">
                                                                        Betweenness: {player.betweenness_centrality?.toFixed(3) || 0}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Patterns and Tactics */}
                                            <div className="analysis-row">
                                                <div className="card flex-1">
                                                    <div className="card-header">
                                                        <h4 className="card-title">Detected Patterns</h4>
                                                        <span className="ml-badge">ML</span>
                                                    </div>
                                                    <div className="card-body">
                                                        {matchAnalysis.patterns?.length > 0 ? (
                                                            matchAnalysis.patterns.slice(0, 4).map((pattern, idx) => (
                                                                <div className="pattern-item" key={idx}>
                                                                    <div className="pattern-info">
                                                                        <span className="pattern-name">{pattern.pattern_type.replace(/_/g, ' ')}</span>
                                                                        <span className="pattern-confidence">
                                                                            {(pattern.confidence_score * 100).toFixed(0)}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="no-data">No patterns detected</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="card flex-1">
                                                    <div className="card-header">
                                                        <h4 className="card-title">Counter Tactics</h4>
                                                        <span className="ai-badge">AI</span>
                                                    </div>
                                                    <div className="card-body">
                                                        {matchAnalysis.counter_tactics?.length > 0 ? (
                                                            matchAnalysis.counter_tactics.slice(0, 3).map((tactic, idx) => (
                                                                <div className="tactic-item-compact" key={idx}>
                                                                    <span className="tactic-number">{idx + 1}</span>
                                                                    <div>
                                                                        <strong>{tactic.target_player_name}</strong>
                                                                        <p>{tactic.recommendation}</p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="no-data">No tactics generated</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* View Full Analysis Button */}
                                            <div className="action-row">
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => navigate(`/analysis/${selectedMatch.match_id}`)}
                                                >
                                                    View Full Analysis
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="btn btn-outline"
                                                    onClick={() => navigate(`/match/${selectedMatch.match_id}`)}
                                                >
                                                    View Pass Network
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
