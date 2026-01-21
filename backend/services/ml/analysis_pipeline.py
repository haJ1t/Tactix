"""
Analysis Pipeline

Complete analysis pipeline integrating:
- Pass network construction
- Network metrics
- VAEP action valuation
- Pass difficulty weighting
- Tactical pattern detection
- Counter-tactic generation
"""

import pandas as pd
import numpy as np
import networkx as nx
from typing import Dict, List, Optional
import os
import sys

# Add parent path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.network_builder import NetworkBuilder
from services.metrics_calculator import MetricsCalculator
from services.data_cleaner import DataCleaner
from services.ml.vaep_model import VAEPModel
from services.ml.pass_difficulty_model import PassDifficultyModel
from services.ml.tactical_classifier import TacticalPatternClassifier
from services.ml.counter_tactic_engine import CounterTacticEngine


class MLAnalysisPipeline:
    """
    Complete ML-enhanced analysis pipeline.
    """

    def __init__(self, models_dir: str = None):
        self.vaep_model = VAEPModel()
        self.pass_model = PassDifficultyModel()
        self.pattern_classifier = TacticalPatternClassifier()
        self.counter_engine = CounterTacticEngine(
            vaep_model=self.vaep_model,
            pass_model=self.pass_model
        )
        self.network_builder = NetworkBuilder()
        self.metrics_calculator = MetricsCalculator()
        self.data_cleaner = DataCleaner()

        # Auto-detect models directory if not provided
        if models_dir is None:
            # Try default location
            default_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                'models', 'trained'
            )
            if os.path.exists(default_dir):
                models_dir = default_dir
        
        # Load pre-trained models if available
        if models_dir and os.path.exists(models_dir):
            self._load_models(models_dir)

    def _load_models(self, models_dir: str):
        """Load pre-trained models."""
        vaep_path = os.path.join(models_dir, 'vaep_model.joblib')
        pass_path = os.path.join(models_dir, 'pass_difficulty.joblib')
        pattern_path = os.path.join(models_dir, 'tactical_classifier.joblib')

        if os.path.exists(vaep_path):
            self.vaep_model.load_model(vaep_path)
        if os.path.exists(pass_path):
            self.pass_model.load_model(pass_path)
        if os.path.exists(pattern_path):
            self.pattern_classifier.load_model(pattern_path)

    def analyze_passes(self, passes_df: pd.DataFrame,
                       player_info: Dict = None) -> Dict:
        """
        Run complete analysis on pass data.

        Args:
            passes_df: DataFrame with pass data
            player_info: Optional dict of player_id -> player info

        Returns:
            Complete analysis results
        """
        # Get successful passes only
        successful_passes = self.data_cleaner.get_successful_passes(passes_df)

        # Build pass network
        G = self.network_builder.build_pass_network(successful_passes)

        if G.number_of_nodes() == 0:
            return self._empty_result()

        # Get node positions (average positions)
        node_positions = {}
        for node in G.nodes():
            node_data = G.nodes[node]
            node_positions[node] = (
                node_data.get('x', 60),
                node_data.get('y', 40)
            )

        # Calculate network metrics
        metrics = self.metrics_calculator.calculate_all_metrics(G)
        network_stats = self.metrics_calculator.get_network_statistics(G)

        # Calculate VAEP values for passes
        vaep_df = self.vaep_model.calculate_vaep(passes_df)
        vaep_summary = {
            'total_offensive_value': float(vaep_df['offensive_value'].sum()),
            'total_defensive_value': float(vaep_df['defensive_value'].sum()),
            'total_vaep': float(vaep_df['vaep_value'].sum()),
            'avg_vaep': float(vaep_df['vaep_value'].mean()),
            'top_valued_passes': vaep_df.nlargest(5, 'vaep_value')[
                ['vaep_value', 'offensive_value', 'location_x', 'location_y']
            ].to_dict('records')
        }

        # Calculate pass difficulty
        pass_values = self.pass_model.calculate_pass_value(passes_df, self.vaep_model)
        passes_df = passes_df.copy()
        passes_df['ml_pass_value'] = pass_values

        # Extract network features for pattern classification
        features = self.pattern_classifier.extract_network_features(G, node_positions)

        # Detect tactical patterns (ML + rule-based)
        patterns = self.pattern_classifier.predict_patterns(features)

        # Build player info dict from metrics if not provided
        if not player_info:
            player_info = {}
            for player_id, player_metrics in metrics.items():
                player_info[player_id] = {
                    'name': player_metrics.get('name', f'Player {player_id}'),
                    'avg_position': {
                        'x': player_metrics.get('avg_x', 60),
                        'y': player_metrics.get('avg_y', 40)
                    }
                }

        # Convert metrics dict to format expected by counter engine
        metrics_for_tactics = {
            'betweenness': {pid: m['betweenness_centrality'] for pid, m in metrics.items()},
            'in_degree_centrality': {pid: m['in_degree_centrality'] for pid, m in metrics.items()},
            'out_degree_centrality': {pid: m['out_degree_centrality'] for pid, m in metrics.items()},
            'pagerank': {pid: m['pagerank'] for pid, m in metrics.items()}
        }

        # Generate counter-tactical recommendations
        recommendations = self.counter_engine.generate_recommendations(
            patterns, metrics_for_tactics, features, player_info
        )

        # Generate natural language summary
        summary = self.counter_engine.generate_natural_language_summary(
            patterns, recommendations
        )

        return {
            'network': {
                'nodes': self.network_builder.get_node_list(G),
                'edges': self.network_builder.get_edge_list(G),
                'positions': node_positions
            },
            'network_statistics': network_stats,
            'player_metrics': list(metrics.values()),
            'patterns': patterns,
            'counter_tactics': recommendations,
            'vaep_summary': vaep_summary,
            'network_features': features,
            'summary': summary,
            'ml_info': {
                'vaep_trained': self.vaep_model.is_trained,
                'pass_model_trained': self.pass_model.is_trained,
                'pattern_classifier_trained': self.pattern_classifier.is_trained
            }
        }

    def _empty_result(self) -> Dict:
        """Return empty result structure."""
        return {
            'network': {'nodes': [], 'edges': [], 'positions': {}},
            'network_statistics': {},
            'player_metrics': [],
            'patterns': [],
            'counter_tactics': [],
            'vaep_summary': {},
            'network_features': {},
            'summary': 'No data available for analysis.',
            'ml_info': {
                'vaep_trained': False,
                'pass_model_trained': False,
                'pattern_classifier_trained': False
            }
        }

    def train_models(self, training_passes: pd.DataFrame,
                     training_actions: pd.DataFrame = None) -> Dict:
        """
        Train all ML models on provided data.

        Args:
            training_passes: DataFrame with pass data for training
            training_actions: Optional DataFrame with all actions for VAEP

        Returns:
            Training results for each model
        """
        results = {}

        # Train VAEP model
        if training_actions is not None and len(training_actions) > 100:
            try:
                vaep_results = self.vaep_model.train(training_actions)
                results['vaep'] = vaep_results
            except Exception as e:
                results['vaep'] = {'error': str(e)}
        else:
            results['vaep'] = {'skipped': 'Not enough action data'}

        # Train pass difficulty model
        if len(training_passes) > 50:
            try:
                pass_results = self.pass_model.train(training_passes)
                results['pass_difficulty'] = pass_results
            except Exception as e:
                results['pass_difficulty'] = {'error': str(e)}
        else:
            results['pass_difficulty'] = {'skipped': 'Not enough pass data'}

        return results

    def save_models(self, models_dir: str):
        """Save all trained models."""
        os.makedirs(models_dir, exist_ok=True)

        self.vaep_model.save_model(os.path.join(models_dir, 'vaep_model.joblib'))
        self.pass_model.save_model(os.path.join(models_dir, 'pass_difficulty.joblib'))
        self.pattern_classifier.save_model(os.path.join(models_dir, 'tactical_classifier.joblib'))

    def get_player_rankings(self, metrics: List[Dict],
                            vaep_totals: pd.DataFrame = None) -> pd.DataFrame:
        """
        Create comprehensive player rankings combining metrics and VAEP.
        """
        df = pd.DataFrame(metrics)

        if vaep_totals is not None and len(vaep_totals) > 0:
            df = df.merge(
                vaep_totals[['player_id', 'vaep_value']],
                on='player_id',
                how='left'
            )
            df['vaep_value'] = df['vaep_value'].fillna(0)
        else:
            df['vaep_value'] = 0

        # Create composite score
        df['composite_score'] = (
            df['betweenness_centrality'] * 0.25 +
            df['pagerank'] * 0.25 +
            df['degree_centrality'] * 0.2 +
            df['vaep_value'].clip(0, 1) * 0.3
        )

        return df.sort_values('composite_score', ascending=False)
