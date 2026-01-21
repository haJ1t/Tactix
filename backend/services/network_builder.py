"""
Pass network construction using NetworkX

Builds directed weighted graphs from pass data.
"""
import networkx as nx
import pandas as pd
from typing import Dict, List, Optional, Tuple
import numpy as np


class NetworkBuilder:
    """Builds pass networks from match data."""
    
    def __init__(self):
        """Initialize network builder."""
        pass
    
    def build_pass_network(
        self, 
        passes_df: pd.DataFrame,
        include_positions: bool = True
    ) -> nx.DiGraph:
        """
        Build directed weighted pass network from pass events.
        
        Args:
            passes_df: DataFrame with columns [passer_id, recipient_id, ...] 
            include_positions: Whether to add average positions as node attributes
            
        Returns:
            NetworkX DiGraph with players as nodes and passes as edges
        """
        G = nx.DiGraph()
        
        if passes_df.empty:
            return G
        
        # Count passes between player pairs
        pass_counts = passes_df.groupby(
            ['passer_id', 'recipient_id']
        ).size().reset_index(name='weight')
        
        # Add edges with weights
        for _, row in pass_counts.iterrows():
            passer = int(row['passer_id'])
            recipient = int(row['recipient_id'])
            weight = int(row['weight'])
            
            G.add_edge(passer, recipient, weight=weight)
        
        # Add player names as node attributes
        self._add_player_names(G, passes_df)
        
        # Add player positions as node attributes
        if include_positions:
            self._add_player_positions(G, passes_df)
        
        return G
    
    def _add_player_names(self, G: nx.DiGraph, passes_df: pd.DataFrame) -> None:
        """Add player names as node attributes."""
        # Get unique passer info
        passers = passes_df[['passer_id', 'passer_name']].drop_duplicates()
        for _, row in passers.iterrows():
            player_id = int(row['passer_id'])
            if player_id in G.nodes:
                G.nodes[player_id]['name'] = row['passer_name']
        
        # Get unique recipient info
        recipients = passes_df[['recipient_id', 'recipient_name']].drop_duplicates()
        for _, row in recipients.iterrows():
            player_id = int(row['recipient_id'])
            if player_id in G.nodes and 'name' not in G.nodes[player_id]:
                G.nodes[player_id]['name'] = row['recipient_name']
    
    def _add_player_positions(self, G: nx.DiGraph, passes_df: pd.DataFrame) -> None:
        """Calculate and add average positions as node attributes."""
        # Calculate average position where player made passes from
        passer_positions = passes_df.groupby('passer_id')[
            ['location_x', 'location_y']
        ].mean()
        
        # Calculate average position where player received passes
        recipient_positions = passes_df.groupby('recipient_id')[
            ['end_location_x', 'end_location_y']
        ].mean()
        recipient_positions.columns = ['location_x', 'location_y']
        
        # Combine: average of pass and receive positions
        for player_id in G.nodes:
            x_vals = []
            y_vals = []
            
            if player_id in passer_positions.index:
                x_vals.append(passer_positions.loc[player_id, 'location_x'])
                y_vals.append(passer_positions.loc[player_id, 'location_y'])
            
            if player_id in recipient_positions.index:
                x_vals.append(recipient_positions.loc[player_id, 'location_x'])
                y_vals.append(recipient_positions.loc[player_id, 'location_y'])
            
            if x_vals:
                G.nodes[player_id]['x'] = float(np.mean(x_vals))
                G.nodes[player_id]['y'] = float(np.mean(y_vals))
    
    def filter_by_weight(
        self, 
        G: nx.DiGraph, 
        min_weight: int = 1
    ) -> nx.DiGraph:
        """
        Filter network to only include edges with minimum weight.
        
        Args:
            G: Pass network
            min_weight: Minimum number of passes for edge to be included
            
        Returns:
            Filtered network
        """
        filtered = nx.DiGraph()
        
        for u, v, data in G.edges(data=True):
            if data['weight'] >= min_weight:
                filtered.add_edge(u, v, **data)
        
        # Copy node attributes
        for node in filtered.nodes:
            if node in G.nodes:
                filtered.nodes[node].update(G.nodes[node])
        
        return filtered
    
    def get_edge_list(self, G: nx.DiGraph) -> List[Dict]:
        """
        Convert network edges to list format for JSON serialization.
        
        Returns:
            List of edge dictionaries with source, target, weight
        """
        edges = []
        for u, v, data in G.edges(data=True):
            edges.append({
                'source': u,
                'target': v,
                'weight': data.get('weight', 1)
            })
        return edges
    
    def get_node_list(self, G: nx.DiGraph) -> List[Dict]:
        """
        Convert network nodes to list format for JSON serialization.
        
        Returns:
            List of node dictionaries with id, name, x, y
        """
        nodes = []
        for node, data in G.nodes(data=True):
            nodes.append({
                'id': node,
                'name': data.get('name', f'Player {node}'),
                'x': data.get('x', 60),  # Default to center
                'y': data.get('y', 40),
            })
        return nodes
    
    def to_json(self, G: nx.DiGraph) -> Dict:
        """
        Convert network to JSON-serializable format.
        
        Returns:
            Dictionary with nodes and edges lists
        """
        return {
            'nodes': self.get_node_list(G),
            'edges': self.get_edge_list(G)
        }
    
    def get_network_density(self, G: nx.DiGraph) -> float:
        """Calculate network density."""
        if G.number_of_nodes() < 2:
            return 0.0
        return nx.density(G)
    
    def get_total_passes(self, G: nx.DiGraph) -> int:
        """Get total number of passes in network."""
        return sum(data['weight'] for _, _, data in G.edges(data=True))
    
    def get_unique_connections(self, G: nx.DiGraph) -> int:
        """Get number of unique passing connections."""
        return G.number_of_edges()
