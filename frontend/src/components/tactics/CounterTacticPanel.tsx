import type { CounterTactic } from '../../types';

interface CounterTacticPanelProps {
    tactics: CounterTactic[];
}

export default function CounterTacticPanel({ tactics }: CounterTacticPanelProps) {
    // Empty state branch
    if (tactics.length === 0) {
        return (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                    Counter-Tactical Recommendations
                </h3>
                <p className="text-gray-400 text-center py-8">
                    Run analysis to generate counter-tactical recommendations
                </p>
            </div>
        );
    }

    // Split tactics by priority
    const highPriority = tactics.filter(t => t.priority === 1);
    const mediumPriority = tactics.filter(t => t.priority === 2);
    const lowPriority = tactics.filter(t => t.priority === 3);

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
                Counter-Tactical Recommendations
            </h3>

            {highPriority.length > 0 && (
                <TacticGroup
                    title="High Priority"
                    tactics={highPriority}
                    color="red"
                    icon="🔴"
                />
            )}

            {mediumPriority.length > 0 && (
                <TacticGroup
                    title="Medium Priority"
                    tactics={mediumPriority}
                    color="yellow"
                    icon="🟡"
                />
            )}

            {lowPriority.length > 0 && (
                <TacticGroup
                    title="Low Priority"
                    tactics={lowPriority}
                    color="green"
                    icon="🟢"
                />
            )}
        </div>
    );
}

function TacticGroup({
    title,
    tactics,
    color,
    icon,
}: {
    title: string;
    tactics: CounterTactic[];
    color: 'red' | 'yellow' | 'green';
    icon: string;
}) {
    // Pick border color by priority
    const borderColor = {
        red: 'border-red-500/50',
        yellow: 'border-yellow-500/50',
        green: 'border-green-500/50',
    }[color];

    // Matching background tint
    const bgColor = {
        red: 'bg-red-500/10',
        yellow: 'bg-yellow-500/10',
        green: 'bg-green-500/10',
    }[color];

    return (
        <div className="mb-6 last:mb-0">
            <div className="flex items-center gap-2 mb-3">
                <span>{icon}</span>
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                    {title}
                </h4>
            </div>
            <div className="space-y-2">
                {tactics.map((tactic, idx) => (
                    <div
                        key={idx}
                        className={`${bgColor} ${borderColor} border rounded-lg p-4`}
                    >
                        <div className="flex items-start gap-3">
                            <TacticIcon type={tactic.tactic_type} />
                            <div className="flex-1">
                                <p className="text-white text-sm leading-relaxed">
                                    {tactic.recommendation}
                                </p>
                                {tactic.target_player_name && (
                                    <p className="text-gray-400 text-xs mt-2">
                                        Target: {tactic.target_player_name}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TacticIcon({ type }: { type: string }) {
    // Icon mapping per tactic type
    const icons: Record<string, string> = {
        MAN_MARK: '👤',
        PRESS: '⚡',
        BLOCK_CHANNEL: '🚧',
        FORCE_DIRECTION: '➡️',
        COMPACT_ZONE: '🛡️',
        DROP_DEEP: '⬇️',
        HIGH_LINE: '⬆️',
    };

    return (
        <span className="text-xl flex-shrink-0">
            {icons[type] || '📋'}
        </span>
    );
}
