"""
Match-related API routes
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy.orm import Session
from models import SessionLocal
from models.match import Match
from models.team import Team
from models.player import Player
from models.event import Event
from models.pass_event import PassEvent
from models.network_metrics import NetworkMetrics
from services.network_builder import NetworkBuilder
from services.data_cleaner import DataCleaner
from services.metrics_calculator import MetricsCalculator
from services.pattern_detector import PatternDetector
from services.counter_tactic_generator import CounterTacticGenerator
from services.ml.analysis_pipeline import MLAnalysisPipeline
from services.ml.shot_metrics import calculate_shot_summary
import pandas as pd

match_bp = Blueprint('matches', __name__, url_prefix='/api/matches')
_ml_pipeline_instance = None


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        return db
    except:
        db.close()
        raise


def get_ml_pipeline():
    """Return a cached ML pipeline instance for this process."""
    global _ml_pipeline_instance
    if _ml_pipeline_instance is None:
        _ml_pipeline_instance = MLAnalysisPipeline()
    return _ml_pipeline_instance


def build_ml_analysis_payload(
    db: Session,
    match: Match,
    team_id: int | None = None,
    include_network: bool = False
) -> dict:
    """Build the ML analysis snapshot used by routes and PDF generation."""
    team_ids = [team_id] if team_id else [match.home_team_id, match.away_team_id]
    ml_pipeline = get_ml_pipeline()
    results = {}

    for tid in team_ids:
        if tid is None:
            continue

        team = db.query(Team).filter(Team.team_id == tid).first()
        team_name = team.team_name if team else f'Team {tid}'

        shots = db.query(Event).filter(
            Event.match_id == match.match_id,
            Event.team_id == tid,
            Event.event_type == 'Shot'
        ).all()
        shots_df = pd.DataFrame(
            [
                {
                    'location_x': shot.location_x,
                    'location_y': shot.location_y,
                    'minute': shot.minute,
                    'second': shot.second,
                }
                for shot in shots
            ]
        )
        shot_summary = calculate_shot_summary(shots_df)

        passes = db.query(PassEvent).join(Event).filter(
            Event.match_id == match.match_id,
            Event.team_id == tid
        ).all()

        if not passes:
            results[team_name] = {
                'error': 'No passes found',
                'shot_summary': shot_summary,
            }
            continue

        passes_data = []
        for pass_event in passes:
            event = pass_event.event
            passer = pass_event.passer
            recipient = pass_event.recipient
            final_goal_diff = 0
            if tid == match.home_team_id:
                final_goal_diff = (match.home_score or 0) - (match.away_score or 0)
            elif tid == match.away_team_id:
                final_goal_diff = (match.away_score or 0) - (match.home_score or 0)

            passes_data.append({
                'match_id': match.match_id,
                'pass_id': pass_event.pass_id,
                'event_id': pass_event.event_id,
                'passer_id': pass_event.passer_id,
                'passer_name': passer.player_name if passer else f'Player {pass_event.passer_id}',
                'player_id': pass_event.passer_id,
                'player_name': passer.player_name if passer else f'Player {pass_event.passer_id}',
                'recipient_id': pass_event.recipient_id,
                'recipient_name': recipient.player_name if recipient else f'Player {pass_event.recipient_id}' if pass_event.recipient_id else None,
                'location_x': event.location_x if event else 60,
                'location_y': event.location_y if event else 40,
                'end_location_x': pass_event.end_location_x or 60,
                'end_location_y': pass_event.end_location_y or 40,
                'pass_outcome': pass_event.pass_outcome,
                'pass_length': pass_event.pass_length,
                'pass_angle': pass_event.pass_angle,
                'team_id': tid,
                'minute': event.minute if event else 0,
                'second': event.second if event else 0,
                'period': event.period if event else 1,
                'event_type': 'Pass',
                'event_index': event.event_index if event else None,
                'possession_id': event.possession_id if event else None,
                'play_pattern': event.play_pattern if event else None,
                'position_name': (event.position_name if event and event.position_name else passer.position if passer else None),
                'under_pressure': event.under_pressure if event else False,
                'competition': match.competition,
                'season': match.season,
                'final_goal_diff': final_goal_diff,
                'technique': pass_event.technique,
                'is_cross': pass_event.is_cross,
                'is_switch': pass_event.is_switch,
                'is_through_ball': pass_event.is_through_ball,
                'is_cut_back': pass_event.is_cut_back,
            })

        passes_df = pd.DataFrame(passes_data)

        player_info = {}
        players = db.query(Player).filter(Player.team_id == tid).all()
        for player in players:
            player_info[player.player_id] = {
                'name': player.player_name,
                'jersey': player.jersey_number,
                'position': player.position,
            }

        analysis = ml_pipeline.analyze_passes(passes_df, player_info)

        db.query(NetworkMetrics).filter(
            NetworkMetrics.match_id == match.match_id,
            NetworkMetrics.team_id == tid
        ).delete()

        for player_metrics in analysis['player_metrics']:
            player_id = player_metrics.get('player_id')
            if not player_id:
                continue
            metric = NetworkMetrics(
                match_id=match.match_id,
                team_id=tid,
                player_id=player_id,
                degree_centrality=player_metrics.get('degree_centrality', 0),
                in_degree_centrality=player_metrics.get('in_degree_centrality', 0),
                out_degree_centrality=player_metrics.get('out_degree_centrality', 0),
                betweenness_centrality=player_metrics.get('betweenness_centrality', 0),
                closeness_centrality=player_metrics.get('closeness_centrality', 0),
                pagerank=player_metrics.get('pagerank', 0),
                clustering_coefficient=player_metrics.get('clustering_coefficient', 0),
                in_degree=player_metrics.get('in_degree', 0),
                out_degree=player_metrics.get('out_degree', 0),
                avg_x=player_metrics.get('avg_x', 60),
                avg_y=player_metrics.get('avg_y', 40),
            )
            db.add(metric)

        db.commit()

        team_result = {
            'network_statistics': analysis['network_statistics'],
            'player_metrics': analysis['player_metrics'],
            'patterns': analysis['patterns'],
            'counter_tactics': analysis['counter_tactics'],
            'vaep_summary': analysis['vaep_summary'],
            'network_features': analysis['network_features'],
            'summary': analysis['summary'],
            'ml_info': analysis['ml_info'],
            'shot_summary': shot_summary,
        }
        if include_network:
            team_result['network'] = analysis.get('network', {'nodes': [], 'edges': [], 'positions': {}})

        results[team_name] = team_result

    return {
        'match_id': match.match_id,
        'analysis': results,
        'ml_enhanced': True,
    }


@match_bp.route('', methods=['GET'])
def list_matches():
    """List all available matches."""
    db = get_db()
    try:
        matches = db.query(Match).all()
        return jsonify({
            'matches': [m.to_dict() for m in matches],
            'count': len(matches)
        })
    finally:
        db.close()


@match_bp.route('/<int:match_id>', methods=['GET'])
def get_match(match_id: int):
    """Get match details."""
    db = get_db()
    try:
        match = db.query(Match).filter(Match.match_id == match_id).first()
        if not match:
            return jsonify({'error': 'Match not found'}), 404
        
        return jsonify(match.to_dict())
    finally:
        db.close()


@match_bp.route('/<int:match_id>/network', methods=['GET'])
def get_match_network(match_id: int):
    """
    Get pass network for a match.
    
    Query params:
    - team_id: Filter by team ID
    - period: Filter by period (1 or 2)
    - min_passes: Minimum passes for edge (default: 1)
    """
    db = get_db()
    try:
        # Get query parameters
        team_id = request.args.get('team_id', type=int)
        period = request.args.get('period', type=int)
        min_passes = request.args.get('min_passes', default=1, type=int)
        
        # Build query for passes
        query = db.query(PassEvent).join(Event).filter(
            Event.match_id == match_id
        )
        
        if team_id:
            query = query.filter(Event.team_id == team_id)
        if period:
            query = query.filter(Event.period == period)
        
        passes = query.all()
        
        if not passes:
            return jsonify({
                'nodes': [],
                'edges': [],
                'statistics': {},
                'message': 'No passes found for this match'
            })
        
        # Convert to DataFrame
        passes_data = []
        for p in passes:
            event = p.event
            passer = p.passer
            recipient = p.recipient
            
            passes_data.append({
                'passer_id': p.passer_id,
                'passer_name': passer.player_name if passer else f'Player {p.passer_id}',
                'recipient_id': p.recipient_id,
                'recipient_name': recipient.player_name if recipient else f'Player {p.recipient_id}',
                'location_x': event.location_x if event else 60,
                'location_y': event.location_y if event else 40,
                'end_location_x': p.end_location_x,
                'end_location_y': p.end_location_y,
                'pass_outcome': p.pass_outcome,
                'period': event.period if event else 1,
                'minute': event.minute if event else 0,
            })
        
        df = pd.DataFrame(passes_data)
        
        # Clean data
        cleaner = DataCleaner()
        df = cleaner.get_successful_passes(df)
        
        # Build network
        builder = NetworkBuilder()
        G = builder.build_pass_network(df)
        
        # Filter by minimum passes
        if min_passes > 1:
            G = builder.filter_by_weight(G, min_passes)
        
        # Calculate metrics
        calculator = MetricsCalculator()
        network_stats = calculator.get_network_statistics(G)
        
        return jsonify({
            'nodes': builder.get_node_list(G),
            'edges': builder.get_edge_list(G),
            'statistics': network_stats
        })
    finally:
        db.close()


@match_bp.route('/<int:match_id>/analyze', methods=['POST'])
def analyze_match(match_id: int):
    """
    Trigger full analysis for a match.
    
    Body params:
    - team_id: Team to analyze (optional, analyzes both if not provided)
    """
    db = get_db()
    try:
        data = request.get_json() or {}
        team_id = data.get('team_id')
        
        # Check match exists
        match = db.query(Match).filter(Match.match_id == match_id).first()
        if not match:
            return jsonify({'error': 'Match not found'}), 404
        
        # Get teams to analyze
        team_ids = [team_id] if team_id else [match.home_team_id, match.away_team_id]
        
        results = {}
        
        for tid in team_ids:
            if tid is None:
                continue
                
            team = db.query(Team).filter(Team.team_id == tid).first()
            team_name = team.team_name if team else f'Team {tid}'
            
            # Get shot events for this team
            shots = db.query(Event).filter(
                Event.match_id == match_id,
                Event.team_id == tid,
                Event.event_type == 'Shot'
            ).all()
            shots_data = [
                {
                    'location_x': s.location_x,
                    'location_y': s.location_y,
                    'minute': s.minute,
                    'second': s.second
                }
                for s in shots
            ]
            shots_df = pd.DataFrame(shots_data)
            shot_summary = calculate_shot_summary(shots_df)

            # Get passes for this team
            passes = db.query(PassEvent).join(Event).filter(
                Event.match_id == match_id,
                Event.team_id == tid
            ).all()

            if not passes:
                results[team_name] = {
                    'error': 'No passes found',
                    'shot_summary': shot_summary
                }
                continue
            
            # Convert to DataFrame
            passes_data = []
            for p in passes:
                event = p.event
                passer = p.passer
                recipient = p.recipient
                
                passes_data.append({
                    'passer_id': p.passer_id,
                    'passer_name': passer.player_name if passer else f'Player {p.passer_id}',
                    'recipient_id': p.recipient_id,
                    'recipient_name': recipient.player_name if recipient else f'Player {p.recipient_id}',
                    'location_x': event.location_x if event else 60,
                    'location_y': event.location_y if event else 40,
                    'end_location_x': p.end_location_x,
                    'end_location_y': p.end_location_y,
                    'pass_outcome': p.pass_outcome,
                })
            
            df = pd.DataFrame(passes_data)
            
            # Clean and analyze
            cleaner = DataCleaner()
            df = cleaner.get_successful_passes(df)
            
            builder = NetworkBuilder()
            G = builder.build_pass_network(df)
            
            calculator = MetricsCalculator()
            metrics = calculator.calculate_all_metrics(G)
            network_stats = calculator.get_network_statistics(G)
            
            detector = PatternDetector()
            patterns = detector.detect_all_patterns(G, metrics)
            
            generator = CounterTacticGenerator()
            tactics = generator.generate_counter_tactics(patterns, metrics)
            
            # Store metrics in database
            # Clear existing metrics for this match/team
            db.query(NetworkMetrics).filter(
                NetworkMetrics.match_id == match_id,
                NetworkMetrics.team_id == tid
            ).delete()
            
            for player_id, player_metrics in metrics.items():
                metric = NetworkMetrics(
                    match_id=match_id,
                    team_id=tid,
                    player_id=player_id,
                    degree_centrality=player_metrics['degree_centrality'],
                    in_degree_centrality=player_metrics['in_degree_centrality'],
                    out_degree_centrality=player_metrics['out_degree_centrality'],
                    betweenness_centrality=player_metrics['betweenness_centrality'],
                    closeness_centrality=player_metrics['closeness_centrality'],
                    pagerank=player_metrics['pagerank'],
                    clustering_coefficient=player_metrics['clustering_coefficient'],
                    in_degree=player_metrics['in_degree'],
                    out_degree=player_metrics['out_degree'],
                    avg_x=player_metrics['avg_x'],
                    avg_y=player_metrics['avg_y'],
                )
                db.add(metric)
            
            db.commit()
            
            results[team_name] = {
                'network_statistics': network_stats,
                'player_metrics': list(metrics.values()),
                'patterns': patterns,
                'counter_tactics': tactics,
                'top_players': calculator.get_top_players(metrics, 'betweenness_centrality', 3)
            }
        
        return jsonify({
            'match_id': match_id,
            'analysis': results
        })
    finally:
        db.close()


@match_bp.route('/<int:match_id>/analyze-ml', methods=['POST'])
def analyze_match_ml(match_id: int):
    """
    Trigger ML-enhanced analysis for a match.
    
    Uses VAEP, Pass Difficulty, and ML Pattern Classification.
    
    Body params:
    - team_id: Team to analyze (optional, analyzes both if not provided)
    """
    db = get_db()
    try:
        data = request.get_json() or {}
        team_id = data.get('team_id')
        
        # Check match exists
        match = db.query(Match).filter(Match.match_id == match_id).first()
        if not match:
            return jsonify({'error': 'Match not found'}), 404
        return jsonify(build_ml_analysis_payload(db, match, team_id=team_id))
    finally:
        db.close()
