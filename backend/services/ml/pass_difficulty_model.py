"""
Pass Difficulty Model
Based on McHale & Relton (2018) approach.

Models pass difficulty to weight network edges.
Difficult completed passes are more valuable than easy passes.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import joblib
import os

from .rich_features import PASS_CAT_COLS, PASS_NUMERIC_COLS, assign_pass_bucket, build_pass_feature_frame


class PassDifficultyModel:
    """
    Model pass difficulty to weight network edges.
    """

    def __init__(self):
        self.model_params = {
            'n_estimators': 100,
            'max_depth': 10,
            'random_state': 42
        }
        self.model = RandomForestClassifier(**self.model_params)
        # Legacy scaler retained for backward compatibility with older saved models
        self.scaler = StandardScaler()
        self.is_trained = False
        self.numeric_cols = list(PASS_NUMERIC_COLS)
        self.cat_cols = list(PASS_CAT_COLS)
        self.bucket_models = {}
        self.bucket_calibrators = {}
        self.artifact_type = 'single_model'

    def extract_pass_features(self, passes_df: pd.DataFrame) -> pd.DataFrame:
        """Extract features that determine pass difficulty."""
        return build_pass_feature_frame(passes_df)

    def train(self, passes_df: pd.DataFrame) -> dict:
        """
        Train model to predict pass success.
        Difficult passes = lower success rate.
        """
        X = self.extract_pass_features(passes_df)

        # Get outcome
        outcome_col = None
        for col in ['pass_outcome', 'outcome', 'result']:
            if col in passes_df.columns:
                outcome_col = col
                break

        if outcome_col:
            y = passes_df[outcome_col].apply(
                lambda x: 1 if x in [None, 'Complete', 'Success', 'Successful'] or pd.isna(x) else 0
            ).values
        else:
            # Assume all passes are complete if no outcome column
            y = np.ones(len(X))

        preprocessor = ColumnTransformer(
            [('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), self.cat_cols)],
            remainder='passthrough'
        )
        base_model = RandomForestClassifier(**self.model_params)
        self.model = Pipeline([
            ('preprocess', preprocessor),
            ('model', base_model)
        ])
        self.bucket_models = {}
        self.bucket_calibrators = {}
        self.artifact_type = 'single_model'
        # Pipeline includes preprocessing; scaler is not used for new models.
        self.scaler = None
        self.model.fit(X, y)
        self.is_trained = True

        accuracy = self.model.score(X, y)

        feature_importance = {}
        if hasattr(self.model, 'named_steps'):
            clf = self.model.named_steps['model']
            pre = self.model.named_steps['preprocess']
            if hasattr(clf, 'feature_importances_'):
                feature_names = pre.get_feature_names_out()
                feature_importance = dict(zip(feature_names, clf.feature_importances_))

        return {
            'accuracy': accuracy,
            'samples_used': len(X),
            'feature_importance': feature_importance
        }

    def calculate_pass_difficulty(self, passes_df: pd.DataFrame) -> np.ndarray:
        """
        Calculate difficulty score for each pass.
        Difficulty = 1 - P(success)
        """
        X = self.extract_pass_features(passes_df)

        if not self.is_trained:
            # Use heuristic based on distance and direction
            distance_factor = np.clip(X['distance'].values / 50, 0, 1)
            backward_penalty = np.where(X['forward_distance'].values < 0, 0.1, 0)
            difficulty = distance_factor + backward_penalty
            return np.clip(difficulty, 0, 1)

        if self.bucket_models:
            p_success = self._predict_bucket_probabilities(X, passes_df)
        elif hasattr(self.model, 'named_steps'):
            p_success = self.model.predict_proba(X)[:, 1]
        else:
            X_num = X[self.numeric_cols]
            if self.scaler is not None:
                X_scaled = self.scaler.transform(X_num)
            else:
                X_scaled = X_num
            p_success = self.model.predict_proba(X_scaled)[:, 1]

        # Difficulty = 1 - success probability
        difficulty = 1 - p_success

        return difficulty

    def calculate_pass_value(self, passes_df: pd.DataFrame,
                             vaep_model=None) -> np.ndarray:
        """
        Calculate pass value combining difficulty and VAEP.

        Value = Difficulty × VAEP (if completed)
        """
        difficulty = self.calculate_pass_difficulty(passes_df)

        # Get outcome
        outcome_col = None
        for col in ['pass_outcome', 'outcome', 'result']:
            if col in passes_df.columns:
                outcome_col = col
                break

        if outcome_col:
            completed = passes_df[outcome_col].apply(
                lambda x: 1 if x in [None, 'Complete', 'Success', 'Successful'] or pd.isna(x) else 0
            ).values
        else:
            completed = np.ones(len(passes_df))

        if vaep_model and vaep_model.is_trained:
            vaep_df = vaep_model.calculate_vaep(passes_df)
            vaep_values = vaep_df['vaep_value'].values

            # Completed passes get positive value, failed get negative
            value = difficulty * vaep_values * (2 * completed - 1)
        else:
            # Without VAEP, use difficulty and progress
            features = self.extract_pass_features(passes_df)
            progress = features['goal_progress'].values / 30  # Normalize

            # Value = difficulty * progress for completed, penalty for failed
            value = difficulty * (progress + 0.1) * completed - (1 - completed) * 0.2

        return value

    def get_weighted_edges(self, passes_df: pd.DataFrame) -> pd.DataFrame:
        """
        Return passes with calculated weights for network construction.
        """
        result = passes_df.copy()
        result['difficulty'] = self.calculate_pass_difficulty(passes_df)
        result['pass_value'] = self.calculate_pass_value(passes_df)
        return result

    def _apply_calibrator(self, bucket: str, probabilities: np.ndarray) -> np.ndarray:
        calibrator = self.bucket_calibrators.get(bucket)
        if calibrator is None:
            return probabilities
        if hasattr(calibrator, 'transform'):
            return np.clip(calibrator.transform(probabilities), 0, 1)
        if hasattr(calibrator, 'predict'):
            return np.clip(calibrator.predict(probabilities), 0, 1)
        return probabilities

    def _predict_bucket_probabilities(self, features: pd.DataFrame, passes_df: pd.DataFrame) -> np.ndarray:
        buckets = assign_pass_bucket(passes_df)
        probabilities = np.zeros(len(features), dtype=float)
        fallback_model = self.bucket_models.get('GENERAL', self.model)

        for bucket in buckets.unique():
            mask = buckets == bucket
            model = self.bucket_models.get(bucket, fallback_model)
            if model is None:
                probabilities[mask] = 0.5
                continue
            bucket_features = features.loc[mask].copy()
            if model.__class__.__name__.startswith('LGBM'):
                for col in self.cat_cols:
                    bucket_features[col] = bucket_features[col].astype('category')
            bucket_probs = model.predict_proba(bucket_features)[:, 1]
            probabilities[mask] = self._apply_calibrator(bucket, bucket_probs)

        return probabilities

    def save_model(self, path: str):
        """Save trained model."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = {
            'model': self.model,
            'is_trained': self.is_trained,
            'numeric_cols': self.numeric_cols,
            'cat_cols': self.cat_cols,
            'artifact_type': self.artifact_type,
            'bucket_models': self.bucket_models,
            'bucket_calibrators': self.bucket_calibrators,
        }
        # Preserve scaler for legacy compatibility if present
        if self.scaler is not None:
            data['scaler'] = self.scaler
        joblib.dump(data, path)

    def load_model(self, path: str):
        """Load trained model with integrity verification."""
        from utils.security import secure_joblib_load

        data = secure_joblib_load(path, joblib.load)
        if data is None:
            self.is_trained = False
            return

        try:
            self.model = data.get('model', data)
            self.scaler = data.get('scaler', None)
            self.is_trained = data.get('is_trained', False)
            self.numeric_cols = data.get('numeric_cols', self.numeric_cols)
            self.cat_cols = data.get('cat_cols', self.cat_cols)
            self.artifact_type = data.get('artifact_type', 'single_model')
            self.bucket_models = data.get('bucket_models', {})
            self.bucket_calibrators = data.get('bucket_calibrators', {})
        except Exception as e:
            self.is_trained = False
            print(f"Warning: Failed to load pass difficulty model from {path}: {e}")
