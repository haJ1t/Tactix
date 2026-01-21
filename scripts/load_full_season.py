"""
Load a full season of match data into database

Loads all matches from a competition/season from StatsBomb open data.
"""
import os
import sys
import time

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

# Premier League 2015/2016 season
PREMIER_LEAGUE_ID = 2
SEASON_2015_16_ID = 27


def load_full_season(competition_id: int, season_id: int):
    """
    Load all matches from a competition/season.
    
    Args:
        competition_id: StatsBomb competition ID
        season_id: StatsBomb season ID
    """
    # Initialize database
    init_db()
    
    # Create parser
    parser = StatsBombParser(DATA_DIR)
    
    # Get matches
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
        return
    
    print(f"\nFound {len(matches)} matches to load")
    print("=" * 60)
    
    loaded = 0
    skipped = 0
    errors = 0
    
    for i, match_data in enumerate(matches):
        match_id = match_data['match_id']
        home_team = match_data['home_team_name']
        away_team = match_data['away_team_name']
        
        print(f"\n[{i+1}/{len(matches)}] {home_team} vs {away_team}")
        
        try:
            result = load_single_match(parser, match_data)
            if result == 'loaded':
                loaded += 1
            elif result == 'skipped':
                skipped += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            errors += 1
    
    print("\n" + "=" * 60)
    print(f"COMPLETE: {loaded} loaded, {skipped} skipped, {errors} errors")
    print(f"Total matches in database: {loaded + skipped}")


def load_single_match(parser, match_data: dict) -> str:
    """Load a single match. Returns 'loaded', 'skipped', or raises exception."""
    match_id = match_data['match_id']
    
    db = SessionLocal()
    
    try:
        # Check if already exists
        existing = db.query(Match).filter(Match.match_id == match_id).first()
        if existing:
            print(f"  Already loaded, skipping...")
            return 'skipped'
        
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
        lineups = parser.parse_lineups(match_id)
        for team_id, players in lineups.items():
            for player_data in players:
                get_or_create_player(db, player_data)
        
        # Load events
        events = parser.parse_events(match_id)
        
        if not events:
            print(f"  No events found, skipping...")
            db.rollback()
            return 'skipped'
        
        # Add match_id to events
        for event in events:
            event['match_id'] = match_id
        
        # Extract passes
        passes = parser.extract_passes(events)
        
        # Create event records
        for event_data in events:
            if event_data.get('player_id'):
                player_data = {
                    'player_id': event_data['player_id'],
                    'player_name': event_data.get('player_name', f"Player {event_data['player_id']}"),
                    'team_id': event_data.get('team_id'),
                    'position': 'Unknown',
                    'jersey_number': None
                }
                get_or_create_player(db, player_data)
            
            event = Event(
                event_id=event_data['event_id'],
                match_id=match_id,
                team_id=event_data.get('team_id'),
                player_id=event_data.get('player_id'),
                event_type=event_data['event_type'],
                period=event_data['period'],
                timestamp=event_data['timestamp'],
                minute=event_data['minute'],
                second=event_data['second'],
                location_x=event_data.get('location_x'),
                location_y=event_data.get('location_y')
            )
            db.add(event)
        
        db.flush()
        
        # Create pass records
        for pass_data in passes:
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
                body_part=pass_data.get('body_part')
            )
            db.add(pass_event)
        
        db.commit()
        
        print(f"  Loaded: {len(events)} events, {len(passes)} passes")
        return 'loaded'
        
    except Exception as e:
        db.rollback()
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


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Load full season of StatsBomb data')
    parser.add_argument('--competition', type=int, default=PREMIER_LEAGUE_ID,
                        help='Competition ID (default: Premier League)')
    parser.add_argument('--season', type=int, default=SEASON_2015_16_ID,
                        help='Season ID (default: 2015/2016)')
    
    args = parser.parse_args()
    
    print(f"Loading Premier League 2015/2016 season...")
    print(f"Competition ID: {args.competition}, Season ID: {args.season}")
    print()
    
    load_full_season(args.competition, args.season)
