// Match types
export interface Team {
    team_id: number;
    team_name: string;
    country?: string;
}

export interface Match {
    match_id: number;
    home_team: Team | null;
    away_team: Team | null;
    match_date: string;
    competition: string;
    season: string;
    home_score: number;
    away_score: number;
}

// Player types
export interface Player {
    player_id: number;
    player_name: string;
    team_id: number;
    position: string;
    jersey_number: number;
}

// Network types
export interface NetworkNode {
    id: number;
    name: string;
    x: number;
    y: number;
    // Metrics added after calculation
    degree_centrality?: number;
    betweenness_centrality?: number;
    pagerank?: number;
}

export interface NetworkEdge {
    source: number;
    target: number;
    weight: number;
}

export interface NetworkData {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    statistics: NetworkStatistics;
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

// Metrics types
export interface PlayerMetrics {
    metric_id: number;
    match_id: number;
    team_id: number;
    player_id: number;
    player_name: string;
    jersey_number?: number;
    degree_centrality: number;
    in_degree_centrality: number;
    out_degree_centrality: number;
    betweenness_centrality: number;
    closeness_centrality: number;
    pagerank: number;
    clustering_coefficient: number;
    in_degree: number;
    out_degree: number;
    avg_x: number;
    avg_y: number;
}

// Pattern types
export interface TacticalPattern {
    pattern_id?: number;
    pattern_type: string;
    confidence_score: number;
    description: string;
    key_player_id?: number;
    key_player_name?: string;
    side?: string;
}

// Counter-tactic types
export interface CounterTactic {
    tactic_id?: number;
    pattern_id?: number;
    tactic_type: string;
    recommendation: string;
    priority: number;
    target_player_id?: number;
    target_player_name?: string;
}

// Analysis result types
export interface AnalysisResult {
    match_id: number;
    analysis: {
        [teamName: string]: TeamAnalysis;
    };
}

export interface TeamAnalysis {
    network_statistics: NetworkStatistics;
    player_metrics: PlayerMetrics[];
    patterns: TacticalPattern[];
    counter_tactics: CounterTactic[];
    top_players: PlayerMetrics[];
}
