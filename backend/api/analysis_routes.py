"""
Analysis-related API routes
"""
from flask import Blueprint, jsonify, request
from sqlalchemy.orm import joinedload
from models import SessionLocal
from models.match import Match
from models.team import Team
from models.player import Player
from models.network_metrics import NetworkMetrics
from models.tactical_pattern import TacticalPattern
from models.counter_tactic import CounterTactic
from utils.security import require_api_key

analysis_bp = Blueprint('analysis', __name__, url_prefix='/api/analysis')

# Whitelist of sortable metric columns
ALLOWED_METRICS = {
    'betweenness_centrality',
    'closeness_centrality',
    'pagerank',
    'degree_centrality',
    'in_degree_centrality',
    'out_degree_centrality',
    'clustering_coefficient',
}
MAX_LIMIT = 100


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        return db
    except:
        db.close()
        raise


@analysis_bp.route('/<int:match_id>/metrics', methods=['GET'])
@require_api_key
def get_match_metrics(match_id: int):
    """
    Get network metrics for a match.

    Query params:
    - team_id: Filter by team
    """
    db = get_db()
    try:
        team_id = request.args.get('team_id', type=int)

        query = db.query(NetworkMetrics).filter(NetworkMetrics.match_id == match_id)

        if team_id:
            query = query.filter(NetworkMetrics.team_id == team_id)

        metrics = query.options(joinedload(NetworkMetrics.player)).all()

        return jsonify({
            'match_id': match_id,
            'metrics': [m.to_dict() for m in metrics]
        })
    finally:
        db.close()


@analysis_bp.route('/<int:match_id>/patterns', methods=['GET'])
@require_api_key
def get_patterns(match_id: int):
    """
    Get detected tactical patterns for a match.

    Query params:
    - team_id: Filter by team
    """
    db = get_db()
    try:
        team_id = request.args.get('team_id', type=int)

        query = db.query(TacticalPattern).filter(TacticalPattern.match_id == match_id)

        if team_id:
            query = query.filter(TacticalPattern.team_id == team_id)

        patterns = query.order_by(TacticalPattern.confidence_score.desc()).all()

        return jsonify({
            'match_id': match_id,
            'patterns': [p.to_dict() for p in patterns]
        })
    finally:
        db.close()


@analysis_bp.route('/<int:match_id>/countertactics', methods=['GET'])
@require_api_key
def get_counter_tactics(match_id: int):
    """
    Get counter-tactical recommendations for a match.

    Query params:
    - team_id: Filter by team being analyzed (to counter)
    """
    db = get_db()
    try:
        team_id = request.args.get('team_id', type=int)

        # Get patterns first
        pattern_query = db.query(TacticalPattern).filter(TacticalPattern.match_id == match_id)

        if team_id:
            pattern_query = pattern_query.filter(TacticalPattern.team_id == team_id)

        patterns = pattern_query.all()
        pattern_ids = [p.pattern_id for p in patterns]

        if not pattern_ids:
            return jsonify({
                'match_id': match_id,
                'counter_tactics': [],
                'message': 'No patterns found. Run analysis first.'
            })

        # Get counter tactics for these patterns
        tactics = db.query(CounterTactic).filter(
            CounterTactic.pattern_id.in_(pattern_ids)
        ).order_by(CounterTactic.priority).all()

        return jsonify({
            'match_id': match_id,
            'counter_tactics': [t.to_dict() for t in tactics]
        })
    finally:
        db.close()


@analysis_bp.route('/<int:match_id>/top-players', methods=['GET'])
@require_api_key
def get_top_players(match_id: int):
    """
    Get top players by centrality for a match.

    Query params:
    - team_id: Filter by team
    - metric: Metric to sort by (default: betweenness_centrality)
    - limit: Number of players (default: 5, max: 100)
    """
    db = get_db()
    try:
        team_id = request.args.get('team_id', type=int)
        metric = request.args.get('metric', default='betweenness_centrality')
        limit = request.args.get('limit', default=5, type=int)

        # Cap limit to prevent DoS
        if limit is None or limit < 1:
            limit = 5
        limit = min(limit, MAX_LIMIT)

        # Whitelist metric to prevent attribute access on internal SQLAlchemy attrs
        if metric not in ALLOWED_METRICS:
            metric = 'betweenness_centrality'

        query = db.query(NetworkMetrics).filter(NetworkMetrics.match_id == match_id)

        if team_id:
            query = query.filter(NetworkMetrics.team_id == team_id)

        # Sort by requested metric (already whitelisted)
        query = query.order_by(getattr(NetworkMetrics, metric).desc())

        top_metrics = query.options(joinedload(NetworkMetrics.player)).limit(limit).all()

        return jsonify({
            'match_id': match_id,
            'metric': metric,
            'top_players': [m.to_dict() for m in top_metrics]
        })
    finally:
        db.close()
