"""
VAEP (Valuing Actions by Estimating Probabilities)
Based on Decroos et al. (2019)

Assigns value to every on-ball action by measuring how much it 
increases/decreases the probability of scoring and conceding.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
import joblib
import os


class VAEPModel:
    """
    Valuing Actions by Estimating Probabilities (VAEP)
    """

    def __init__(self):
        self.scoring_model = GradientBoostingClassifier(
            n_estimators=150,
            max_depth=3,
            learning_rate=0.05,
            random_state=42
        )
        self.conceding_model = GradientBoostingClassifier(
            n_estimators=150,
            max_depth=3,
            learning_rate=0.05,
            random_state=42
        )
        self.feature_columns = []
        self.is_trained = False

    def _encode_category(self, series: pd.Series) -> pd.Series:
        return pd.Categorical(series.fillna('Unknown').astype(str)).codes.astype(float)

    def _safe_series(self, actions_df: pd.DataFrame, column: str, default) -> pd.Series:
        if column in actions_df.columns:
            return actions_df[column]
        if isinstance(default, pd.Series):
            return default.reindex(actions_df.index)
        return pd.Series([default] * len(actions_df), index=actions_df.index)

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
        features['start_x'] = self._safe_series(actions_df, 'location_x', 60).fillna(60)
        features['start_y'] = self._safe_series(actions_df, 'location_y', 40).fillna(40)
        features['end_x'] = self._safe_series(actions_df, 'end_location_x', features['start_x']).fillna(60)
        features['end_y'] = self._safe_series(actions_df, 'end_location_y', features['start_y']).fillna(40)

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

        # Enriched context features
        features['event_type_code'] = self._encode_category(self._safe_series(actions_df, 'event_type', 'Pass'))
        features['play_pattern_code'] = self._encode_category(self._safe_series(actions_df, 'play_pattern', 'Open Play'))
        features['position_code'] = self._encode_category(self._safe_series(actions_df, 'position_name', 'Unknown'))
        features['under_pressure'] = self._safe_series(actions_df, 'under_pressure', 0).fillna(0).astype(int)
        features['score_diff'] = pd.to_numeric(self._safe_series(actions_df, 'score_diff', 0), errors='coerce').fillna(0)
        features['final_goal_diff'] = pd.to_numeric(self._safe_series(actions_df, 'final_goal_diff', 0), errors='coerce').fillna(0)
        features['event_index'] = pd.to_numeric(self._safe_series(actions_df, 'event_index', 0), errors='coerce').fillna(0)
        features['possession_id'] = pd.to_numeric(self._safe_series(actions_df, 'possession_id', 0), errors='coerce').fillna(0)

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

        if actions_df is None or actions_df.empty or 'match_id' not in actions_df.columns:
            return scores, concedes

        ordered = actions_df.copy()
        ordered['_orig_index'] = np.arange(len(actions_df))
        sort_cols = ['match_id']
        if 'event_index' in ordered.columns:
            sort_cols.append('event_index')
        else:
            sort_cols.extend(['period', 'minute', 'second'])
        ordered = ordered.sort_values(sort_cols).reset_index(drop=True)

        goal_mask = ordered.get('is_goal', pd.Series([False] * len(ordered))).fillna(False).astype(bool)
        if 'shot_outcome' in ordered.columns:
            goal_mask = goal_mask | ordered['shot_outcome'].fillna('').eq('Goal')

        for _, match_df in ordered.groupby('match_id', sort=False):
            goal_positions = match_df.index[goal_mask.loc[match_df.index]].tolist()
            for goal_pos in goal_positions:
                goal_team = ordered.iloc[goal_pos].get('team_id')
                start_idx = max(match_df.index.min(), goal_pos - lookforward_actions)
                for idx in range(start_idx, goal_pos):
                    action_team = ordered.iloc[idx].get('team_id')
                    if action_team == goal_team:
                        scores[idx] = 1
                    else:
                        concedes[idx] = 1

        ordered['score_label'] = scores
        ordered['concede_label'] = concedes
        ordered = ordered.sort_values('_orig_index')

        return ordered['score_label'].to_numpy(), ordered['concede_label'].to_numpy()

    def train(self, actions_df: pd.DataFrame) -> dict:
        """Train both scoring and conceding models."""
        X = self.extract_features(actions_df)
        y_scores, y_concedes = self.create_labels(actions_df)

        if y_scores.sum() < 5 or y_concedes.sum() < 5:
            raise ValueError('Not enough goal events for grouped VAEP training')

        if 'match_id' not in actions_df.columns:
            raise ValueError('actions_df must contain match_id for grouped VAEP training')

        # Group split by match
        match_ids = pd.Index(actions_df['match_id']).unique().tolist()
        rng = np.random.default_rng(42)
        rng.shuffle(match_ids)
        split_index = max(int(len(match_ids) * 0.8), 1)
        train_matches = set(match_ids[:split_index])
        test_matches = set(match_ids[split_index:]) or train_matches

        # Build train/test masks
        train_mask = actions_df['match_id'].isin(train_matches).values
        test_mask = actions_df['match_id'].isin(test_matches).values

        X_train = X.loc[train_mask]
        X_test = X.loc[test_mask]
        y_scores_train = y_scores[train_mask]
        y_scores_test = y_scores[test_mask]
        y_concedes_train = y_concedes[train_mask]
        y_concedes_test = y_concedes[test_mask]

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
            'samples_used': len(X_train),
            'train_matches': len(train_matches),
            'test_matches': len(test_matches),
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
        """Load trained models with integrity verification."""
        from utils.security import secure_joblib_load

        data = secure_joblib_load(path, joblib.load)
        if data is None:
            self.is_trained = False
            return

        try:
            self.scoring_model = data['scoring_model']
            self.conceding_model = data['conceding_model']
            self.feature_columns = data['feature_columns']
            self.is_trained = data['is_trained']
        except Exception as e:
            self.is_trained = False
            print(f"Warning: Failed to load VAEP model from {path}: {e}")
