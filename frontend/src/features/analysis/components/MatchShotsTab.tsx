import { getTeamStats } from '@/entities/analysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';

export default function MatchShotsTab() {
    const { currentAnalysis, currentTeamName, homeAnalysis, awayAnalysis, runAnalysis, isRunningAnalysis, match } = useMatchWorkspaceContext();

    if (!currentAnalysis || !currentTeamName) {
        return (
            <EmptyState
                title="Shot quality needs analysis"
                description="Run the workspace analysis to calculate xG, shot volume, and chance quality."
                action={
                    <button className="btn btn-primary" onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </button>
                }
            />
        );
    }

    const selectedStats = getTeamStats(currentAnalysis);
    const homeStats = getTeamStats(homeAnalysis);
    const awayStats = getTeamStats(awayAnalysis);

    return (
        <div className="workspace-stack">
            <div className="card insight-panel insight-panel-primary theater-panel theater-panel-primary shots-profile-panel">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Selected Team Shot Profile</h3>
                        <p className="card-subtitle">Start with the active team, then compare the two sides below.</p>
                    </div>
                    <span className="tag">{currentTeamName}</span>
                </div>
                <div className="card-body workspace-stack">
                    <div className="editorial-stat-row editorial-stat-row-soft">
                        <div className="editorial-stat">
                            <span className="editorial-stat-label">Shots</span>
                            <strong>{selectedStats.shots}</strong>
                        </div>
                        <div className="editorial-stat">
                            <span className="editorial-stat-label">xG total</span>
                            <strong>{selectedStats.xgTotal.toFixed(2)}</strong>
                        </div>
                        <div className="editorial-stat">
                            <span className="editorial-stat-label">xG per shot</span>
                            <strong>{selectedStats.xgPerShot.toFixed(2)}</strong>
                        </div>
                        <div className="editorial-stat">
                            <span className="editorial-stat-label">High xG shots</span>
                            <strong>{selectedStats.highXgShots}</strong>
                        </div>
                    </div>

                    <div className="shot-summary-grid">
                        <div className="shot-summary-card">
                            <span className="shot-summary-label">Average shot distance</span>
                            <strong>{selectedStats.avgShotDistance.toFixed(1)}</strong>
                        </div>
                        <div className="shot-summary-card">
                            <span className="shot-summary-label">Average shot angle</span>
                            <strong>{selectedStats.avgShotAngle.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card theater-panel shots-comparison-panel">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Chance Quality Comparison</h3>
                        <p className="card-subtitle">Two compact sides of the same finishing profile.</p>
                    </div>
                    <span className="tag">{currentTeamName}</span>
                </div>
                <div className="card-body">
                    <div className="chance-grid chance-grid-editorial">
                        <div className="chance-card chance-card-editorial">
                            <div className="chance-title">{match.home_team?.team_name || 'Home'}</div>
                            <div className="chance-row"><span>Shots</span><strong>{homeStats.shots}</strong></div>
                            <div className="chance-row"><span>xG</span><strong>{homeStats.xgTotal.toFixed(2)}</strong></div>
                            <div className="chance-row"><span>xG/Shot</span><strong>{homeStats.xgPerShot.toFixed(2)}</strong></div>
                            <div className="chance-row"><span>Avg shot distance</span><strong>{homeStats.avgShotDistance.toFixed(1)}</strong></div>
                            <div className="chance-row"><span>High xG shots</span><strong>{homeStats.highXgShots}</strong></div>
                        </div>
                        <div className="chance-card chance-card-editorial">
                            <div className="chance-title">{match.away_team?.team_name || 'Away'}</div>
                            <div className="chance-row"><span>Shots</span><strong>{awayStats.shots}</strong></div>
                            <div className="chance-row"><span>xG</span><strong>{awayStats.xgTotal.toFixed(2)}</strong></div>
                            <div className="chance-row"><span>xG/Shot</span><strong>{awayStats.xgPerShot.toFixed(2)}</strong></div>
                            <div className="chance-row"><span>Avg shot distance</span><strong>{awayStats.avgShotDistance.toFixed(1)}</strong></div>
                            <div className="chance-row"><span>High xG shots</span><strong>{awayStats.highXgShots}</strong></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
