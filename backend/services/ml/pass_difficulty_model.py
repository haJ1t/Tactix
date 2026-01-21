"""
Pass Difficulty Model
Based on McHale & Relton (2018) approach.

Models pass difficulty to weight network edges.
Difficult completed passes are more valuable than easy passes.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import joblib
import os


class PassDifficultyModel:
    """
    Model pass difficulty to weight network edges.
    """

    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.is_trained = False

    def extract_pass_features(self, passes_df: pd.DataFrame) -> pd.DataFrame:
        """Extract features that determine pass difficulty."""
        features = pd.DataFrame()

        # Get coordinates
        start_x = passes_df.get('location_x', passes_df.get('start_x', 60)).fillna(60)
        start_y = passes_df.get('location_y', passes_df.get('start_y', 40)).fillna(40)
        end_x = passes_df.get('end_location_x', passes_df.get('end_x', 60)).fillna(60)
        end_y = passes_df.get('end_location_y', passes_df.get('end_y', 40)).fillna(40)

        # Pass distance
        features['distance'] = np.sqrt(
            (end_x - start_x)**2 +
            (end_y - start_y)**2
        )

        # Pass direction (forward = positive)
        features['forward_distance'] = end_x - start_x

        # Lateral movement
        features['lateral_distance'] = np.abs(end_y - start_y)

        # Starting position (passes from defensive third are harder to progress)
        features['start_third'] = pd.cut(
            start_x,
            bins=[-1, 40, 80, 121],
            labels=[0, 1, 2]
        ).astype(float).fillna(1)

        # End position (passes into final third are more valuable)
        features['end_third'] = pd.cut(
            end_x,
            bins=[-1, 40, 80, 121],
            labels=[0, 1, 2]
        ).astype(float).fillna(1)

        # Progressive pass (moves ball significantly forward)
        features['is_progressive'] = (features['forward_distance'] > 10).astype(int)

        # Pass into box
        features['into_box'] = (
            (end_x > 102) &
            (end_y > 18) &
            (end_y < 62)
        ).astype(int)

        # Pass angle (in radians)
        features['angle'] = np.arctan2(
            end_y - start_y,
            end_x - start_x
        )

        # Distance to goal at start
        features['start_dist_goal'] = np.sqrt(
            (120 - start_x)**2 + (40 - start_y)**2
        )

        # Distance to goal at end
        features['end_dist_goal'] = np.sqrt(
            (120 - end_x)**2 + (40 - end_y)**2
        )

        # Progress towards goal
        features['goal_progress'] = features['start_dist_goal'] - features['end_dist_goal']

        # Pass length categories
        features['is_short'] = (features['distance'] < 10).astype(int)
        features['is_medium'] = ((features['distance'] >= 10) & (features['distance'] < 25)).astype(int)
        features['is_long'] = (features['distance'] >= 25).astype(int)

        return features.fillna(0)

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

        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self.is_trained = True

        accuracy = self.model.score(X_scaled, y)

        return {
            'accuracy': accuracy,
            'samples_used': len(X),
            'feature_importance': dict(zip(X.columns, self.model.feature_importances_))
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

        X_scaled = self.scaler.transform(X)

        # Probability of success
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

    def save_model(self, path: str):
        """Save trained model."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'is_trained': self.is_trained
        }, path)

    def load_model(self, path: str):
        """Load trained model."""
        if os.path.exists(path):
            data = joblib.load(path)
            self.model = data['model']
            self.scaler = data['scaler']
            self.is_trained = data['is_trained']
