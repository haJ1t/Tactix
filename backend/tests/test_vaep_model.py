import os
import sys
import unittest

import pandas as pd


BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.ml.vaep_model import VAEPModel


class VAEPModelTests(unittest.TestCase):
    def test_extract_features_handles_missing_context_columns(self):
        model = VAEPModel()
        actions_df = pd.DataFrame([
            {
                'event_id': 'e1',
                'match_id': 1,
                'team_id': 10,
                'player_id': 101,
                'event_type': 'Pass',
                'location_x': 50,
                'location_y': 40,
                'end_location_x': 62,
                'end_location_y': 44,
                'minute': 12,
                'period': 1,
            }
        ])

        features = model.extract_features(actions_df)

        self.assertEqual(len(features), 1)
        self.assertIn('score_diff', features.columns)
        self.assertIn('final_goal_diff', features.columns)
        self.assertIn('possession_id', features.columns)
        self.assertEqual(features.loc[0, 'score_diff'], 0)
        self.assertEqual(features.loc[0, 'final_goal_diff'], 0)
        self.assertEqual(features.loc[0, 'possession_id'], 0)

    def test_calculate_vaep_works_with_minimal_pass_runtime_frame(self):
        model = VAEPModel()
        actions_df = pd.DataFrame([
            {
                'event_id': 'e1',
                'match_id': 1,
                'team_id': 10,
                'player_id': 101,
                'event_type': 'Pass',
                'location_x': 50,
                'location_y': 40,
                'end_location_x': 62,
                'end_location_y': 44,
                'minute': 12,
                'period': 1,
            }
        ])

        result = model.calculate_vaep(actions_df)

        self.assertIn('vaep_value', result.columns)
        self.assertIn('offensive_value', result.columns)
        self.assertIn('defensive_value', result.columns)
        self.assertEqual(len(result), 1)


if __name__ == '__main__':
    unittest.main()
