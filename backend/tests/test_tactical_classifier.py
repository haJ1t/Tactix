import json
import os
import sys
import tempfile
import unittest

import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler


BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.ml.counter_tactic_engine import CounterTacticEngine
from services.ml.tactical_classifier import TacticalPatternClassifier


class DummyClassifier:
    def __init__(self, classes):
        self.classes_ = np.array(classes)

    def predict_proba(self, X):
        return np.array([[0.82, 0.18] for _ in range(len(X))])


class TacticalClassifierTests(unittest.TestCase):
    def test_predict_patterns_normalizes_numeric_classifier_classes(self):
        model = TacticalPatternClassifier()
        model.feature_columns = ['density', 'forward_ratio']
        scaler = StandardScaler().fit([[0.0, 0.0], [1.0, 1.0]])
        model.classifier_scaler = scaler
        model.scaler = scaler
        model.classifier = DummyClassifier([0, 1])
        model.pattern_classes = ['CENTRAL_BUILDUP', 'DIRECT_PLAY']
        model.is_trained = True
        model.detect_patterns_rule_based = lambda _features: []

        patterns = model.predict_patterns({
            'density': 0.4,
            'forward_ratio': 0.55,
        })

        self.assertTrue(patterns)
        self.assertEqual(patterns[0]['pattern_type'], 'CENTRAL_BUILDUP')
        self.assertIsInstance(patterns[0]['pattern_type'], str)

    def test_load_model_infers_pattern_classes_from_report(self):
        scaler = StandardScaler().fit([[0.0, 0.0], [1.0, 1.0]])
        payload = {
            'classifier': DummyClassifier([0, 1, 2]),
            'scaler': scaler,
            'classifier_scaler': scaler,
            'kmeans_scaler': scaler,
            'kmeans': None,
            'is_trained': True,
            'kmeans_trained': False,
            'feature_columns': ['density', 'forward_ratio'],
            'cluster_centers': None,
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = os.path.join(temp_dir, 'tactical_classifier.joblib')
            report_path = os.path.join(temp_dir, 'finetune_report.json')
            joblib.dump(payload, model_path)
            with open(report_path, 'w') as fh:
                json.dump({
                    'tactical_classifier': {
                        'classes': ['CENTRAL_BUILDUP', 'DIRECT_PLAY', 'POSSESSION_RECYCLING'],
                    }
                }, fh)

            model = TacticalPatternClassifier()
            model.load_model(model_path)

            self.assertEqual(
                model.pattern_classes,
                ['CENTRAL_BUILDUP', 'DIRECT_PLAY', 'POSSESSION_RECYCLING'],
            )
            self.assertEqual(model._normalize_pattern_type(np.int64(1)), 'DIRECT_PLAY')


class CounterTacticEngineTests(unittest.TestCase):
    def test_summary_handles_numeric_pattern_types(self):
        engine = CounterTacticEngine()

        summary = engine.generate_natural_language_summary(
            patterns=[{
                'pattern_type': np.int64(2),
                'confidence_score': 0.73,
                'description': 'Model output uses encoded class ids.',
            }],
            recommendations=[],
        )

        self.assertIn('Model output uses encoded class ids.', summary)
        self.assertIn('2', summary)


if __name__ == '__main__':
    unittest.main()
