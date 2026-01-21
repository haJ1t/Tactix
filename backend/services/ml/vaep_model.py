"""
VAEP (Valuing Actions by Estimating Probabilities)
Based on Decroos et al. (2019)

Assigns value to every on-ball action by measuring how much it 
increases/decreases the probability of scoring and conceding.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
import joblib
import os


class VAEPModel:
    """
    Valuing Actions by Estimating Probabilities (VAEP)
    """

    def __init__(self):
        self.scoring_model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        self.conceding_model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        self.feature_columns = []
        self.is_trained = False

    def extract_features(self, actions_df: pd.DataFrame) -> pd.DataFrame:
        """
        Extract SPADL-style features from actions.

        Features include:
        - Start/end location (x, y coordinates)
        - Distance to goal
        - Angle to goal
        - Movement distance and direction
        - Time features
        """
        features = pd.DataFrame()

        # Location features
        features['start_x'] = actions_df['location_x'].fillna(60)
        features['start_y'] = actions_df['location_y'].fillna(40)
        features['end_x'] = actions_df.get('end_location_x', actions_df['location_x']).fillna(60)
        features['end_y'] = actions_df.get('end_location_y', actions_df['location_y']).fillna(40)

        # Distance to goal (goal at x=120, y=40)
        features['dist_to_goal'] = np.sqrt(
            (120 - features['start_x'])**2 +
            (40 - features['start_y'])**2
        )

        # End distance to goal
        features['end_dist_to_goal'] = np.sqrt(
            (120 - features['end_x'])**2 +
            (40 - features['end_y'])**2
        )

        # Angle to goal
        features['angle_to_goal'] = np.arctan2(
            40 - features['start_y'],
            120 - features['start_x']
        )

        # Movement distance
        features['dx'] = features['end_x'] - features['start_x']
        features['dy'] = features['end_y'] - features['start_y']
        features['movement'] = np.sqrt(features['dx']**2 + features['dy']**2)

        # Progress towards goal
        features['progress'] = features['dist_to_goal'] - features['end_dist_to_goal']

        # Time features
        if 'minute' in actions_df.columns:
            features['minute'] = actions_df['minute'].fillna(45)
        else:
            features['minute'] = 45

        if 'period' in actions_df.columns:
            features['period'] = actions_df['period'].fillna(1)
        else:
            features['period'] = 1

        # Zone features
        features['start_zone'] = pd.cut(
            features['start_x'],
            bins=[0, 40, 80, 120],
            labels=[0, 1, 2]
        ).astype(float).fillna(1)

        features['end_zone'] = pd.cut(
            features['end_x'],
            bins=[0, 40, 80, 120],
            labels=[0, 1, 2]
        ).astype(float).fillna(1)

        # Lateral position
        features['start_lateral'] = abs(features['start_y'] - 40)
        features['end_lateral'] = abs(features['end_y'] - 40)

        self.feature_columns = features.columns.tolist()
        return features.fillna(0)

    def create_labels(self, actions_df: pd.DataFrame,
                      lookforward_actions: int = 10) -> tuple:
        """
        Create scoring and conceding labels.

        For each action, check if a goal is scored/conceded
        within the next N actions.
        """
        n = len(actions_df)
        scores = np.zeros(n)
        concedes = np.zeros(n)

        # Check for goal events
        if 'event_type' in actions_df.columns:
            goal_mask = (actions_df['event_type'] == 'Shot') & \
                       (actions_df.get('outcome', actions_df.get('pass_outcome', '')) == 'Goal')
            goal_indices = actions_df[goal_mask].index.tolist()

            for goal_idx in goal_indices:
                goal_pos = actions_df.index.get_loc(goal_idx)
                goal_team = actions_df.iloc[goal_pos].get('team_id')

                # Mark previous actions
                start_idx = max(0, goal_pos - lookforward_actions)
                for i in range(start_idx, goal_pos):
                    action_team = actions_df.iloc[i].get('team_id')
                    if action_team == goal_team:
                        scores[i] = 1
                    else:
                        concedes[i] = 1

        return scores, concedes

    def train(self, actions_df: pd.DataFrame) -> dict:
        """Train both scoring and conceding models."""
        X = self.extract_features(actions_df)
        y_scores, y_concedes = self.create_labels(actions_df)

        # Check if we have enough positive samples
        if y_scores.sum() < 5 or y_concedes.sum() < 5:
            print("Warning: Not enough goal events for proper training")
            # Use synthetic labels for demo
            y_scores = (X['progress'] > 10).astype(int).values
            y_concedes = (X['progress'] < -10).astype(int).values

        # Split data
        X_train, X_test, y_scores_train, y_scores_test = train_test_split(
            X, y_scores, test_size=0.2, random_state=42
        )
        _, _, y_concedes_train, y_concedes_test = train_test_split(
            X, y_concedes, test_size=0.2, random_state=42
        )

        # Train models
        self.scoring_model.fit(X_train, y_scores_train)
        self.conceding_model.fit(X_train, y_concedes_train)

        self.is_trained = True

        # Evaluate
        score_acc = self.scoring_model.score(X_test, y_scores_test)
        concede_acc = self.conceding_model.score(X_test, y_concedes_test)

        return {
            'scoring_accuracy': score_acc,
            'conceding_accuracy': concede_acc,
            'samples_used': len(X_train)
        }

    def calculate_vaep(self, actions_df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate VAEP values for each action.

        VAEP = ΔP(scoring) - ΔP(conceding)
        """
        X = self.extract_features(actions_df)

        if not self.is_trained:
            # Use heuristic if not trained
            result = actions_df.copy()
            progress = X['progress'].values
            result['vaep_value'] = progress / 30  # Normalize
            result['offensive_value'] = np.maximum(progress / 30, 0)
            result['defensive_value'] = np.minimum(progress / 30, 0)
            return result

        # Get probabilities
        p_scores = self.scoring_model.predict_proba(X)[:, 1]
        p_concedes = self.conceding_model.predict_proba(X)[:, 1]

        # Calculate deltas (change from previous state)
        delta_scores = np.diff(p_scores, prepend=p_scores[0])
        delta_concedes = np.diff(p_concedes, prepend=p_concedes[0])

        # VAEP = offensive value - defensive value
        vaep_values = delta_scores - delta_concedes

        result = actions_df.copy()
        result['vaep_value'] = vaep_values
        result['offensive_value'] = delta_scores
        result['defensive_value'] = -delta_concedes
        result['p_score'] = p_scores
        result['p_concede'] = p_concedes

        return result

    def get_top_valued_actions(self, vaep_df: pd.DataFrame, n: int = 10) -> pd.DataFrame:
        """Get top N highest valued actions."""
        return vaep_df.nlargest(n, 'vaep_value')

    def get_player_vaep_totals(self, vaep_df: pd.DataFrame) -> pd.DataFrame:
        """Aggregate VAEP values by player."""
        if 'player_id' not in vaep_df.columns:
            return pd.DataFrame()

        return vaep_df.groupby('player_id').agg({
            'vaep_value': 'sum',
            'offensive_value': 'sum',
            'defensive_value': 'sum',
            'player_name': 'first'
        }).reset_index().sort_values('vaep_value', ascending=False)

    def save_model(self, path: str):
        """Save trained models."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({
            'scoring_model': self.scoring_model,
            'conceding_model': self.conceding_model,
            'feature_columns': self.feature_columns,
            'is_trained': self.is_trained
        }, path)

    def load_model(self, path: str):
        """Load trained models."""
        if os.path.exists(path):
            data = joblib.load(path)
            self.scoring_model = data['scoring_model']
            self.conceding_model = data['conceding_model']
            self.feature_columns = data['feature_columns']
            self.is_trained = data['is_trained']
