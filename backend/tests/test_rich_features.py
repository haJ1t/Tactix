import os
import sys
import unittest

import pandas as pd


BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.ml.rich_features import build_pass_feature_frame, extract_tactical_context_features


class RichFeaturesTests(unittest.TestCase):
    def test_build_pass_feature_frame_handles_missing_match_id(self):
        passes_df = pd.DataFrame([
            {
                'event_id': 'e1',
                'team_id': 10,
                'location_x': 48,
                'location_y': 35,
                'end_location_x': 65,
                'end_location_y': 41,
                'minute': 12,
                'second': 5,
                'period': 1,
                'pass_outcome': 'Complete',
                'pass_type': 'Open Play',
            }
        ])

        features = build_pass_feature_frame(passes_df)

        self.assertEqual(len(features), 1)
        self.assertIn('possession_pass_index', features.columns)
        self.assertEqual(features.loc[0, 'possession_pass_index'], 1)

    def test_extract_tactical_context_features_handles_missing_match_id(self):
        passes_df = pd.DataFrame([
            {
                'event_id': 'e1',
                'team_id': 10,
                'location_x': 48,
                'location_y': 35,
                'end_location_x': 65,
                'end_location_y': 41,
                'minute': 12,
                'second': 5,
                'period': 1,
                'pass_outcome': 'Complete',
                'pass_type': 'Open Play',
            }
        ])

        features = extract_tactical_context_features(passes_df)

        self.assertIn('avg_possession_length', features)
        self.assertIn('avg_tempo_seconds', features)
        self.assertGreaterEqual(features['avg_possession_length'], 0.0)


if __name__ == '__main__':
    unittest.main()
