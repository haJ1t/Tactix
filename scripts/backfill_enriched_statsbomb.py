"""
Backfill enriched StatsBomb fields into the existing local SQLite dataset.

This script upgrades the current loaded match set in-place:
- ensures the additive schema upgrades exist
- re-parses raw event/lineup files for matches already present in the DB
- updates Event and PassEvent rows with richer contextual fields
- refreshes player positions when lineups contain better information
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from sqlalchemy import select

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / 'backend'
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_DIR))

from backend.models import SessionLocal, DATABASE_PATH, init_db
from backend.models.event import Event
from backend.models.match import Match
from backend.models.pass_event import PassEvent
from backend.models.player import Player
from backend.services.data_parser import StatsBombParser


RAW_DIR = PROJECT_ROOT / 'data' / 'raw'
ALT_RAW_DIR = RAW_DIR / 'open-data' / 'data'
BACKUP_PATH = Path(DATABASE_PATH).with_name('pass_network.pre_enriched_backup.db')


def resolve_parser() -> StatsBombParser:
    if ALT_RAW_DIR.exists():
        return StatsBombParser(str(ALT_RAW_DIR))
    return StatsBombParser(str(RAW_DIR))


def backup_database():
    source = Path(DATABASE_PATH)
    if not source.exists():
        return
    if BACKUP_PATH.exists():
        return
    shutil.copy2(source, BACKUP_PATH)
    print(f"Created backup at {BACKUP_PATH}")


def update_player_positions(db, lineup_map):
    for team_players in lineup_map.values():
        for player_data in team_players:
            player = db.get(Player, player_data['player_id'])
            if player is None:
                continue
            incoming = player_data.get('position')
            if incoming and incoming != 'Unknown':
                player.position = incoming
            if player_data.get('jersey_number') is not None:
                player.jersey_number = player_data['jersey_number']


def main():
    init_db()
    backup_database()
    parser = resolve_parser()

    db = SessionLocal()
    try:
        # Pull existing match IDs
        match_ids = [row[0] for row in db.execute(select(Match.match_id)).all()]
        print(f"Backfilling enriched fields for {len(match_ids)} loaded matches...")

        updated_matches = 0
        updated_events = 0
        updated_passes = 0

        for index, match_id in enumerate(match_ids, start=1):
            events = parser.parse_events(match_id)
            if not events:
                continue

            # Refresh player positions
            lineups = parser.parse_lineups(match_id)
            update_player_positions(db, lineups)

            # Build lookup tables
            event_map = {event['event_id']: event for event in events}
            pass_map = {
                pass_row['pass_id']: pass_row
                for pass_row in parser.extract_passes(events)
            }

            # Update event rows
            db_events = db.execute(
                select(Event).where(Event.match_id == match_id)
            ).scalars().all()
            for event_row in db_events:
                payload = event_map.get(event_row.event_id)
                if payload is None:
                    continue
                event_row.event_index = payload.get('event_index')
                event_row.duration = payload.get('duration')
                event_row.possession_id = payload.get('possession_id')
                event_row.possession_team_id = payload.get('possession_team_id')
                event_row.play_pattern = payload.get('play_pattern')
                event_row.position_name = payload.get('position_name')
                event_row.under_pressure = payload.get('under_pressure')
                event_row.outcome_name = payload.get('outcome_name')
                event_row.shot_outcome = payload.get('shot_outcome')
                event_row.is_goal = payload.get('is_goal')
                updated_events += 1

            # Update pass rows
            db_passes = db.execute(
                select(PassEvent).join(Event).where(Event.match_id == match_id)
            ).scalars().all()
            for pass_row in db_passes:
                payload = pass_map.get(pass_row.pass_id)
                if payload is None:
                    continue
                pass_row.technique = payload.get('technique')
                pass_row.is_cross = payload.get('is_cross')
                pass_row.is_switch = payload.get('is_switch')
                pass_row.is_through_ball = payload.get('is_through_ball')
                pass_row.is_cut_back = payload.get('is_cut_back')
                updated_passes += 1

            updated_matches += 1
            if index % 25 == 0:
                db.commit()
                print(f"  Processed {index}/{len(match_ids)} matches...")

        db.commit()
        print("Backfill complete.")
        print(f"  Matches updated: {updated_matches}")
        print(f"  Events updated: {updated_events}")
        print(f"  Passes updated: {updated_passes}")
    finally:
        db.close()


if __name__ == '__main__':
    main()
