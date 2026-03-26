"""
Counter-Tactic Engine

Generates counter-tactical recommendations based on:
- Detected patterns
- Network metrics
- VAEP values
- Spatial analysis
"""

import pandas as pd
import numpy as np
from typing import List, Dict
import networkx as nx


class CounterTacticEngine:
    """
    Generate counter-tactical recommendations.
    """

    TACTIC_TEMPLATES = {
        'KEY_PLAYER_DEPENDENCY': [
            {
                'action': 'MAN_MARK',
                'template': "Man-mark {player_name} - {betweenness:.0%} of play flows through them. Assign your most disciplined midfielder to shadow them.",
                'priority': 1
            },
            {
                'action': 'PRESS',
                'template': "Trigger aggressive press when {player_name} receives the ball. Cutting their passing options will disrupt the opposition's rhythm.",
                'priority': 1
            },
            {
                'action': 'DOUBLE_TEAM',
                'template': "Double-team {player_name} when they receive in {zone}. Force them to make quick decisions.",
                'priority': 2
            }
        ],
        'WING_OVERLOAD_LEFT': [
            {
                'action': 'REINFORCE_FLANK',
                'template': "Strengthen right defensive flank - opponent overloads left wing with {confidence:.0%} confidence. Consider tucking in right winger to help.",
                'priority': 1
            },
            {
                'action': 'FORCE_DIRECTION',
                'template': "Force play to right side where opponent has weaker connections. Show the ball carrier inside.",
                'priority': 2
            },
            {
                'action': 'EXPLOIT_WEAKNESS',
                'template': "Counter-attack through your left wing - opponent leaves space when overloading their left.",
                'priority': 3
            }
        ],
        'WING_OVERLOAD_RIGHT': [
            {
                'action': 'REINFORCE_FLANK',
                'template': "Strengthen left defensive flank - opponent overloads right wing with {confidence:.0%} confidence. Left-back may need support.",
                'priority': 1
            },
            {
                'action': 'FORCE_DIRECTION',
                'template': "Force play to left side where opponent has weaker connections. Show the ball carrier inside.",
                'priority': 2
            },
            {
                'action': 'EXPLOIT_WEAKNESS',
                'template': "Counter-attack through your right wing - opponent leaves space when overloading their right.",
                'priority': 3
            }
        ],
        'DIRECT_PLAY': [
            {
                'action': 'DROP_DEEP',
                'template': "Consider dropping defensive line to limit space behind - opponent uses direct passes {forward_ratio:.0%} of the time.",
                'priority': 1
            },
            {
                'action': 'PRESS_HIGH',
                'template': "Alternatively, press high to disrupt direct passes before they're played. Force turnovers in their half.",
                'priority': 2
            },
            {
                'action': 'WIN_SECOND_BALLS',
                'template': "Position midfielders to win second balls from long passes. Direct play creates loose ball opportunities.",
                'priority': 2
            }
        ],
        'POSSESSION_RECYCLING': [
            {
                'action': 'PRESS_TRIGGERS',
                'template': "Use press triggers on backward passes - opponent recycles possession {backward_ratio:.0%} backwards. High energy press can force errors.",
                'priority': 1
            },
            {
                'action': 'COMPACT_ZONE',
                'template': "Keep compact midfield shape - deny central passing lanes where they prefer to circulate.",
                'priority': 1
            },
            {
                'action': 'PATIENCE',
                'template': "Stay patient and organized. Possession teams can be frustrated by disciplined defensive shape.",
                'priority': 2
            }
        ],
        'CENTRAL_BUILDUP': [
            {
                'action': 'COMPACT_ZONE',
                'template': "Block central passing channels - {clustering:.0%} clustering in center. Narrow your midfield block.",
                'priority': 1
            },
            {
                'action': 'FORCE_DIRECTION',
                'template': "Force play wide - opponent prefers central progression. Show them the touchline.",
                'priority': 1
            },
            {
                'action': 'MIDFIELD_PRESS',
                'template': "Win the midfield battle - central buildup relies on central midfielders. Win duels in the middle third.",
                'priority': 2
            }
        ],
        'TIKI_TAKA': [
            {
                'action': 'HIGH_PRESS',
                'template': "Implement coordinated high press - tiki-taka teams struggle when pressed early. Don't allow them to settle.",
                'priority': 1
            },
            {
                'action': 'MAN_ORIENT',
                'template': "Consider man-oriented marking in midfield - break their passing triangles by following runners.",
                'priority': 2
            },
            {
                'action': 'DIRECT_COUNTER',
                'template': "When you win the ball, play direct - don't allow them to reorganize. Quick transitions are key.",
                'priority': 2
            }
        ],
        'LONG_BALL': [
            {
                'action': 'AERIAL_DOMINANCE',
                'template': "Ensure aerial dominance - opponent uses long balls {long_pass_ratio:.0%}. Win first headers.",
                'priority': 1
            },
            {
                'action': 'SECOND_BALL',
                'template': "Position midfielders for second balls. Long ball teams concede possession when headers are won.",
                'priority': 1
            },
            {
                'action': 'PRESS_SOURCE',
                'template': "Press the long ball source (goalkeeper/center-backs) to force rushed clearances.",
                'priority': 2
            }
        ],
        'BALANCED_ATTACK': [
            {
                'action': 'STAY_COMPACT',
                'template': "Maintain compact defensive shape - balanced attacks require disciplined defending across all channels.",
                'priority': 1
            },
            {
                'action': 'COMMUNICATION',
                'template': "Emphasize defensive communication - balanced attacks probe for weaknesses. Stay organized.",
                'priority': 2
            }
        ]
    }

    def _normalize_pattern_type(self, raw_pattern_type) -> str:
        """Return a safe string label for rule-based or ML pattern output."""
        if isinstance(raw_pattern_type, str):
            return raw_pattern_type

        if isinstance(raw_pattern_type, np.generic):
            raw_pattern_type = raw_pattern_type.item()

        if raw_pattern_type is None:
            return 'UNKNOWN'

        return str(raw_pattern_type)

    def __init__(self, vaep_model=None, pass_model=None):
        self.vaep_model = vaep_model
        self.pass_model = pass_model

    def generate_recommendations(self,
                                  patterns: List[Dict],
                                  network_metrics: Dict,
                                  network_features: Dict,
                                  player_info: Dict = None) -> List[Dict]:
        """
        Generate prioritized counter-tactical recommendations.
        """
        recommendations = []

        for pattern in patterns:
            pattern_type = self._normalize_pattern_type(pattern.get('pattern_type', pattern.get('type', '')))

            if pattern_type in self.TACTIC_TEMPLATES:
                templates = self.TACTIC_TEMPLATES[pattern_type]

                for template in templates:
                    rec = self._fill_template(
                        template,
                        pattern,
                        network_metrics,
                        network_features,
                        player_info
                    )
                    if rec:
                        recommendations.append(rec)

        # Add metrics-based recommendations
        metrics_recs = self._generate_metrics_recommendations(network_metrics, player_info)
        recommendations.extend(metrics_recs)

        # Remove duplicates based on action type
        seen_actions = set()
        unique_recs = []
        for rec in recommendations:
            key = (rec['tactic_type'], rec.get('target_player_id'))
            if key not in seen_actions:
                seen_actions.add(key)
                unique_recs.append(rec)

        # Sort by priority
        unique_recs = sorted(unique_recs, key=lambda x: x['priority'])

        return unique_recs[:12]  # Top 12 recommendations

    def _fill_template(self, template: Dict, pattern: Dict,
                       metrics: Dict, features: Dict,
                       player_info: Dict) -> Dict:
        """Fill in template with actual values."""

        # Get the key player if relevant
        key_player_id = pattern.get('key_player_id')
        key_player_name = pattern.get('key_player_name', 'Key Player')

        if not key_player_id and 'betweenness' in metrics:
            betweenness = metrics.get('betweenness', {})
            if betweenness:
                key_player_id = max(betweenness, key=betweenness.get)
                if player_info and key_player_id in player_info:
                    key_player_name = player_info[key_player_id].get('name', f'Player {key_player_id}')

        # Build context for formatting
        context = {
            'confidence': pattern.get('confidence_score', 0.5),
            'betweenness': metrics.get('betweenness', {}).get(key_player_id, 0.2) if key_player_id else 0.2,
            'forward_ratio': features.get('forward_ratio', 0.33),
            'backward_ratio': features.get('backward_ratio', 0.2),
            'clustering': features.get('avg_clustering', 0.3),
            'long_pass_ratio': features.get('long_pass_ratio', 0.1),
            'zone': self._get_player_zone(key_player_id, player_info),
            'player_name': key_player_name,
            'jersey': player_info.get(key_player_id, {}).get('jersey', '?') if player_info and key_player_id else '?'
        }

        try:
            recommendation_text = template['template'].format(**context)
        except KeyError:
            recommendation_text = template['template']

        return {
            'tactic_type': template['action'],
            'recommendation': recommendation_text,
            'priority': template['priority'],
            'confidence': pattern.get('confidence_score', 0.5),
            'pattern_type': self._normalize_pattern_type(pattern.get('pattern_type', '')),
            'target_player_id': key_player_id,
            'target_player_name': key_player_name if key_player_id else None
        }

    def _get_player_zone(self, player_id, player_info: Dict) -> str:
        """Determine player's primary zone."""
        if not player_info or not player_id or player_id not in player_info:
            return "central areas"

        pos = player_info[player_id].get('avg_position', {})
        x = pos.get('x', 60)
        y = pos.get('y', 40)

        # Determine zone
        if x < 40:
            x_zone = "defensive third"
        elif x < 80:
            x_zone = "midfield"
        else:
            x_zone = "attacking third"

        if y < 27:
            y_zone = "left"
        elif y > 53:
            y_zone = "right"
        else:
            y_zone = "central"

        return f"{y_zone} {x_zone}"

    def _generate_metrics_recommendations(self, metrics: Dict,
                                          player_info: Dict) -> List[Dict]:
        """Generate recommendations directly from metrics."""
        recommendations = []

        # Find highest betweenness player
        betweenness = metrics.get('betweenness', {})
        if betweenness:
            max_b_player = max(betweenness, key=betweenness.get)
            max_b_value = betweenness[max_b_player]

            if max_b_value > 0.12:
                player_name = 'Key Player'
                if player_info and max_b_player in player_info:
                    player_name = player_info[max_b_player].get('name', f'Player {max_b_player}')

                recommendations.append({
                    'tactic_type': 'DISRUPT_HUB',
                    'recommendation': f"Disrupt {player_name} - highest betweenness centrality ({max_b_value:.2f}). They control the team's passing rhythm.",
                    'priority': 1,
                    'confidence': min(max_b_value * 4, 1.0),
                    'target_player_id': max_b_player,
                    'target_player_name': player_name,
                    'pattern_type': 'METRICS_BASED'
                })

        # Find highest in-degree player (receives most passes)
        in_degree = metrics.get('in_degree_centrality', metrics.get('in_degree', {}))
        if in_degree:
            max_in_player = max(in_degree, key=in_degree.get)
            max_in_value = in_degree[max_in_player]

            if max_in_value > 0.15:
                player_name = 'Target Player'
                if player_info and max_in_player in player_info:
                    player_name = player_info[max_in_player].get('name', f'Player {max_in_player}')

                recommendations.append({
                    'tactic_type': 'BLOCK_TARGET',
                    'recommendation': f"Block passing lanes to {player_name} - primary receiving target ({max_in_value:.0%} in-degree). Cut off the supply.",
                    'priority': 2,
                    'confidence': min(max_in_value * 3, 1.0),
                    'target_player_id': max_in_player,
                    'target_player_name': player_name,
                    'pattern_type': 'METRICS_BASED'
                })

        # Find highest out-degree player (initiates most passes)
        out_degree = metrics.get('out_degree_centrality', metrics.get('out_degree', {}))
        if out_degree:
            max_out_player = max(out_degree, key=out_degree.get)
            max_out_value = out_degree[max_out_player]

            if max_out_value > 0.15:
                player_name = 'Playmaker'
                if player_info and max_out_player in player_info:
                    player_name = player_info[max_out_player].get('name', f'Player {max_out_player}')

                recommendations.append({
                    'tactic_type': 'PRESS_PLAYMAKER',
                    'recommendation': f"Press {player_name} early - they initiate {max_out_value:.0%} of passes. Don't let them dictate tempo.",
                    'priority': 2,
                    'confidence': min(max_out_value * 3, 1.0),
                    'target_player_id': max_out_player,
                    'target_player_name': player_name,
                    'pattern_type': 'METRICS_BASED'
                })

        return recommendations

    def generate_natural_language_summary(self,
                                          patterns: List[Dict],
                                          recommendations: List[Dict]) -> str:
        """
        Generate a natural language tactical briefing.
        """
        summary_parts = []

        # Opening
        summary_parts.append("## Tactical Analysis Summary\n\n")

        # Patterns detected
        if patterns:
            summary_parts.append("### Detected Playing Patterns\n\n")
            for p in patterns[:4]:
                pattern_name = self._normalize_pattern_type(p.get('pattern_type', 'Unknown')).replace('_', ' ').title()
                confidence = p.get('confidence_score', 0)
                description = p.get('description', '')
                summary_parts.append(f"- **{pattern_name}** ({confidence:.0%}): {description}\n")
            summary_parts.append("\n")

        # Key recommendations
        if recommendations:
            summary_parts.append("### Recommended Counter-Tactics\n\n")
            for i, r in enumerate(recommendations[:6], 1):
                priority_label = "🔴" if r['priority'] == 1 else "🟡" if r['priority'] == 2 else "🟢"
                summary_parts.append(f"{priority_label} **{i}.** {r['recommendation']}\n\n")

        return "".join(summary_parts)
