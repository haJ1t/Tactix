"""
Main Flask Application
"""
from flask import Flask, jsonify
from flask_cors import CORS
import os
import sys

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import init_db
from api.match_routes import match_bp
from api.analysis_routes import analysis_bp
from api.report_routes import reports_bp
from api.team_player_routes import team_bp, player_bp
from config import config as app_config


def create_app(config_name: str = 'development'):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(app_config.get(config_name, app_config['default']))
    
    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Initialize database
    with app.app_context():
        # Ensure database directory exists
        db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database')
        os.makedirs(db_dir, exist_ok=True)
        init_db()
    
    # Register blueprints
    app.register_blueprint(match_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(team_bp)
    app.register_blueprint(player_bp)
    
    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'version': '1.0.0'
        })
    
    # Root endpoint
    @app.route('/', methods=['GET'])
    def root():
        return jsonify({
            'name': 'Pass Network Analysis API',
            'version': '1.0.0',
            'endpoints': {
                'matches': '/api/matches',
                'teams': '/api/teams',
                'players': '/api/players',
                'analysis': '/api/analysis/<match_id>',
                'reports': '/api/reports',
                'health': '/api/health'
            }
        })
    
    return app


# Application instance for running directly
app = create_app()

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5001)
