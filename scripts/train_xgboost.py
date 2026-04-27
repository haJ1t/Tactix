"""
XGBoost and LightGBM Training for Improved Performance.

Compares XGBoost, LightGBM with existing RandomForest and GradientBoosting.
"""
import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupKFold, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
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
from backend.models.match import Match
from backend.models.pass_event import PassEvent
from backend.services.network_builder import NetworkBuilder
from backend.services.ml.tactical_classifier import TacticalPatternClassifier
from backend.services.ml.holdout_utils import split_holdout


def get_all_passes_from_db():
    """Get all pass data from database."""
    print("Loading all passes from database...")
    db = SessionLocal()
    try:
        passes = db.query(PassEvent).join(Event).join(Match, Event.match_id == Match.match_id).all()
        
        passes_data = []
        for p in passes:
            event = p.event
            if event is None:
                continue
                
            match = event.match
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
                'pass_type': p.pass_type,
                'pass_height': p.pass_height,
                'body_part': p.body_part,
                'competition': match.competition if match else None,
                'season': match.season if match else None,
            })
        
        print(f"  Loaded {len(passes_data):,} passes")
        return pd.DataFrame(passes_data)
    finally:
        db.close()


def compare_pass_difficulty_models(passes_df: pd.DataFrame, holdout_df: pd.DataFrame = None) -> dict:
    """Compare different algorithms for Pass Difficulty Model."""
    print("\n" + "="*60)
    print("PASS DIFFICULTY - ALGORITHM COMPARISON")
    print("="*60)
    
    # Drop incomplete rows
    df = passes_df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y'])

    # Compute pass features
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
    cat_cols = ['pass_type', 'pass_height', 'body_part']
    
    X_df = df[feature_cols + cat_cols].copy()
    X_df[cat_cols] = X_df[cat_cols].fillna('Unknown')
    y = (df['pass_outcome'].isna() | (df['pass_outcome'] == 'Complete')).astype(int).values
    groups = df['match_id'].values
    
    # Subsample for speed
    sample_idx = np.arange(len(X_df))
    if len(X_df) > 100000:
        sample_idx = np.random.choice(len(X_df), 100000, replace=False)
        X_df, y = X_df.iloc[sample_idx], y[sample_idx]
        groups = groups[sample_idx]

    print(f"\n  Samples: {len(X_df):,}")
    
    def make_pipeline(model):
        preprocessor = ColumnTransformer(
            [('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cat_cols)],
            remainder='passthrough'
        )
        return Pipeline([('preprocess', preprocessor), ('model', model)])

    # Configure candidate models
    models = {
        'Random Forest': make_pipeline(RandomForestClassifier(
            n_estimators=200, max_depth=15, min_samples_split=10,
            min_samples_leaf=2, random_state=42, n_jobs=-1
        )),
        'Gradient Boosting': make_pipeline(GradientBoostingClassifier(
            n_estimators=150, max_depth=5, learning_rate=0.1, random_state=42
        )),
        'XGBoost': make_pipeline(xgb.XGBClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1, verbosity=0
        )),
        'LightGBM': make_pipeline(lgb.LGBMClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1, verbose=-1
        ))
    }
    
    gkf = GroupKFold(n_splits=5)
    results = {}
    
    print("\n  5-Fold Cross-Validation Comparison:")
    print(f"  {'Algorithm':<20} {'Accuracy':<12} {'F1 Score':<12} {'Time':<10}")
    print(f"  {'-'*54}")
    
    import time
    
    for name, model in models.items():
        start = time.time()
        
        acc_scores = cross_val_score(model, X_df, y, cv=gkf, groups=groups, scoring='accuracy', n_jobs=-1)
        f1_scores = cross_val_score(model, X_df, y, cv=gkf, groups=groups, scoring='f1', n_jobs=-1)
        
        elapsed = time.time() - start
        
        results[name] = {
            'accuracy_mean': acc_scores.mean(),
            'accuracy_std': acc_scores.std(),
            'f1_mean': f1_scores.mean(),
            'f1_std': f1_scores.std(),
            'time': elapsed
        }
        
        print(f"  {name:<20} {acc_scores.mean():>10.2%}   {f1_scores.mean():>10.2%}   {elapsed:>7.1f}s")
    
    # Pick best by accuracy
    best_model_name = max(results, key=lambda x: results[x]['accuracy_mean'])
    print(f"\n  ✅ Best Model: {best_model_name} ({results[best_model_name]['accuracy_mean']:.2%} accuracy)")

    # Refit and save winner
    best_model = models[best_model_name]
    best_model.fit(X_df, y)
    
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    
    model_data = {
        'model': best_model,
        'algorithm': best_model_name,
        'feature_cols': feature_cols,
        'cat_cols': cat_cols,
        'accuracy': results[best_model_name]['accuracy_mean']
    }
    joblib.dump(model_data, os.path.join(models_dir, 'pass_difficulty_xgboost.joblib'))
    print(f"  Model saved to {models_dir}/pass_difficulty_xgboost.joblib")
    
    # Holdout evaluation
    if holdout_df is not None and not holdout_df.empty:
        df_hold = holdout_df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y'])
        if not df_hold.empty:
            df_hold['pass_length'] = np.sqrt(
                (df_hold['end_location_x'] - df_hold['location_x'])**2 + 
                (df_hold['end_location_y'] - df_hold['location_y'])**2
            )
            df_hold['dx'] = df_hold['end_location_x'] - df_hold['location_x']
            df_hold['dy'] = df_hold['end_location_y'] - df_hold['location_y']
            df_hold['is_forward'] = (df_hold['dx'] > 0).astype(int)
            df_hold['is_in_final_third'] = (df_hold['location_x'] > 80).astype(int)
            df_hold['is_long_pass'] = (df_hold['pass_length'] > 30).astype(int)
            
            X_hold = df_hold[feature_cols + cat_cols].copy()
            X_hold[cat_cols] = X_hold[cat_cols].fillna('Unknown')
            y_hold = (df_hold['pass_outcome'].isna() | (df_hold['pass_outcome'] == 'Complete')).astype(int).values
            
            y_pred = best_model.predict(X_hold)
            holdout_acc = accuracy_score(y_hold, y_pred)
            holdout_f1 = f1_score(y_hold, y_pred)
            
            print("\n  Holdout Performance (Fixed Split):")
            print(f"    Accuracy: {holdout_acc:.2%}")
            print(f"    F1 Score: {holdout_f1:.2%}")
            
            results['holdout'] = {
                'accuracy': holdout_acc,
                'f1': holdout_f1
            }
    
    return results


def compare_tactical_classifier_models(passes_df: pd.DataFrame, holdout_df: pd.DataFrame = None) -> dict:
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
    
    def build_features(df: pd.DataFrame):
        features_list = []
        labels = []
        groups = []
        
        grouped = df.groupby(['match_id', 'team_id'])
        
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
                    groups.append(match_id)
            except:
                continue
        
        return features_list, labels, groups
    
    features_list, labels, groups = build_features(passes_df)
    
    print(f"  Built {len(features_list)} samples")
    
    X = pd.DataFrame(features_list).values
    feature_cols = list(pd.DataFrame(features_list).columns)
    
    # Encode labels for sklearn
    le = LabelEncoder()
    y = le.fit_transform(labels)

    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print(f"  Classes: {len(le.classes_)}")

    # Configure candidate models
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
    
    gkf = GroupKFold(n_splits=5)
    results = {}
    
    print("\n  5-Fold Cross-Validation Comparison:")
    print(f"  {'Algorithm':<20} {'Accuracy':<12} {'F1 Score':<12} {'Time':<10}")
    print(f"  {'-'*54}")
    
    import time
    
    for name, model in models.items():
        start = time.time()
        
        acc_scores = cross_val_score(model, X_scaled, y, cv=gkf, groups=groups, scoring='accuracy', n_jobs=-1)
        f1_scores = cross_val_score(model, X_scaled, y, cv=gkf, groups=groups, scoring='f1_weighted', n_jobs=-1)
        
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
    
    # Holdout evaluation
    if holdout_df is not None and not holdout_df.empty:
        holdout_features, holdout_labels, _ = build_features(holdout_df)
        if holdout_features:
            X_hold = pd.DataFrame(holdout_features)
            X_hold_scaled = scaler.transform(X_hold)
            y_hold = le.transform(holdout_labels)
            
            best_model.fit(X_scaled, y)
            y_pred = best_model.predict(X_hold_scaled)
            
            holdout_acc = accuracy_score(y_hold, y_pred)
            holdout_f1 = f1_score(y_hold, y_pred, average='weighted')
            
            print("\n  Holdout Performance (Fixed Split):")
            print(f"    Accuracy: {holdout_acc:.2%}")
            print(f"    F1 Score: {holdout_f1:.2%}")
            
            results['holdout'] = {
                'accuracy': holdout_acc,
                'f1': holdout_f1
            }
    
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
    
    train_df, holdout_df, holdout_info = split_holdout(passes_df)
    if holdout_info.get("enabled"):
        print("\n  Holdout Split:")
        print(f"    Rule: competition contains '{holdout_info['competition_contains']}', season contains '{holdout_info['season_contains']}'")
        print(f"    Holdout passes: {holdout_info['holdout_size']:,} from {holdout_info['holdout_matches']} matches")
        print(f"    Train passes: {holdout_info['train_size']:,}")
    
    # Compare Pass Difficulty models
    pass_results = compare_pass_difficulty_models(train_df, holdout_df)
    
    # Compare Tactical Classifier models
    tactical_results = compare_tactical_classifier_models(train_df, holdout_df)
    
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
