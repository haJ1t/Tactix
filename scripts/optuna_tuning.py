"""
Optuna Hyperparameter Tuning with Fixed Holdout.

Optimizes speed/performance tradeoff using a time penalty in the objective.
"""
import os
import sys
import time
import numpy as np
import pandas as pd

try:
    import optuna
except ImportError as exc:
    raise SystemExit("optuna not installed. Run: pip install -r requirements.txt") from exc

from sklearn.model_selection import GroupKFold, cross_val_score
from sklearn.metrics import accuracy_score, f1_score
from sklearn.preprocessing import OneHotEncoder, LabelEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import lightgbm as lgb
import joblib

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

N_TRIALS_PASS = int(os.environ.get("TACTIX_OPTUNA_TRIALS_PASS", "30"))
N_TRIALS_TACTICAL = int(os.environ.get("TACTIX_OPTUNA_TRIALS_TACTICAL", "30"))
SPEED_PENALTY = float(os.environ.get("TACTIX_OPTUNA_SPEED_PENALTY", "0.02"))


def get_all_passes_from_db() -> pd.DataFrame:
    """Get all pass data from database with match metadata."""
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


def build_pass_dataset(df: pd.DataFrame):
    """Build dataset for pass difficulty tuning."""
    # Drop incomplete rows
    df = df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y'])

    # Engineer derived features
    df['pass_length'] = np.sqrt(
        (df['end_location_x'] - df['location_x'])**2 +
        (df['end_location_y'] - df['location_y'])**2
    )
    df['dx'] = df['end_location_x'] - df['location_x']
    df['dy'] = df['end_location_y'] - df['location_y']
    df['is_forward'] = (df['dx'] > 0).astype(int)
    df['is_in_final_third'] = (df['location_x'] > 80).astype(int)
    df['is_long_pass'] = (df['pass_length'] > 30).astype(int)
    
    num_cols = [
        'location_x', 'location_y', 'end_location_x', 'end_location_y',
        'pass_length', 'dx', 'dy', 'is_forward', 'is_in_final_third', 'is_long_pass'
    ]
    cat_cols = ['pass_type', 'pass_height', 'body_part']
    
    X_df = df[num_cols + cat_cols].copy()
    X_df[cat_cols] = X_df[cat_cols].fillna('Unknown')
    y = (df['pass_outcome'].isna() | (df['pass_outcome'] == 'Complete')).astype(int).values
    groups = df['match_id'].values
    
    return X_df, y, groups, num_cols, cat_cols


def objective_pass(trial, X_df, y, groups, cat_cols):
    # Define search space
    params = {
        'n_estimators': trial.suggest_int('n_estimators', 100, 400),
        'num_leaves': trial.suggest_int('num_leaves', 16, 128),
        'max_depth': trial.suggest_int('max_depth', 4, 12),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
        'subsample': trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'min_child_samples': trial.suggest_int('min_child_samples', 10, 50),
        'reg_alpha': trial.suggest_float('reg_alpha', 0.0, 1.0),
        'reg_lambda': trial.suggest_float('reg_lambda', 0.0, 1.0),
        'random_state': 42,
        'n_jobs': -1,
        'verbose': -1,
    }
    
    model = lgb.LGBMClassifier(**params)
    preprocessor = ColumnTransformer(
        [('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cat_cols)],
        remainder='passthrough'
    )
    pipeline = Pipeline([('preprocess', preprocessor), ('model', model)])
    
    # Run grouped CV
    gkf = GroupKFold(n_splits=5)
    start = time.time()
    scores = cross_val_score(pipeline, X_df, y, cv=gkf, groups=groups, scoring='f1', n_jobs=-1)
    elapsed = time.time() - start

    # Apply time penalty
    score = scores.mean()
    value = score - (SPEED_PENALTY * np.log1p(elapsed))

    trial.set_user_attr("f1", score)
    trial.set_user_attr("elapsed", elapsed)

    return value


def tune_pass_difficulty(train_df: pd.DataFrame, holdout_df: pd.DataFrame):
    print("\n" + "="*60)
    print("OPTUNA TUNING - PASS DIFFICULTY")
    print("="*60)
    
    X_df, y, groups, num_cols, cat_cols = build_pass_dataset(train_df)

    # Run optuna study
    study = optuna.create_study(direction='maximize')
    study.optimize(lambda t: objective_pass(t, X_df, y, groups, cat_cols), n_trials=N_TRIALS_PASS)
    
    best_trial = study.best_trial
    best_params = best_trial.params
    best_f1 = best_trial.user_attrs.get("f1", None)
    best_time = best_trial.user_attrs.get("elapsed", None)
    
    print(f"\n  Best Trial: #{best_trial.number}")
    print(f"  Best CV F1: {best_f1:.4f}" if best_f1 is not None else "  Best CV F1: n/a")
    print(f"  Train Time: {best_time:.1f}s" if best_time is not None else "  Train Time: n/a")
    print(f"  Params: {best_params}")
    
    # Refit best on full data
    model = lgb.LGBMClassifier(**best_params, random_state=42, n_jobs=-1, verbose=-1)
    preprocessor = ColumnTransformer(
        [('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cat_cols)],
        remainder='passthrough'
    )
    pipeline = Pipeline([('preprocess', preprocessor), ('model', model)])
    pipeline.fit(X_df, y)
    
    holdout_metrics = None
    if holdout_df is not None and not holdout_df.empty:
        X_hold, y_hold, _, _, _ = build_pass_dataset(holdout_df)
        y_pred = pipeline.predict(X_hold)
        holdout_metrics = {
            'accuracy': accuracy_score(y_hold, y_pred),
            'f1': f1_score(y_hold, y_pred)
        }
        print("\n  Holdout Performance (Fixed Split):")
        print(f"    Accuracy: {holdout_metrics['accuracy']:.2%}")
        print(f"    F1 Score: {holdout_metrics['f1']:.2%}")
    
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    joblib.dump({
        'model': pipeline,
        'best_params': best_params,
        'num_cols': num_cols,
        'cat_cols': cat_cols,
        'holdout': holdout_metrics,
        'best_cv_f1': best_f1
    }, os.path.join(models_dir, 'pass_difficulty_optuna.joblib'))
    print(f"\n  Model saved to {models_dir}/pass_difficulty_optuna.joblib")


def build_tactical_dataset(df: pd.DataFrame):
    """Build dataset for tactical classifier tuning (returns features + string labels)."""
    builder = NetworkBuilder()
    classifier = TacticalPatternClassifier()
    
    if 'passer_name' not in df.columns:
        df['passer_name'] = df['passer_id'].apply(lambda x: f'Player {x}')
    if 'recipient_name' not in df.columns:
        df['recipient_name'] = df['recipient_id'].apply(lambda x: f'Player {x}' if pd.notna(x) else None)
    
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
            label = patterns[0]['pattern_type'] if patterns else 'BALANCED_ATTACK'
            
            features_list.append(features)
            labels.append(label)
            groups.append(match_id)
        except:
            continue
    
    if not features_list:
        return None, None, None
    
    X = pd.DataFrame(features_list)
    groups = np.array(groups)
    
    return X, labels, groups


def objective_tactical(trial, X, y, groups):
    params = {
        'n_estimators': trial.suggest_int('n_estimators', 100, 400),
        'num_leaves': trial.suggest_int('num_leaves', 16, 128),
        'max_depth': trial.suggest_int('max_depth', 3, 10),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
        'subsample': trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'min_child_samples': trial.suggest_int('min_child_samples', 10, 50),
        'reg_alpha': trial.suggest_float('reg_alpha', 0.0, 1.0),
        'reg_lambda': trial.suggest_float('reg_lambda', 0.0, 1.0),
        'random_state': 42,
        'n_jobs': -1,
        'verbose': -1,
    }
    
    model = lgb.LGBMClassifier(**params)
    gkf = GroupKFold(n_splits=5)
    
    start = time.time()
    scores = cross_val_score(model, X, y, cv=gkf, groups=groups, scoring='f1_weighted', n_jobs=-1)
    elapsed = time.time() - start
    
    score = scores.mean()
    value = score - (SPEED_PENALTY * np.log1p(elapsed))
    
    trial.set_user_attr("f1_weighted", score)
    trial.set_user_attr("elapsed", elapsed)
    
    return value


def tune_tactical_classifier(train_df: pd.DataFrame, holdout_df: pd.DataFrame):
    print("\n" + "="*60)
    print("OPTUNA TUNING - TACTICAL CLASSIFIER")
    print("="*60)
    
    X, labels, groups = build_tactical_dataset(train_df)
    if X is None:
        print("Not enough data for tactical tuning.")
        return
    
    le = LabelEncoder()
    y = le.fit_transform(labels)
    
    study = optuna.create_study(direction='maximize')
    study.optimize(lambda t: objective_tactical(t, X, y, groups), n_trials=N_TRIALS_TACTICAL)
    
    best_trial = study.best_trial
    best_params = best_trial.params
    best_f1 = best_trial.user_attrs.get("f1_weighted", None)
    best_time = best_trial.user_attrs.get("elapsed", None)
    
    print(f"\n  Best Trial: #{best_trial.number}")
    print(f"  Best CV F1 (weighted): {best_f1:.4f}" if best_f1 is not None else "  Best CV F1: n/a")
    print(f"  Train Time: {best_time:.1f}s" if best_time is not None else "  Train Time: n/a")
    print(f"  Params: {best_params}")
    
    model = lgb.LGBMClassifier(**best_params, random_state=42, n_jobs=-1, verbose=-1)
    model.fit(X, y)
    
    holdout_metrics = None
    if holdout_df is not None and not holdout_df.empty:
        X_hold, holdout_labels, _ = build_tactical_dataset(holdout_df)
        if X_hold is not None:
            known_mask = np.isin(holdout_labels, le.classes_)
            X_hold = X_hold[known_mask]
            holdout_labels = np.array(holdout_labels)[known_mask]
            if len(holdout_labels) > 0:
                y_hold = le.transform(holdout_labels)
                y_pred = model.predict(X_hold)
                holdout_metrics = {
                    'accuracy': accuracy_score(y_hold, y_pred),
                    'f1': f1_score(y_hold, y_pred, average='weighted')
                }
                print("\n  Holdout Performance (Fixed Split):")
                print(f"    Accuracy: {holdout_metrics['accuracy']:.2%}")
                print(f"    F1 Score: {holdout_metrics['f1']:.2%}")
    
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    joblib.dump({
        'model': model,
        'best_params': best_params,
        'label_encoder': le,
        'holdout': holdout_metrics,
        'best_cv_f1_weighted': best_f1
    }, os.path.join(models_dir, 'tactical_classifier_optuna.joblib'))
    print(f"\n  Model saved to {models_dir}/tactical_classifier_optuna.joblib")


def main():
    print("="*60)
    print("OPTUNA TUNING (SPEED/PERFORMANCE BALANCE)")
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
    
    tune_pass_difficulty(train_df, holdout_df)
    tune_tactical_classifier(train_df, holdout_df)
    
    print("\n✅ OPTUNA TUNING COMPLETE!")


if __name__ == '__main__':
    main()
