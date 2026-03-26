import unittest
from unittest.mock import patch
import os
import sys

from flask import Flask

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from api.match_routes import match_bp
from models.event import Event
from models.match import Match
from models.network_metrics import NetworkMetrics
from models.pass_event import PassEvent
from models.player import Player
from models.team import Team
from models.tactical_pattern import TacticalPattern
from models.counter_tactic import CounterTactic
import api.match_routes as match_routes


class FakeQuery:
    def __init__(self, session, model):
        self.session = session
        self.model = model

    def join(self, *_args, **_kwargs):
        return self

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        values = self.session.data.get(self.model, [])
        return values[0] if values else None

    def all(self):
        return list(self.session.data.get(self.model, []))

    def delete(self):
        return 0


class FakeSession:
    def __init__(self, data):
        self.data = data
        self.added = []
        self.commits = 0
        self.closed = False

    def query(self, model):
        return FakeQuery(self, model)

    def add(self, item):
        self.added.append(item)

    def commit(self):
        self.commits += 1

    def close(self):
        self.closed = True


class FakePipeline:
    init_count = 0
    last_frames = []

    def __init__(self):
        type(self).init_count += 1

    def analyze_passes(self, passes_df, _player_info):
        type(self).last_frames.append(passes_df.copy())
        return {
            'network_statistics': {
                'density': 0.5,
                'num_nodes': 2,
                'num_edges': 1,
                'total_passes': 1,
                'avg_clustering': 0.0,
                'avg_path_length': 1.0,
                'reciprocity': 0.0
            },
            'player_metrics': [{
                'player_id': 101,
                'degree_centrality': 1.0,
                'in_degree_centrality': 0.0,
                'out_degree_centrality': 1.0,
                'betweenness_centrality': 0.0,
                'closeness_centrality': 1.0,
                'pagerank': 0.5,
                'clustering_coefficient': 0.0,
                'in_degree': 0,
                'out_degree': 1,
                'avg_x': 50,
                'avg_y': 40,
            }],
            'patterns': [],
            'counter_tactics': [],
            'vaep_summary': {},
            'network_features': {},
            'summary': 'ok',
            'ml_info': {
                'vaep_trained': False,
                'pass_model_trained': False,
                'pattern_classifier_trained': False
            }
        }


def build_app():
    app = Flask(__name__)
    app.register_blueprint(match_bp)
    app.testing = True
    return app


def build_match():
    match = Match(
        match_id=1,
        home_team_id=10,
        away_team_id=20,
        competition='League',
        season='2024/25',
        home_score=1,
        away_score=0,
    )
    return match


def build_team():
    return Team(team_id=10, team_name='Alpha', country='Country')


def build_players():
    return [
        Player(player_id=101, player_name='Player One', team_id=10, position='MF', jersey_number=8),
        Player(player_id=102, player_name='Player Two', team_id=10, position='FW', jersey_number=9),
    ]


def build_passes():
    pass_event = PassEvent(
        pass_id='p1',
        event_id='e1',
        passer_id=101,
        recipient_id=102,
        end_location_x=60,
        end_location_y=42,
        pass_length=10,
        pass_angle=0.2,
        pass_outcome='Complete',
    )
    pass_event.event = Event(
        event_id='e1',
        match_id=1,
        team_id=10,
        player_id=101,
        event_type='Pass',
        period=1,
        minute=10,
        second=5,
        location_x=50,
        location_y=40,
    )
    pass_event.passer = build_players()[0]
    pass_event.recipient = build_players()[1]
    return [pass_event]


def build_shots():
    return [
        Event(
            event_id='s1',
            match_id=1,
            team_id=10,
            player_id=101,
            event_type='Shot',
            period=1,
            minute=15,
            second=0,
            location_x=102,
            location_y=38,
        )
    ]


class AnalyzeMatchMLRouteTests(unittest.TestCase):
    def setUp(self):
        self.app = build_app()
        self.client = self.app.test_client()
        match_routes._ml_pipeline_instance = None
        FakePipeline.init_count = 0
        FakePipeline.last_frames = []

    def test_analyze_ml_returns_shot_summary_when_shots_exist(self):
        session = FakeSession({
            Match: [build_match()],
            Team: [build_team()],
            Event: build_shots(),
            PassEvent: build_passes(),
            Player: build_players(),
            NetworkMetrics: [],
        })

        with patch.object(match_routes, 'SessionLocal', return_value=session), \
             patch.object(match_routes, 'MLAnalysisPipeline', FakePipeline):
            response = self.client.post('/api/matches/1/analyze-ml', json={'team_id': 10})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn('Alpha', payload['analysis'])
        self.assertIn('shot_summary', payload['analysis']['Alpha'])
        self.assertEqual(payload['analysis']['Alpha']['shot_summary']['total_shots'], 1)
        self.assertTrue(FakePipeline.last_frames)
        self.assertIn('match_id', FakePipeline.last_frames[0].columns)

    def test_analyze_ml_returns_zero_shot_summary_when_no_shots_exist(self):
        session = FakeSession({
            Match: [build_match()],
            Team: [build_team()],
            Event: [],
            PassEvent: build_passes(),
            Player: build_players(),
            NetworkMetrics: [],
        })

        with patch.object(match_routes, 'SessionLocal', return_value=session), \
             patch.object(match_routes, 'MLAnalysisPipeline', FakePipeline):
            response = self.client.post('/api/matches/1/analyze-ml', json={'team_id': 10})

        self.assertEqual(response.status_code, 200)
        shot_summary = response.get_json()['analysis']['Alpha']['shot_summary']
        self.assertEqual(shot_summary['total_shots'], 0)
        self.assertEqual(shot_summary['xg_total'], 0.0)

    def test_analyze_ml_returns_error_and_shot_summary_when_no_passes_exist(self):
        session = FakeSession({
            Match: [build_match()],
            Team: [build_team()],
            Event: build_shots(),
            PassEvent: [],
            Player: build_players(),
            NetworkMetrics: [],
        })

        with patch.object(match_routes, 'SessionLocal', return_value=session), \
             patch.object(match_routes, 'MLAnalysisPipeline', FakePipeline):
            response = self.client.post('/api/matches/1/analyze-ml', json={'team_id': 10})

        self.assertEqual(response.status_code, 200)
        team_payload = response.get_json()['analysis']['Alpha']
        self.assertEqual(team_payload['error'], 'No passes found')
        self.assertIn('shot_summary', team_payload)
        self.assertEqual(team_payload['shot_summary']['total_shots'], 1)

    def test_ml_pipeline_is_cached_across_requests(self):
        session = FakeSession({
            Match: [build_match()],
            Team: [build_team()],
            Event: build_shots(),
            PassEvent: build_passes(),
            Player: build_players(),
            NetworkMetrics: [],
        })

        with patch.object(match_routes, 'SessionLocal', side_effect=[session, session]), \
             patch.object(match_routes, 'MLAnalysisPipeline', FakePipeline):
            first = self.client.post('/api/matches/1/analyze-ml', json={'team_id': 10})
            second = self.client.post('/api/matches/1/analyze-ml', json={'team_id': 10})

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(FakePipeline.init_count, 1)


if __name__ == '__main__':
    unittest.main()
