import type { TacticalPattern } from '../../types';

interface PatternListProps {
    patterns: TacticalPattern[];
}

export default function PatternList({ patterns }: PatternListProps) {
    // Empty state branch
    if (patterns.length === 0) {
        return (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                    Detected Tactical Patterns
                </h3>
                <p className="text-gray-400 text-center py-8">
                    Run analysis to detect tactical patterns
                </p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
                Detected Tactical Patterns
            </h3>
            <div className="space-y-4">
                {patterns.map((pattern, idx) => (
                    <PatternCard key={idx} pattern={pattern} />
                ))}
            </div>
        </div>
    );
}

function PatternCard({ pattern }: { pattern: TacticalPattern }) {
    // Icons for each pattern type
    const patternIcons: Record<string, string> = {
        KEY_PLAYER_DEPENDENCY: '⭐',
        WING_OVERLOAD: '↔️',
        CENTRAL_BUILDUP: '🎯',
        DIRECT_PLAY: '⚡',
        POSSESSION_RECYCLING: '🔄',
        ASYMMETRIC_PLAY: '↗️',
    };

    // Gradient colors per pattern
    const patternColors: Record<string, string> = {
        KEY_PLAYER_DEPENDENCY: 'from-purple-500 to-purple-600',
        WING_OVERLOAD: 'from-blue-500 to-blue-600',
        CENTRAL_BUILDUP: 'from-green-500 to-green-600',
        DIRECT_PLAY: 'from-orange-500 to-orange-600',
        POSSESSION_RECYCLING: 'from-cyan-500 to-cyan-600',
        ASYMMETRIC_PLAY: 'from-pink-500 to-pink-600',
    };

    // Resolve display values
    const icon = patternIcons[pattern.pattern_type] || '📊';
    const gradient = patternColors[pattern.pattern_type] || 'from-gray-500 to-gray-600';
    const confidencePercent = Math.round(pattern.confidence_score * 100);

    return (
        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-lg">{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-white font-medium text-sm">
                            {formatPatternType(pattern.pattern_type)}
                        </h4>
                        <span className="text-xs font-medium text-gray-300 bg-gray-600 px-2 py-0.5 rounded">
                            {confidencePercent}%
                        </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                        {pattern.description}
                    </p>
                    {pattern.side && (
                        <span className="inline-block mt-2 text-xs text-gray-500 bg-gray-600/50 px-2 py-0.5 rounded">
                            {pattern.side.charAt(0).toUpperCase() + pattern.side.slice(1)} side
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function formatPatternType(type: string): string {
    return type
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}
