import type { Match } from '@/entities/match';
import type { PlayerMetrics } from '@/entities/player';
import type { TeamWithMatches } from '@/entities/team';
import type {
    CounterTactic,
    RankedPlayer,
    TacticalPattern,
    TeamAggregateAnalysis,
    TeamAnalysis,
    TeamStats,
} from './types';

export const getDisplayPlayerName = (player: Pick<PlayerMetrics, 'player_id' | 'player_name' | 'name'>): string =>
    player.player_name || player.name || `Player ${player.player_id}`;

export const getAnalysisForTeam = (
    analysis: Record<string, TeamAnalysis> | null | undefined,
    teamName?: string | null
): TeamAnalysis | null => {
    if (!analysis || !teamName) {
        return null;
    }

    return analysis[teamName] || null;
};

export const getTeamNameById = (match: Match | null, teamId: number | null): string | null => {
    if (!match || !teamId) {
        return null;
    }

    if (match.home_team?.team_id === teamId) {
        return match.home_team.team_name;
    }

    if (match.away_team?.team_id === teamId) {
        return match.away_team.team_name;
    }

    return null;
};

export const getOpponentName = (match: Match, teamId: number): string => {
    const isHome = match.home_team?.team_id === teamId;
    return isHome ? match.away_team?.team_name || 'Unknown' : match.home_team?.team_name || 'Unknown';
};

export const getMatchResult = (match: Match, teamId: number): 'W' | 'D' | 'L' => {
    const isHome = match.home_team?.team_id === teamId;
    const teamScore = isHome ? match.home_score : match.away_score;
    const opponentScore = isHome ? match.away_score : match.home_score;

    if (teamScore > opponentScore) {
        return 'W';
    }

    if (teamScore < opponentScore) {
        return 'L';
    }

    return 'D';
};

export const getTeamStats = (analysis: TeamAnalysis | null): TeamStats => {
    const stats = analysis?.network_statistics;
    const shots = analysis?.shot_summary;

    return {
        totalPasses: stats?.total_passes || 0,
        density: stats?.density || 0,
        clustering: stats?.avg_clustering || 0,
        reciprocity: stats?.reciprocity || 0,
        avgPathLength: stats?.avg_path_length || 0,
        numNodes: stats?.num_nodes || 0,
        numEdges: stats?.num_edges || 0,
        players: analysis?.player_metrics?.length || 0,
        patterns: analysis?.patterns?.length || 0,
        counterTactics: analysis?.counter_tactics?.length || 0,
        shots: shots?.total_shots || 0,
        xgTotal: shots?.xg_total || 0,
        xgPerShot: shots?.xg_per_shot || 0,
        avgShotDistance: shots?.avg_shot_distance || 0,
        avgShotAngle: shots?.avg_shot_angle || 0,
        highXgShots: shots?.high_xg_shots || 0,
    };
};

export const buildRankedPlayers = (analysis: TeamAnalysis | null, teamName: string): RankedPlayer[] => {
    if (!analysis?.player_metrics) {
        return [];
    }

    return analysis.player_metrics.map((player) => {
        const betweenness = player.betweenness_centrality || 0;
        const pagerank = player.pagerank || 0;

        return {
            ...player,
            teamName,
            impactScore: betweenness * 0.6 + pagerank * 0.4,
        };
    });
};

export const getTopPlayers = (analysis: TeamAnalysis | null, teamName: string, count = 5): RankedPlayer[] =>
    buildRankedPlayers(analysis, teamName)
        .sort((first, second) => second.impactScore - first.impactScore)
        .slice(0, count);

export const getTopPatterns = (analysis: TeamAnalysis | null, count = 4): TacticalPattern[] => {
    if (!analysis?.patterns) {
        return [];
    }

    return [...analysis.patterns]
        .sort((first, second) => (second.confidence_score || 0) - (first.confidence_score || 0))
        .slice(0, count);
};

export const getTopTactics = (analysis: TeamAnalysis | null, count = 3): CounterTactic[] => {
    if (!analysis?.counter_tactics) {
        return [];
    }

    return [...analysis.counter_tactics]
        .sort((first, second) => (first.priority || 0) - (second.priority || 0))
        .slice(0, count);
};

export const buildOverviewInsights = ({
    homeStats,
    awayStats,
    homeName,
    awayName,
    homeGoals,
    awayGoals,
    homePatterns,
    awayPatterns,
    passShareHome,
}: {
    homeStats: TeamStats;
    awayStats: TeamStats;
    homeName: string;
    awayName: string;
    homeGoals: number;
    awayGoals: number;
    homePatterns: string[];
    awayPatterns: string[];
    passShareHome: number;
}): string[] => {
    const insights: string[] = [];
    const passSharePct = passShareHome * 100;

    if (passSharePct >= 55) {
        insights.push(`${homeName} controlled possession (${passSharePct.toFixed(0)}% pass share).`);
    } else if (passSharePct <= 45) {
        insights.push(`${awayName} controlled possession (${(100 - passSharePct).toFixed(0)}% pass share).`);
    }

    const densityDiff = homeStats.density - awayStats.density;
    if (Math.abs(densityDiff) >= 0.05) {
        insights.push(
            `${densityDiff > 0 ? homeName : awayName} used a more compact network (+${(Math.abs(densityDiff) * 100).toFixed(1)}pp density).`
        );
    }

    const reciprocityDiff = homeStats.reciprocity - awayStats.reciprocity;
    if (Math.abs(reciprocityDiff) >= 0.05) {
        insights.push(
            `${reciprocityDiff > 0 ? homeName : awayName} showed stronger two-way passing (+${(Math.abs(reciprocityDiff) * 100).toFixed(1)}pp reciprocity).`
        );
    }

    if (homeStats.clustering >= 0.22) {
        insights.push(`${homeName} created stable triangles (${(homeStats.clustering * 100).toFixed(1)}% clustering).`);
    }

    if (awayStats.clustering >= 0.22) {
        insights.push(`${awayName} created stable triangles (${(awayStats.clustering * 100).toFixed(1)}% clustering).`);
    }

    if (homeStats.shots + awayStats.shots > 0) {
        const shotDiff = homeStats.shots - awayStats.shots;
        if (Math.abs(shotDiff) >= 5) {
            insights.push(`${shotDiff > 0 ? homeName : awayName} generated more shots (+${Math.abs(shotDiff)}).`);
        }

        const xgDiff = homeStats.xgTotal - awayStats.xgTotal;
        if (Math.abs(xgDiff) >= 0.5) {
            insights.push(`${xgDiff > 0 ? homeName : awayName} created higher xG (+${Math.abs(xgDiff).toFixed(2)}).`);
        }

        if (homeStats.xgPerShot >= 0.12) {
            insights.push(`${homeName} produced high-quality chances (xG/shot ${homeStats.xgPerShot.toFixed(2)}).`);
        } else if (homeStats.xgPerShot > 0 && homeStats.xgPerShot <= 0.07) {
            insights.push(`${homeName} relied on lower-quality shots (xG/shot ${homeStats.xgPerShot.toFixed(2)}).`);
        }

        if (awayStats.xgPerShot >= 0.12) {
            insights.push(`${awayName} produced high-quality chances (xG/shot ${awayStats.xgPerShot.toFixed(2)}).`);
        } else if (awayStats.xgPerShot > 0 && awayStats.xgPerShot <= 0.07) {
            insights.push(`${awayName} relied on lower-quality shots (xG/shot ${awayStats.xgPerShot.toFixed(2)}).`);
        }

        if (homeStats.xgTotal > 0) {
            const finishingDelta = homeGoals - homeStats.xgTotal;
            if (finishingDelta >= 0.6) {
                insights.push(`${homeName} overperformed finishing (+${finishingDelta.toFixed(2)} goals vs xG).`);
            } else if (finishingDelta <= -0.6) {
                insights.push(`${homeName} underperformed finishing (${finishingDelta.toFixed(2)} goals vs xG).`);
            }
        }

        if (awayStats.xgTotal > 0) {
            const finishingDelta = awayGoals - awayStats.xgTotal;
            if (finishingDelta >= 0.6) {
                insights.push(`${awayName} overperformed finishing (+${finishingDelta.toFixed(2)} goals vs xG).`);
            } else if (finishingDelta <= -0.6) {
                insights.push(`${awayName} underperformed finishing (${finishingDelta.toFixed(2)} goals vs xG).`);
            }
        }
    }

    if (homePatterns.length > 0) {
        insights.push(`${homeName} pattern highlight: ${homePatterns[0].replace(/_/g, ' ')}.`);
    }

    if (awayPatterns.length > 0) {
        insights.push(`${awayName} pattern highlight: ${awayPatterns[0].replace(/_/g, ' ')}.`);
    }

    return insights.slice(0, 7);
};

export const aggregateTeamAnalysis = (team: TeamWithMatches, results: TeamAnalysis[]): TeamAggregateAnalysis => {
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

    let wins = 0;
    let draws = 0;
    let losses = 0;

    team.matches.forEach((match) => {
        const result = getMatchResult(match, team.team_id);

        if (result === 'W') {
            wins += 1;
        } else if (result === 'D') {
            draws += 1;
        } else {
            losses += 1;
        }
    });

    const totalPasses = results.reduce((sum, result) => sum + (result.network_statistics?.total_passes || 0), 0);
    const avgDensity = results.reduce((sum, result) => sum + (result.network_statistics?.density || 0), 0) / results.length;
    const avgClustering = results.reduce((sum, result) => sum + (result.network_statistics?.avg_clustering || 0), 0) / results.length;
    const avgReciprocity = results.reduce((sum, result) => sum + (result.network_statistics?.reciprocity || 0), 0) / results.length;

    const playerMap = new Map<number, { player_name: string; totalBetweenness: number; appearances: number }>();
    results.forEach((result) => {
        result.player_metrics?.forEach((player) => {
            const displayName = getDisplayPlayerName(player);
            const existing = playerMap.get(player.player_id);

            if (existing) {
                existing.totalBetweenness += player.betweenness_centrality || 0;
                existing.appearances += 1;
                return;
            }

            playerMap.set(player.player_id, {
                player_name: displayName,
                totalBetweenness: player.betweenness_centrality || 0,
                appearances: 1,
            });
        });
    });

    const topPlayers = Array.from(playerMap.entries())
        .map(([player_id, data]) => ({
            player_id,
            player_name: data.player_name,
            avgBetweenness: data.totalBetweenness / data.appearances,
            appearances: data.appearances,
        }))
        .sort((first, second) => second.avgBetweenness - first.avgBetweenness)
        .slice(0, 5);

    const patternMap = new Map<string, { count: number; totalConfidence: number }>();
    results.forEach((result) => {
        result.patterns?.forEach((pattern) => {
            const existing = patternMap.get(pattern.pattern_type);
            if (existing) {
                existing.count += 1;
                existing.totalConfidence += pattern.confidence_score;
                return;
            }

            patternMap.set(pattern.pattern_type, {
                count: 1,
                totalConfidence: pattern.confidence_score,
            });
        });
    });

    const commonPatterns = Array.from(patternMap.entries())
        .map(([pattern_type, data]) => ({
            pattern_type,
            count: data.count,
            avgConfidence: data.totalConfidence / data.count,
        }))
        .sort((first, second) => second.count - first.count)
        .slice(0, 5);

    const tacticMap = new Map<string, { recommendation: string; count: number }>();
    results.forEach((result) => {
        result.counter_tactics?.forEach((tactic) => {
            const existing = tacticMap.get(tactic.tactic_type);
            if (existing) {
                existing.count += 1;
                return;
            }

            tacticMap.set(tactic.tactic_type, {
                recommendation: tactic.recommendation,
                count: 1,
            });
        });
    });

    const suggestedTactics = Array.from(tacticMap.entries())
        .map(([tactic_type, data]) => ({
            tactic_type,
            recommendation: data.recommendation,
            frequency: data.count,
        }))
        .sort((first, second) => second.frequency - first.frequency)
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
