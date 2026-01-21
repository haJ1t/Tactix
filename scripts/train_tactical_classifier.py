"""
Train Tactical Pattern Classifier with K-Means + GradientBoosting.
"""
import os
import sys
import pandas as pd
import numpy as np

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal, init_db
from backend.models.pass_event import PassEvent
from backend.models.event import Event
from backend.models.player import Player
from backend.services.network_builder import NetworkBuilder
from backend.services.data_cleaner import DataCleaner
from backend.services.ml.tactical_classifier import TacticalPatternClassifier


def get_pass_data_from_db():
    """Get all pass data from database."""
    db = SessionLocal()
    try:
        passes = db.query(PassEvent).join(Event).all()
        
        passes_data = []
        for p in passes:
            event = p.event
            passer = db.query(Player).filter(Player.player_id == p.passer_id).first()
            recipient = db.query(Player).filter(Player.player_id == p.recipient_id).first() if p.recipient_id else None
            
            passes_data.append({
                'passer_id': p.passer_id,
                'passer_name': passer.player_name if passer else f'Player {p.passer_id}',
                'recipient_id': p.recipient_id,
                'recipient_name': recipient.player_name if recipient else None,
                'location_x': event.location_x if event else 60,
                'location_y': event.location_y if event else 40,
                'end_location_x': p.end_location_x or 60,
                'end_location_y': p.end_location_y or 40,
                'pass_outcome': p.pass_outcome,
                'team_id': event.team_id if event else None,
            })
        
        return pd.DataFrame(passes_data)
    finally:
        db.close()


def generate_synthetic_training_data(passes_df: pd.DataFrame, n_samples: int = 50):
    """
    Generate synthetic training data by creating variations of network features.
    This simulates having multiple matches to train on.
    """
    cleaner = DataCleaner()
    builder = NetworkBuilder()
    classifier = TacticalPatternClassifier()
    
    # Build real network from actual data
    successful_passes = cleaner.get_successful_passes(passes_df)
    G = builder.build_pass_network(successful_passes)
    
    # Get node positions
    node_positions = {}
    for node in G.nodes():
        node_data = G.nodes[node]
        node_positions[node] = (
            node_data.get('x', 60),
            node_data.get('y', 40)
        )
    
    # Extract real features
    real_features = classifier.extract_network_features(G, node_positions)
    
    # Generate synthetic variations
    features_list = [real_features]
    
    np.random.seed(42)
    
    for i in range(n_samples - 1):
        # Create variation by adding noise and changing some parameters
        variation = real_features.copy()
        
        # Add gaussian noise to numeric features
        for key in variation:
            if isinstance(variation[key], (int, float)):
                noise = np.random.normal(0, abs(variation[key]) * 0.15 + 0.01)
                variation[key] = max(0, min(1, variation[key] + noise))
        
        # Randomly shift playing style characteristics
        style_shift = np.random.choice([
            'direct', 'possession', 'wing_left', 'wing_right', 'central', 'balanced'
        ])
        
        if style_shift == 'direct':
            variation['forward_ratio'] = min(0.8, variation['forward_ratio'] + 0.15)
            variation['backward_ratio'] = max(0.1, variation['backward_ratio'] - 0.1)
        elif style_shift == 'possession':
            variation['backward_ratio'] = min(0.5, variation['backward_ratio'] + 0.1)
            variation['lateral_ratio'] = min(0.4, variation['lateral_ratio'] + 0.1)
            variation['forward_ratio'] = max(0.2, variation['forward_ratio'] - 0.1)
        elif style_shift == 'wing_left':
            variation['lateral_balance'] = max(-0.4, variation['lateral_balance'] - 0.2)
        elif style_shift == 'wing_right':
            variation['lateral_balance'] = min(0.4, variation['lateral_balance'] + 0.2)
        elif style_shift == 'central':
            variation['center_ratio'] = min(0.6, variation['center_ratio'] + 0.15)
            variation['avg_clustering'] = min(0.5, variation['avg_clustering'] + 0.1)
        elif style_shift == 'balanced':
            variation['gini_betweenness'] = max(0.1, variation['gini_betweenness'] - 0.1)
            variation['lateral_balance'] = variation['lateral_balance'] * 0.5
        
        features_list.append(variation)
    
    return features_list


def train_tactical_classifier():
    """Train the Tactical Pattern Classifier with K-Means + GradientBoosting."""
    
    print("="*60)
    print("TRAINING TACTICAL PATTERN CLASSIFIER")
    print("K-Means (unsupervised) + GradientBoosting (supervised)")
    print("="*60)
    
    # Get pass data
    print("\n[1/4] Loading pass data from database...")
    passes_df = get_pass_data_from_db()
    print(f"  Loaded {len(passes_df)} passes")
    
    # Generate synthetic training data
    print("\n[2/4] Generating synthetic training samples...")
    features_list = generate_synthetic_training_data(passes_df, n_samples=100)
    print(f"  Generated {len(features_list)} training samples")
    
    # Train classifier
    print("\n[3/4] Training ML models...")
    classifier = TacticalPatternClassifier()
    results = classifier.auto_train(features_list)
    
    # Print results
    print("\n  K-Means Results:")
    if 'error' not in results.get('kmeans', {}):
        print(f"    ✓ Clusters: {results['kmeans']['n_clusters']}")
        print(f"    ✓ Samples: {results['kmeans']['samples_clustered']}")
        print(f"    ✓ Inertia: {results['kmeans']['inertia']:.2f}")
    else:
        print(f"    ✗ {results['kmeans'].get('error', 'Unknown error')}")
    
    print("\n  GradientBoosting Results:")
    if 'error' not in results.get('gradient_boosting', {}) and 'skipped' not in results.get('gradient_boosting', {}):
        print(f"    ✓ Train Accuracy: {results['gradient_boosting']['train_accuracy']:.2%}")
        print(f"    ✓ Test Accuracy: {results['gradient_boosting']['test_accuracy']:.2%}")
        print(f"    ✓ Classes: {results['gradient_boosting']['classes']}")
    else:
        print(f"    ✗ {results['gradient_boosting'].get('error', results['gradient_boosting'].get('skipped', 'Unknown'))}")
    
    # Save model
    print("\n[4/4] Saving trained model...")
    models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'models', 'trained')
    os.makedirs(models_dir, exist_ok=True)
    classifier.save_model(os.path.join(models_dir, 'tactical_classifier.joblib'))
    print(f"  ✓ Model saved to {models_dir}/tactical_classifier.joblib")
    
    print("\n" + "="*60)
    print("✅ TACTICAL PATTERN CLASSIFIER TRAINING COMPLETE!")
    print("="*60)
    
    return results


if __name__ == '__main__':
    init_db()
    train_tactical_classifier()
