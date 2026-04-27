"""
StatsBomb JSON data parser

Parses StatsBomb open data format to extract matches, events, and lineups.
"""
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import math


class StatsBombParser:
    """Parser for StatsBomb JSON event data."""
    
    def __init__(self, data_dir: str):
        """
        Initialize parser with data directory path.
        
        Args:
            data_dir: Path to StatsBomb data directory
        """
        self.data_dir = Path(data_dir).resolve()

    @staticmethod
    def _sanitize_id(value) -> str:
        """Remove path traversal characters from an identifier."""
        return re.sub(r'[^a-zA-Z0-9_-]', '', str(value))

    def _safe_path(self, *parts) -> Path:
        """Build a path and ensure it stays within data_dir."""
        target = self.data_dir.joinpath(*parts)
        try:
            target.resolve().relative_to(self.data_dir)
        except ValueError:
            raise ValueError(f"Path traversal detected: {target}")
        return target
        
    def parse_competitions(self) -> List[Dict]:
        """Parse competitions.json file."""
        filepath = self._safe_path('competitions.json')
        if not filepath.exists():
            return []

        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def parse_matches(self, competition_id: int, season_id: int) -> List[Dict]:
        """
        Parse matches for a specific competition and season.

        Args:
            competition_id: StatsBomb competition ID
            season_id: StatsBomb season ID

        Returns:
            List of match dictionaries
        """
        safe_comp = self._sanitize_id(competition_id)
        safe_season = self._sanitize_id(season_id)
        filepath = self._safe_path('matches', safe_comp, f'{safe_season}.json')

        if not filepath.exists():
            return []

        with open(filepath, 'r', encoding='utf-8') as f:
            matches = json.load(f)

        return [self._transform_match(m) for m in matches]
    
    def _transform_match(self, match: Dict) -> Dict:
        """Transform StatsBomb match format to our schema."""
        return {
            'match_id': match['match_id'],
            'home_team_id': match['home_team']['home_team_id'],
            'home_team_name': match['home_team']['home_team_name'],
            'away_team_id': match['away_team']['away_team_id'],
            'away_team_name': match['away_team']['away_team_name'],
            'match_date': datetime.strptime(match['match_date'], '%Y-%m-%d').date(),
            'competition': match['competition']['competition_name'],
            'season': match['season']['season_name'],
            'home_score': match['home_score'],
            'away_score': match['away_score']
        }
    
    def parse_events(self, match_id: int) -> List[Dict]:
        """
        Parse events for a specific match.

        Args:
            match_id: Match ID

        Returns:
            List of event dictionaries
        """
        safe_match = self._sanitize_id(match_id)
        filepath = self._safe_path('events', f'{safe_match}.json')

        if not filepath.exists():
            return []

        with open(filepath, 'r', encoding='utf-8') as f:
            events = json.load(f)

        return [self._transform_event(e) for e in events]
    
    def _transform_event(self, event: Dict) -> Dict:
        """Transform StatsBomb event format to our schema."""
        location = event.get('location', [None, None])
        shot_data = event.get('shot', {})
        shot_outcome = shot_data.get('outcome', {}).get('name')

        transformed = {
            'event_id': event['id'],
            'match_id': event.get('match_id'),
            'team_id': event.get('team', {}).get('id'),
            'team_name': event.get('team', {}).get('name'),
            'player_id': event.get('player', {}).get('id'),
            'player_name': event.get('player', {}).get('name'),
            'event_type': event['type']['name'],
            'event_index': event.get('index'),
            'period': event['period'],
            'timestamp': event['timestamp'],
            'duration': event.get('duration'),
            'minute': event['minute'],
            'second': event['second'],
            'location_x': location[0] if location else None,
            'location_y': location[1] if location else None,
            'possession_id': event.get('possession'),
            'possession_team_id': event.get('possession_team', {}).get('id'),
            'play_pattern': event.get('play_pattern', {}).get('name'),
            'position_name': event.get('position', {}).get('name'),
            'under_pressure': bool(event.get('under_pressure', False)),
            'outcome_name': shot_outcome,
            'shot_outcome': shot_outcome,
            'is_goal': shot_outcome == 'Goal',
        }
        
        # Add pass-specific data if this is a pass event
        if event['type']['name'] == 'Pass':
            pass_data = event.get('pass', {})
            # Default coords when missing
            end_location = pass_data.get('end_location', [None, None])
            
            transformed['pass_data'] = {
                'recipient_id': pass_data.get('recipient', {}).get('id'),
                'recipient_name': pass_data.get('recipient', {}).get('name'),
                'end_location_x': end_location[0] if end_location else None,
                'end_location_y': end_location[1] if end_location else None,
                'pass_length': pass_data.get('length'),
                'pass_angle': pass_data.get('angle'),
                'pass_outcome': pass_data.get('outcome', {}).get('name', 'Complete'),
                'pass_type': pass_data.get('type', {}).get('name'),
                'pass_height': pass_data.get('height', {}).get('name'),
                'body_part': pass_data.get('body_part', {}).get('name'),
                'technique': pass_data.get('technique', {}).get('name'),
                'is_cross': bool(pass_data.get('cross', False)),
                'is_switch': bool(pass_data.get('switch', False)),
                'is_through_ball': bool(pass_data.get('through_ball', False)),
                'is_cut_back': bool(pass_data.get('cut_back', False)),
            }

        return transformed
    
    def parse_lineups(self, match_id: int) -> Dict[int, List[Dict]]:
        """
        Parse lineups for a specific match.

        Args:
            match_id: Match ID

        Returns:
            Dictionary mapping team_id to list of players
        """
        safe_match = self._sanitize_id(match_id)
        filepath = self._safe_path('lineups', f'{safe_match}.json')

        if not filepath.exists():
            return {}

        with open(filepath, 'r', encoding='utf-8') as f:
            lineups = json.load(f)
        
        result = {}
        for team_data in lineups:
            team_id = team_data['team_id']
            players = []

            # Build per-team player list
            for player in team_data.get('lineup', []):
                players.append({
                    'player_id': player['player_id'],
                    'player_name': player['player_name'],
                    'jersey_number': player['jersey_number'],
                    'team_id': team_id,
                    'position': self._get_position(player)
                })

            result[team_id] = players
        
        return result
    
    def _get_position(self, player: Dict) -> str:
        """Extract player's primary position from lineup data."""
        positions = player.get('positions', [])
        if positions:
            return positions[0].get('position', 'Unknown')
        return 'Unknown'
    
    def extract_passes(self, events: List[Dict]) -> List[Dict]:
        """
        Extract only pass events from event list.
        
        Args:
            events: List of all events
            
        Returns:
            List of pass events with flattened structure
        """
        passes = []
        
        for event in events:
            if event['event_type'] == 'Pass' and 'pass_data' in event:
                pass_data = event['pass_data']
                
                # Skip passes without recipient (unsuccessful/clearances)
                if not pass_data.get('recipient_id'):
                    continue
                
                passes.append({
                    'pass_id': event['event_id'],
                    'event_id': event['event_id'],
                    'match_id': event['match_id'],
                    'team_id': event['team_id'],
                    'passer_id': event['player_id'],
                    'passer_name': event['player_name'],
                    'recipient_id': pass_data['recipient_id'],
                    'recipient_name': pass_data['recipient_name'],
                    'period': event['period'],
                    'minute': event['minute'],
                    'second': event['second'],
                    'location_x': event['location_x'],
                    'location_y': event['location_y'],
                    'end_location_x': pass_data['end_location_x'],
                    'end_location_y': pass_data['end_location_y'],
                    'pass_length': pass_data['pass_length'],
                    'pass_angle': pass_data['pass_angle'],
                    'pass_outcome': pass_data['pass_outcome'],
                    'pass_type': pass_data['pass_type'],
                    'pass_height': pass_data['pass_height'],
                    'body_part': pass_data['body_part'],
                    'technique': pass_data['technique'],
                    'is_cross': pass_data['is_cross'],
                    'is_switch': pass_data['is_switch'],
                    'is_through_ball': pass_data['is_through_ball'],
                    'is_cut_back': pass_data['is_cut_back'],
                })

        return passes
