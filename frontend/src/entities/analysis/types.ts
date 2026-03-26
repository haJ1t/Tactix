import type { PlayerMetrics } from '@/entities/player';

export interface NetworkNode {
    id: number;
    name: string;
    x: number;
    y: number;
    degree_centrality?: number;
    betweenness_centrality?: number;
    pagerank?: number;
}

export interface NetworkEdge {
    source: number;
    target: number;
    weight: number;
}

export interface NetworkStatistics {
    density: number;
    num_nodes: number;
    num_edges: number;
    total_passes: number;
    avg_clustering: number;
    avg_path_length: number;
    reciprocity: number;
}

export interface NetworkData {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    statistics: NetworkStatistics;
}

export interface TacticalPattern {
    pattern_id?: number;
    pattern_type: string;
    confidence_score: number;
    description: string;
    key_player_id?: number;
    key_player_name?: string;
    side?: string;
}

export interface CounterTactic {
    tactic_id?: number;
    pattern_id?: number;
    tactic_type: string;
    recommendation: string;
    priority: number;
    target_player_id?: number;
    target_player_name?: string;
}

export interface ShotSummary {
    total_shots: number;
    xg_total: number;
    xg_per_shot: number;
    avg_shot_distance: number;
    avg_shot_angle: number;
    high_xg_shots: number;
}

export interface VaepSummary {
    avg_scoring_vaep?: number;
    avg_conceding_vaep?: number;
    total_scoring_vaep?: number;
    total_conceding_vaep?: number;
    top_positive_actions?: Array<{
        pass_id?: string;
        player_name?: string;
        vaep_value?: number;
    }>;
}

export interface MatchNetwork {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    positions?: Record<string, { x: number; y: number }>;
}

export interface TeamAnalysis {
    network_statistics: NetworkStatistics;
    player_metrics: PlayerMetrics[];
    patterns: TacticalPattern[];
    counter_tactics: CounterTactic[];
    top_players?: PlayerMetrics[];
    network?: MatchNetwork;
    vaep_summary?: VaepSummary;
    network_features?: Record<string, number | string | boolean | null>;
    summary?: string;
    ml_info?: Record<string, boolean | string | number | null>;
    shot_summary?: ShotSummary;
}

export interface AnalysisResult {
    match_id: number;
    analysis: Record<string, TeamAnalysis>;
}

export interface TeamAggregateAnalysis {
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

export interface TeamStats {
    totalPasses: number;
    density: number;
    clustering: number;
    reciprocity: number;
    avgPathLength: number;
    numNodes: number;
    numEdges: number;
    players: number;
    patterns: number;
    counterTactics: number;
    shots: number;
    xgTotal: number;
    xgPerShot: number;
    avgShotDistance: number;
    avgShotAngle: number;
    highXgShots: number;
}

export interface RankedPlayer extends PlayerMetrics {
    teamName: string;
    impactScore: number;
}
