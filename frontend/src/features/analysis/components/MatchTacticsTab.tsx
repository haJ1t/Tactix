import { getTopPatterns, getTopTactics } from '@/entities/analysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';

export default function MatchTacticsTab() {
    const { currentAnalysis, currentTeamName, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();

    if (!currentAnalysis || !currentTeamName) {
        return (
            <EmptyState
                title="Tactical signals need analysis"
                description="Run the workspace analysis to surface tactical patterns and counter-tactic recommendations."
                action={
                    <button className="btn btn-primary" onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </button>
                }
            />
        );
    }

    const patterns = getTopPatterns(currentAnalysis, 6);
    const tactics = getTopTactics(currentAnalysis, 6);

    return (
        <div className="grid tactics-editorial-grid">
            <div className="card tactics-panel-primary theater-panel theater-panel-primary">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Pattern Signals</h3>
                        <p className="card-subtitle">High-confidence signals shaping the team’s attacking and possession identity.</p>
                    </div>
                    <span className="tag">{currentTeamName}</span>
                </div>
                <div className="card-body">
                    {patterns.length > 0 ? (
                        <div className="pattern-list pattern-list-editorial">
                            {patterns.map((pattern) => (
                                <div className="pattern-pill pattern-pill-editorial" key={`${pattern.pattern_type}-${pattern.confidence_score}`}>
                                    <div>
                                        <span className="pattern-name">{pattern.pattern_type.replace(/_/g, ' ')}</span>
                                        <span className="pattern-caption">Signal confidence</span>
                                    </div>
                                    <span className="pattern-score">{(pattern.confidence_score * 100).toFixed(0)}%</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="page-subtitle">No tactical patterns were returned for this team.</p>
                    )}
                </div>
            </div>

            <div className="card tactics-panel-secondary theater-panel">
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Counter Tactics</h3>
                        <p className="card-subtitle">Analyst-style responses ordered by immediate tactical relevance.</p>
                    </div>
                    <span className="tag">Priority order</span>
                </div>
                <div className="card-body">
                    {tactics.length > 0 ? (
                        <div className="tactic-list tactic-list-editorial">
                            {tactics.map((tactic, index) => (
                                <div className="tactic-item tactic-item-editorial" key={`${tactic.tactic_type}-${index}`}>
                                    <span className="tactic-rank">{index + 1}</span>
                                    <span>{tactic.recommendation}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="page-subtitle">No counter-tactic recommendations were returned for this team.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
