"""
Staged Tactix ML training program.

Stages:
1. dataset build
2. silver label build
3. candidate training
4. holdout evaluation
5. runtime artifact export
6. report generation
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from catboost import CatBoostClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier, VotingClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import GroupKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.utils.class_weight import compute_sample_weight

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, ROOT_DIR)
sys.path.insert(0, BACKEND_DIR)
os.chdir(ROOT_DIR)

from backend.models import engine, init_db
from backend.services.ml.analysis_pipeline import MLAnalysisPipeline
from backend.services.ml.holdout_utils import split_holdout
from backend.services.ml.pass_difficulty_model import PassDifficultyModel
from backend.services.ml.rich_features import PASS_CAT_COLS, PASS_NUMERIC_COLS, build_pass_feature_frame
from backend.services.ml.tactical_classifier import TacticalPatternClassifier
from backend.services.ml.vaep_model import VAEPModel
from backend.services.network_builder import NetworkBuilder


RANDOM_STATE = 42
MODELS_DIR = Path("backend/models/trained")
REPORT_PATH = MODELS_DIR / "finetune_report.json"
TACTICAL_SILVER_PATH = MODELS_DIR / "tactical_silver_labels.csv"
MAX_PASS_ROWS = 180_000
MAX_BUCKET_ROWS = 60_000
MAX_VAEP_ROWS = 180_000


def load_matches_df() -> pd.DataFrame:
    query = """
        SELECT
            match_id,
            home_team_id,
            away_team_id,
            match_date,
            competition,
            season,
            home_score,
            away_score
        FROM matches
    """
    return pd.read_sql_query(query, engine)


def load_passes_df() -> pd.DataFrame:
    query = """
        SELECT
            p.pass_id,
            p.event_id,
            p.passer_id,
            p.recipient_id,
            p.end_location_x,
            p.end_location_y,
            p.pass_length,
            p.pass_angle,
            p.pass_outcome,
            p.pass_type,
            p.pass_height,
            p.body_part,
            p.technique,
            p.is_cross,
            p.is_switch,
            p.is_through_ball,
            p.is_cut_back,
            e.match_id,
            e.team_id,
            e.player_id,
            e.event_type,
            e.event_index,
            e.period,
            e.timestamp,
            e.duration,
            e.minute,
            e.second,
            e.location_x,
            e.location_y,
            e.possession_id,
            e.possession_team_id,
            e.play_pattern,
            e.position_name,
            e.under_pressure,
            e.is_goal,
            m.competition,
            m.season,
            m.home_team_id,
            m.away_team_id,
            m.home_score,
            m.away_score,
            pl.position AS player_position
        FROM passes p
        JOIN events e ON p.event_id = e.event_id
        JOIN matches m ON e.match_id = m.match_id
        LEFT JOIN players pl ON p.passer_id = pl.player_id
    """
    return pd.read_sql_query(query, engine)


def load_actions_df() -> pd.DataFrame:
    query = """
        SELECT
            e.event_id,
            e.match_id,
            e.team_id,
            e.player_id,
            e.event_type,
            e.event_index,
            e.period,
            e.timestamp,
            e.duration,
            e.minute,
            e.second,
            e.location_x,
            e.location_y,
            e.possession_id,
            e.possession_team_id,
            e.play_pattern,
            e.position_name,
            e.under_pressure,
            e.outcome_name,
            e.shot_outcome,
            e.is_goal,
            p.end_location_x,
            p.end_location_y,
            p.pass_outcome,
            p.pass_type,
            p.pass_height,
            p.body_part,
            p.technique,
            m.competition,
            m.season,
            m.home_team_id,
            m.away_team_id,
            m.home_score,
            m.away_score
        FROM events e
        JOIN matches m ON e.match_id = m.match_id
        LEFT JOIN passes p ON e.event_id = p.event_id
    """
    return pd.read_sql_query(query, engine)


def build_team_strength_lookup(matches_df: pd.DataFrame) -> Dict[Tuple[int, str], float]:
    rows: List[Dict] = []
    for _, match in matches_df.iterrows():
        rows.append({
            'team_id': match['home_team_id'],
            'season': match['season'],
            'points': 3 if match['home_score'] > match['away_score'] else 1 if match['home_score'] == match['away_score'] else 0,
            'goal_diff': (match['home_score'] or 0) - (match['away_score'] or 0),
        })
        rows.append({
            'team_id': match['away_team_id'],
            'season': match['season'],
            'points': 3 if match['away_score'] > match['home_score'] else 1 if match['away_score'] == match['home_score'] else 0,
            'goal_diff': (match['away_score'] or 0) - (match['home_score'] or 0),
        })

    standings = pd.DataFrame(rows)
    summary = standings.groupby(['team_id', 'season']).agg(
        points_per_match=('points', 'mean'),
        goal_diff_per_match=('goal_diff', 'mean'),
    ).reset_index()
    return {
        (int(row['team_id']), row['season']): float(row['points_per_match'] + row['goal_diff_per_match'] * 0.1)
        for _, row in summary.iterrows()
    }


def attach_match_context(df: pd.DataFrame, matches_df: pd.DataFrame, team_strength_lookup: Dict[Tuple[int, str], float],
                         goals_df: pd.DataFrame | None = None) -> pd.DataFrame:
    enriched = df.copy()
    if enriched.empty:
        return enriched

    enriched['final_goal_diff'] = np.where(
        enriched['team_id'] == enriched['home_team_id'],
        enriched['home_score'].fillna(0) - enriched['away_score'].fillna(0),
        enriched['away_score'].fillna(0) - enriched['home_score'].fillna(0),
    )
    enriched['team_strength'] = [
        team_strength_lookup.get((int(team_id), season), 0.0)
        for team_id, season in zip(enriched['team_id'], enriched['season'])
    ]
    enriched['position_name'] = enriched['position_name'].fillna(enriched.get('player_position', 'Unknown')).fillna('Unknown')
    enriched['score_diff'] = 0.0

    if goals_df is None or goals_df.empty or 'event_index' not in enriched.columns:
        return enriched

    goal_map = goals_df.sort_values(['match_id', 'event_index']).groupby('match_id')
    for match_id, group in enriched.groupby('match_id'):
        if match_id not in goal_map.groups:
            continue
        goal_events = goal_map.get_group(match_id)
        home_team_id = int(group['home_team_id'].iloc[0])
        home_goal_idx = np.sort(goal_events.loc[goal_events['team_id'] == home_team_id, 'event_index'].dropna().to_numpy())
        away_goal_idx = np.sort(goal_events.loc[goal_events['team_id'] != home_team_id, 'event_index'].dropna().to_numpy())
        pass_idx = group['event_index'].fillna(-1).to_numpy()
        home_before = np.searchsorted(home_goal_idx, pass_idx, side='left')
        away_before = np.searchsorted(away_goal_idx, pass_idx, side='left')
        score_diff = np.where(group['team_id'].to_numpy() == home_team_id, home_before - away_before, away_before - home_before)
        enriched.loc[group.index, 'score_diff'] = score_diff

    return enriched


def grouped_split(df: pd.DataFrame, fraction: float = 0.15) -> Tuple[pd.DataFrame, pd.DataFrame]:
    match_ids = pd.Index(df['match_id']).unique().to_list()
    rng = np.random.default_rng(RANDOM_STATE)
    rng.shuffle(match_ids)
    cut = max(int(len(match_ids) * (1 - fraction)), 1)
    core_ids = set(match_ids[:cut])
    return df[df['match_id'].isin(core_ids)].copy(), df[~df['match_id'].isin(core_ids)].copy()


def sample_rows(df: pd.DataFrame, max_rows: int) -> pd.DataFrame:
    if len(df) <= max_rows:
        return df.copy()
    return df.sample(n=max_rows, random_state=RANDOM_STATE).copy()


def metric_pair(y_true, y_pred, average='binary') -> Dict[str, float]:
    return {
        'accuracy': float(accuracy_score(y_true, y_pred)),
        'f1': float(f1_score(y_true, y_pred, average=average)),
    }


def load_previous_report() -> Dict:
    if not REPORT_PATH.exists():
        return {}
    return json.loads(REPORT_PATH.read_text())


def evaluate_bucket_model(model, calibrator, X_hold: pd.DataFrame, y_hold: np.ndarray) -> Dict[str, float]:
    payload = X_hold.copy()
    if model.__class__.__name__.startswith('LGBM'):
        for col in PASS_CAT_COLS:
            payload[col] = payload[col].astype('category')
    proba = model.predict_proba(payload)[:, 1]
    if calibrator is not None:
        proba = np.clip(calibrator.transform(proba), 0, 1)
    preds = (proba >= 0.5).astype(int)
    return metric_pair(y_hold, preds)


def fit_pass_candidate(name: str, X_train: pd.DataFrame, y_train: np.ndarray, X_cal: pd.DataFrame, y_cal: np.ndarray):
    if name == 'CatBoost':
        model = CatBoostClassifier(
            iterations=250,
            depth=6,
            learning_rate=0.05,
            loss_function='Logloss',
            random_seed=RANDOM_STATE,
            verbose=False,
        )
        model.fit(X_train, y_train, cat_features=PASS_CAT_COLS)
    else:
        cat_indices = [X_train.columns.get_loc(col) for col in PASS_CAT_COLS]
        encoded_train = X_train.copy()
        encoded_cal = X_cal.copy()
        for col in PASS_CAT_COLS:
            encoded_train[col] = encoded_train[col].astype('category')
            encoded_cal[col] = encoded_cal[col].astype('category')

        model = lgb.LGBMClassifier(
            n_estimators=250,
            max_depth=8,
            learning_rate=0.05,
            subsample=0.85,
            colsample_bytree=0.85,
            random_state=RANDOM_STATE,
            n_jobs=-1,
            verbose=-1,
        )
        model.fit(encoded_train, y_train, categorical_feature=cat_indices)
        X_train = encoded_train
        X_cal = encoded_cal

    calibrator = None
    if len(X_cal) > 100:
        calibration_proba = model.predict_proba(X_cal)[:, 1]
        calibrator = IsotonicRegression(out_of_bounds='clip')
        calibrator.fit(calibration_proba, y_cal)

    return model, calibrator


def train_pass_difficulty(train_df: pd.DataFrame, holdout_df: pd.DataFrame, previous_report: Dict) -> Dict:
    print("Stage: pass difficulty")
    # Split for calibration set
    core_df, calib_df = grouped_split(train_df, 0.15)
    core_df = sample_rows(core_df, MAX_PASS_ROWS)
    calib_df = sample_rows(calib_df, max(int(MAX_PASS_ROWS * 0.15), 10_000))
    # Build pass features
    train_features = build_pass_feature_frame(core_df)
    calib_features = build_pass_feature_frame(calib_df) if not calib_df.empty else pd.DataFrame(columns=train_features.columns)
    holdout_features = build_pass_feature_frame(holdout_df)

    y_train = (core_df['pass_outcome'].isna() | core_df['pass_outcome'].eq('Complete')).astype(int).to_numpy()
    y_cal = (calib_df['pass_outcome'].isna() | calib_df['pass_outcome'].eq('Complete')).astype(int).to_numpy() if not calib_df.empty else np.array([])
    y_hold = (holdout_df['pass_outcome'].isna() | holdout_df['pass_outcome'].eq('Complete')).astype(int).to_numpy()
    y_train_series = pd.Series(y_train, index=train_features.index)
    y_cal_series = pd.Series(y_cal, index=calib_features.index) if not calib_features.empty else pd.Series(dtype=int)

    bucket_models = {}
    bucket_calibrators = {}
    leaderboard = []

    # Train general candidates
    general_results = []
    for candidate_name in ['CatBoost', 'LightGBM']:
        model, calibrator = fit_pass_candidate(candidate_name, train_features, y_train, calib_features, y_cal)
        metrics = evaluate_bucket_model(model, calibrator, holdout_features, y_hold)
        general_results.append((candidate_name, model, calibrator, metrics))

    best_general = max(general_results, key=lambda item: (item[3]['accuracy'], item[3]['f1']))
    bucket_models['GENERAL'] = best_general[1]
    bucket_calibrators['GENERAL'] = best_general[2]
    leaderboard.append({
        'bucket': 'GENERAL',
        'winner': best_general[0],
        'holdout': best_general[3],
    })

    # Train per pass-bucket model
    for bucket_name in ['SHORT', 'MEDIUM', 'LONG', 'CROSS', 'THROUGH_BALL', 'SET_PIECE']:
        train_mask = train_features['pass_bucket'] == bucket_name
        hold_mask = holdout_features['pass_bucket'] == bucket_name
        if train_mask.sum() < 500 or hold_mask.sum() < 100:
            continue

        bucket_results = []
        X_bucket = sample_rows(train_features.loc[train_mask], MAX_BUCKET_ROWS)
        y_bucket = y_train_series.loc[X_bucket.index].to_numpy()
        X_cal_bucket = sample_rows(calib_features.loc[calib_features['pass_bucket'] == bucket_name], max(int(MAX_BUCKET_ROWS * 0.2), 200)) if not calib_features.empty else pd.DataFrame(columns=train_features.columns)
        y_cal_bucket = y_cal_series.loc[X_cal_bucket.index].to_numpy() if not X_cal_bucket.empty else np.array([])
        X_hold_bucket = holdout_features.loc[hold_mask]
        y_hold_bucket = y_hold[hold_mask.to_numpy()]

        for candidate_name in ['CatBoost', 'LightGBM']:
            model, calibrator = fit_pass_candidate(candidate_name, X_bucket, y_bucket, X_cal_bucket, y_cal_bucket)
            metrics = evaluate_bucket_model(model, calibrator, X_hold_bucket, y_hold_bucket)
            bucket_results.append((candidate_name, model, calibrator, metrics))

        best_bucket = max(bucket_results, key=lambda item: (item[3]['accuracy'], item[3]['f1']))
        bucket_models[bucket_name] = best_bucket[1]
        bucket_calibrators[bucket_name] = best_bucket[2]
        leaderboard.append({
            'bucket': bucket_name,
            'winner': best_bucket[0],
            'holdout': best_bucket[3],
        })

    # Persist runtime artifact
    runtime_model = PassDifficultyModel()
    runtime_model.model = bucket_models['GENERAL']
    runtime_model.bucket_models = bucket_models
    runtime_model.bucket_calibrators = bucket_calibrators
    runtime_model.artifact_type = 'specialist_family'
    runtime_model.scaler = None
    runtime_model.is_trained = True
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    runtime_model.save_model(str(MODELS_DIR / 'pass_difficulty.joblib'))

    pass_probs = runtime_model.calculate_pass_difficulty(holdout_df)
    pass_pred = (1 - pass_probs >= 0.5).astype(int)
    holdout_metrics = metric_pair(y_hold, pass_pred)

    baseline = previous_report.get('pass_difficulty', {})
    return {
        'before': baseline.get('winner', baseline.get('baseline', {})),
        'after': holdout_metrics,
        'buckets': leaderboard,
        'bucket_count': len(bucket_models),
        'train_rows': int(len(train_df)),
        'holdout_rows': int(len(holdout_df)),
    }


def silver_label_scores(features: Dict[str, float]) -> Dict[str, float]:
    return {
        'KEY_PLAYER_DEPENDENCY': features['max_betweenness'] * 2.8 + features['gini_betweenness'] * 0.9,
        'LONG_BALL': features['long_pass_ratio'] * 2.6 + features['cross_ratio'] * 0.2 + (1 - min(features['avg_possession_length'] / 8, 1)),
        'DIRECT_PLAY': features['forward_ratio'] * 1.8 + features['progressive_pass_ratio'] * 1.2 + (1 - min(features['avg_possession_length'] / 10, 1)),
        'POSSESSION_RECYCLING': (features['backward_ratio'] + features['lateral_ratio']) * 1.4 + min(features['avg_possession_length'] / 8, 1) + features['ground_pass_ratio'] * 0.4,
        'WING_OVERLOAD_LEFT': max(-features['lateral_balance'], 0) * 2.5 + features['left_usage_ratio'] * 1.2,
        'WING_OVERLOAD_RIGHT': max(features['lateral_balance'], 0) * 2.5 + features['right_usage_ratio'] * 1.2,
        'CENTRAL_BUILDUP': features['center_ratio'] * 1.5 + features['center_usage_ratio'] * 1.1 + features['avg_clustering'] * 1.3,
        'BALANCED_ATTACK': (1 - min(features['gini_betweenness'], 1)) * 1.2 + (1 - abs(features['lateral_balance'])) + features['center_usage_ratio'] * 0.3,
    }


def choose_silver_label(features: Dict[str, float]) -> Tuple[str | None, float]:
    scores = silver_label_scores(features)
    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    best_label, best_score = ordered[0]
    second_score = ordered[1][1]
    if best_score < 1.15 or (best_score - second_score) < 0.18:
        return None, float(best_score)
    return best_label, float(best_score)


def build_tactical_dataset(passes_df: pd.DataFrame) -> pd.DataFrame:
    classifier = TacticalPatternClassifier()
    builder = NetworkBuilder()
    rows: List[Dict] = []
    source = passes_df.copy()
    if 'passer_name' not in source.columns:
        source['passer_name'] = source['passer_id'].apply(lambda value: f'Player {value}')
    if 'recipient_name' not in source.columns:
        source['recipient_name'] = source['recipient_id'].apply(lambda value: f'Player {value}' if pd.notna(value) else None)

    grouped = source.groupby(['match_id', 'team_id'])
    for (match_id, team_id), team_passes in grouped:
        successful = team_passes[
            team_passes['recipient_id'].notna()
            & (team_passes['pass_outcome'].isna() | team_passes['pass_outcome'].eq('Complete'))
        ].copy()
        if len(successful) < 12:
            continue

        graph = builder.build_pass_network(successful)
        if graph.number_of_nodes() < 5:
            continue

        node_positions = {
            node: (graph.nodes[node].get('x', 60), graph.nodes[node].get('y', 40))
            for node in graph.nodes()
        }
        features = classifier.extract_match_features(graph, node_positions, team_passes)
        label, confidence = choose_silver_label(features)
        if label is None:
            continue
        rows.append({
            **features,
            'match_id': match_id,
            'team_id': team_id,
            'label': label,
            'silver_confidence': confidence,
        })

    return pd.DataFrame(rows)


def evaluate_classifier(model, scaler, X_hold: pd.DataFrame, y_hold: np.ndarray, average='weighted') -> Dict[str, float]:
    X_scaled = scaler.transform(X_hold)
    preds = model.predict(X_scaled)
    return metric_pair(y_hold, preds, average=average)


def train_tactical_classifier(train_df: pd.DataFrame, holdout_df: pd.DataFrame, previous_report: Dict) -> Dict:
    print("Stage: tactical classifier")
    # Build silver-labeled dataset
    train_rows = build_tactical_dataset(train_df)
    holdout_rows = build_tactical_dataset(holdout_df)
    silver_export = pd.concat([train_rows.assign(split='train'), holdout_rows.assign(split='holdout')], ignore_index=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    silver_export.to_csv(TACTICAL_SILVER_PATH, index=False)

    feature_cols = [col for col in train_rows.columns if col not in {'match_id', 'team_id', 'label', 'silver_confidence'}]
    X_train = train_rows[feature_cols]
    y_train_labels = train_rows['label'].values
    X_hold = holdout_rows[feature_cols]
    y_hold_labels = holdout_rows['label'].values

    # Encode labels and weights
    label_encoder = LabelEncoder()
    y_train = label_encoder.fit_transform(y_train_labels)
    y_hold = label_encoder.transform(y_hold_labels)
    sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)

    # Scale numeric features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_hold_scaled = scaler.transform(X_hold)

    base_gb = GradientBoostingClassifier(n_estimators=220, max_depth=3, learning_rate=0.05, random_state=RANDOM_STATE)
    base_xgb = xgb.XGBClassifier(
        n_estimators=240,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        objective='multi:softprob',
        eval_metric='mlogloss',
    )
    base_rf = RandomForestClassifier(
        n_estimators=320,
        max_depth=12,
        min_samples_leaf=2,
        class_weight='balanced',
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    # Fit base learners
    base_gb.fit(X_train_scaled, y_train, sample_weight=sample_weights)
    base_xgb.fit(X_train_scaled, y_train, sample_weight=sample_weights)
    base_rf.fit(X_train_scaled, y_train, sample_weight=sample_weights)

    # Soft voting ensemble
    voter = VotingClassifier(
        estimators=[('gb', base_gb), ('xgb', base_xgb), ('rf', base_rf)],
        voting='soft',
        weights=[2, 2, 1],
    )
    voter.fit(X_train_scaled, y_train)
    min_class_count = int(pd.Series(y_train).value_counts().min())
    calibrated_voter = None
    if min_class_count >= 2:
        calibration_cv = min(3, min_class_count)
        calibrated_voter = CalibratedClassifierCV(voter, method='sigmoid', cv=calibration_cv)
        calibrated_voter.fit(X_train_scaled, y_train)

    candidate_results = [
        ('GradientBoosting', metric_pair(y_hold, base_gb.predict(X_hold_scaled), average='weighted')),
        ('XGBoost', metric_pair(y_hold, base_xgb.predict(X_hold_scaled), average='weighted')),
        ('RandomForest', metric_pair(y_hold, base_rf.predict(X_hold_scaled), average='weighted')),
    ]
    if calibrated_voter is not None:
        candidate_results.append(('CalibratedEnsemble', metric_pair(y_hold, calibrated_voter.predict(X_hold_scaled), average='weighted')))
    else:
        candidate_results.append(('SoftVotingEnsemble', metric_pair(y_hold, voter.predict(X_hold_scaled), average='weighted')))
    # Save classifier artifact
    runtime_classifier = TacticalPatternClassifier()
    runtime_classifier.feature_columns = feature_cols
    runtime_classifier.classifier = calibrated_voter if calibrated_voter is not None else voter
    runtime_classifier.classifier_scaler = scaler
    runtime_classifier.scaler = scaler
    runtime_classifier.is_trained = True
    runtime_classifier.train_kmeans(X_train.to_dict('records'))
    runtime_classifier.save_model(str(MODELS_DIR / 'tactical_classifier.joblib'))

    baseline = previous_report.get('tactical_classifier', {})
    return {
        'before': baseline.get('winner', baseline.get('baseline', {})),
        'after': candidate_results[-1][1],
        'winner': candidate_results[-1][0],
        'candidate_results': [
            {'name': name, **metrics}
            for name, metrics in candidate_results
        ],
        'train_rows': int(len(train_rows)),
        'holdout_rows': int(len(holdout_rows)),
        'classes': label_encoder.classes_.tolist(),
        'silver_label_artifact': str(TACTICAL_SILVER_PATH),
    }


def train_vaep(actions_df: pd.DataFrame, previous_report: Dict) -> Dict:
    print("Stage: vaep")
    # Split and train VAEP
    train_df, holdout_df, holdout_info = split_holdout(actions_df)
    train_df = sample_rows(train_df, MAX_VAEP_ROWS)
    model = VAEPModel()
    train_metrics = model.train(train_df)

    # Score on holdout
    X_hold = model.extract_features(holdout_df)
    y_score_hold, y_concede_hold = model.create_labels(holdout_df)
    holdout_metrics = {
        'scoring_accuracy': float(model.scoring_model.score(X_hold, y_score_hold)),
        'conceding_accuracy': float(model.conceding_model.score(X_hold, y_concede_hold)),
    }
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model.save_model(str(MODELS_DIR / 'vaep_model.joblib'))

    baseline = previous_report.get('vaep', {})
    return {
        'before': baseline.get('holdout_metrics', baseline.get('train_metrics', {})),
        'after': holdout_metrics,
        'train_metrics': train_metrics,
        'holdout_rows': int(len(holdout_df)),
        'holdout_info': holdout_info,
    }


def runtime_smoke_check() -> Dict[str, bool]:
    pipeline = MLAnalysisPipeline(str(MODELS_DIR))
    return {
        'vaep_trained': bool(pipeline.vaep_model.is_trained),
        'pass_model_trained': bool(pipeline.pass_model.is_trained),
        'pattern_classifier_trained': bool(pipeline.pattern_classifier.is_trained),
        'pattern_kmeans_trained': bool(pipeline.pattern_classifier.kmeans_trained),
    }


def main():
    print("=" * 72)
    print("TACTIX ML >95 PROGRAM")
    print("=" * 72)

    init_db()
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    previous_report = load_previous_report()

    # Load and enrich datasets
    matches_df = load_matches_df()
    team_strength_lookup = build_team_strength_lookup(matches_df)
    actions_df = load_actions_df()
    goals_df = actions_df[actions_df['is_goal'].fillna(0).astype(bool)].copy()
    actions_df = attach_match_context(actions_df, matches_df, team_strength_lookup, goals_df)

    passes_df = load_passes_df()
    passes_df = attach_match_context(passes_df, matches_df, team_strength_lookup, goals_df)
    train_passes, holdout_passes, holdout_info = split_holdout(passes_df)

    # Run all training stages
    pass_results = train_pass_difficulty(train_passes, holdout_passes, previous_report)
    tactical_results = train_tactical_classifier(train_passes, holdout_passes, previous_report)
    vaep_results = train_vaep(actions_df, previous_report)
    smoke = runtime_smoke_check()

    report = {
        'dataset': {
            'generated_at': pd.Timestamp.utcnow().isoformat(),
            'total_matches': int(matches_df['match_id'].nunique()),
            'total_pass_rows': int(len(passes_df)),
            'total_action_rows': int(len(actions_df)),
            'holdout': holdout_info,
        },
        'pass_difficulty': pass_results,
        'tactical_classifier': tactical_results,
        'vaep': vaep_results,
        'runtime_smoke_check': smoke,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2))

    print(f"Pass difficulty holdout accuracy: {pass_results['after']['accuracy']:.2%}")
    print(f"Tactical holdout accuracy: {tactical_results['after']['accuracy']:.2%}")
    print(f"Tactical holdout F1: {tactical_results['after']['f1']:.2%}")
    print(f"VAEP holdout scoring accuracy: {vaep_results['after']['scoring_accuracy']:.2%}")
    print(f"VAEP holdout conceding accuracy: {vaep_results['after']['conceding_accuracy']:.2%}")
    print(f"Report written to {REPORT_PATH}")


if __name__ == '__main__':
    main()
