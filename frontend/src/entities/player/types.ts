export interface Player {
    player_id: number;
    player_name: string;
    team_id: number;
    position: string;
    jersey_number: number;
}

export interface PlayerMetrics {
    metric_id: number;
    match_id: number;
    team_id: number;
    player_id: number;
    player_name: string;
    name?: string;
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
