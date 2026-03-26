import os
import sys
import tempfile
import unittest

from pypdf import PdfReader

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from models import counter_tactic, event, network_metrics, pass_event, player, tactical_pattern  # noqa: F401
from models.report_artifact import ReportArtifact
from services.report_pdf_service import ReportPdfService


class ReportPdfServiceTests(unittest.TestCase):
    def test_render_pdf_contains_key_headings_and_match_metadata(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = ReportPdfService(output_dir=temp_dir)
            artifact = ReportArtifact(
                id='report-1',
                match_id=99,
                created_at=None,
                language='en',
                source_kind='generated',
                title='Alpha FC vs Beta FC Analyst Dossier',
                home_team='Alpha FC',
                away_team='Beta FC',
                competition='World Cup 2022',
                match_date='2022-12-18',
                scoreline='3 - 2',
                pdf_path=os.path.join(temp_dir, 'report-1.pdf'),
                snapshot_json='{}',
            )
            snapshot = {
                'match': {
                    'home_team': {'team_name': 'Alpha FC'},
                    'away_team': {'team_name': 'Beta FC'},
                    'competition': 'World Cup 2022',
                },
                'analysis': {
                    'Alpha FC': {
                        'network': {
                            'nodes': [
                                {'id': 10, 'name': 'Player Ten', 'x': 45, 'y': 30},
                                {'id': 11, 'name': 'Player Eleven', 'x': 72, 'y': 44},
                            ],
                            'edges': [{'source': 10, 'target': 11, 'weight': 8}],
                        },
                        'player_metrics': [
                            {'player_id': 10, 'player_name': 'Player Ten', 'betweenness_centrality': 0.45, 'pagerank': 0.28, 'position': 'MF'},
                        ],
                        'patterns': [{'pattern_type': 'DIRECT_PLAY', 'confidence_score': 0.91, 'description': 'Frequent forward progression.'}],
                        'counter_tactics': [{'recommendation': 'Crowd central outlets early.', 'priority': 1}],
                        'shot_summary': {'total_shots': 9, 'xg_total': 1.8, 'xg_per_shot': 0.2, 'high_xg_shots': 3},
                        'vaep_summary': {'avg_scoring_vaep': 0.12, 'avg_conceding_vaep': -0.03},
                    },
                    'Beta FC': {
                        'network': {'nodes': [], 'edges': []},
                        'player_metrics': [],
                        'patterns': [],
                        'counter_tactics': [],
                        'shot_summary': {'total_shots': 4, 'xg_total': 0.6, 'xg_per_shot': 0.15, 'high_xg_shots': 1},
                        'vaep_summary': {'avg_scoring_vaep': 0.05, 'avg_conceding_vaep': -0.01},
                    },
                },
                'executive_summary': 'Alpha FC controlled more of the passing volume.',
                'match_story': 'Alpha FC vs Beta FC separated control and chance quality.',
                'final_conclusion': 'The main tactical reading is to disrupt Alpha FC centrally.',
                'section_summary': [{'id': 'executive-summary', 'title': 'Executive Summary', 'detail': 'Alpha FC controlled more of the passing volume.', 'status': 'complete'}],
                'team_summaries': [
                    {'team_name': 'Alpha FC', 'total_passes': 420, 'patterns': 2, 'counter_tactics': 1, 'shots': 9, 'xg_total': 1.8, 'top_connector': 'Player Ten'},
                    {'team_name': 'Beta FC', 'total_passes': 310, 'patterns': 0, 'counter_tactics': 0, 'shots': 4, 'xg_total': 0.6, 'top_connector': None},
                ],
            }

            service.render_pdf(artifact, snapshot)

            self.assertTrue(os.path.exists(artifact.pdf_path))

            with open(artifact.pdf_path, 'rb') as pdf_handle:
                extracted_text = '\n'.join(page.extract_text() or '' for page in PdfReader(pdf_handle).pages)
            self.assertIn('Alpha FC vs Beta FC Analyst Dossier', extracted_text)
            self.assertIn('Executive Summary', extracted_text)
            self.assertIn('Final Analyst Conclusion', extracted_text)
            self.assertIn('World Cup 2022', extracted_text)


if __name__ == '__main__':
    unittest.main()
