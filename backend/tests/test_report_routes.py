import os
import sys
import tempfile
import unittest
from unittest.mock import patch

from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from api.report_routes import reports_bp
import api.report_routes as report_routes
from models import Base
from models import counter_tactic, event, network_metrics, pass_event, player, tactical_pattern  # noqa: F401
from models.match import Match
from models.report_artifact import ReportArtifact
from models.team import Team


def build_app():
    app = Flask(__name__)
    app.register_blueprint(reports_bp)
    app.testing = True
    return app


def fake_analysis_payload():
    return {
        'match_id': 3943043,
        'ml_enhanced': True,
        'analysis': {
            'Alpha FC': {
                'network': {
                    'nodes': [
                        {'id': 8, 'name': 'Midfielder', 'x': 48, 'y': 34},
                        {'id': 9, 'name': 'Forward', 'x': 74, 'y': 42},
                    ],
                    'edges': [{'source': 8, 'target': 9, 'weight': 6}],
                },
                'network_statistics': {'total_passes': 420, 'density': 0.43, 'reciprocity': 0.21},
                'player_metrics': [{'player_id': 8, 'player_name': 'Midfielder', 'betweenness_centrality': 0.41, 'pagerank': 0.24, 'position': 'MF'}],
                'patterns': [{'pattern_type': 'DIRECT_PLAY', 'confidence_score': 0.89, 'description': 'Vertical access through the first two lines.'}],
                'counter_tactics': [{'recommendation': 'Press the first receiver and protect the central lane.', 'priority': 1}],
                'vaep_summary': {'avg_scoring_vaep': 0.12, 'avg_conceding_vaep': -0.04},
                'network_features': {'tempo_index': 0.55},
                'summary': 'Alpha FC controlled more of the circulation.',
                'ml_info': {'vaep_trained': True, 'pass_model_trained': True, 'pattern_classifier_trained': True},
                'shot_summary': {'total_shots': 10, 'xg_total': 1.91, 'xg_per_shot': 0.19, 'avg_shot_distance': 17.8, 'avg_shot_angle': 0.31, 'high_xg_shots': 3},
            },
            'Beta FC': {
                'network': {'nodes': [], 'edges': []},
                'network_statistics': {'total_passes': 305, 'density': 0.31, 'reciprocity': 0.18},
                'player_metrics': [],
                'patterns': [{'pattern_type': 'POSSESSION_RECYCLING', 'confidence_score': 0.77, 'description': 'Slower circulation to retain structure.'}],
                'counter_tactics': [{'recommendation': 'Allow safe circulation and trap the wide return lane.', 'priority': 2}],
                'vaep_summary': {'avg_scoring_vaep': 0.05, 'avg_conceding_vaep': -0.02},
                'network_features': {'tempo_index': 0.41},
                'summary': 'Beta FC protected structure but created less threat.',
                'ml_info': {'vaep_trained': True, 'pass_model_trained': True, 'pattern_classifier_trained': True},
                'shot_summary': {'total_shots': 5, 'xg_total': 0.72, 'xg_per_shot': 0.14, 'avg_shot_distance': 19.2, 'avg_shot_angle': 0.22, 'high_xg_shots': 1},
            },
        },
    }


class ReportRoutesTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.output_dir = os.path.join(self.temp_dir.name, 'reports')
        os.makedirs(self.output_dir, exist_ok=True)

        self.db_path = os.path.join(self.temp_dir.name, 'test_reports.sqlite')
        self.engine = create_engine(f'sqlite:///{self.db_path}')
        self.Session = sessionmaker(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

        self._seed_data()

        report_routes.report_service.output_dir = report_routes.report_service.output_dir.__class__(self.output_dir)
        report_routes.report_service.output_dir.mkdir(parents=True, exist_ok=True)
        self.session_patch = patch.object(report_routes, 'SessionLocal', self.Session)
        self.analysis_patch = patch('api.match_routes.build_ml_analysis_payload', return_value=fake_analysis_payload())
        self.session_patch.start()
        self.analysis_patch.start()

        self.app = build_app()
        self.client = self.app.test_client()

    def tearDown(self):
        self.analysis_patch.stop()
        self.session_patch.stop()
        self.temp_dir.cleanup()

    def _seed_data(self):
        session = self.Session()
        session.add_all(
            [
                Team(team_id=10, team_name='Alpha FC', country='Country A'),
                Team(team_id=20, team_name='Beta FC', country='Country B'),
                Match(
                    match_id=3943043,
                    home_team_id=10,
                    away_team_id=20,
                    competition='World Cup 2022',
                    season='2022',
                    home_score=3,
                    away_score=2,
                ),
            ]
        )
        session.commit()
        session.close()

    def test_create_list_detail_download_and_delete_report_artifact(self):
        create_response = self.client.post('/api/reports', json={'match_id': 3943043})
        self.assertEqual(create_response.status_code, 201)
        created = create_response.get_json()
        report_id = created['id']
        self.assertEqual(created['home_team'], 'Alpha FC')
        self.assertTrue(os.path.exists(os.path.join(self.output_dir, f'{report_id}.pdf')))

        list_response = self.client.get('/api/reports')
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.get_json()['count'], 1)

        detail_response = self.client.get(f'/api/reports/{report_id}')
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.get_json()['snapshot_summary']['section_summary'][0]['title'], 'Executive Summary')

        download_response = self.client.get(f'/api/reports/{report_id}/download')
        self.assertEqual(download_response.status_code, 200)
        self.assertEqual(download_response.mimetype, 'application/pdf')
        self.assertTrue(download_response.data.startswith(b'%PDF'))
        download_response.close()

        delete_response = self.client.delete(f'/api/reports/{report_id}')
        self.assertEqual(delete_response.status_code, 200)
        self.assertFalse(os.path.exists(os.path.join(self.output_dir, f'{report_id}.pdf')))

        session = self.Session()
        self.assertEqual(session.query(ReportArtifact).count(), 0)
        session.close()

    def test_import_legacy_report_creates_backend_pdf_artifact(self):
        payload = {
            'legacy_report': {
                'id': 'legacy-1',
                'matchId': 3943043,
                'createdAt': '2026-03-10T11:00:00Z',
                'matchSummary': {
                    'homeTeam': 'Alpha FC',
                    'awayTeam': 'Beta FC',
                    'score': '3 - 2',
                    'competition': 'World Cup 2022',
                    'matchDate': '2022-12-18',
                },
                'homeAnalysis': fake_analysis_payload()['analysis']['Alpha FC'],
                'awayAnalysis': fake_analysis_payload()['analysis']['Beta FC'],
            }
        }

        response = self.client.post('/api/reports/import-legacy', json=payload)
        self.assertEqual(response.status_code, 201)
        artifact = response.get_json()
        self.assertEqual(artifact['source_kind'], 'legacy_import')
        self.assertTrue(os.path.exists(os.path.join(self.output_dir, f"{artifact['id']}.pdf")))


if __name__ == '__main__':
    unittest.main()
