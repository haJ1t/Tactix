"""
Advanced ML Training with Full Premier League Season Data.

Trains all ML models using 380 Premier League matches:
1. Pass Difficulty Model (Random Forest)
2. VAEP Model (Gradient Boosting)  
3. Tactical Pattern Classifier (K-Means + GradientBoosting)
"""
import os
import sys
import pandas as pd
import numpy as np
from collections import defaultdict

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal, init_db
from backend.models.match import Match
from backend.models.team import Team
from backend.models.player import Player
from backend.models.event import Event
from backend.models.pass_event import PassEvent
from backend.services.network_builder import NetworkBuilder
from backend.services.data_cleaner import DataCleaner
from backend.services.ml.vaep_model import VAEPModel
from backend.services.ml.pass_difficulty_model import PassDifficultyModel
from backend.services.ml.tactical_classifier import TacticalPatternClassifier


def get_all_passes_from_db():
    """Get all pass data from database."""
    print("Loading all passes from database...")
    db = SessionLocal()
    try:
        passes = db.query(PassEvent).join(Event).all()
        
        passes_data = []
        for p in passes:
            event = p.event
            if event is None:
                continue
                
            passes_data.append({
                'match_id': event.match_id,
                'event_id': p.event_id,
                'passer_id': p.passer_id,
                'recipient_id': p.recipient_id,
                'team_id': event.team_id,
                'location_x': event.location_x or 60,
                'location_y': event.location_y or 40,
                'end_location_x': p.end_location_x or 60,
                'end_location_y': p.end_location_y or 40,
                'pass_length': p.pass_length,
                'pass_angle': p.pass_angle,
                'pass_outcome': p.pass_outcome,
                'pass_type': p.pass_type,
                'pass_height': p.pass_height,
                'body_part': p.body_part,
                'minute': event.minute,
                'second': event.second,
                'period': event.period,
                'event_type': event.event_type
            })
        
        print(f"  Loaded {len(passes_data):,} passes")
        return pd.DataFrame(passes_data)
    finally:
        db.close()


def get_matches_from_db():
    """Get all matches from database."""
    db = SessionLocal()
    try:
        matches = db.query(Match).all()
        return matches
    finally:
        db.close()


def build_network_features_per_team(passes_df: pd.DataFrame) -> list:
    """Build network features for each team in each match."""
    print("\nBuilding network features per team/match...")
    
    builder = NetworkBuilder()
    classifier = TacticalPatternClassifier()
    
    features_list = []
    
    # Add required name columns if missing
    if 'passer_name' not in passes_df.columns:
        passes_df['passer_name'] = passes_df['passer_id'].apply(lambda x: f'Player {x}')
    if 'recipient_name' not in passes_df.columns:
        passes_df['recipient_name'] = passes_df['recipient_id'].apply(lambda x: f'Player {x}' if pd.notna(x) else None)
    
    # Group by match and team
    grouped = passes_df.groupby(['match_id', 'team_id'])
    total_groups = len(grouped)
    
    for i, ((match_id, team_id), team_passes) in enumerate(grouped):
        if i % 100 == 0:
            print(f"  Processing {i}/{total_groups} team-matches...")
        
        # Get successful passes (None outcome = successful in StatsBomb)
        # Filter: recipient must exist, and outcome is None or 'Complete'
        mask = (
            team_passes['recipient_id'].notna() & 
            (team_passes['pass_outcome'].isna() | (team_passes['pass_outcome'] == 'Complete'))
        )
        successful = team_passes[mask].copy()
        
        if len(successful) < 10:
            continue
        
        # Build network
        try:
            G = builder.build_pass_network(successful)
            
            if G.number_of_nodes() < 5:
                continue
            
            # Get node positions
            node_positions = {}
            for node in G.nodes():
                node_data = G.nodes[node]
                node_positions[node] = (
                    node_data.get('x', 60),
                    node_data.get('y', 40)
                )
            
            # Extract features
            features = classifier.extract_network_features(G, node_positions)
            features['match_id'] = match_id
            features['team_id'] = team_id
            features['pass_count'] = len(successful)
            
            features_list.append(features)
        except Exception as e:
            continue
    
    print(f"  Built {len(features_list)} team-match network features")
    return features_list


def train_pass_difficulty_model(passes_df: pd.DataFrame) -> dict:
    """Train Pass Difficulty Model with full data."""
    print("\n" + "="*60)
    print("TRAINING PASS DIFFICULTY MODEL")
    print("="*60)
    
    model = PassDifficultyModel()
    results = model.train(passes_df)
    
    print(f"  Algorithm: Random Forest")
    print(f"  Samples used: {results['samples_used']:,}")
    print(f"  Accuracy: {results['accuracy']:.2%}")
    
    # Save model
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    model.save_model(os.path.join(models_dir, 'pass_difficulty.joblib'))
    print(f"  Model saved to {models_dir}/pass_difficulty.joblib")
    
    return results


def train_vaep_model(passes_df: pd.DataFrame) -> dict:
    """Train VAEP Model with full data."""
    print("\n" + "="*60)
    print("TRAINING VAEP MODEL")
    print("="*60)
    
    model = VAEPModel()
    results = model.train(passes_df)
    
    print(f"  Algorithm: Gradient Boosting")
    print(f"  Samples used: {results['samples_used']:,}")
    print(f"  Scoring Accuracy: {results['scoring_accuracy']:.2%}")
    print(f"  Conceding Accuracy: {results['conceding_accuracy']:.2%}")
    
    # Save model
    models_dir = 'backend/models/trained'
    model.save_model(os.path.join(models_dir, 'vaep_model.joblib'))
    print(f"  Model saved to {models_dir}/vaep_model.joblib")
    
    return results


def train_tactical_classifier(features_list: list) -> dict:
    """Train Tactical Pattern Classifier with real match data."""
    print("\n" + "="*60)
    print("TRAINING TACTICAL PATTERN CLASSIFIER")
    print("="*60)
    
    if len(features_list) < 50:
        print(f"  Not enough data: {len(features_list)} samples (need 50+)")
        return {'error': 'Not enough data'}
    
    print(f"  Training samples: {len(features_list)}")
    
    # Remove metadata columns for training
    training_features = []
    for f in features_list:
        clean_f = {k: v for k, v in f.items() if k not in ['match_id', 'team_id', 'pass_count']}
        training_features.append(clean_f)
    
    classifier = TacticalPatternClassifier()
    results = classifier.auto_train(training_features)
    
    # Print K-Means results
    print("\n  K-Means Clustering Results:")
    if 'error' not in results.get('kmeans', {}):
        print(f"    ✓ Clusters: {results['kmeans']['n_clusters']}")
        print(f"    ✓ Samples clustered: {results['kmeans']['samples_clustered']}")
        print(f"    ✓ Inertia: {results['kmeans']['inertia']:.2f}")
        
        if 'cluster_stats' in results['kmeans']:
            print("\n    Cluster Statistics:")
            for cluster_name, stats in results['kmeans']['cluster_stats'].items():
                print(f"      {cluster_name}: {stats['size']} samples, "
                      f"forward_ratio: {stats.get('avg_forward_ratio', 0):.2%}, "
                      f"clustering: {stats.get('avg_clustering', 0):.2f}")
    
    # Print GradientBoosting results
    print("\n  GradientBoosting Classification Results:")
    if 'error' not in results.get('gradient_boosting', {}) and 'skipped' not in results.get('gradient_boosting', {}):
        print(f"    ✓ Train Accuracy: {results['gradient_boosting']['train_accuracy']:.2%}")
        print(f"    ✓ Test Accuracy: {results['gradient_boosting']['test_accuracy']:.2%}")
        print(f"    ✓ Pattern Classes: {len(results['gradient_boosting']['classes'])}")
        print(f"    ✓ Classes: {', '.join(results['gradient_boosting']['classes'][:5])}...")
    else:
        msg = results.get('gradient_boosting', {}).get('error') or results.get('gradient_boosting', {}).get('skipped')
        print(f"    ✗ {msg}")
    
    # Save model
    models_dir = 'backend/models/trained'
    classifier.save_model(os.path.join(models_dir, 'tactical_classifier.joblib'))
    print(f"\n  Model saved to {models_dir}/tactical_classifier.joblib")
    
    return results


def analyze_team_styles(features_list: list):
    """Analyze and display team playing styles."""
    print("\n" + "="*60)
    print("TEAM PLAYING STYLE ANALYSIS")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Group features by team
        team_features = defaultdict(list)
        for f in features_list:
            team_id = f.get('team_id')
            if team_id:
                team_features[team_id].append(f)
        
        # Calculate average features per team
        team_styles = []
        for team_id, features in team_features.items():
            team = db.query(Team).filter(Team.team_id == team_id).first()
            team_name = team.team_name if team else f"Team {team_id}"
            
            avg_features = {}
            for key in features[0].keys():
                if key not in ['match_id', 'team_id', 'pass_count'] and isinstance(features[0][key], (int, float)):
                    avg_features[key] = np.mean([f[key] for f in features])
            
            avg_features['team_name'] = team_name
            avg_features['matches_played'] = len(features)
            avg_features['avg_passes'] = np.mean([f['pass_count'] for f in features])
            
            team_styles.append(avg_features)
        
        # Sort by forward ratio (most attacking)
        team_styles.sort(key=lambda x: x.get('forward_ratio', 0), reverse=True)
        
        print("\n  Most Direct/Attacking Teams (by forward pass ratio):")
        for i, t in enumerate(team_styles[:5]):
            print(f"    {i+1}. {t['team_name']}: {t.get('forward_ratio', 0):.1%} forward, "
                  f"{t.get('avg_passes', 0):.0f} avg passes/match")
        
        # Sort by pass volume (possession)
        team_styles.sort(key=lambda x: x.get('avg_passes', 0), reverse=True)
        
        print("\n  Most Possession-Oriented Teams (by pass volume):")
        for i, t in enumerate(team_styles[:5]):
            print(f"    {i+1}. {t['team_name']}: {t.get('avg_passes', 0):.0f} passes/match, "
                  f"{t.get('avg_clustering', 0):.2f} clustering")
        
        # Sort by key player dependency
        team_styles.sort(key=lambda x: x.get('max_betweenness', 0), reverse=True)
        
        print("\n  Most Key-Player Dependent Teams (by max betweenness):")
        for i, t in enumerate(team_styles[:5]):
            print(f"    {i+1}. {t['team_name']}: {t.get('max_betweenness', 0):.3f} betweenness, "
                  f"gini: {t.get('gini_betweenness', 0):.2f}")
        
    finally:
        db.close()


def main():
    """Main training function."""
    print("="*60)
    print("ADVANCED ML TRAINING")
    print("Using Full Premier League 2015/2016 Season (380 matches)")
    print("="*60)
    
    # Initialize database
    init_db()
    
    # Check match count
    matches = get_matches_from_db()
    print(f"\nMatches in database: {len(matches)}")
    
    if len(matches) < 10:
        print("ERROR: Not enough matches in database!")
        print("Run: python scripts/load_full_season.py")
        return
    
    # Load all passes
    passes_df = get_all_passes_from_db()
    
    if len(passes_df) < 1000:
        print("ERROR: Not enough pass data!")
        return
    
    print(f"\nTotal passes: {len(passes_df):,}")
    print(f"Total matches with pass data: {passes_df['match_id'].nunique()}")
    print(f"Total teams: {passes_df['team_id'].nunique()}")
    
    # Train Pass Difficulty Model
    pass_results = train_pass_difficulty_model(passes_df)
    
    # Train VAEP Model
    vaep_results = train_vaep_model(passes_df)
    
    # Build network features for Tactical Classifier
    features_list = build_network_features_per_team(passes_df)
    
    # Train Tactical Classifier
    tactical_results = train_tactical_classifier(features_list)
    
    # Analyze team styles
    if len(features_list) > 50:
        analyze_team_styles(features_list)
    
    # Summary
    print("\n" + "="*60)
    print("✅ ADVANCED ML TRAINING COMPLETE!")
    print("="*60)
    print("\nModels trained:")
    print(f"  1. Pass Difficulty: {pass_results.get('accuracy', 0):.1%} accuracy")
    print(f"  2. VAEP: {vaep_results.get('scoring_accuracy', 0):.1%} scoring accuracy")
    print(f"  3. Tactical Classifier: {tactical_results.get('gradient_boosting', {}).get('test_accuracy', 0):.1%} test accuracy")
    print(f"\nTraining data: {len(passes_df):,} passes from {len(matches)} matches")
    print(f"Network features: {len(features_list)} team-match samples")
    print("\nModels saved to: backend/models/trained/")


if __name__ == '__main__':
    main()
