"""
Network metrics calculator

Calculates centrality and other network metrics.
"""
import networkx as nx
from typing import Dict, List, Optional
import numpy as np


class MetricsCalculator:
    """Calculates network centrality and other metrics."""
    
    def __init__(self):
        """Initialize metrics calculator."""
        pass
    
    def calculate_all_metrics(self, G: nx.DiGraph) -> Dict[int, Dict]:
        """
        Calculate all centrality metrics for each node in the network.
        
        Args:
            G: Pass network graph
            
        Returns:
            Dictionary mapping player_id to metrics dictionary
        """
        if G.number_of_nodes() == 0:
            return {}
        
        metrics = {}
        
        # Calculate all centralities
        degree = nx.degree_centrality(G)
        in_degree = nx.in_degree_centrality(G)
        out_degree = nx.out_degree_centrality(G)
        betweenness = self._safe_betweenness_centrality(G)
        closeness = self._safe_closeness_centrality(G)
        pagerank = self._safe_pagerank(G)
        clustering = self._clustering_coefficient(G)
        
        # Combine into per-player metrics
        for node in G.nodes:
            metrics[node] = {
                'player_id': node,
                'name': G.nodes[node].get('name', f'Player {node}'),
                'degree_centrality': round(degree.get(node, 0), 4),
                'in_degree_centrality': round(in_degree.get(node, 0), 4),
                'out_degree_centrality': round(out_degree.get(node, 0), 4),
                'betweenness_centrality': round(betweenness.get(node, 0), 4),
                'closeness_centrality': round(closeness.get(node, 0), 4),
                'pagerank': round(pagerank.get(node, 0), 4),
                'clustering_coefficient': round(clustering.get(node, 0), 4),
                'in_degree': G.in_degree(node),
                'out_degree': G.out_degree(node),
                'avg_x': G.nodes[node].get('x', 60),
                'avg_y': G.nodes[node].get('y', 40),
            }
        
        return metrics
    
    def _safe_betweenness_centrality(self, G: nx.DiGraph) -> Dict:
        """Calculate betweenness centrality with error handling."""
        try:
            return nx.betweenness_centrality(G, weight='weight')
        except:
            return {node: 0 for node in G.nodes}
    
    def _safe_closeness_centrality(self, G: nx.DiGraph) -> Dict:
        """Calculate closeness centrality with error handling."""
        try:
            return nx.closeness_centrality(G)
        except:
            return {node: 0 for node in G.nodes}
    
    def _safe_pagerank(self, G: nx.DiGraph) -> Dict:
        """Calculate PageRank with error handling."""
        try:
            return nx.pagerank(G, weight='weight')
        except:
            # Fallback to uniform distribution
            n = G.number_of_nodes()
            return {node: 1/n if n > 0 else 0 for node in G.nodes}
    
    def _clustering_coefficient(self, G: nx.DiGraph) -> Dict:
        """Calculate clustering coefficient for directed graph."""
        try:
            return nx.clustering(G)
        except:
            return {node: 0 for node in G.nodes}
    
    def get_network_statistics(self, G: nx.DiGraph) -> Dict:
        """
        Calculate overall network statistics.
        
        Returns:
            Dictionary with network-level metrics
        """
        if G.number_of_nodes() == 0:
            return {
                'density': 0,
                'num_nodes': 0,
                'num_edges': 0,
                'total_passes': 0,
                'avg_clustering': 0,
                'avg_path_length': 0,
                'reciprocity': 0,
            }
        
        total_passes = sum(data['weight'] for _, _, data in G.edges(data=True))
        
        return {
            'density': round(nx.density(G), 4),
            'num_nodes': G.number_of_nodes(),
            'num_edges': G.number_of_edges(),
            'total_passes': total_passes,
            'avg_clustering': round(nx.average_clustering(G), 4),
            'avg_path_length': self._safe_avg_path_length(G),
            'reciprocity': round(nx.reciprocity(G), 4),
        }
    
    def _safe_avg_path_length(self, G: nx.DiGraph) -> float:
        """Calculate average path length with error handling."""
        try:
            if nx.is_strongly_connected(G):
                return round(nx.average_shortest_path_length(G), 4)
            else:
                # For disconnected graphs, calculate for largest component
                largest_cc = max(nx.strongly_connected_components(G), key=len)
                subgraph = G.subgraph(largest_cc)
                if subgraph.number_of_nodes() > 1:
                    return round(nx.average_shortest_path_length(subgraph), 4)
                return 0
        except:
            return 0
    
    def get_top_players(
        self, 
        metrics: Dict[int, Dict], 
        metric_name: str = 'betweenness_centrality',
        top_n: int = 5
    ) -> List[Dict]:
        """
        Get top N players by a specific metric.
        
        Args:
            metrics: Player metrics dictionary
            metric_name: Name of metric to rank by
            top_n: Number of top players to return
            
        Returns:
            List of top players with their metrics
        """
        players = list(metrics.values())
        sorted_players = sorted(
            players, 
            key=lambda x: x.get(metric_name, 0), 
            reverse=True
        )
        return sorted_players[:top_n]
    
    def get_key_player(self, metrics: Dict[int, Dict]) -> Optional[Dict]:
        """
        Identify the most influential player (highest betweenness).
        
        Returns:
            Key player's metrics or None
        """
        top = self.get_top_players(metrics, 'betweenness_centrality', 1)
        return top[0] if top else None
    
    def identify_playmakers(
        self, 
        metrics: Dict[int, Dict],
        threshold: float = 0.15
    ) -> List[Dict]:
        """
        Identify playmakers (high betweenness + high out-degree).
        
        Returns:
            List of playmaker players
        """
        playmakers = []
        for player in metrics.values():
            if (player['betweenness_centrality'] >= threshold and 
                player['out_degree_centrality'] >= threshold):
                playmakers.append(player)
        
        return sorted(
            playmakers, 
            key=lambda x: x['betweenness_centrality'], 
            reverse=True
        )
    
    def identify_target_men(
        self, 
        metrics: Dict[int, Dict],
        threshold: float = 0.2
    ) -> List[Dict]:
        """
        Identify target men (high in-degree, lower out-degree).
        
        Returns:
            List of target player metrics
        """
        targets = []
        for player in metrics.values():
            in_deg = player['in_degree_centrality']
            out_deg = player['out_degree_centrality']
            
            if in_deg >= threshold and in_deg > out_deg * 1.5:
                targets.append(player)
        
        return sorted(targets, key=lambda x: x['in_degree_centrality'], reverse=True)
