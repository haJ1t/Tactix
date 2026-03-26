import { useTeamDetailsContext } from '@/features/teams/pages/TeamDetailsPage';

export default function TeamPatternsTab() {
    const { aggregateAnalysis, season } = useTeamDetailsContext();

    return (
        <div className="grid grid-2">
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Common Patterns</h3>
                    <span className="results-count">{season}</span>
                </div>
                <div className="card-body">
                    <div className="pattern-list">
                        {aggregateAnalysis.commonPatterns.map((pattern) => (
                            <div className="pattern-pill" key={pattern.pattern_type}>
                                <span>{pattern.pattern_type.replace(/_/g, ' ')}</span>
                                <span className="pattern-score">{pattern.count} matches</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Suggested Tactics</h3>
                    <span className="results-count">{season}</span>
                </div>
                <div className="card-body">
                    <div className="tactic-list">
                        {aggregateAnalysis.suggestedTactics.map((tactic, index) => (
                            <div className="tactic-item" key={`${tactic.tactic_type}-${index}`}>
                                <span className="tactic-rank">{index + 1}</span>
                                <span>{tactic.recommendation}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
