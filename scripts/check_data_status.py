import os
import sys
import json
from sqlalchemy import func

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal
from backend.models import SessionLocal
from backend.models.match import Match
from backend.models.event import Event
from backend.models.team import Team  # Added Team
from backend.models.player import Player
from backend.models.network_metrics import NetworkMetrics
from backend.models.tactical_pattern import TacticalPattern # Added Player just in case
from backend.models.pass_event import PassEvent # Added Player just in case
from backend.models.counter_tactic import CounterTactic # Added Player just in case

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'raw')
if not os.path.exists(os.path.join(DATA_DIR, 'competitions.json')):
     DATA_DIR = os.path.join(DATA_DIR, 'open-data', 'data')

def check_status():
    # 1. Database Counts
    db = SessionLocal()
    try:
        loaded_matches = db.query(func.count(Match.match_id)).scalar() or 0
        loaded_events = db.query(func.count(Event.event_id)).scalar() or 0
        
        # Get loaded seasons (distinct competition_id, season_id)
        loaded_seasons_query = db.query(Match.competition, Match.season).distinct().all()
        loaded_seasons_count = len(loaded_seasons_query)
        
    finally:
        db.close()

    # 2. File System Counts
    total_matches = 0
    total_seasons = 0
    
    competitions_file = os.path.join(DATA_DIR, 'competitions.json')
    if os.path.exists(competitions_file):
        with open(competitions_file, 'r') as f:
            comps = json.load(f)
            total_seasons = len(comps)
            
            for comp in comps:
                cid = comp['competition_id']
                sid = comp['season_id']
                matches_file = os.path.join(DATA_DIR, 'matches', str(cid), f"{sid}.json")
                if os.path.exists(matches_file):
                    with open(matches_file, 'r') as mf:
                        matches = json.load(mf)
                        total_matches += len(matches)

    # Estimate total events (avg 3300 per match)
    estimated_total_events = total_matches * 3300

    print(f"--- Data Status ---")
    print(f"Loaded Seasons: {loaded_seasons_count}")
    print(f"Total Available Seasons: {total_seasons}")
    print(f"Unloaded Seasons: {total_seasons - loaded_seasons_count}")
    print(f"")
    print(f"Loaded Matches: {loaded_matches}")
    print(f"Total Available Matches: {total_matches}")
    print(f"Unloaded Matches: {total_matches - loaded_matches}")
    print(f"")
    print(f"Loaded Events: {loaded_events}")
    print(f"Estimated Total Events: {estimated_total_events:,}")
    print(f"Estimated Unloaded Events: {estimated_total_events - loaded_events:,}")

if __name__ == "__main__":
    check_status()
