"""
Load sample match data into database

Loads a sample match from StatsBomb open data for testing.
"""
import os
import sys
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal, init_db
from backend.models.match import Match
from backend.models.team import Team
from backend.models.player import Player
from backend.models.event import Event
from backend.models.pass_event import PassEvent
from backend.services.data_parser import StatsBombParser

# Project paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, 'data', 'raw')

# Default competition and season (La Liga 2020/2021)
DEFAULT_COMPETITION_ID = 11
DEFAULT_SEASON_ID = 90


def load_sample_match(competition_id: int = None, season_id: int = None, match_index: int = 0):
    """
    Load a sample match from StatsBomb data.
    
    Args:
        competition_id: StatsBomb competition ID (default: La Liga)
        season_id: StatsBomb season ID (default: 2020/2021)
        match_index: Which match to load (0 = first)
    """
    competition_id = competition_id or DEFAULT_COMPETITION_ID
    season_id = season_id or DEFAULT_SEASON_ID
    
    # Initialize database
    init_db()
    
    # Create parser
    parser = StatsBombParser(DATA_DIR)
    
    # Get matches for competition/season
    print(f"Loading matches for competition {competition_id}, season {season_id}...")
    
    matches = parser.parse_matches(competition_id, season_id)
    
    if not matches:
        # Try open-data subdirectory
        alt_data_dir = os.path.join(DATA_DIR, 'open-data', 'data')
        if os.path.exists(alt_data_dir):
            parser = StatsBombParser(alt_data_dir)
            matches = parser.parse_matches(competition_id, season_id)
    
    if not matches:
        print("No matches found. Make sure StatsBomb data is downloaded.")
        print("Run: python scripts/download_statsbomb_data.py")
        return None
    
    if match_index >= len(matches):
        match_index = 0
    
    match_data = matches[match_index]
    match_id = match_data['match_id']
    
    print(f"\nLoading match: {match_data['home_team_name']} vs {match_data['away_team_name']}")
    print(f"Date: {match_data['match_date']}")
    print(f"Score: {match_data['home_score']} - {match_data['away_score']}")
    
    # Get database session
    db = SessionLocal()
    
    try:
        # Check if match already exists
        existing = db.query(Match).filter(Match.match_id == match_id).first()
        if existing:
            print(f"\nMatch {match_id} already loaded. Skipping...")
            return match_id
        
        # Create teams
        home_team = get_or_create_team(db, match_data['home_team_id'], match_data['home_team_name'])
        away_team = get_or_create_team(db, match_data['away_team_id'], match_data['away_team_name'])
        
        # Create match
        match = Match(
            match_id=match_id,
            home_team_id=home_team.team_id,
            away_team_id=away_team.team_id,
            match_date=match_data['match_date'],
            competition=match_data['competition'],
            season=match_data['season'],
            home_score=match_data['home_score'],
            away_score=match_data['away_score']
        )
        db.add(match)
        db.flush()
        
        # Load lineups
        print("\nLoading lineups...")
        lineups = parser.parse_lineups(match_id)
        
        for team_id, players in lineups.items():
            for player_data in players:
                get_or_create_player(db, player_data)
        
        print(f"  Loaded {sum(len(p) for p in lineups.values())} players")
        
        # Load events
        print("\nLoading events...")
        events = parser.parse_events(match_id)
        
        if not events:
            print("No events found for this match.")
            db.rollback()
            return None
        
        # Add match_id to events
        for event in events:
            event['match_id'] = match_id
        
        # Extract passes
        passes = parser.extract_passes(events)
        print(f"  Found {len(events)} events, {len(passes)} passes")
        
        # Create event and pass records
        pass_count = 0
        for event_data in events:
            # Create or update player if not in lineups
            if event_data.get('player_id'):
                player_data = {
                    'player_id': event_data['player_id'],
                    'player_name': event_data.get('player_name', f"Player {event_data['player_id']}"),
                    'team_id': event_data.get('team_id'),
                    'position': 'Unknown',
                    'jersey_number': None
                }
                get_or_create_player(db, player_data)
            
            # Create event
            event = Event(
                event_id=event_data['event_id'],
                match_id=match_id,
                team_id=event_data.get('team_id'),
                player_id=event_data.get('player_id'),
                event_type=event_data['event_type'],
                event_index=event_data.get('event_index'),
                period=event_data['period'],
                timestamp=event_data['timestamp'],
                duration=event_data.get('duration'),
                minute=event_data['minute'],
                second=event_data['second'],
                location_x=event_data.get('location_x'),
                location_y=event_data.get('location_y'),
                possession_id=event_data.get('possession_id'),
                possession_team_id=event_data.get('possession_team_id'),
                play_pattern=event_data.get('play_pattern'),
                position_name=event_data.get('position_name'),
                under_pressure=event_data.get('under_pressure'),
                outcome_name=event_data.get('outcome_name'),
                shot_outcome=event_data.get('shot_outcome'),
                is_goal=event_data.get('is_goal'),
            )
            db.add(event)
        
        db.flush()
        
        # Create pass records
        for pass_data in passes:
            # Ensure recipient exists
            if pass_data.get('recipient_id'):
                recipient_data = {
                    'player_id': pass_data['recipient_id'],
                    'player_name': pass_data.get('recipient_name', f"Player {pass_data['recipient_id']}"),
                    'team_id': pass_data.get('team_id'),
                    'position': 'Unknown',
                    'jersey_number': None
                }
                get_or_create_player(db, recipient_data)
            
            pass_event = PassEvent(
                pass_id=pass_data['pass_id'],
                event_id=pass_data['event_id'],
                passer_id=pass_data['passer_id'],
                recipient_id=pass_data.get('recipient_id'),
                end_location_x=pass_data.get('end_location_x'),
                end_location_y=pass_data.get('end_location_y'),
                pass_length=pass_data.get('pass_length'),
                pass_angle=pass_data.get('pass_angle'),
                pass_outcome=pass_data.get('pass_outcome'),
                pass_type=pass_data.get('pass_type'),
                pass_height=pass_data.get('pass_height'),
                body_part=pass_data.get('body_part'),
                technique=pass_data.get('technique'),
                is_cross=pass_data.get('is_cross'),
                is_switch=pass_data.get('is_switch'),
                is_through_ball=pass_data.get('is_through_ball'),
                is_cut_back=pass_data.get('is_cut_back'),
            )
            db.add(pass_event)
            pass_count += 1
        
        db.commit()
        
        print(f"\nSuccessfully loaded match {match_id}")
        print(f"  - {pass_count} passes stored")
        
        return match_id
        
    except Exception as e:
        db.rollback()
        print(f"Error loading match: {e}")
        raise
    finally:
        db.close()


def get_or_create_team(db, team_id: int, team_name: str) -> Team:
    """Get existing team or create new one."""
    team = db.query(Team).filter(Team.team_id == team_id).first()
    if not team:
        team = Team(team_id=team_id, team_name=team_name)
        db.add(team)
        db.flush()
    return team


def get_or_create_player(db, player_data: dict) -> Player:
    """Get existing player or create new one."""
    player_id = player_data['player_id']
    player = db.query(Player).filter(Player.player_id == player_id).first()
    if not player:
        player = Player(
            player_id=player_id,
            player_name=player_data['player_name'],
            team_id=player_data.get('team_id'),
            position=player_data.get('position'),
            jersey_number=player_data.get('jersey_number')
        )
        db.add(player)
        db.flush()
    return player


def list_available_competitions():
    """List available competitions in StatsBomb data."""
    parser = StatsBombParser(DATA_DIR)
    competitions = parser.parse_competitions()
    
    if not competitions:
        alt_data_dir = os.path.join(DATA_DIR, 'open-data', 'data')
        parser = StatsBombParser(alt_data_dir)
        competitions = parser.parse_competitions()
    
    if not competitions:
        print("No competitions found. Download data first.")
        return
    
    print("\nAvailable competitions:")
    print("-" * 60)
    
    for c in sorted(competitions, key=lambda x: x['competition_name']):
        print(f"ID: {c['competition_id']:3d} | Season ID: {c['season_id']:3d} | "
              f"{c['competition_name']} - {c['season_name']}")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Load StatsBomb match data')
    parser.add_argument('--list', action='store_true', help='List available competitions')
    parser.add_argument('--competition', type=int, help='Competition ID')
    parser.add_argument('--season', type=int, help='Season ID')
    parser.add_argument('--match', type=int, default=0, help='Match index (0-based)')
    
    args = parser.parse_args()
    
    if args.list:
        list_available_competitions()
    else:
        load_sample_match(args.competition, args.season, args.match)
