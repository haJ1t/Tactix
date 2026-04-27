"""
Tactical pattern detection

Detects tactical patterns from network structure and metrics.
"""
import networkx as nx
from typing import Dict, List, Optional, Tuple
import numpy as np


class PatternDetector:
    """Detects tactical patterns from pass networks."""
    
    # Pattern type constants
    KEY_PLAYER_DEPENDENCY = 'KEY_PLAYER_DEPENDENCY'
    WING_OVERLOAD = 'WING_OVERLOAD'
    CENTRAL_BUILDUP = 'CENTRAL_BUILDUP'
    DIRECT_PLAY = 'DIRECT_PLAY'
    POSSESSION_RECYCLING = 'POSSESSION_RECYCLING'
    ASYMMETRIC_PLAY = 'ASYMMETRIC_PLAY'
    
    # Pitch zones (x-coordinates, StatsBomb uses 120yd length)
    DEFENSIVE_THIRD = (0, 40)
    MIDDLE_THIRD = (40, 80)
    ATTACKING_THIRD = (80, 120)
    
    # Lateral zones (y-coordinates, StatsBomb uses 80yd width)
    LEFT_ZONE = (0, 27)
    CENTER_ZONE = (27, 53)
    RIGHT_ZONE = (53, 80)
    
    def __init__(self):
        """Initialize pattern detector."""
        pass
    
    def detect_all_patterns(
        self,
        G: nx.DiGraph,
        metrics: Dict[int, Dict],
        passes_df=None
    ) -> List[Dict]:
        """
        Detect all tactical patterns from the network.

        Args:
            G: Pass network graph
            metrics: Player metrics dictionary
            passes_df: Optional DataFrame with pass data for zone analysis

        Returns:
            List of detected patterns
        """
        patterns = []

        # Check key player dependency
        key_player_pattern = self._detect_key_player_dependency(G, metrics)
        if key_player_pattern:
            patterns.append(key_player_pattern)

        # Detect wing overload
        wing_patterns = self._detect_wing_overload(G, metrics)
        patterns.extend(wing_patterns)

        # Check central buildup
        central_pattern = self._detect_central_buildup(G, metrics)
        if central_pattern:
            patterns.append(central_pattern)

        # Detect direct play
        direct_pattern = self._detect_direct_play(G, metrics)
        if direct_pattern:
            patterns.append(direct_pattern)

        # Check possession recycling
        recycling_pattern = self._detect_possession_recycling(G, metrics)
        if recycling_pattern:
            patterns.append(recycling_pattern)

        # Sort by confidence score
        patterns.sort(key=lambda x: x['confidence_score'], reverse=True)

        return patterns
    
    def _detect_key_player_dependency(
        self, 
        G: nx.DiGraph, 
        metrics: Dict[int, Dict]
    ) -> Optional[Dict]:
        """
        Detect if team is overly dependent on a single player.
        
        High betweenness centrality (>0.25) indicates critical playmaker.
        """
        if not metrics:
            return None

        # Find highest betweenness player
        betweenness_values = {
            pid: m['betweenness_centrality']
            for pid, m in metrics.items()
        }

        if not betweenness_values:
            return None

        max_player = max(betweenness_values, key=betweenness_values.get)
        max_betweenness = betweenness_values[max_player]

        if max_betweenness > 0.20:  # Threshold for dependency
            confidence = min(max_betweenness * 2.5, 1.0)
            player_name = metrics[max_player].get('name', f'Player {max_player}')
            
            return {
                'pattern_type': self.KEY_PLAYER_DEPENDENCY,
                'confidence_score': round(confidence, 2),
                'key_player_id': max_player,
                'key_player_name': player_name,
                'description': (
                    f"High dependency on {player_name} - "
                    f"{max_betweenness:.0%} of passes flow through them"
                ),
                'side': None
            }
        
        return None
    
    def _detect_wing_overload(
        self, 
        G: nx.DiGraph, 
        metrics: Dict[int, Dict]
    ) -> List[Dict]:
        """
        Detect wing overload patterns.
        
        Analyzes player positions to find asymmetric wing focus.
        """
        patterns = []

        # Group players by lateral side
        left_players = []
        right_players = []

        for pid, m in metrics.items():
            y = m.get('avg_y', 40)
            if y < 30:  # Left side
                left_players.append(pid)
            elif y > 50:  # Right side
                right_players.append(pid)

        # Sum edge weights per side
        left_weight = 0
        right_weight = 0
        total_weight = 0

        for u, v, data in G.edges(data=True):
            weight = data.get('weight', 1)
            total_weight += weight

            if v in left_players:
                left_weight += weight
            elif v in right_players:
                right_weight += weight

        if total_weight == 0:
            return patterns

        left_ratio = left_weight / total_weight
        right_ratio = right_weight / total_weight

        # Flag asymmetric wing focus
        if left_ratio > 0.40:
            patterns.append({
                'pattern_type': self.WING_OVERLOAD,
                'confidence_score': round(min(left_ratio * 1.5, 1.0), 2),
                'key_player_id': None,
                'description': f"Left wing overload - {left_ratio:.0%} of passes target left side",
                'side': 'left'
            })
        
        if right_ratio > 0.40:
            patterns.append({
                'pattern_type': self.WING_OVERLOAD,
                'confidence_score': round(min(right_ratio * 1.5, 1.0), 2),
                'key_player_id': None,
                'description': f"Right wing overload - {right_ratio:.0%} of passes target right side",
                'side': 'right'
            })
        
        return patterns
    
    def _detect_central_buildup(
        self, 
        G: nx.DiGraph, 
        metrics: Dict[int, Dict]
    ) -> Optional[Dict]:
        """
        Detect central buildup pattern.
        
        High centrality among players in central positions.
        """
        # Identify central midfield players
        central_players = []
        total_centrality = 0

        for pid, m in metrics.items():
            x = m.get('avg_x', 60)
            y = m.get('avg_y', 40)

            if 25 <= y <= 55 and 35 <= x <= 85:
                central_players.append(pid)
                total_centrality += m.get('degree_centrality', 0)

        if len(central_players) >= 2:
            avg_centrality = total_centrality / len(central_players)
            
            if avg_centrality > 0.25:
                confidence = min(avg_centrality * 2, 1.0)
                return {
                    'pattern_type': self.CENTRAL_BUILDUP,
                    'confidence_score': round(confidence, 2),
                    'key_player_id': None,
                    'description': (
                        f"Strong central buildup - "
                        f"{len(central_players)} central players with high connectivity"
                    ),
                    'side': 'central'
                }
        
        return None
    
    def _detect_direct_play(
        self, 
        G: nx.DiGraph, 
        metrics: Dict[int, Dict]
    ) -> Optional[Dict]:
        """
        Detect direct play pattern.
        
        Low clustering + high forward pass tendency.
        """
        if G.number_of_nodes() < 3:
            return None

        avg_clustering = nx.average_clustering(G)
        density = nx.density(G)

        # Low clustering signals direct
        if avg_clustering < 0.15 and density < 0.5:
            confidence = 1 - avg_clustering  # Lower clustering = more direct
            
            return {
                'pattern_type': self.DIRECT_PLAY,
                'confidence_score': round(min(confidence, 1.0), 2),
                'key_player_id': None,
                'description': (
                    f"Direct playing style - "
                    f"low pass circulation (clustering: {avg_clustering:.2f})"
                ),
                'side': None
            }
        
        return None
    
    def _detect_possession_recycling(
        self, 
        G: nx.DiGraph, 
        metrics: Dict[int, Dict]
    ) -> Optional[Dict]:
        """
        Detect possession recycling pattern.
        
        High reciprocity and clustering among defensive players.
        """
        if G.number_of_nodes() < 3:
            return None

        reciprocity = nx.reciprocity(G)

        # Pick defensive players by position
        defensive_players = [
            pid for pid, m in metrics.items()
            if m.get('avg_x', 60) < 45
        ]

        # Check defensive clustering
        if len(defensive_players) >= 2:
            subgraph = G.subgraph(defensive_players)
            if subgraph.number_of_edges() > 0:
                def_clustering = nx.average_clustering(subgraph)
                
                if def_clustering > 0.20 and reciprocity > 0.15:
                    confidence = (def_clustering + reciprocity) / 2
                    
                    return {
                        'pattern_type': self.POSSESSION_RECYCLING,
                        'confidence_score': round(min(confidence * 2, 1.0), 2),
                        'key_player_id': None,
                        'description': (
                            f"Possession recycling in defense - "
                            f"high ball circulation among back line"
                        ),
                        'side': 'defensive'
                    }
        
        return None
    
    def get_pattern_summary(self, patterns: List[Dict]) -> str:
        """
        Generate human-readable summary of detected patterns.
        
        Returns:
            Summary text
        """
        if not patterns:
            return "No significant tactical patterns detected."
        
        summaries = []
        for p in patterns[:3]:  # Top 3 patterns
            summaries.append(
                f"• {p['description']} (confidence: {p['confidence_score']:.0%})"
            )
        
        return "\n".join(summaries)
