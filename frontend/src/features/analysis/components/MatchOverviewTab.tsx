import { useMemo } from 'react';
import { buildOverviewInsights, getTeamStats, getTopPlayers, getTopPatterns } from '@/entities/analysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatPercent } from '@/shared/lib/format';

export default function MatchOverviewTab() {
    const { match, currentAnalysis, currentTeamName, homeAnalysis, awayAnalysis, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();

    const overview = useMemo(() => {
        const homeStats = getTeamStats(homeAnalysis);
        const awayStats = getTeamStats(awayAnalysis);
        const totalPasses = homeStats.totalPasses + awayStats.totalPasses;
        const passShareHome = totalPasses ? homeStats.totalPasses / totalPasses : 0.5;
        const homeName = match.home_team?.team_name || 'Home';
        const awayName = match.away_team?.team_name || 'Away';

        return {
            homeStats,
            awayStats,
            totalPasses,
            passShareHome,
            passShareAway: 1 - passShareHome,
            insights: buildOverviewInsights({
                homeStats,
                awayStats,
                homeName,
                awayName,
                homeGoals: match.home_score,
                awayGoals: match.away_score,
                homePatterns: getTopPatterns(homeAnalysis).map((pattern) => pattern.pattern_type),
                awayPatterns: getTopPatterns(awayAnalysis).map((pattern) => pattern.pattern_type),
                passShareHome,
            }),
        };
    }, [awayAnalysis, homeAnalysis, match]);

    if (!currentAnalysis || !currentTeamName) {
        return (
            <EmptyState
                title="Analysis not available yet"
                description="Run the match analysis to unlock the overview, network, players, tactics, and report tabs."
                action={
                    <button className="btn btn-primary" onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </button>
                }
            />
        );
    }

    const selectedStats = getTeamStats(currentAnalysis);
    const topPlayers = getTopPlayers(currentAnalysis, currentTeamName, 5);
    const selectedTeamPassShare = currentTeamName === match.home_team?.team_name ? overview.passShareHome : overview.passShareAway;

    return (
        <div className="workspace-stack">
            <div className="overview-topline">
                <div className="overview-topline-stat">
                    <span className="editorial-stat-label">Selected lens</span>
                    <strong>{currentTeamName}</strong>
                </div>
                <div className="overview-topline-stat">
                    <span className="editorial-stat-label">Total passes</span>
                    <strong>{selectedStats.totalPasses}</strong>
                </div>
                <div className="overview-topline-stat">
                    <span className="editorial-stat-label">Pass share</span>
                    <strong>{formatPercent(selectedTeamPassShare)}</strong>
                </div>
                <div className="overview-topline-stat">
                    <span className="editorial-stat-label">xG total</span>
                    <strong>{selectedStats.xgTotal.toFixed(2)}</strong>
                </div>
            </div>

            <div className="grid grid-2 overview-story-grid">
                <div className="card insight-panel insight-panel-primary theater-panel theater-panel-primary overview-story-panel">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Match Story</h3>
                            <p className="card-subtitle">The clearest signals from the shared match analysis.</p>
                        </div>
                        <span className="tag">{overview.totalPasses} total passes</span>
                    </div>
                    <div className="card-body workspace-stack">
                        <div className="pass-share">
                            <div className="pass-share-labels">
                                <span>{match.home_team?.team_name} {formatPercent(overview.passShareHome)}</span>
                                <span>{match.away_team?.team_name} {formatPercent(overview.passShareAway)}</span>
                            </div>
                            <div className="pass-share-bar">
                                <div className="pass-share-home" style={{ width: `${overview.passShareHome * 100}%` }} />
                                <div className="pass-share-away" style={{ width: `${overview.passShareAway * 100}%` }} />
                            </div>
                        </div>

                        <div className="editorial-stat-row editorial-stat-row-soft">
                            <div className="editorial-stat">
                                <span className="editorial-stat-label">Tracked players</span>
                                <strong>{selectedStats.players}</strong>
                            </div>
                            <div className="editorial-stat">
                                <span className="editorial-stat-label">Patterns found</span>
                                <strong>{selectedStats.patterns}</strong>
                            </div>
                            <div className="editorial-stat">
                                <span className="editorial-stat-label">Shot volume</span>
                                <strong>{selectedStats.shots}</strong>
                            </div>
                            <div className="editorial-stat">
                                <span className="editorial-stat-label">Reciprocity</span>
                                <strong>{formatPercent(selectedStats.reciprocity)}</strong>
                            </div>
                        </div>

                        {overview.insights.length > 0 ? (
                            <div className="insights-list curated-insights">
                                {overview.insights.map((insight) => (
                                    <div className="insight-item" key={insight}>
                                        <span className="insight-bullet">•</span>
                                        <span>{insight}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="page-subtitle">No strong match differentials were detected from the current network and shot profile.</p>
                        )}
                    </div>
                </div>

                <div className="card insight-panel theater-panel overview-profile-panel">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Selected Team Profile</h3>
                            <p className="card-subtitle">Compact orientation before moving into deeper tabs.</p>
                        </div>
                    </div>
                    <div className="card-body workspace-stack">
                        <div className="detail-list overview-profile-list">
                            <div className="stat-item">
                                <span className="stat-label">Network density</span>
                                <span className="stat-value">{formatPercent(selectedStats.density)}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Average clustering</span>
                                <span className="stat-value">{formatPercent(selectedStats.clustering)}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Average path length</span>
                                <span className="stat-value">{selectedStats.avgPathLength.toFixed(2)}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">xG per shot</span>
                                <span className="stat-value">{selectedStats.xgPerShot.toFixed(2)}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">High xG shots</span>
                                <span className="stat-value">{selectedStats.highXgShots}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card theater-panel overview-connectors-panel">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Key Connectors</h3>
                        <p className="card-subtitle">The players carrying structure and progression for {currentTeamName}.</p>
                    </div>
                </div>
                <div className="card-body">
                    <div className="player-rank-list player-rank-list-editorial">
                        {topPlayers.map((player, index) => (
                            <div key={player.player_id} className={`player-rank-row editorial-player-row ${index < 3 ? 'editorial-player-row-top' : ''}`}>
                                <span className="player-rank-num">{index + 1}</span>
                                <div className="player-rank-core">
                                    <div className="player-mini-avatar">{(player.player_name || player.name || '?')[0]}</div>
                                    <div>
                                        <div className="player-name">{player.player_name || player.name}</div>
                                        <div className="player-meta">Impact {player.impactScore.toFixed(3)}</div>
                                    </div>
                                </div>
                                <div className="player-rank-stats">
                                    <span>Degree {player.degree_centrality.toFixed(3)}</span>
                                    <span>Betweenness {player.betweenness_centrality.toFixed(3)}</span>
                                    <span>PageRank {player.pagerank.toFixed(3)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
