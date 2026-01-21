"""
Comprehensive Cross-Validation Analysis for ML Models.

Includes:
- Stratified K-Fold Cross-Validation
- Precision, Recall, F1 Scores
- Confusion Matrix
- Learning Curves
- Feature Importance Analysis
"""
import os
import sys
import pandas as pd
import numpy as np
from collections import defaultdict
from sklearn.model_selection import (
    StratifiedKFold, 
    cross_val_score, 
    cross_val_predict,
    learning_curve
)
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score, 
    precision_score, 
    recall_score, 
    f1_score,
    classification_report,
    confusion_matrix
)
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


def cross_validate_pass_difficulty(passes_df: pd.DataFrame) -> dict:
    """Comprehensive cross-validation for Pass Difficulty Model."""
    print("\n" + "="*60)
    print("PASS DIFFICULTY MODEL - CROSS-VALIDATION ANALYSIS")
    print("="*60)
    
    # Prepare features
    df = passes_df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y', 'recipient_id'])
    
    # Calculate pass length
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
    y = (df['pass_outcome'].isna() | (df['pass_outcome'] == 'Complete')).astype(int)
    
    print(f"\n  Dataset: {len(X):,} samples, {len(feature_cols)} features")
    print(f"  Class distribution: {y.sum():,} successful ({y.mean():.1%}), {(~y.astype(bool)).sum():,} failed ({1-y.mean():.1%})")
    
    # Sample for CV (100k max for speed)
    if len(X) > 100000:
        sample_idx = np.random.choice(len(X), 100000, replace=False)
        X = X.iloc[sample_idx]
        y = y.iloc[sample_idx]
        print(f"  Sampled to {len(X):,} for faster CV")
    
    # Load best parameters from tuning
    best_params = {'max_depth': 15, 'min_samples_leaf': 2, 'min_samples_split': 10, 'n_estimators': 200}
    
    model = RandomForestClassifier(**best_params, random_state=42, n_jobs=-1)
    
    # Stratified K-Fold
    n_folds = 10
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    
    print(f"\n  Running {n_folds}-Fold Stratified Cross-Validation...")
    
    # Collect metrics per fold
    fold_metrics = []
    
    for fold, (train_idx, test_idx) in enumerate(skf.split(X, y)):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
        
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        fold_metrics.append({
            'fold': fold + 1,
            'accuracy': accuracy_score(y_test, y_pred),
            'precision': precision_score(y_test, y_pred, zero_division=0),
            'recall': recall_score(y_test, y_pred, zero_division=0),
            'f1': f1_score(y_test, y_pred, zero_division=0)
        })
    
    # Aggregate results
    metrics_df = pd.DataFrame(fold_metrics)
    
    print(f"\n  ╔{'═'*58}╗")
    print(f"  ║{'STRATIFIED 10-FOLD CROSS-VALIDATION RESULTS':^58}║")
    print(f"  ╠{'═'*58}╣")
    print(f"  ║ {'Fold':<6} {'Accuracy':<12} {'Precision':<12} {'Recall':<12} {'F1':<12} ║")
    print(f"  ╠{'═'*58}╣")
    
    for _, row in metrics_df.iterrows():
        print(f"  ║ {int(row['fold']):<6} {row['accuracy']:>10.2%}   {row['precision']:>10.2%}   {row['recall']:>10.2%}   {row['f1']:>10.2%} ║")
    
    print(f"  ╠{'═'*58}╣")
    print(f"  ║ {'Mean':<6} {metrics_df['accuracy'].mean():>10.2%}   {metrics_df['precision'].mean():>10.2%}   {metrics_df['recall'].mean():>10.2%}   {metrics_df['f1'].mean():>10.2%} ║")
    print(f"  ║ {'Std':<6} {metrics_df['accuracy'].std():>10.2%}   {metrics_df['precision'].std():>10.2%}   {metrics_df['recall'].std():>10.2%}   {metrics_df['f1'].std():>10.2%} ║")
    print(f"  ╚{'═'*58}╝")
    
    # Feature importance
    print("\n  Feature Importance (Top 5):")
    model.fit(X, y)
    importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    for i, row in importance.head(5).iterrows():
        bar = '█' * int(row['importance'] * 30)
        print(f"    {row['feature']:<20} {row['importance']:.3f} {bar}")
    
    # Confusion Matrix
    print("\n  Confusion Matrix:")
    y_pred_all = cross_val_predict(model, X, y, cv=skf)
    cm = confusion_matrix(y, y_pred_all)
    print(f"                  Predicted")
    print(f"                  Fail   Success")
    print(f"    Actual Fail   {cm[0,0]:>6}  {cm[0,1]:>6}")
    print(f"    Actual Success{cm[1,0]:>6}  {cm[1,1]:>6}")
    
    return {
        'mean_accuracy': metrics_df['accuracy'].mean(),
        'std_accuracy': metrics_df['accuracy'].std(),
        'mean_f1': metrics_df['f1'].mean(),
        'feature_importance': importance.to_dict('records')
    }


def cross_validate_tactical_classifier(passes_df: pd.DataFrame) -> dict:
    """Comprehensive cross-validation for Tactical Pattern Classifier."""
    print("\n" + "="*60)
    print("TACTICAL CLASSIFIER - CROSS-VALIDATION ANALYSIS")
    print("="*60)
    
    # Build network features
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
    
    print(f"  Built {len(features_list)} feature samples")
    
    X = pd.DataFrame(features_list)
    feature_cols = list(X.columns)
    
    # Encode labels
    le = LabelEncoder()
    y = le.fit_transform(labels)
    class_names = le.classes_
    
    print(f"  Classes: {len(class_names)}")
    for i, name in enumerate(class_names):
        count = (y == i).sum()
        print(f"    {name}: {count} samples ({count/len(y):.1%})")
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Best parameters from tuning
    best_params = {'n_estimators': 150, 'min_samples_split': 5, 'min_samples_leaf': 1, 'max_depth': 3, 'learning_rate': 0.2}
    model = GradientBoostingClassifier(**best_params, random_state=42)
    
    # Stratified K-Fold
    n_folds = 10
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    
    print(f"\n  Running {n_folds}-Fold Stratified Cross-Validation...")
    
    fold_metrics = []
    
    for fold, (train_idx, test_idx) in enumerate(skf.split(X_scaled, y)):
        X_train, X_test = X_scaled[train_idx], X_scaled[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]
        
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        fold_metrics.append({
            'fold': fold + 1,
            'accuracy': accuracy_score(y_test, y_pred),
            'precision': precision_score(y_test, y_pred, average='weighted', zero_division=0),
            'recall': recall_score(y_test, y_pred, average='weighted', zero_division=0),
            'f1': f1_score(y_test, y_pred, average='weighted', zero_division=0)
        })
    
    metrics_df = pd.DataFrame(fold_metrics)
    
    print(f"\n  ╔{'═'*58}╗")
    print(f"  ║{'STRATIFIED 10-FOLD CROSS-VALIDATION RESULTS':^58}║")
    print(f"  ╠{'═'*58}╣")
    print(f"  ║ {'Fold':<6} {'Accuracy':<12} {'Precision':<12} {'Recall':<12} {'F1':<12} ║")
    print(f"  ╠{'═'*58}╣")
    
    for _, row in metrics_df.iterrows():
        print(f"  ║ {int(row['fold']):<6} {row['accuracy']:>10.2%}   {row['precision']:>10.2%}   {row['recall']:>10.2%}   {row['f1']:>10.2%} ║")
    
    print(f"  ╠{'═'*58}╣")
    print(f"  ║ {'Mean':<6} {metrics_df['accuracy'].mean():>10.2%}   {metrics_df['precision'].mean():>10.2%}   {metrics_df['recall'].mean():>10.2%}   {metrics_df['f1'].mean():>10.2%} ║")
    print(f"  ║ {'Std':<6} {metrics_df['accuracy'].std():>10.2%}   {metrics_df['precision'].std():>10.2%}   {metrics_df['recall'].std():>10.2%}   {metrics_df['f1'].std():>10.2%} ║")
    print(f"  ╚{'═'*58}╝")
    
    # Feature importance
    print("\n  Feature Importance (Top 10):")
    model.fit(X_scaled, y)
    importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    for i, row in importance.head(10).iterrows():
        bar = '█' * int(row['importance'] * 40)
        print(f"    {row['feature']:<25} {row['importance']:.3f} {bar}")
    
    # Per-class metrics
    print("\n  Per-Class Performance:")
    y_pred_all = cross_val_predict(model, X_scaled, y, cv=skf)
    
    print(f"    {'Class':<30} {'Precision':<12} {'Recall':<12} {'F1':<12} {'Support':<8}")
    print(f"    {'-'*72}")
    
    for i, class_name in enumerate(class_names):
        mask = y == i
        if mask.sum() > 0:
            prec = precision_score(y == i, y_pred_all == i, zero_division=0)
            rec = recall_score(y == i, y_pred_all == i, zero_division=0)
            f1 = f1_score(y == i, y_pred_all == i, zero_division=0)
            print(f"    {class_name:<30} {prec:>10.2%}   {rec:>10.2%}   {f1:>10.2%}   {mask.sum():>6}")
    
    return {
        'mean_accuracy': metrics_df['accuracy'].mean(),
        'std_accuracy': metrics_df['accuracy'].std(),
        'mean_f1': metrics_df['f1'].mean(),
        'class_names': list(class_names),
        'feature_importance': importance.head(10).to_dict('records')
    }


def main():
    """Main cross-validation analysis."""
    print("="*60)
    print("COMPREHENSIVE CROSS-VALIDATION ANALYSIS")
    print("Stratified K-Fold + Detailed Metrics + Feature Importance")
    print("="*60)
    
    init_db()
    passes_df = get_all_passes_from_db()
    
    if len(passes_df) < 1000:
        print("ERROR: Not enough data!")
        return
    
    # Cross-validate Pass Difficulty Model
    pass_results = cross_validate_pass_difficulty(passes_df)
    
    # Cross-validate Tactical Classifier
    tactical_results = cross_validate_tactical_classifier(passes_df)
    
    # Summary
    print("\n" + "="*60)
    print("✅ CROSS-VALIDATION ANALYSIS COMPLETE!")
    print("="*60)
    
    print("\n  Summary:")
    print(f"  ┌{'─'*50}┐")
    print(f"  │ {'Model':<25} {'Mean Accuracy':<12} {'Mean F1':<12} │")
    print(f"  ├{'─'*50}┤")
    print(f"  │ {'Pass Difficulty':<25} {pass_results['mean_accuracy']:>10.2%}   {pass_results['mean_f1']:>10.2%} │")
    print(f"  │ {'Tactical Classifier':<25} {tactical_results['mean_accuracy']:>10.2%}   {tactical_results['mean_f1']:>10.2%} │")
    print(f"  └{'─'*50}┘")


if __name__ == '__main__':
    main()
