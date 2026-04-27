import type { PlayerMetrics } from '../../types';

interface MetricsCardsProps {
    metrics: PlayerMetrics[];
    networkStats?: {
        density: number;
        total_passes: number;
        avg_clustering: number;
        reciprocity: number;
    };
}

// Helper to get player name from metrics (handles both 'name' and 'player_name')
function getPlayerName(player: PlayerMetrics): string {
    return player.player_name || (player as any).name || `Player ${player.player_id}`;
}

export default function MetricsCards({ metrics, networkStats }: MetricsCardsProps) {
    // Top three by betweenness
    const topByBetweenness = [...metrics]
        .sort((a, b) => b.betweenness_centrality - a.betweenness_centrality)
        .slice(0, 3);

    // Top three by PageRank
    const topByPageRank = [...metrics]
        .sort((a, b) => b.pagerank - a.pagerank)
        .slice(0, 3);

    return (
        <div className="space-y-6">
            {/* Network Statistics */}
            {networkStats && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Network Statistics</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <StatItem label="Total Passes" value={networkStats.total_passes} />
                        <StatItem label="Network Density" value={`${(networkStats.density * 100).toFixed(1)}%`} />
                        <StatItem label="Avg Clustering" value={networkStats.avg_clustering.toFixed(3)} />
                        <StatItem label="Reciprocity" value={`${(networkStats.reciprocity * 100).toFixed(1)}%`} />
                    </div>
                </div>
            )}

            {/* Top by Betweenness */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                    Key Players (Betweenness)
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                    Players who control the flow of passes through the team
                </p>
                <div className="space-y-3">
                    {topByBetweenness.map((player, idx) => (
                        <PlayerRow
                            key={player.player_id}
                            rank={idx + 1}
                            name={getPlayerName(player)}
                            value={player.betweenness_centrality}
                            maxValue={topByBetweenness[0].betweenness_centrality}
                            color="green"
                        />
                    ))}
                </div>
            </div>

            {/* Top by PageRank */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                    Most Involved (PageRank)
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                    Players with highest overall involvement in passing
                </p>
                <div className="space-y-3">
                    {topByPageRank.map((player, idx) => (
                        <PlayerRow
                            key={player.player_id}
                            rank={idx + 1}
                            name={getPlayerName(player)}
                            value={player.pagerank}
                            maxValue={topByPageRank[0].pagerank}
                            color="blue"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="bg-gray-700/50 rounded-lg p-3">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
        </div>
    );
}

function PlayerRow({
    rank,
    name,
    value,
    maxValue,
    color,
}: {
    rank: number;
    name: string;
    value: number;
    maxValue: number;
    color: 'green' | 'blue';
}) {
    // Bar width as percentage
    const percentage = (value / maxValue) * 100;
    const bgColor = color === 'green' ? 'bg-green-500' : 'bg-blue-500';

    return (
        <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm w-6">#{rank}</span>
            <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-medium truncate">{name}</span>
                    <span className="text-gray-400 text-xs">{value.toFixed(4)}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${bgColor} rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
