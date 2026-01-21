import os
import sys
import argparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal, init_db
from backend.models.match import Match
from backend.services.data_parser import StatsBombParser
from scripts.load_sample_data import load_sample_match

# Project paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, 'data', 'raw')

def load_season(competition_id, season_id):
    """Load all matches for a specific competition and season."""
    print(f"Starting batch load for Competition {competition_id}, Season {season_id}...")
    
    # Initialize DB once
    init_db()
    
    # Parser to get match list
    parser = StatsBombParser(DATA_DIR)
    matches = parser.parse_matches(competition_id, season_id)
    
    if not matches:
        # Try open-data subdirectory
        alt_data_dir = os.path.join(DATA_DIR, 'open-data', 'data')
        if os.path.exists(alt_data_dir):
            parser = StatsBombParser(alt_data_dir)
            matches = parser.parse_matches(competition_id, season_id)
            
    if not matches:
        print("No matches found.")
        return

    print(f"Found {len(matches)} matches. Starting load...")
    
    successful_loads = 0
    failed_loads = 0
    skipped_loads = 0
    
    db = SessionLocal()
    existing_match_ids = {m[0] for m in db.query(Match.match_id).all()}
    db.close()

    for i, match in enumerate(matches):
        match_id = match['match_id']
        match_desc = f"{match['home_team_name']} vs {match['away_team_name']}"
        
        if match_id in existing_match_ids:
            print(f"[{i+1}/{len(matches)}] Skipping existing match {match_id}: {match_desc}")
            skipped_loads += 1
            continue

        print(f"[{i+1}/{len(matches)}] Loading match {match_id}: {match_desc}")
        try:
            # Re-using load_sample_match logic might be tricky if it re-inits DB or has sys.exit.
            # Ideally we refactor load_sample_data to separate logic. 
            # For now, let's just assume we can call the core logic or just implement it here.
            # Actually, calling load_sample_match is safe as it just prints and returns.
            # But load_sample_match takes an INDEX, not ID.
            # So we pass 'i' as match_index.
            # Wait, load_sample_match re-fetches the match list every time. That's inefficient but acceptable for 50 matches.
            
            result = load_sample_match(competition_id, season_id, match_index=i)
            if result:
                successful_loads += 1
            else:
                failed_loads += 1
                
        except Exception as e:
            print(f"Failed to load match {match_id}: {e}")
            failed_loads += 1

    print("\n--- Load Summary ---")
    print(f"Total Matches: {len(matches)}")
    print(f"Successfully Loaded: {successful_loads}")
    print(f"Skipped (Already Exists): {skipped_loads}")
    print(f"Failed: {failed_loads}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Load all matches for a season')
    parser.add_argument('--competition', type=int, required=True, help='Competition ID')
    parser.add_argument('--season', type=int, required=True, help='Season ID')
    
    args = parser.parse_args()
    convert_ids = {55: 55, 282: 282} # Just ensuring int
    
    load_season(args.competition, args.season)
