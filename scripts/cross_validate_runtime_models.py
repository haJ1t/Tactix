"""
Canonical cross-validation and diagnostics for the enriched Tactix runtime models.

This script evaluates the same enriched pass-difficulty and tactical-classifier
pipelines used by the current runtime training stack. It is the source of truth
for grouped CV diagnostics and fixed-holdout comparison.
"""

from __future__ import annotations

import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GroupKFold, StratifiedGroupKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, ROOT_DIR)
sys.path.insert(0, BACKEND_DIR)
os.chdir(ROOT_DIR)

from scripts.finetune_runtime_models import (  # noqa: E402
    MODELS_DIR,
    RANDOM_STATE,
    TACTICAL_SILVER_PATH,
    attach_match_context,
    build_tactical_dataset,
    build_team_strength_lookup,
    fit_pass_candidate,
    grouped_split,
    load_matches_df,
    load_passes_df,
    load_previous_report,
    sample_rows,
)
from backend.services.ml.holdout_utils import split_holdout  # noqa: E402
from backend.services.ml.rich_features import PASS_CAT_COLS, build_pass_feature_frame  # noqa: E402
from backend.models import init_db  # noqa: E402
import xgboost as xgb  # noqa: E402


CV_REPORT_PATH = MODELS_DIR / "cv_report.json"
PASS_CV_MAX_ROWS = 80_000
PASS_CV_FOLDS = 5
TACTICAL_CV_FOLDS = 5
TACTICAL_LABEL_POLICY = "confidence_filtered_silver_labels"


def to_builtin(value):
    if isinstance(value, dict):
        return {str(key): to_builtin(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_builtin(item) for item in value]
    if isinstance(value, tuple):
        return [to_builtin(item) for item in value]
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def pass_target(df: pd.DataFrame) -> pd.Series:
    return (df["pass_outcome"].isna() | df["pass_outcome"].eq("Complete")).astype(int)


def predict_pass_binary(model, calibrator, features: pd.DataFrame) -> np.ndarray:
    payload = features.copy()
    if model.__class__.__name__.startswith("LGBM"):
        for col in PASS_CAT_COLS:
            payload[col] = payload[col].astype("category")
    probabilities = model.predict_proba(payload)[:, 1]
    if calibrator is not None:
        probabilities = np.clip(calibrator.transform(probabilities), 0, 1)
    return (probabilities >= 0.5).astype(int)


def build_pass_fold_model(train_df: pd.DataFrame):
    core_df, calib_df = grouped_split(train_df, 0.15)
    core_df = sample_rows(core_df, PASS_CV_MAX_ROWS)
    calib_df = sample_rows(calib_df, max(int(PASS_CV_MAX_ROWS * 0.15), 5_000))

    X_train = build_pass_feature_frame(core_df)
    y_train = pass_target(core_df).to_numpy()
    X_cal = build_pass_feature_frame(calib_df) if not calib_df.empty else pd.DataFrame(columns=X_train.columns)
    y_cal = pass_target(calib_df).to_numpy() if not calib_df.empty else np.array([])
    return fit_pass_candidate("LightGBM", X_train, y_train, X_cal, y_cal)


def build_tactical_ensemble() -> VotingClassifier:
    gb = GradientBoostingClassifier(
        n_estimators=220,
        max_depth=3,
        learning_rate=0.05,
        random_state=RANDOM_STATE,
    )
    rf = RandomForestClassifier(
        n_estimators=320,
        max_depth=12,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    xgb_model = xgb.XGBClassifier(
        n_estimators=240,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        objective="multi:softprob",
        eval_metric="mlogloss",
        verbosity=0,
    )
    return VotingClassifier(
        estimators=[("gb", gb), ("xgb", xgb_model), ("rf", rf)],
        voting="soft",
        weights=[2, 2, 1],
    )


def summarize_per_class(y_true, y_pred, labels: List[str]) -> List[Dict]:
    report = classification_report(
        y_true,
        y_pred,
        labels=labels,
        output_dict=True,
        zero_division=0,
    )
    rows = []
    for label in labels:
        metrics = report.get(label, {})
        rows.append({
            "label": label,
            "precision": float(metrics.get("precision", 0.0)),
            "recall": float(metrics.get("recall", 0.0)),
            "f1": float(metrics.get("f1-score", 0.0)),
            "support": int(metrics.get("support", 0)),
        })
    return rows


def compare_metric_sets(current: Dict, reference: Dict, f1_key: str) -> Dict:
    if not reference:
        return {"latest_finetune": None, "delta": None}
    reference_f1_key = f1_key if f1_key in reference else "f1"
    return {
        "latest_finetune": reference,
        "delta": {
            "accuracy": float(current.get("accuracy", 0.0) - reference.get("accuracy", 0.0)),
            f1_key: float(current.get(f1_key, 0.0) - reference.get(reference_f1_key, 0.0)),
        },
    }


def evaluate_pass(train_df: pd.DataFrame, holdout_df: pd.DataFrame, previous_report: Dict) -> Dict:
    sampled_train = sample_rows(train_df, PASS_CV_MAX_ROWS)
    features = build_pass_feature_frame(sampled_train)
    y = pass_target(sampled_train).to_numpy()
    groups = sampled_train["match_id"].to_numpy()

    splitter = GroupKFold(n_splits=PASS_CV_FOLDS)
    fold_rows: List[Dict] = []
    aggregate_true: List[int] = []
    aggregate_pred: List[int] = []

    for fold_index, (train_idx, test_idx) in enumerate(splitter.split(features, y, groups), start=1):
        fold_train_df = sampled_train.iloc[train_idx].copy()
        fold_test_df = sampled_train.iloc[test_idx].copy()
        model, calibrator = build_pass_fold_model(fold_train_df)
        X_test = build_pass_feature_frame(fold_test_df)
        y_test = pass_target(fold_test_df).to_numpy()
        preds = predict_pass_binary(model, calibrator, X_test)

        aggregate_true.extend(y_test.tolist())
        aggregate_pred.extend(preds.tolist())
        fold_rows.append({
            "fold": fold_index,
            "rows": int(len(y_test)),
            "accuracy": float(accuracy_score(y_test, preds)),
            "f1": float(f1_score(y_test, preds, zero_division=0)),
            "match_count": int(fold_test_df["match_id"].nunique()),
        })

    full_model, full_calibrator = build_pass_fold_model(train_df)
    holdout_features = build_pass_feature_frame(holdout_df)
    holdout_truth = pass_target(holdout_df).to_numpy()
    holdout_pred = predict_pass_binary(full_model, full_calibrator, holdout_features)

    holdout_metrics = {
        "accuracy": float(accuracy_score(holdout_truth, holdout_pred)),
        "f1": float(f1_score(holdout_truth, holdout_pred, zero_division=0)),
    }
    confusion = confusion_matrix(aggregate_true, aggregate_pred, labels=[0, 1]).tolist()
    holdout_confusion = confusion_matrix(holdout_truth, holdout_pred, labels=[0, 1]).tolist()

    previous = previous_report.get("pass_difficulty", {})
    previous_after = previous.get("after", previous.get("winner", {}))

    return {
        "model": "LightGBM enriched general pass model",
        "sample_rows": int(len(sampled_train)),
        "fold_count": PASS_CV_FOLDS,
        "folds": fold_rows,
        "cv_summary": {
            "mean_accuracy": float(np.mean([row["accuracy"] for row in fold_rows])),
            "std_accuracy": float(np.std([row["accuracy"] for row in fold_rows])),
            "mean_f1": float(np.mean([row["f1"] for row in fold_rows])),
            "std_f1": float(np.std([row["f1"] for row in fold_rows])),
        },
        "cv_confusion_matrix": {
            "labels": ["failed", "successful"],
            "matrix": confusion,
        },
        "holdout": {
            **holdout_metrics,
            "rows": int(len(holdout_df)),
            "match_count": int(holdout_df["match_id"].nunique()),
            "confusion_matrix": {
                "labels": ["failed", "successful"],
                "matrix": holdout_confusion,
            },
        },
        "comparison": compare_metric_sets(holdout_metrics, previous_after, "f1"),
    }


def fit_tactical_model(train_rows: pd.DataFrame):
    feature_cols = [col for col in train_rows.columns if col not in {"match_id", "team_id", "label", "silver_confidence"}]
    encoder = LabelEncoder()
    y_train = encoder.fit_transform(train_rows["label"].astype(str))
    scaler = StandardScaler()
    X_train = scaler.fit_transform(train_rows[feature_cols])
    model = build_tactical_ensemble()
    model.fit(X_train, y_train)
    return model, scaler, encoder, feature_cols


def evaluate_tactical(train_rows: pd.DataFrame, holdout_rows: pd.DataFrame, previous_report: Dict) -> Dict:
    feature_cols = [col for col in train_rows.columns if col not in {"match_id", "team_id", "label", "silver_confidence"}]
    X = train_rows[feature_cols].copy()
    labels = train_rows["label"].astype(str).to_numpy()
    groups = train_rows["match_id"].to_numpy()

    encoder = LabelEncoder()
    y = encoder.fit_transform(labels)
    splitter = StratifiedGroupKFold(n_splits=TACTICAL_CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)

    fold_rows: List[Dict] = []
    aggregate_true: List[str] = []
    aggregate_pred: List[str] = []

    for fold_index, (train_idx, test_idx) in enumerate(splitter.split(X, y, groups), start=1):
        X_train = X.iloc[train_idx].copy()
        X_test = X.iloc[test_idx].copy()
        y_train_labels = labels[train_idx]
        y_test_labels = labels[test_idx]

        train_encoder = LabelEncoder()
        y_train = train_encoder.fit_transform(y_train_labels)
        valid_mask = np.isin(y_test_labels, train_encoder.classes_)
        filtered_test = X_test.iloc[valid_mask].copy()
        filtered_truth = y_test_labels[valid_mask]

        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(filtered_test)

        model = build_tactical_ensemble()
        model.fit(X_train_scaled, y_train)
        preds = train_encoder.inverse_transform(model.predict(X_test_scaled))

        aggregate_true.extend(filtered_truth.tolist())
        aggregate_pred.extend(preds.tolist())
        fold_rows.append({
            "fold": fold_index,
            "rows": int(len(filtered_truth)),
            "skipped_rows": int((~valid_mask).sum()),
            "match_count": int(train_rows.iloc[test_idx]["match_id"].nunique()),
            "heldout_classes": sorted(pd.Index(filtered_truth).unique().tolist()),
            "accuracy": float(accuracy_score(filtered_truth, preds)),
            "f1_weighted": float(f1_score(filtered_truth, preds, average="weighted", zero_division=0)),
        })

    effective_classes = sorted(pd.unique(np.concatenate([np.asarray(aggregate_true, dtype=object), np.asarray(aggregate_pred, dtype=object)])).tolist())
    confusion = confusion_matrix(aggregate_true, aggregate_pred, labels=effective_classes).tolist()
    per_class = summarize_per_class(aggregate_true, aggregate_pred, effective_classes)

    model, scaler, holdout_encoder, feature_cols = fit_tactical_model(train_rows)
    holdout_mask = holdout_rows["label"].astype(str).isin(holdout_encoder.classes_)
    effective_holdout = holdout_rows.loc[holdout_mask].copy()
    X_hold = scaler.transform(effective_holdout[feature_cols])
    holdout_truth = effective_holdout["label"].astype(str).to_numpy()
    holdout_pred = holdout_encoder.inverse_transform(model.predict(X_hold))
    holdout_classes = sorted(pd.unique(np.concatenate([np.asarray(holdout_truth, dtype=object), np.asarray(holdout_pred, dtype=object)])).tolist())
    holdout_metrics = {
        "accuracy": float(accuracy_score(holdout_truth, holdout_pred)),
        "f1_weighted": float(f1_score(holdout_truth, holdout_pred, average="weighted", zero_division=0)),
        "rows": int(len(effective_holdout)),
        "skipped_rows": int((~holdout_mask).sum()),
        "match_count": int(effective_holdout["match_id"].nunique()),
        "classes": holdout_classes,
        "confusion_matrix": {
            "labels": holdout_classes,
            "matrix": confusion_matrix(holdout_truth, holdout_pred, labels=holdout_classes).tolist(),
        },
        "per_class_metrics": summarize_per_class(holdout_truth, holdout_pred, holdout_classes),
    }

    previous = previous_report.get("tactical_classifier", {})
    previous_after = previous.get("after", {})

    return {
        "label_policy": TACTICAL_LABEL_POLICY,
        "model": "SoftVotingEnsemble",
        "rows": int(len(train_rows)),
        "classes": sorted(train_rows["label"].astype(str).unique().tolist()),
        "silver_label_artifact": str(TACTICAL_SILVER_PATH) if TACTICAL_SILVER_PATH.exists() else None,
        "fold_count": TACTICAL_CV_FOLDS,
        "folds": fold_rows,
        "cv_summary": {
            "mean_accuracy": float(np.mean([row["accuracy"] for row in fold_rows])),
            "std_accuracy": float(np.std([row["accuracy"] for row in fold_rows])),
            "mean_f1_weighted": float(np.mean([row["f1_weighted"] for row in fold_rows])),
            "std_f1_weighted": float(np.std([row["f1_weighted"] for row in fold_rows])),
            "evaluated_rows": int(len(aggregate_true)),
            "skipped_rows": int(sum(row["skipped_rows"] for row in fold_rows)),
        },
        "cv_confusion_matrix": {
            "labels": effective_classes,
            "matrix": confusion,
        },
        "cv_per_class_metrics": per_class,
        "holdout": holdout_metrics,
        "comparison": compare_metric_sets(holdout_metrics, previous_after, "f1_weighted"),
    }


def build_report() -> Dict:
    init_db()
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    previous_report = load_previous_report()
    matches_df = load_matches_df()
    passes_df = load_passes_df()
    team_strength_lookup = build_team_strength_lookup(matches_df)
    passes_df = attach_match_context(passes_df, matches_df, team_strength_lookup)
    train_passes, holdout_passes, holdout_info = split_holdout(passes_df)

    tactical_train_rows = build_tactical_dataset(train_passes)
    tactical_holdout_rows = build_tactical_dataset(holdout_passes)
    train_class_counts = tactical_train_rows["label"].value_counts()
    tactical_train_rows = tactical_train_rows[tactical_train_rows["label"].isin(train_class_counts[train_class_counts >= TACTICAL_CV_FOLDS].index)].copy()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "scripts/cross_validate_runtime_models.py",
        "benchmark_holdout": {
            **holdout_info,
            "display_name": "World Cup 2022",
        },
        "dataset": {
            "total_matches": int(matches_df["match_id"].nunique()),
            "total_pass_rows": int(len(passes_df)),
            "train_pass_rows": int(len(train_passes)),
            "holdout_pass_rows": int(len(holdout_passes)),
            "tactical_train_rows": int(len(tactical_train_rows)),
            "tactical_holdout_rows": int(len(tactical_holdout_rows)),
        },
        "pass_difficulty": evaluate_pass(train_passes, holdout_passes, previous_report),
        "tactical_classifier": evaluate_tactical(tactical_train_rows, tactical_holdout_rows, previous_report),
        "finetune_reference": previous_report,
    }
    return to_builtin(report)


def print_summary(report: Dict):
    pass_summary = report["pass_difficulty"]["cv_summary"]
    pass_holdout = report["pass_difficulty"]["holdout"]
    tactical_summary = report["tactical_classifier"]["cv_summary"]
    tactical_holdout = report["tactical_classifier"]["holdout"]

    print("=" * 72)
    print("TACTIX RUNTIME MODEL CROSS-VALIDATION")
    print("=" * 72)
    print(f"Holdout benchmark: {report['benchmark_holdout']['display_name']}")
    print(
        f"Pass CV: {pass_summary['mean_accuracy']:.2%} acc +/- {pass_summary['std_accuracy']:.2%}, "
        f"{pass_summary['mean_f1']:.2%} F1"
    )
    print(
        f"Pass holdout: {pass_holdout['accuracy']:.2%} acc, "
        f"{pass_holdout['f1']:.2%} F1 over {pass_holdout['rows']:,} rows"
    )
    print(
        f"Tactical CV: {tactical_summary['mean_accuracy']:.2%} acc +/- {tactical_summary['std_accuracy']:.2%}, "
        f"{tactical_summary['mean_f1_weighted']:.2%} weighted F1"
    )
    print(
        f"Tactical holdout: {tactical_holdout['accuracy']:.2%} acc, "
        f"{tactical_holdout['f1_weighted']:.2%} weighted F1 over {tactical_holdout['rows']} rows"
    )
    print(f"Report written to {CV_REPORT_PATH}")


def main():
    report = build_report()
    CV_REPORT_PATH.write_text(json.dumps(report, indent=2))
    print_summary(report)


if __name__ == "__main__":
    main()
