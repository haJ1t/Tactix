"""
Team and Player API routes
"""
from flask import Blueprint, jsonify, request
from sqlalchemy.orm import joinedload
from models import SessionLocal
from models.team import Team
from models.player import Player
from models.network_metrics import NetworkMetrics
from utils.security import require_api_key

team_bp = Blueprint('teams', __name__, url_prefix='/api/teams')
player_bp = Blueprint('players', __name__, url_prefix='/api/players')


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        return db
    except:
        db.close()
        raise


# Team routes
@team_bp.route('', methods=['GET'])
@require_api_key
def list_teams():
    """List all teams."""
    db = get_db()
    try:
        teams = db.query(Team).all()
        return jsonify({
            'teams': [t.to_dict() for t in teams],
            'count': len(teams)
        })
    finally:
        db.close()


@team_bp.route('/<int:team_id>', methods=['GET'])
@require_api_key
def get_team(team_id: int):
    """Get team details."""
    db = get_db()
    try:
        team = db.query(Team).filter(Team.team_id == team_id).first()
        if not team:
            return jsonify({'error': 'Team not found'}), 404

        # Include players
        players = db.query(Player).filter(Player.team_id == team_id).all()

        result = team.to_dict()
        result['players'] = [p.to_dict() for p in players]

        return jsonify(result)
    finally:
        db.close()


@team_bp.route('/<int:team_id>/metrics', methods=['GET'])
@require_api_key
def get_team_metrics(team_id: int):
    """Get aggregated network metrics for a team across matches."""
    db = get_db()
    try:
        match_id = request.args.get('match_id', type=int)

        query = db.query(NetworkMetrics).filter(NetworkMetrics.team_id == team_id)

        if match_id:
            query = query.filter(NetworkMetrics.match_id == match_id)

        metrics = query.options(joinedload(NetworkMetrics.player)).all()

        return jsonify({
            'team_id': team_id,
            'metrics': [m.to_dict() for m in metrics]
        })
    finally:
        db.close()


# Player routes
@player_bp.route('/<int:player_id>', methods=['GET'])
@require_api_key
def get_player(player_id: int):
    """Get player details."""
    db = get_db()
    try:
        player = db.query(Player).filter(Player.player_id == player_id).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        return jsonify(player.to_dict())
    finally:
        db.close()


@player_bp.route('/<int:player_id>/centrality', methods=['GET'])
@require_api_key
def get_player_centrality(player_id: int):
    """Get player centrality scores across matches."""
    db = get_db()
    try:
        match_id = request.args.get('match_id', type=int)

        query = db.query(NetworkMetrics).filter(NetworkMetrics.player_id == player_id)

        if match_id:
            query = query.filter(NetworkMetrics.match_id == match_id)

        metrics = query.options(joinedload(NetworkMetrics.player)).all()

        if not metrics:
            return jsonify({
                'player_id': player_id,
                'metrics': [],
                'message': 'No metrics found. Run analysis first.'
            })

        return jsonify({
            'player_id': player_id,
            'metrics': [m.to_dict() for m in metrics]
        })
    finally:
        db.close()
