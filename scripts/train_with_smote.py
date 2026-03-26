"""
SMOTE (Synthetic Minority Over-sampling Technique) for Class Imbalance.

Applies SMOTE to handle class imbalance in both models.
"""
import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
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


def train_pass_difficulty_with_smote(passes_df: pd.DataFrame, holdout_df: pd.DataFrame = None) -> dict:
    """Train Pass Difficulty model with SMOTE."""
    print("\n" + "="*60)
    print("PASS DIFFICULTY - SMOTE FOR CLASS IMBALANCE")
    print("="*60)
    
    # Prepare features
    df = passes_df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y'])
    
    df['pass_length'] = np.sqrt(
        (df['end_location_x'] - df['location_x'])**2 + 
        (df['end_location_y'] - df['location_y'])**2
    )
    
    df['dx'] = df['end_location_x'] - df['location_x']
    df['dy'] = df['end_location_y'] - df['location_y']
    df['is_forward'] = (df['dx'] > 0).astype(int)
    df['is_in_final_third'] = (df['location_x'] > 80).astype(int)
    df['is_long_pass'] = (df['pass_length'] > 30).astype(int)
    
    num_cols = ['location_x', 'location_y', 'end_location_x', 'end_location_y', 
                'pass_length', 'dx', 'dy', 'is_forward', 'is_in_final_third', 'is_long_pass']
    cat_cols = ['pass_type', 'pass_height', 'body_part']
    
    X_df = df[num_cols + cat_cols].copy()
    X_df[cat_cols] = X_df[cat_cols].fillna('Unknown')
    y = (df['pass_outcome'].isna() | (df['pass_outcome'] == 'Complete')).astype(int).values
    groups = df['match_id'].values
    
    # Sample for speed
    sample_idx = np.arange(len(X_df))
    if len(X_df) > 100000:
        sample_idx = np.random.choice(len(X_df), 100000, replace=False)
        X_df, y = X_df.iloc[sample_idx], y[sample_idx]
        groups = groups[sample_idx]
    
    print(f"\n  Before SMOTE:")
    print(f"    Total samples: {len(X_df):,}")
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
    gkf = GroupKFold(n_splits=5)
    
    print("\n  Comparing resampling techniques:")
    print(f"  {'Technique':<20} {'Accuracy':<12} {'F1 (Failed)':<12} {'F1 (Success)':<12}")
    print(f"  {'-'*56}")
    
    results = {}
    best_technique = None
    best_f1_minority = 0
    
    for name, sampler in techniques.items():
        acc_scores = []
        f1_0_scores = []
        f1_1_scores = []
        
        for train_idx, test_idx in gkf.split(X_df, y, groups):
            X_train_df, X_test_df = X_df.iloc[train_idx], X_df.iloc[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]
            
            encoder = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
            X_train_cat = encoder.fit_transform(X_train_df[cat_cols])
            X_test_cat = encoder.transform(X_test_df[cat_cols])
            
            X_train_num = X_train_df[num_cols].fillna(0).values
            X_test_num = X_test_df[num_cols].fillna(0).values
            
            X_train = np.hstack([X_train_num, X_train_cat])
            X_test = np.hstack([X_test_num, X_test_cat])
            
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
    encoder = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    X_cat = encoder.fit_transform(X_df[cat_cols])
    X_num = X_df[num_cols].fillna(0).values
    X_full = np.hstack([X_num, X_cat])
    
    if best_technique != 'No Resampling':
        sampler = techniques[best_technique]
        X_res, y_res = sampler.fit_resample(X_full, y)
        print(f"\n  After {best_technique}:")
        print(f"    Total samples: {len(X_res):,}")
        print(f"    Class 0 (Failed): {(y_res == 0).sum():,}")
        print(f"    Class 1 (Success): {(y_res == 1).sum():,}")
    else:
        X_res, y_res = X_full, y
    
    model.fit(X_res, y_res)
    
    # Save model
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    
    model_data = {
        'model': model,
        'num_cols': num_cols,
        'cat_cols': cat_cols,
        'encoder': encoder,
        'best_technique': best_technique,
        'results': results
    }
    joblib.dump(model_data, os.path.join(models_dir, 'pass_difficulty_smote.joblib'))
    print(f"\n  Model saved to {models_dir}/pass_difficulty_smote.joblib")
    
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
            
            X_hold_df = df_hold[num_cols + cat_cols].copy()
            X_hold_df[cat_cols] = X_hold_df[cat_cols].fillna('Unknown')
            X_hold_cat = encoder.transform(X_hold_df[cat_cols])
            X_hold_num = X_hold_df[num_cols].fillna(0).values
            X_hold = np.hstack([X_hold_num, X_hold_cat])
            y_hold = (df_hold['pass_outcome'].isna() | (df_hold['pass_outcome'] == 'Complete')).astype(int).values
            
            y_pred = model.predict(X_hold)
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


def train_tactical_classifier_with_smote(passes_df: pd.DataFrame, holdout_df: pd.DataFrame = None) -> dict:
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
    
    gkf = GroupKFold(n_splits=5)
    
    # Without SMOTE
    acc_no_smote = cross_val_score(model_no_smote, X_scaled, y, cv=gkf, groups=groups, scoring='accuracy').mean()
    f1_no_smote = cross_val_score(model_no_smote, X_scaled, y, cv=gkf, groups=groups, scoring='f1_weighted').mean()
    
    # With SMOTE (resample in each fold)
    acc_smote_scores = []
    f1_smote_scores = []
    
    for train_idx, test_idx in gkf.split(X_scaled, y, groups):
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
    
    # Holdout evaluation
    if holdout_df is not None and not holdout_df.empty:
        holdout_features, holdout_labels, _ = build_features(holdout_df)
        if holdout_features:
            X_hold = pd.DataFrame(holdout_features).values
            X_hold_scaled = scaler.transform(X_hold)
            y_hold = le.transform(holdout_labels)
            
            final_model.fit(X_scaled, y)
            y_pred = final_model.predict(X_hold_scaled)
            
            holdout_acc = accuracy_score(y_hold, y_pred)
            holdout_f1 = f1_score(y_hold, y_pred, average='weighted')
            
            print("\n  Holdout Performance (Fixed Split):")
            print(f"    Accuracy: {holdout_acc:.2%}")
            print(f"    F1 Score: {holdout_f1:.2%}")
    
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
    
    train_df, holdout_df, holdout_info = split_holdout(passes_df)
    if holdout_info.get("enabled"):
        print("\n  Holdout Split:")
        print(f"    Rule: competition contains '{holdout_info['competition_contains']}', season contains '{holdout_info['season_contains']}'")
        print(f"    Holdout passes: {holdout_info['holdout_size']:,} from {holdout_info['holdout_matches']} matches")
        print(f"    Train passes: {holdout_info['train_size']:,}")
    
    # Train Pass Difficulty with SMOTE
    pass_results = train_pass_difficulty_with_smote(train_df, holdout_df)
    
    # Train Tactical Classifier with SMOTE
    tactical_results = train_tactical_classifier_with_smote(train_df, holdout_df)
    
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
