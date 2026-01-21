"""
Ensemble Model for Maximum Performance.

Combines multiple models using:
- Voting Classifier (hard/soft voting)
- Stacking Classifier
- Blending with meta-learner
"""
import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import StratifiedKFold, cross_val_score, cross_val_predict
from sklearn.ensemble import (
    RandomForestClassifier, 
    GradientBoostingClassifier,
    VotingClassifier,
    StackingClassifier,
    AdaBoostClassifier,
    ExtraTreesClassifier
)
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
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
                'minute': event.minute,
                'second': event.second,
                'period': event.period,
            })
        
        print(f"  Loaded {len(passes_data):,} passes")
        return pd.DataFrame(passes_data)
    finally:
        db.close()


def prepare_features(df: pd.DataFrame) -> tuple:
    """Prepare enhanced features for ensemble."""
    df = df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y', 'recipient_id'])
    
    # Basic features
    df['pass_length'] = np.sqrt(
        (df['end_location_x'] - df['location_x'])**2 + 
        (df['end_location_y'] - df['location_y'])**2
    )
    df['dx'] = df['end_location_x'] - df['location_x']
    df['dy'] = df['end_location_y'] - df['location_y']
    df['is_forward'] = (df['dx'] > 5).astype(int)
    df['is_backward'] = (df['dx'] < -5).astype(int)
    df['is_long_pass'] = (df['pass_length'] > 25).astype(int)
    
    # Pressure features
    df['distance_to_goal'] = 120 - df['location_x']
    df['in_final_third'] = (df['location_x'] >= 80).astype(int)
    df['in_box'] = ((df['location_x'] > 102) & (np.abs(df['location_y'] - 40) < 22)).astype(int)
    
    # Game state
    df['normalized_minute'] = df['minute'] / 90
    df['is_late_game'] = (df['minute'] >= 75).astype(int)
    
    feature_cols = [
        'location_x', 'location_y', 'end_location_x', 'end_location_y',
        'pass_length', 'dx', 'dy', 'is_forward', 'is_backward', 'is_long_pass',
        'distance_to_goal', 'in_final_third', 'in_box',
        'normalized_minute', 'is_late_game'
    ]
    
    X = df[feature_cols].fillna(0).values
    y = (df['pass_outcome'].isna() | (df['pass_outcome'] == 'Complete')).astype(int).values
    
    return X, y, feature_cols


def train_ensemble_models(X: np.ndarray, y: np.ndarray) -> dict:
    """Train and compare ensemble methods."""
    print("\n" + "="*60)
    print("ENSEMBLE MODEL TRAINING")
    print("="*60)
    
    # Sample for speed
    if len(X) > 100000:
        idx = np.random.choice(len(X), 100000, replace=False)
        X, y = X[idx], y[idx]
    
    print(f"\n  Samples: {len(X):,}")
    
    # Base models
    rf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    gb = GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
    xgb_clf = xgb.XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbosity=0)
    lgb_clf = lgb.LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1)
    et = ExtraTreesClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    
    # ==========================================
    # 1. VOTING CLASSIFIER
    # ==========================================
    print("\n  [1/4] Training Voting Classifiers...")
    
    # Hard voting
    hard_voting = VotingClassifier(
        estimators=[
            ('rf', rf),
            ('xgb', xgb_clf),
            ('lgb', lgb_clf)
        ],
        voting='hard',
        n_jobs=-1
    )
    
    # Soft voting (probability-based)
    soft_voting = VotingClassifier(
        estimators=[
            ('rf', RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)),
            ('xgb', xgb.XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbosity=0)),
            ('lgb', lgb.LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1))
        ],
        voting='soft',
        n_jobs=-1
    )
    
    # ==========================================
    # 2. STACKING CLASSIFIER
    # ==========================================
    print("  [2/4] Training Stacking Classifier...")
    
    stacking = StackingClassifier(
        estimators=[
            ('rf', RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)),
            ('xgb', xgb.XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbosity=0)),
            ('lgb', lgb.LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1)),
            ('et', ExtraTreesClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1))
        ],
        final_estimator=LogisticRegression(max_iter=1000),
        cv=3,
        n_jobs=-1
    )
    
    # ==========================================
    # 3. BLENDING (Manual)
    # ==========================================
    print("  [3/4] Training Blending Ensemble...")
    
    # We'll implement blending in the comparison
    
    # ==========================================
    # 4. COMPARE ALL METHODS
    # ==========================================
    print("  [4/4] Comparing all ensemble methods...\n")
    
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    
    models = {
        'Random Forest (Base)': RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1),
        'XGBoost (Base)': xgb.XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbosity=0),
        'LightGBM (Base)': lgb.LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1),
        'Hard Voting': hard_voting,
        'Soft Voting': soft_voting,
        'Stacking': stacking,
    }
    
    results = {}
    best_model = None
    best_accuracy = 0
    
    print(f"  {'Model':<25} {'Accuracy':<12} {'F1 Score':<12} {'Time':<10}")
    print(f"  {'-'*59}")
    
    import time
    
    for name, model in models.items():
        start = time.time()
        
        acc_scores = cross_val_score(model, X, y, cv=skf, scoring='accuracy', n_jobs=-1)
        f1_scores = cross_val_score(model, X, y, cv=skf, scoring='f1', n_jobs=-1)
        
        elapsed = time.time() - start
        
        results[name] = {
            'accuracy': acc_scores.mean(),
            'accuracy_std': acc_scores.std(),
            'f1': f1_scores.mean(),
            'f1_std': f1_scores.std(),
            'time': elapsed
        }
        
        if acc_scores.mean() > best_accuracy:
            best_accuracy = acc_scores.mean()
            best_model = name
        
        print(f"  {name:<25} {acc_scores.mean():>10.2%}   {f1_scores.mean():>10.2%}   {elapsed:>7.1f}s")
    
    # Blending (manual implementation)
    print("\n  Training Blending Ensemble (manual)...")
    
    # Split data for blending
    blend_idx = np.random.permutation(len(X))
    train_idx = blend_idx[:int(0.8 * len(X))]
    blend_train_idx = blend_idx[int(0.8 * len(X)):]
    
    X_train, y_train = X[train_idx], y[train_idx]
    X_blend, y_blend = X[blend_train_idx], y[blend_train_idx]
    
    # Train base models
    base_models = [
        RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1),
        xgb.XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbosity=0),
        lgb.LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1),
        ExtraTreesClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    ]
    
    # Generate blend features
    blend_features = np.zeros((len(X_blend), len(base_models)))
    
    for i, model in enumerate(base_models):
        model.fit(X_train, y_train)
        blend_features[:, i] = model.predict_proba(X_blend)[:, 1]
    
    # Train meta-model
    meta_model = LogisticRegression(max_iter=1000)
    meta_model.fit(blend_features, y_blend)
    
    # CV for blending
    blend_acc_scores = []
    blend_f1_scores = []
    
    for train_idx, test_idx in skf.split(X, y):
        X_tr, X_te = X[train_idx], X[test_idx]
        y_tr, y_te = y[train_idx], y[test_idx]
        
        # Train base models
        test_predictions = np.zeros((len(X_te), len(base_models)))
        for i, model in enumerate(base_models):
            model.fit(X_tr, y_tr)
            test_predictions[:, i] = model.predict_proba(X_te)[:, 1]
        
        # Meta prediction
        meta_model_cv = LogisticRegression(max_iter=1000)
        train_blend = np.zeros((len(X_tr), len(base_models)))
        for i, model in enumerate(base_models):
            train_blend[:, i] = model.predict_proba(X_tr)[:, 1]
        meta_model_cv.fit(train_blend, y_tr)
        
        y_pred = meta_model_cv.predict(test_predictions)
        
        blend_acc_scores.append(accuracy_score(y_te, y_pred))
        blend_f1_scores.append(f1_score(y_te, y_pred))
    
    results['Blending'] = {
        'accuracy': np.mean(blend_acc_scores),
        'accuracy_std': np.std(blend_acc_scores),
        'f1': np.mean(blend_f1_scores),
        'f1_std': np.std(blend_f1_scores)
    }
    
    if np.mean(blend_acc_scores) > best_accuracy:
        best_accuracy = np.mean(blend_acc_scores)
        best_model = 'Blending'
    
    print(f"  {'Blending':<25} {np.mean(blend_acc_scores):>10.2%}   {np.mean(blend_f1_scores):>10.2%}")
    
    print(f"\n  ✅ Best Ensemble: {best_model} ({best_accuracy:.2%} accuracy)")
    
    return results, best_model


def train_final_ensemble(X: np.ndarray, y: np.ndarray, feature_cols: list) -> dict:
    """Train and save the final best ensemble."""
    print("\n" + "="*60)
    print("TRAINING FINAL ENSEMBLE MODEL")
    print("="*60)
    
    # Best performing: Soft Voting or Stacking based on results
    # Using Soft Voting as it's typically best balance of speed/performance
    
    final_ensemble = VotingClassifier(
        estimators=[
            ('rf', RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1)),
            ('xgb', xgb.XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbosity=0)),
            ('lgb', lgb.LGBMClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1)),
            ('et', ExtraTreesClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1))
        ],
        voting='soft',
        n_jobs=-1
    )
    
    print("\n  Training final ensemble on full data...")
    final_ensemble.fit(X, y)
    
    # Evaluate
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    acc_scores = cross_val_score(final_ensemble, X, y, cv=skf, scoring='accuracy', n_jobs=-1)
    f1_scores = cross_val_score(final_ensemble, X, y, cv=skf, scoring='f1', n_jobs=-1)
    
    print(f"\n  Final Ensemble Performance:")
    print(f"    Accuracy: {acc_scores.mean():.2%} (+/- {acc_scores.std()*2:.2%})")
    print(f"    F1 Score: {f1_scores.mean():.2%} (+/- {f1_scores.std()*2:.2%})")
    
    # Save model
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    
    model_data = {
        'ensemble': final_ensemble,
        'feature_cols': feature_cols,
        'accuracy': acc_scores.mean(),
        'f1': f1_scores.mean(),
        'type': 'soft_voting_4_models'
    }
    joblib.dump(model_data, os.path.join(models_dir, 'pass_difficulty_ensemble.joblib'))
    print(f"\n  Model saved to {models_dir}/pass_difficulty_ensemble.joblib")
    
    return {
        'accuracy': acc_scores.mean(),
        'f1': f1_scores.mean()
    }


def main():
    """Main ensemble training."""
    print("="*60)
    print("ENSEMBLE MODEL - COMBINING MULTIPLE CLASSIFIERS")
    print("Voting + Stacking + Blending")
    print("="*60)
    
    init_db()
    passes_df = get_all_passes_from_db()
    
    if len(passes_df) < 1000:
        print("ERROR: Not enough data!")
        return
    
    # Prepare features
    X, y, feature_cols = prepare_features(passes_df)
    
    # Train and compare ensemble methods
    results, best_model = train_ensemble_models(X, y)
    
    # Train final ensemble
    final_results = train_final_ensemble(X, y, feature_cols)
    
    # Summary
    print("\n" + "="*60)
    print("✅ ENSEMBLE TRAINING COMPLETE!")
    print("="*60)
    
    print("\n  Model Rankings:")
    sorted_results = sorted(results.items(), key=lambda x: x[1]['accuracy'], reverse=True)
    for i, (name, r) in enumerate(sorted_results):
        medal = ['🥇', '🥈', '🥉', '  ', '  ', '  ', '  '][i]
        print(f"    {medal} {name}: {r['accuracy']:.2%} accuracy, {r['f1']:.2%} F1")
    
    print(f"\n  Final Ensemble (4-model Soft Voting):")
    print(f"    Accuracy: {final_results['accuracy']:.2%}")
    print(f"    F1 Score: {final_results['f1']:.2%}")


if __name__ == '__main__':
    main()
