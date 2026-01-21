"""
Advanced ML Training with Hyperparameter Tuning.

Uses GridSearchCV and RandomizedSearchCV to find optimal parameters.
"""
import os
import sys
import pandas as pd
import numpy as np
from collections import defaultdict
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report
import joblib
import warnings
warnings.filterwarnings('ignore')

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal, init_db
from backend.models.match import Match
from backend.models.event import Event
from backend.models.pass_event import PassEvent
from backend.services.network_builder import NetworkBuilder
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
            })
        
        print(f"  Loaded {len(passes_data):,} passes")
        return pd.DataFrame(passes_data)
    finally:
        db.close()


def train_pass_difficulty_with_tuning(passes_df: pd.DataFrame) -> dict:
    """Train Pass Difficulty Model with hyperparameter tuning."""
    print("\n" + "="*60)
    print("PASS DIFFICULTY MODEL - HYPERPARAMETER TUNING")
    print("="*60)
    
    # Prepare features
    df = passes_df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y', 'recipient_id'])
    
    # Calculate pass length if missing
    if 'pass_length' not in df.columns or df['pass_length'].isna().all():
        df['pass_length'] = np.sqrt(
            (df['end_location_x'] - df['location_x'])**2 + 
            (df['end_location_y'] - df['location_y'])**2
        )
    
    # Feature engineering
    df['dx'] = df['end_location_x'] - df['location_x']
    df['dy'] = df['end_location_y'] - df['location_y']
    df['is_forward'] = (df['dx'] > 0).astype(int)
    df['is_in_final_third'] = (df['location_x'] > 80).astype(int)
    df['is_long_pass'] = (df['pass_length'] > 30).astype(int)
    
    feature_cols = ['location_x', 'location_y', 'end_location_x', 'end_location_y', 
                    'pass_length', 'dx', 'dy', 'is_forward', 'is_in_final_third', 'is_long_pass']
    
    X = df[feature_cols].fillna(0)
    # Target: 1 = successful (no outcome or Complete), 0 = failed
    y = (df['pass_outcome'].isna() | (df['pass_outcome'] == 'Complete')).astype(int)
    
    print(f"  Samples: {len(X):,}")
    print(f"  Features: {len(feature_cols)}")
    print(f"  Class balance: {y.sum()/len(y):.1%} successful")
    
    # Sample for faster tuning (use 50k samples max)
    if len(X) > 50000:
        sample_idx = np.random.choice(len(X), 50000, replace=False)
        X_sample = X.iloc[sample_idx]
        y_sample = y.iloc[sample_idx]
    else:
        X_sample = X
        y_sample = y
    
    # Hyperparameter grid
    param_grid = {
        'n_estimators': [50, 100, 200],
        'max_depth': [5, 10, 15, None],
        'min_samples_split': [2, 5, 10],
        'min_samples_leaf': [1, 2, 4]
    }
    
    print("\n  Grid Search Parameters:")
    for key, values in param_grid.items():
        print(f"    {key}: {values}")
    
    print("\n  Running GridSearchCV (this may take a few minutes)...")
    
    rf = RandomForestClassifier(random_state=42, n_jobs=-1)
    
    grid_search = GridSearchCV(
        rf, 
        param_grid, 
        cv=3, 
        scoring='accuracy',
        n_jobs=-1,
        verbose=0
    )
    
    grid_search.fit(X_sample, y_sample)
    
    print("\n  Best Parameters:")
    for key, value in grid_search.best_params_.items():
        print(f"    {key}: {value}")
    
    print(f"\n  Best CV Score: {grid_search.best_score_:.2%}")
    
    # Train final model with best params on full data
    print("\n  Training final model on full data...")
    best_model = RandomForestClassifier(**grid_search.best_params_, random_state=42, n_jobs=-1)
    best_model.fit(X, y)
    
    # Cross-validation on full model
    cv_scores = cross_val_score(best_model, X, y, cv=5, scoring='accuracy', n_jobs=-1)
    print(f"  5-Fold CV Accuracy: {cv_scores.mean():.2%} (+/- {cv_scores.std()*2:.2%})")
    
    # Save model
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    
    model_data = {
        'model': best_model,
        'best_params': grid_search.best_params_,
        'cv_scores': cv_scores,
        'feature_cols': feature_cols
    }
    joblib.dump(model_data, os.path.join(models_dir, 'pass_difficulty_tuned.joblib'))
    print(f"  Model saved to {models_dir}/pass_difficulty_tuned.joblib")
    
    return {
        'best_params': grid_search.best_params_,
        'best_cv_score': grid_search.best_score_,
        'final_cv_mean': cv_scores.mean(),
        'final_cv_std': cv_scores.std()
    }


def train_tactical_classifier_with_tuning(passes_df: pd.DataFrame) -> dict:
    """Train Tactical Pattern Classifier with hyperparameter tuning."""
    print("\n" + "="*60)
    print("TACTICAL CLASSIFIER - HYPERPARAMETER TUNING")
    print("="*60)
    
    # Build network features
    print("\n  Building network features per team/match...")
    builder = NetworkBuilder()
    classifier = TacticalPatternClassifier()
    
    # Add required name columns
    if 'passer_name' not in passes_df.columns:
        passes_df['passer_name'] = passes_df['passer_id'].apply(lambda x: f'Player {x}')
    if 'recipient_name' not in passes_df.columns:
        passes_df['recipient_name'] = passes_df['recipient_id'].apply(lambda x: f'Player {x}' if pd.notna(x) else None)
    
    features_list = []
    grouped = passes_df.groupby(['match_id', 'team_id'])
    
    for i, ((match_id, team_id), team_passes) in enumerate(grouped):
        # Get successful passes
        mask = (
            team_passes['recipient_id'].notna() & 
            (team_passes['pass_outcome'].isna() | (team_passes['pass_outcome'] == 'Complete'))
        )
        successful = team_passes[mask].copy()
        
        if len(successful) < 10:
            continue
        
        try:
            G = builder.build_pass_network(successful)
            if G.number_of_nodes() < 5:
                continue
            
            node_positions = {}
            for node in G.nodes():
                node_data = G.nodes[node]
                node_positions[node] = (node_data.get('x', 60), node_data.get('y', 40))
            
            features = classifier.extract_network_features(G, node_positions)
            features_list.append(features)
        except:
            continue
    
    print(f"  Built {len(features_list)} network feature samples")
    
    if len(features_list) < 50:
        return {'error': 'Not enough data'}
    
    # Prepare data for classification
    X = pd.DataFrame(features_list)
    feature_cols = list(X.columns)
    
    # Generate pseudo-labels using rule-based detection
    labels = []
    for features in features_list:
        patterns = classifier.detect_patterns_rule_based(features)
        if patterns:
            labels.append(patterns[0]['pattern_type'])
        else:
            labels.append('BALANCED_ATTACK')
    
    y = pd.Series(labels)
    
    print(f"  Samples: {len(X)}")
    print(f"  Features: {len(feature_cols)}")
    print(f"  Classes: {y.nunique()}")
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # ======================================
    # K-MEANS HYPERPARAMETER TUNING
    # ======================================
    print("\n  [1/2] K-Means Cluster Optimization...")
    
    inertias = []
    silhouette_scores = []
    k_range = range(3, 10)
    
    from sklearn.metrics import silhouette_score
    
    for k in k_range:
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels_km = kmeans.fit_predict(X_scaled)
        inertias.append(kmeans.inertia_)
        silhouette_scores.append(silhouette_score(X_scaled, labels_km))
    
    best_k = k_range[np.argmax(silhouette_scores)]
    print(f"    Optimal clusters: {best_k} (silhouette: {max(silhouette_scores):.3f})")
    
    # Train final K-Means
    final_kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    final_kmeans.fit(X_scaled)
    
    # ======================================
    # GRADIENT BOOSTING HYPERPARAMETER TUNING
    # ======================================
    print("\n  [2/2] GradientBoosting Hyperparameter Tuning...")
    
    param_grid = {
        'n_estimators': [50, 100, 150],
        'max_depth': [3, 5, 7],
        'learning_rate': [0.05, 0.1, 0.2],
        'min_samples_split': [2, 5],
        'min_samples_leaf': [1, 2]
    }
    
    print("    Grid Search Parameters:")
    for key, values in param_grid.items():
        print(f"      {key}: {values}")
    
    print("\n    Running RandomizedSearchCV...")
    
    gb = GradientBoostingClassifier(random_state=42)
    
    random_search = RandomizedSearchCV(
        gb,
        param_grid,
        n_iter=30,
        cv=3,
        scoring='accuracy',
        random_state=42,
        n_jobs=-1,
        verbose=0
    )
    
    random_search.fit(X_scaled, y)
    
    print("\n    Best Parameters:")
    for key, value in random_search.best_params_.items():
        print(f"      {key}: {value}")
    
    print(f"\n    Best CV Score: {random_search.best_score_:.2%}")
    
    # Cross-validation
    cv_scores = cross_val_score(random_search.best_estimator_, X_scaled, y, cv=5, scoring='accuracy')
    print(f"    5-Fold CV Accuracy: {cv_scores.mean():.2%} (+/- {cv_scores.std()*2:.2%})")
    
    # Save models
    models_dir = 'backend/models/trained'
    
    model_data = {
        'classifier': random_search.best_estimator_,
        'kmeans': final_kmeans,
        'scaler': scaler,
        'best_params': random_search.best_params_,
        'optimal_k': best_k,
        'cv_scores': cv_scores,
        'feature_columns': feature_cols,
        'is_trained': True,
        'kmeans_trained': True
    }
    joblib.dump(model_data, os.path.join(models_dir, 'tactical_classifier_tuned.joblib'))
    print(f"\n  Model saved to {models_dir}/tactical_classifier_tuned.joblib")
    
    return {
        'kmeans': {
            'optimal_k': best_k,
            'best_silhouette': max(silhouette_scores)
        },
        'gradient_boosting': {
            'best_params': random_search.best_params_,
            'best_cv_score': random_search.best_score_,
            'final_cv_mean': cv_scores.mean(),
            'final_cv_std': cv_scores.std()
        }
    }


def main():
    """Main training function with hyperparameter tuning."""
    print("="*60)
    print("ML TRAINING WITH HYPERPARAMETER TUNING")
    print("GridSearchCV + RandomizedSearchCV + Cross-Validation")
    print("="*60)
    
    # Initialize database
    init_db()
    
    # Load passes
    passes_df = get_all_passes_from_db()
    
    if len(passes_df) < 1000:
        print("ERROR: Not enough pass data!")
        return
    
    print(f"\nTotal passes: {len(passes_df):,}")
    print(f"Total matches: {passes_df['match_id'].nunique()}")
    
    # Train Pass Difficulty with tuning
    pass_results = train_pass_difficulty_with_tuning(passes_df)
    
    # Train Tactical Classifier with tuning
    tactical_results = train_tactical_classifier_with_tuning(passes_df)
    
    # Summary
    print("\n" + "="*60)
    print("✅ HYPERPARAMETER TUNING COMPLETE!")
    print("="*60)
    
    print("\nPass Difficulty Model:")
    print(f"  Best Params: {pass_results['best_params']}")
    print(f"  CV Accuracy: {pass_results['final_cv_mean']:.2%} (+/- {pass_results['final_cv_std']*2:.2%})")
    
    print("\nTactical Classifier:")
    print(f"  Optimal K-Means Clusters: {tactical_results['kmeans']['optimal_k']}")
    print(f"  Best GB Params: {tactical_results['gradient_boosting']['best_params']}")
    print(f"  CV Accuracy: {tactical_results['gradient_boosting']['final_cv_mean']:.2%} (+/- {tactical_results['gradient_boosting']['final_cv_std']*2:.2%})")
    
    print("\nTuned models saved to: backend/models/trained/")


if __name__ == '__main__':
    main()
