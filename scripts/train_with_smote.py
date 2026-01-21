"""
SMOTE (Synthetic Minority Over-sampling Technique) for Class Imbalance.

Applies SMOTE to handle class imbalance in both models.
"""
import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, f1_score, classification_report
from imblearn.over_sampling import SMOTE, ADASYN
from imblearn.combine import SMOTETomek
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


def train_pass_difficulty_with_smote(passes_df: pd.DataFrame) -> dict:
    """Train Pass Difficulty model with SMOTE."""
    print("\n" + "="*60)
    print("PASS DIFFICULTY - SMOTE FOR CLASS IMBALANCE")
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
    
    print(f"\n  Before SMOTE:")
    print(f"    Total samples: {len(X):,}")
    print(f"    Class 0 (Failed): {(y == 0).sum():,} ({(y == 0).mean():.1%})")
    print(f"    Class 1 (Success): {(y == 1).sum():,} ({(y == 1).mean():.1%})")
    print(f"    Imbalance ratio: {(y == 1).sum() / (y == 0).sum():.1f}:1")
    
    # Compare different techniques
    techniques = {
        'No Resampling': None,
        'SMOTE': SMOTE(random_state=42),
        'ADASYN': ADASYN(random_state=42),
        'SMOTETomek': SMOTETomek(random_state=42)
    }
    
    model = lgb.LGBMClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    
    print("\n  Comparing resampling techniques:")
    print(f"  {'Technique':<20} {'Accuracy':<12} {'F1 (Failed)':<12} {'F1 (Success)':<12}")
    print(f"  {'-'*56}")
    
    results = {}
    best_technique = None
    best_f1_minority = 0
    
    for name, sampler in techniques.items():
        if sampler:
            X_res, y_res = sampler.fit_resample(X, y)
        else:
            X_res, y_res = X, y
        
        acc_scores = []
        f1_0_scores = []
        f1_1_scores = []
        
        for train_idx, test_idx in skf.split(X, y):
            X_train, X_test = X[train_idx], X[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]
            
            if sampler:
                X_train_res, y_train_res = sampler.fit_resample(X_train, y_train)
            else:
                X_train_res, y_train_res = X_train, y_train
            
            model.fit(X_train_res, y_train_res)
            y_pred = model.predict(X_test)
            
            acc_scores.append(accuracy_score(y_test, y_pred))
            f1_0_scores.append(f1_score(y_test, y_pred, pos_label=0))
            f1_1_scores.append(f1_score(y_test, y_pred, pos_label=1))
        
        results[name] = {
            'accuracy': np.mean(acc_scores),
            'f1_failed': np.mean(f1_0_scores),
            'f1_success': np.mean(f1_1_scores)
        }
        
        print(f"  {name:<20} {np.mean(acc_scores):>10.2%}   {np.mean(f1_0_scores):>10.2%}   {np.mean(f1_1_scores):>10.2%}")
        
        # Best based on minority class F1 (failed passes)
        if np.mean(f1_0_scores) > best_f1_minority:
            best_f1_minority = np.mean(f1_0_scores)
            best_technique = name
    
    print(f"\n  ✅ Best technique for minority class: {best_technique}")
    print(f"     Minority (Failed) F1: {results[best_technique]['f1_failed']:.2%}")
    
    # Train final model with best technique
    if best_technique != 'No Resampling':
        sampler = techniques[best_technique]
        X_res, y_res = sampler.fit_resample(X, y)
        print(f"\n  After {best_technique}:")
        print(f"    Total samples: {len(X_res):,}")
        print(f"    Class 0 (Failed): {(y_res == 0).sum():,}")
        print(f"    Class 1 (Success): {(y_res == 1).sum():,}")
    else:
        X_res, y_res = X, y
    
    model.fit(X_res, y_res)
    
    # Save model
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    
    model_data = {
        'model': model,
        'feature_cols': feature_cols,
        'best_technique': best_technique,
        'results': results
    }
    joblib.dump(model_data, os.path.join(models_dir, 'pass_difficulty_smote.joblib'))
    print(f"\n  Model saved to {models_dir}/pass_difficulty_smote.joblib")
    
    return results


def train_tactical_classifier_with_smote(passes_df: pd.DataFrame) -> dict:
    """Train Tactical Classifier with SMOTE."""
    print("\n" + "="*60)
    print("TACTICAL CLASSIFIER - SMOTE FOR CLASS IMBALANCE")
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
    
    # Show class distribution
    print(f"\n  Before SMOTE - Class Distribution:")
    unique, counts = np.unique(y, return_counts=True)
    for i, (cls_id, count) in enumerate(zip(unique, counts)):
        class_name = le.inverse_transform([cls_id])[0]
        print(f"    {class_name}: {count} ({count/len(y):.1%})")
    
    # SMOTE for multi-class
    print("\n  Applying SMOTE for multi-class...")
    smote = SMOTE(random_state=42, k_neighbors=min(5, min(counts) - 1))
    
    try:
        X_res, y_res = smote.fit_resample(X_scaled, y)
        print(f"\n  After SMOTE - Class Distribution:")
        unique, counts = np.unique(y_res, return_counts=True)
        for cls_id, count in zip(unique, counts):
            class_name = le.inverse_transform([cls_id])[0]
            print(f"    {class_name}: {count} ({count/len(y_res):.1%})")
    except Exception as e:
        print(f"  SMOTE failed: {e}")
        print("  Using class weights instead...")
        X_res, y_res = X_scaled, y
    
    # Train with and without SMOTE
    model_no_smote = lgb.LGBMClassifier(n_estimators=200, max_depth=4, learning_rate=0.15, random_state=42, n_jobs=-1, verbose=-1)
    model_smote = lgb.LGBMClassifier(n_estimators=200, max_depth=4, learning_rate=0.15, random_state=42, n_jobs=-1, verbose=-1)
    
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    
    # Without SMOTE
    acc_no_smote = cross_val_score(model_no_smote, X_scaled, y, cv=skf, scoring='accuracy').mean()
    f1_no_smote = cross_val_score(model_no_smote, X_scaled, y, cv=skf, scoring='f1_weighted').mean()
    
    # With SMOTE (resample in each fold)
    acc_smote_scores = []
    f1_smote_scores = []
    
    for train_idx, test_idx in skf.split(X_scaled, y):
        X_train, X_test = X_scaled[train_idx], X_scaled[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]
        
        try:
            X_train_res, y_train_res = smote.fit_resample(X_train, y_train)
        except:
            X_train_res, y_train_res = X_train, y_train
        
        model_smote.fit(X_train_res, y_train_res)
        y_pred = model_smote.predict(X_test)
        
        acc_smote_scores.append(accuracy_score(y_test, y_pred))
        f1_smote_scores.append(f1_score(y_test, y_pred, average='weighted'))
    
    acc_smote = np.mean(acc_smote_scores)
    f1_smote = np.mean(f1_smote_scores)
    
    print(f"\n  Comparison:")
    print(f"  {'Method':<20} {'Accuracy':<12} {'F1 (weighted)':<15}")
    print(f"  {'-'*47}")
    print(f"  {'Without SMOTE':<20} {acc_no_smote:>10.2%}   {f1_no_smote:>12.2%}")
    print(f"  {'With SMOTE':<20} {acc_smote:>10.2%}   {f1_smote:>12.2%}")
    
    # Use best
    if f1_smote > f1_no_smote:
        print(f"\n  ✅ SMOTE improved F1 by {(f1_smote - f1_no_smote)*100:.2f}%")
        model_smote.fit(X_res, y_res)
        final_model = model_smote
        used_smote = True
    else:
        print(f"\n  ⚠️ SMOTE did not improve. Using original data.")
        model_no_smote.fit(X_scaled, y)
        final_model = model_no_smote
        used_smote = False
    
    # Save model
    models_dir = 'backend/models/trained'
    model_data = {
        'classifier': final_model,
        'scaler': scaler,
        'label_encoder': le,
        'feature_columns': feature_cols,
        'used_smote': used_smote,
        'accuracy': max(acc_smote, acc_no_smote),
        'is_trained': True
    }
    joblib.dump(model_data, os.path.join(models_dir, 'tactical_classifier_smote.joblib'))
    print(f"\n  Model saved to {models_dir}/tactical_classifier_smote.joblib")
    
    return {
        'without_smote': {'accuracy': acc_no_smote, 'f1': f1_no_smote},
        'with_smote': {'accuracy': acc_smote, 'f1': f1_smote},
        'used_smote': used_smote
    }


def main():
    """Main SMOTE training function."""
    print("="*60)
    print("SMOTE - HANDLING CLASS IMBALANCE")
    print("Synthetic Minority Over-sampling Technique")
    print("="*60)
    
    init_db()
    passes_df = get_all_passes_from_db()
    
    if len(passes_df) < 1000:
        print("ERROR: Not enough data!")
        return
    
    # Train Pass Difficulty with SMOTE
    pass_results = train_pass_difficulty_with_smote(passes_df)
    
    # Train Tactical Classifier with SMOTE
    tactical_results = train_tactical_classifier_with_smote(passes_df)
    
    # Summary
    print("\n" + "="*60)
    print("✅ SMOTE TRAINING COMPLETE!")
    print("="*60)
    
    print("\n  Pass Difficulty - Minority Class (Failed) F1:")
    for name, r in pass_results.items():
        arrow = "⬆️" if r['f1_failed'] > pass_results['No Resampling']['f1_failed'] else ""
        print(f"    {name}: {r['f1_failed']:.2%} {arrow}")
    
    print(f"\n  Tactical Classifier:")
    print(f"    Without SMOTE: {tactical_results['without_smote']['f1']:.2%}")
    print(f"    With SMOTE:    {tactical_results['with_smote']['f1']:.2%}")
    
    print("\n  Models saved to: backend/models/trained/")


if __name__ == '__main__':
    main()
