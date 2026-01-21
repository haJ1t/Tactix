"""
XGBoost and LightGBM Training for Improved Performance.

Compares XGBoost, LightGBM with existing RandomForest and GradientBoosting.
"""
import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, f1_score
import xgboost as xgb
import lightgbm as lgb
import joblib
import warnings
warnings.filterwarnings('ignore')

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal, init_db
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
                'passer_id': p.passer_id,
                'recipient_id': p.recipient_id,
                'team_id': event.team_id,
                'location_x': event.location_x or 60,
                'location_y': event.location_y or 40,
                'end_location_x': p.end_location_x or 60,
                'end_location_y': p.end_location_y or 40,
                'pass_length': p.pass_length,
                'pass_outcome': p.pass_outcome,
            })
        
        print(f"  Loaded {len(passes_data):,} passes")
        return pd.DataFrame(passes_data)
    finally:
        db.close()


def compare_pass_difficulty_models(passes_df: pd.DataFrame) -> dict:
    """Compare different algorithms for Pass Difficulty Model."""
    print("\n" + "="*60)
    print("PASS DIFFICULTY - ALGORITHM COMPARISON")
    print("="*60)
    
    # Prepare features
    df = passes_df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y', 'recipient_id'])
    
    df['pass_length'] = np.sqrt(
        (df['end_location_x'] - df['location_x'])**2 + 
        (df['end_location_y'] - df['location_y'])**2
    )
    
    df['dx'] = df['end_location_x'] - df['location_x']
    df['dy'] = df['end_location_y'] - df['location_y']
    df['is_forward'] = (df['dx'] > 0).astype(int)
    df['is_in_final_third'] = (df['location_x'] > 80).astype(int)
    df['is_long_pass'] = (df['pass_length'] > 30).astype(int)
    
    feature_cols = ['location_x', 'location_y', 'end_location_x', 'end_location_y', 
                    'pass_length', 'dx', 'dy', 'is_forward', 'is_in_final_third', 'is_long_pass']
    
    X = df[feature_cols].fillna(0).values
    y = (df['pass_outcome'].isna() | (df['pass_outcome'] == 'Complete')).astype(int).values
    
    # Sample for speed
    if len(X) > 100000:
        idx = np.random.choice(len(X), 100000, replace=False)
        X, y = X[idx], y[idx]
    
    print(f"\n  Samples: {len(X):,}")
    
    # Define models
    models = {
        'Random Forest': RandomForestClassifier(
            n_estimators=200, max_depth=15, min_samples_split=10, 
            min_samples_leaf=2, random_state=42, n_jobs=-1
        ),
        'Gradient Boosting': GradientBoostingClassifier(
            n_estimators=150, max_depth=5, learning_rate=0.1, random_state=42
        ),
        'XGBoost': xgb.XGBClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1, verbosity=0
        ),
        'LightGBM': lgb.LGBMClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1, verbose=-1
        )
    }
    
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results = {}
    
    print("\n  5-Fold Cross-Validation Comparison:")
    print(f"  {'Algorithm':<20} {'Accuracy':<12} {'F1 Score':<12} {'Time':<10}")
    print(f"  {'-'*54}")
    
    import time
    
    for name, model in models.items():
        start = time.time()
        
        acc_scores = cross_val_score(model, X, y, cv=skf, scoring='accuracy', n_jobs=-1)
        f1_scores = cross_val_score(model, X, y, cv=skf, scoring='f1', n_jobs=-1)
        
        elapsed = time.time() - start
        
        results[name] = {
            'accuracy_mean': acc_scores.mean(),
            'accuracy_std': acc_scores.std(),
            'f1_mean': f1_scores.mean(),
            'f1_std': f1_scores.std(),
            'time': elapsed
        }
        
        print(f"  {name:<20} {acc_scores.mean():>10.2%}   {f1_scores.mean():>10.2%}   {elapsed:>7.1f}s")
    
    # Find best model
    best_model_name = max(results, key=lambda x: results[x]['accuracy_mean'])
    print(f"\n  ✅ Best Model: {best_model_name} ({results[best_model_name]['accuracy_mean']:.2%} accuracy)")
    
    # Train and save best model
    best_model = models[best_model_name]
    best_model.fit(X, y)
    
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    
    model_data = {
        'model': best_model,
        'algorithm': best_model_name,
        'feature_cols': feature_cols,
        'accuracy': results[best_model_name]['accuracy_mean']
    }
    joblib.dump(model_data, os.path.join(models_dir, 'pass_difficulty_xgboost.joblib'))
    print(f"  Model saved to {models_dir}/pass_difficulty_xgboost.joblib")
    
    return results


def compare_tactical_classifier_models(passes_df: pd.DataFrame) -> dict:
    """Compare different algorithms for Tactical Classifier."""
    print("\n" + "="*60)
    print("TACTICAL CLASSIFIER - ALGORITHM COMPARISON")
    print("="*60)
    
    # Build features
    print("\n  Building network features...")
    builder = NetworkBuilder()
    classifier = TacticalPatternClassifier()
    
    if 'passer_name' not in passes_df.columns:
        passes_df['passer_name'] = passes_df['passer_id'].apply(lambda x: f'Player {x}')
    if 'recipient_name' not in passes_df.columns:
        passes_df['recipient_name'] = passes_df['recipient_id'].apply(lambda x: f'Player {x}' if pd.notna(x) else None)
    
    features_list = []
    labels = []
    
    grouped = passes_df.groupby(['match_id', 'team_id'])
    
    for (match_id, team_id), team_passes in grouped:
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
            patterns = classifier.detect_patterns_rule_based(features)
            
            if patterns:
                features_list.append(features)
                labels.append(patterns[0]['pattern_type'])
        except:
            continue
    
    print(f"  Built {len(features_list)} samples")
    
    X = pd.DataFrame(features_list).values
    feature_cols = list(pd.DataFrame(features_list).columns)
    
    le = LabelEncoder()
    y = le.fit_transform(labels)
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    print(f"  Classes: {len(le.classes_)}")
    
    # Define models
    models = {
        'Gradient Boosting': GradientBoostingClassifier(
            n_estimators=150, max_depth=3, learning_rate=0.2, random_state=42
        ),
        'XGBoost': xgb.XGBClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.15,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1, verbosity=0
        ),
        'LightGBM': lgb.LGBMClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.15,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1, verbose=-1
        )
    }
    
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results = {}
    
    print("\n  5-Fold Cross-Validation Comparison:")
    print(f"  {'Algorithm':<20} {'Accuracy':<12} {'F1 Score':<12} {'Time':<10}")
    print(f"  {'-'*54}")
    
    import time
    
    for name, model in models.items():
        start = time.time()
        
        acc_scores = cross_val_score(model, X_scaled, y, cv=skf, scoring='accuracy', n_jobs=-1)
        f1_scores = cross_val_score(model, X_scaled, y, cv=skf, scoring='f1_weighted', n_jobs=-1)
        
        elapsed = time.time() - start
        
        results[name] = {
            'accuracy_mean': acc_scores.mean(),
            'accuracy_std': acc_scores.std(),
            'f1_mean': f1_scores.mean(),
            'f1_std': f1_scores.std(),
            'time': elapsed
        }
        
        print(f"  {name:<20} {acc_scores.mean():>10.2%}   {f1_scores.mean():>10.2%}   {elapsed:>7.1f}s")
    
    # Find best
    best_model_name = max(results, key=lambda x: results[x]['accuracy_mean'])
    print(f"\n  ✅ Best Model: {best_model_name} ({results[best_model_name]['accuracy_mean']:.2%} accuracy)")
    
    # Train and save
    best_model = models[best_model_name]
    best_model.fit(X_scaled, y)
    
    models_dir = 'backend/models/trained'
    
    model_data = {
        'classifier': best_model,
        'scaler': scaler,
        'label_encoder': le,
        'algorithm': best_model_name,
        'feature_columns': feature_cols,
        'accuracy': results[best_model_name]['accuracy_mean'],
        'is_trained': True,
        'kmeans_trained': False
    }
    joblib.dump(model_data, os.path.join(models_dir, 'tactical_classifier_xgboost.joblib'))
    print(f"  Model saved to {models_dir}/tactical_classifier_xgboost.joblib")
    
    return results


def main():
    """Main comparison function."""
    print("="*60)
    print("XGBOOST & LIGHTGBM MODEL COMPARISON")
    print("Comparing with Random Forest & Gradient Boosting")
    print("="*60)
    
    init_db()
    passes_df = get_all_passes_from_db()
    
    if len(passes_df) < 1000:
        print("ERROR: Not enough data!")
        return
    
    # Compare Pass Difficulty models
    pass_results = compare_pass_difficulty_models(passes_df)
    
    # Compare Tactical Classifier models
    tactical_results = compare_tactical_classifier_models(passes_df)
    
    # Summary
    print("\n" + "="*60)
    print("✅ MODEL COMPARISON COMPLETE!")
    print("="*60)
    
    print("\n  Pass Difficulty Model Rankings:")
    sorted_pass = sorted(pass_results.items(), key=lambda x: x[1]['accuracy_mean'], reverse=True)
    for i, (name, r) in enumerate(sorted_pass):
        medal = ['🥇', '🥈', '🥉', '  '][i]
        print(f"    {medal} {name}: {r['accuracy_mean']:.2%} accuracy, {r['f1_mean']:.2%} F1")
    
    print("\n  Tactical Classifier Rankings:")
    sorted_tact = sorted(tactical_results.items(), key=lambda x: x[1]['accuracy_mean'], reverse=True)
    for i, (name, r) in enumerate(sorted_tact):
        medal = ['🥇', '🥈', '🥉'][i]
        print(f"    {medal} {name}: {r['accuracy_mean']:.2%} accuracy, {r['f1_mean']:.2%} F1")
    
    print("\n  Best models saved to: backend/models/trained/")


if __name__ == '__main__':
    main()
