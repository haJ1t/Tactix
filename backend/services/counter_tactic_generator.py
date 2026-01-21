"""
Counter-tactic recommendation generator

Generates tactical recommendations based on detected patterns.
"""
from typing import Dict, List, Optional


class CounterTacticGenerator:
    """Generates counter-tactical recommendations."""
    
    # Priority levels
    PRIORITY_HIGH = 1
    PRIORITY_MEDIUM = 2
    PRIORITY_LOW = 3
    
    # Tactic types
    PRESS = 'PRESS'
    MAN_MARK = 'MAN_MARK'
    BLOCK_CHANNEL = 'BLOCK_CHANNEL'
    FORCE_DIRECTION = 'FORCE_DIRECTION'
    COMPACT_ZONE = 'COMPACT_ZONE'
    DROP_DEEP = 'DROP_DEEP'
    HIGH_LINE = 'HIGH_LINE'
    
    def __init__(self):
        """Initialize counter-tactic generator."""
        pass
    
    def generate_counter_tactics(
        self, 
        patterns: List[Dict], 
        metrics: Dict[int, Dict]
    ) -> List[Dict]:
        """
        Generate counter-tactical recommendations based on patterns.
        
        Args:
            patterns: List of detected tactical patterns
            metrics: Player metrics dictionary
            
        Returns:
            List of counter-tactic recommendations
        """
        tactics = []
        
        for pattern in patterns:
            pattern_tactics = self._generate_for_pattern(pattern, metrics)
            tactics.extend(pattern_tactics)
        
        # Sort by priority
        tactics.sort(key=lambda x: x['priority'])
        
        # Remove duplicates and limit
        seen = set()
        unique_tactics = []
        for t in tactics:
            key = (t['tactic_type'], t.get('target_player_id'))
            if key not in seen:
                seen.add(key)
                unique_tactics.append(t)
        
        return unique_tactics[:10]  # Top 10 recommendations
    
    def _generate_for_pattern(
        self, 
        pattern: Dict, 
        metrics: Dict[int, Dict]
    ) -> List[Dict]:
        """Generate tactics for a specific pattern."""
        pattern_type = pattern['pattern_type']
        
        generators = {
            'KEY_PLAYER_DEPENDENCY': self._counter_key_player,
            'WING_OVERLOAD': self._counter_wing_overload,
            'CENTRAL_BUILDUP': self._counter_central_buildup,
            'DIRECT_PLAY': self._counter_direct_play,
            'POSSESSION_RECYCLING': self._counter_possession_recycling,
        }
        
        generator = generators.get(pattern_type)
        if generator:
            return generator(pattern, metrics)
        
        return []
    
    def _counter_key_player(
        self, 
        pattern: Dict, 
        metrics: Dict[int, Dict]
    ) -> List[Dict]:
        """Generate tactics to counter key player dependency."""
        tactics = []
        
        player_id = pattern.get('key_player_id')
        player_name = pattern.get('key_player_name', f'Player {player_id}')
        confidence = pattern.get('confidence_score', 0.5)
        
        # Primary: Man-mark the key player
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.MAN_MARK,
            'recommendation': (
                f"Man-mark {player_name} (#{player_id}) - "
                f"{confidence:.0%} of play flows through them. "
                f"Assign your most disciplined midfielder to shadow them."
            ),
            'priority': self.PRIORITY_HIGH,
            'target_player_id': player_id,
            'target_player_name': player_name,
        })
        
        # Secondary: Press when they receive
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.PRESS,
            'recommendation': (
                f"Trigger press when {player_name} receives the ball. "
                f"Cutting their passing options will disrupt the opposition's rhythm."
            ),
            'priority': self.PRIORITY_HIGH,
            'target_player_id': player_id,
            'target_player_name': player_name,
        })
        
        # Tertiary: Force play away from key player
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.FORCE_DIRECTION,
            'recommendation': (
                f"Force opposition to play away from {player_name}'s zone. "
                f"Block passing lanes to isolate them from the build-up."
            ),
            'priority': self.PRIORITY_MEDIUM,
            'target_player_id': player_id,
            'target_player_name': player_name,
        })
        
        return tactics
    
    def _counter_wing_overload(
        self, 
        pattern: Dict, 
        metrics: Dict[int, Dict]
    ) -> List[Dict]:
        """Generate tactics to counter wing overload."""
        tactics = []
        
        side = pattern.get('side', 'left')
        opposite_side = 'right' if side == 'left' else 'left'
        confidence = pattern.get('confidence_score', 0.5)
        
        # Primary: Strengthen the overloaded flank
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.COMPACT_ZONE,
            'recommendation': (
                f"Strengthen {side} defensive flank - "
                f"opponent overloads the {side} wing ({confidence:.0%} of attacks). "
                f"Consider doubling up with fullback + winger."
            ),
            'priority': self.PRIORITY_HIGH,
            'target_player_id': None,
            'target_player_name': None,
        })
        
        # Secondary: Block the channel
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.BLOCK_CHANNEL,
            'recommendation': (
                f"Block the {side} channel aggressively. "
                f"Force play inside where you can compress space."
            ),
            'priority': self.PRIORITY_MEDIUM,
            'target_player_id': None,
            'target_player_name': None,
        })
        
        # Tertiary: Counter-attack opportunity
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.FORCE_DIRECTION,
            'recommendation': (
                f"Exploit the {opposite_side} side on counter-attacks - "
                f"opponent commits heavily to the {side}, leaving space on the {opposite_side}."
            ),
            'priority': self.PRIORITY_LOW,
            'target_player_id': None,
            'target_player_name': None,
        })
        
        return tactics
    
    def _counter_central_buildup(
        self, 
        pattern: Dict, 
        metrics: Dict[int, Dict]
    ) -> List[Dict]:
        """Generate tactics to counter central buildup."""
        tactics = []
        
        # Primary: Compact the center
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.COMPACT_ZONE,
            'recommendation': (
                "Compact the central zones - opponent prefers central buildup. "
                "Narrow your midfield block to deny passing lanes through the middle."
            ),
            'priority': self.PRIORITY_HIGH,
            'target_player_id': None,
            'target_player_name': None,
        })
        
        # Secondary: Force play wide
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.FORCE_DIRECTION,
            'recommendation': (
                "Force play wide where opponent is less comfortable. "
                "Show the ball carrier to the flanks and press there."
            ),
            'priority': self.PRIORITY_MEDIUM,
            'target_player_id': None,
            'target_player_name': None,
        })
        
        # Identify and target key central players
        central_players = [
            (pid, m) for pid, m in metrics.items()
            if 25 <= m.get('avg_y', 40) <= 55 and 35 <= m.get('avg_x', 60) <= 85
        ]
        
        if central_players:
            # Sort by betweenness
            central_players.sort(
                key=lambda x: x[1].get('betweenness_centrality', 0), 
                reverse=True
            )
            top_central = central_players[0]
            
            tactics.append({
                'pattern_id': pattern.get('pattern_id'),
                'tactic_type': self.PRESS,
                'recommendation': (
                    f"Press {top_central[1].get('name', 'central player')} "
                    f"when they receive - they orchestrate the central play."
                ),
                'priority': self.PRIORITY_MEDIUM,
                'target_player_id': top_central[0],
                'target_player_name': top_central[1].get('name'),
            })
        
        return tactics
    
    def _counter_direct_play(
        self, 
        pattern: Dict, 
        metrics: Dict[int, Dict]
    ) -> List[Dict]:
        """Generate tactics to counter direct playing style."""
        tactics = []
        
        # Primary: Drop deep to win aerial duels
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.DROP_DEEP,
            'recommendation': (
                "Drop your defensive line slightly to win second balls. "
                "Opponent plays direct - focus on winning aerial duels and limiting space behind."
            ),
            'priority': self.PRIORITY_HIGH,
            'target_player_id': None,
            'target_player_name': None,
        })
        
        # Secondary: Win the midfield battle
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.COMPACT_ZONE,
            'recommendation': (
                "Pack the midfield to win second balls after long passes. "
                "Convert turnovers quickly before they can reset."
            ),
            'priority': self.PRIORITY_MEDIUM,
            'target_player_id': None,
            'target_player_name': None,
        })
        
        # Find target man (high in-degree, forward position)
        target_men = [
            (pid, m) for pid, m in metrics.items()
            if m.get('avg_x', 60) > 70 and m.get('in_degree_centrality', 0) > 0.15
        ]
        
        if target_men:
            target_men.sort(
                key=lambda x: x[1].get('in_degree_centrality', 0), 
                reverse=True
            )
            target = target_men[0]
            
            tactics.append({
                'pattern_id': pattern.get('pattern_id'),
                'tactic_type': self.MAN_MARK,
                'recommendation': (
                    f"Tight marking on {target[1].get('name', 'target striker')} - "
                    f"they're the focal point of direct balls. Don't let them turn."
                ),
                'priority': self.PRIORITY_HIGH,
                'target_player_id': target[0],
                'target_player_name': target[1].get('name'),
            })
        
        return tactics
    
    def _counter_possession_recycling(
        self, 
        pattern: Dict, 
        metrics: Dict[int, Dict]
    ) -> List[Dict]:
        """Generate tactics to counter possession recycling."""
        tactics = []
        
        # Primary: High press to disrupt buildup
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.HIGH_LINE,
            'recommendation': (
                "Press high when they recycle possession in defense. "
                "They're comfortable building from the back - deny them time."
            ),
            'priority': self.PRIORITY_HIGH,
            'target_player_id': None,
            'target_player_name': None,
        })
        
        # Secondary: Force long balls
        tactics.append({
            'pattern_id': pattern.get('pattern_id'),
            'tactic_type': self.PRESS,
            'recommendation': (
                "Aggressive pressing on center-backs to force long balls. "
                "They want to play short - make it uncomfortable."
            ),
            'priority': self.PRIORITY_MEDIUM,
            'target_player_id': None,
            'target_player_name': None,
        })
        
        return tactics
    
    def format_recommendations(self, tactics: List[Dict]) -> str:
        """
        Format tactics into readable text.
        
        Returns:
            Formatted recommendation text
        """
        if not tactics:
            return "No specific counter-tactics recommended."
        
        lines = ["## Counter-Tactical Recommendations\n"]
        
        priority_labels = {
            self.PRIORITY_HIGH: "🔴 HIGH PRIORITY",
            self.PRIORITY_MEDIUM: "🟡 MEDIUM PRIORITY", 
            self.PRIORITY_LOW: "🟢 LOW PRIORITY",
        }
        
        current_priority = None
        for t in tactics:
            priority = t['priority']
            if priority != current_priority:
                lines.append(f"\n### {priority_labels.get(priority, 'Other')}\n")
                current_priority = priority
            
            lines.append(f"• {t['recommendation']}\n")
        
        return "\n".join(lines)
