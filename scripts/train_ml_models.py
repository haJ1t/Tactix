"""
Load multiple matches and train ML models.
"""
import os
import sys
import json
import pandas as pd
from datetime import datetime

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal, init_db
from backend.models.team import Team
from backend.models.match import Match
from backend.models.player import Player
from backend.models.event import Event
from backend.models.pass_event import PassEvent
from backend.services.data_parser import StatsBombParser
from backend.services.ml.vaep_model import VAEPModel
from backend.services.ml.pass_difficulty_model import PassDifficultyModel
from backend.services.ml.tactical_classifier import TacticalPatternClassifier


def parse_date(date_str):
    """Parse date string to Python date object."""
    if date_str:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        except:
            return None
    return None


def load_multiple_matches(data_dir: str, competition_id: int = 11, season_id: int = 90, max_matches: int = 10):
    """Load multiple matches from StatsBomb data."""
    
    parser = StatsBombParser(data_dir)
    db = SessionLocal()
    
    try:
        # Get matches for La Liga 2020/2021
        matches_file = os.path.join(data_dir, 'matches', str(competition_id), f'{season_id}.json')
        
        if not os.path.exists(matches_file):
            print(f"Matches file not found: {matches_file}")
            return []
        
        with open(matches_file, 'r') as f:
            matches_data = json.load(f)
        
        loaded_match_ids = []
        all_passes_data = []
        
        for i, match_info in enumerate(matches_data[:max_matches]):
            match_id = match_info['match_id']
            
            # Check if already loaded
            existing = db.query(Match).filter(Match.match_id == match_id).first()
            if existing:
                print(f"Match {match_id} already exists, skipping...")
                loaded_match_ids.append(match_id)
                continue
            
            print(f"\n[{i+1}/{max_matches}] Loading match {match_id}...")
            
            # Get teams
            home_team_data = match_info['home_team']
            away_team_data = match_info['away_team']
            
            # Create/get home team
            home_team = db.query(Team).filter(Team.team_id == home_team_data['home_team_id']).first()
            if not home_team:
                home_team = Team(
                    team_id=home_team_data['home_team_id'],
                    team_name=home_team_data['home_team_name']
                )
                db.add(home_team)
            
            # Create/get away team
            away_team = db.query(Team).filter(Team.team_id == away_team_data['away_team_id']).first()
            if not away_team:
                away_team = Team(
                    team_id=away_team_data['away_team_id'],
                    team_name=away_team_data['away_team_name']
                )
                db.add(away_team)
            
            db.flush()
            
            # Create match - parse date string to date object
            match = Match(
                match_id=match_id,
                home_team_id=home_team_data['home_team_id'],
                away_team_id=away_team_data['away_team_id'],
                match_date=parse_date(match_info.get('match_date')),
                competition=match_info.get('competition', {}).get('competition_name', 'La Liga'),
                season=match_info.get('season', {}).get('season_name', '2020/2021'),
                home_score=match_info.get('home_score', 0),
                away_score=match_info.get('away_score', 0)
            )
            db.add(match)
            db.flush()
            
            # Load lineups
            lineups_file = os.path.join(data_dir, 'lineups', f'{match_id}.json')
            if os.path.exists(lineups_file):
                with open(lineups_file, 'r') as f:
                    lineups_data = json.load(f)
                
                for team_lineup in lineups_data:
                    team_id = team_lineup['team_id']
                    for player_data in team_lineup.get('lineup', []):
                        player_id = player_data['player_id']
                        existing_player = db.query(Player).filter(Player.player_id == player_id).first()
                        if not existing_player:
                            player = Player(
                                player_id=player_id,
                                player_name=player_data['player_name'],
                                team_id=team_id,
                                jersey_number=player_data.get('jersey_number'),
                                position=player_data.get('positions', [{}])[0].get('position') if player_data.get('positions') else None
                            )
                            db.add(player)
            
            db.flush()
            
            # Load events
            events_file = os.path.join(data_dir, 'events', f'{match_id}.json')
            if os.path.exists(events_file):
                with open(events_file, 'r') as f:
                    events_data = json.load(f)
                
                pass_count = 0
                for event_data in events_data:
                    event_type = event_data.get('type', {}).get('name', '')
                    
                    # Create event
                    location = event_data.get('location', [None, None])
                    event = Event(
                        event_id=event_data['id'],
                        match_id=match_id,
                        team_id=event_data.get('team', {}).get('id'),
                        player_id=event_data.get('player', {}).get('id'),
                        event_type=event_type,
                        event_index=event_data.get('index'),
                        minute=event_data.get('minute', 0),
                        second=event_data.get('second', 0),
                        period=event_data.get('period', 1),
                        duration=event_data.get('duration'),
                        location_x=location[0] if location else None,
                        location_y=location[1] if len(location) > 1 else None,
                        possession_id=event_data.get('possession'),
                        possession_team_id=event_data.get('possession_team', {}).get('id'),
                        play_pattern=event_data.get('play_pattern', {}).get('name'),
                        position_name=event_data.get('position', {}).get('name'),
                        under_pressure=bool(event_data.get('under_pressure', False)),
                        outcome_name=event_data.get('shot', {}).get('outcome', {}).get('name'),
                        shot_outcome=event_data.get('shot', {}).get('outcome', {}).get('name'),
                        is_goal=event_data.get('shot', {}).get('outcome', {}).get('name') == 'Goal'
                    )
                    db.add(event)
                    
                    # Create pass event if applicable
                    if event_type == 'Pass' and 'pass' in event_data:
                        pass_data = event_data['pass']
                        end_location = pass_data.get('end_location', [None, None])
                        
                        pass_event = PassEvent(
                            event_id=event_data['id'],
                            passer_id=event_data.get('player', {}).get('id'),
                            recipient_id=pass_data.get('recipient', {}).get('id'),
                            pass_length=pass_data.get('length'),
                            pass_angle=pass_data.get('angle'),
                            pass_height=pass_data.get('height', {}).get('name'),
                            end_location_x=end_location[0] if end_location else None,
                            end_location_y=end_location[1] if len(end_location) > 1 else None,
                            pass_outcome=pass_data.get('outcome', {}).get('name') if 'outcome' in pass_data else None,
                            pass_type=pass_data.get('type', {}).get('name') if 'type' in pass_data else None,
                            body_part=pass_data.get('body_part', {}).get('name') if 'body_part' in pass_data else None,
                            technique=pass_data.get('technique', {}).get('name') if 'technique' in pass_data else None,
                            is_cross=bool(pass_data.get('cross', False)),
                            is_switch=bool(pass_data.get('switch', False)),
                            is_through_ball=bool(pass_data.get('through_ball', False)),
                            is_cut_back=bool(pass_data.get('cut_back', False))
                        )
                        db.add(pass_event)
                        pass_count += 1
                        
                        # Collect for training
                        all_passes_data.append({
                            'match_id': match_id,
                            'event_id': event_data['id'],
                            'team_id': event_data.get('team', {}).get('id'),
                            'passer_id': event_data.get('player', {}).get('id'),
                            'recipient_id': pass_data.get('recipient', {}).get('id'),
                            'location_x': location[0] if location else 60,
                            'location_y': location[1] if len(location) > 1 else 40,
                            'end_location_x': end_location[0] if end_location else 60,
                            'end_location_y': end_location[1] if len(end_location) > 1 else 40,
                            'pass_outcome': pass_data.get('outcome', {}).get('name') if 'outcome' in pass_data else 'Complete',
                            'pass_length': pass_data.get('length', 10),
                            'pass_type': pass_data.get('type', {}).get('name'),
                            'pass_height': pass_data.get('height', {}).get('name'),
                            'body_part': pass_data.get('body_part', {}).get('name'),
                            'technique': pass_data.get('technique', {}).get('name') if 'technique' in pass_data else None,
                            'is_cross': bool(pass_data.get('cross', False)),
                            'is_switch': bool(pass_data.get('switch', False)),
                            'is_through_ball': bool(pass_data.get('through_ball', False)),
                            'is_cut_back': bool(pass_data.get('cut_back', False)),
                            'competition': match_info.get('competition', {}).get('competition_name', 'La Liga'),
                            'season': match_info.get('season', {}).get('season_name', '2020/2021'),
                            'minute': event_data.get('minute', 0),
                            'period': event_data.get('period', 1),
                            'event_type': 'Pass'
                        })
                
                print(f"  Loaded {pass_count} passes")
            
            db.commit()
            loaded_match_ids.append(match_id)
            print(f"  Match {match_id} loaded successfully!")
        
        return all_passes_data, loaded_match_ids
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


def train_ml_models(passes_df: pd.DataFrame):
    """Train all ML models on the collected pass data."""
    
    print("\n" + "="*50)
    print("TRAINING ML MODELS")
    print("="*50)
    
    models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'models', 'trained')
    os.makedirs(models_dir, exist_ok=True)
    
    # 1. Train Pass Difficulty Model
    print("\n[1/3] Training Pass Difficulty Model (Random Forest)...")
    pass_model = PassDifficultyModel()
    pass_results = pass_model.train(passes_df)
    print(f"  Accuracy: {pass_results['accuracy']:.2%}")
    print(f"  Samples used: {pass_results['samples_used']}")
    pass_model.save_model(os.path.join(models_dir, 'pass_difficulty.joblib'))
    print("  Model saved!")
    
    # 2. Train VAEP Model
    print("\n[2/3] Training VAEP Model (Gradient Boosting)...")
    vaep_model = VAEPModel()
    vaep_results = vaep_model.train(passes_df)
    print(f"  Scoring Accuracy: {vaep_results['scoring_accuracy']:.2%}")
    print(f"  Conceding Accuracy: {vaep_results['conceding_accuracy']:.2%}")
    print(f"  Samples used: {vaep_results['samples_used']}")
    vaep_model.save_model(os.path.join(models_dir, 'vaep_model.joblib'))
    print("  Model saved!")
    
    # 3. Initialize Tactical Classifier (will use rule-based + clustering)
    print("\n[3/3] Initializing Tactical Pattern Classifier...")
    pattern_classifier = TacticalPatternClassifier()
    pattern_classifier.save_model(os.path.join(models_dir, 'tactical_classifier.joblib'))
    print("  Classifier initialized!")
    
    print("\n" + "="*50)
    print("ML TRAINING COMPLETE!")
    print("="*50)
    print(f"\nModels saved to: {models_dir}")
    
    return {
        'pass_difficulty': pass_results,
        'vaep': vaep_results
    }


if __name__ == '__main__':
    # Initialize database
    init_db()
    
    # Data directory
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'raw', 'open-data', 'data')
    
    if not os.path.exists(data_dir):
        # Try alternative path
        data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'raw')
    
    print("Data directory:", data_dir)
    
    # Load 10 matches
    print("\n" + "="*50)
    print("LOADING MATCHES")
    print("="*50)
    
    passes_data, match_ids = load_multiple_matches(
        data_dir, 
        competition_id=11,  # La Liga
        season_id=90,       # 2020/2021
        max_matches=10
    )
    
    print(f"\nTotal matches loaded: {len(match_ids)}")
    print(f"Total passes collected: {len(passes_data)}")
    
    if len(passes_data) > 100:
        # Train models
        passes_df = pd.DataFrame(passes_data)
        train_ml_models(passes_df)
    else:
        print("\nNot enough pass data for training. Need at least 100 passes.")
