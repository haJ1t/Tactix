"""
Data cleaning utilities

Validates and cleans match event data before analysis.
"""
import pandas as pd
from typing import List, Dict, Optional
import numpy as np


class DataCleaner:
    """Cleans and validates match event data."""
    
    # StatsBomb pitch dimensions (120 x 80 yards)
    PITCH_LENGTH = 120.0
    PITCH_WIDTH = 80.0
    
    def __init__(self):
        """Initialize data cleaner."""
        pass
    
    def clean_passes(self, passes: List[Dict]) -> pd.DataFrame:
        """
        Clean and validate pass data.
        
        Args:
            passes: List of pass dictionaries
            
        Returns:
            Cleaned DataFrame of passes
        """
        if not passes:
            return pd.DataFrame()
        
        df = pd.DataFrame(passes)
        
        # Remove passes without essential fields
        df = self._remove_incomplete_passes(df)
        
        # Validate coordinates
        df = self._validate_coordinates(df)
        
        # Remove self-passes
        df = self._remove_self_passes(df)
        
        # Calculate derived fields
        df = self._calculate_derived_fields(df)
        
        return df
    
    def _remove_incomplete_passes(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove passes with missing essential data."""
        required_fields = ['passer_id', 'recipient_id', 'location_x', 'location_y']
        
        for field in required_fields:
            if field in df.columns:
                df = df[df[field].notna()]
        
        return df
    
    def _validate_coordinates(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate and clip coordinates to pitch boundaries."""
        coord_fields = ['location_x', 'location_y', 'end_location_x', 'end_location_y']
        
        for field in coord_fields:
            if field in df.columns:
                if 'x' in field:
                    df[field] = df[field].clip(0, self.PITCH_LENGTH)
                else:
                    df[field] = df[field].clip(0, self.PITCH_WIDTH)
        
        return df
    
    def _remove_self_passes(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove passes where passer and recipient are the same."""
        return df[df['passer_id'] != df['recipient_id']]
    
    def _calculate_derived_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate additional useful fields."""
        # Calculate pass length if not present
        if 'pass_length' not in df.columns or df['pass_length'].isna().any():
            df['pass_length'] = np.sqrt(
                (df['end_location_x'] - df['location_x']) ** 2 +
                (df['end_location_y'] - df['location_y']) ** 2
            )
        
        # Categorize passes by zone
        df['start_zone'] = df.apply(
            lambda row: self._get_pitch_zone(row['location_x']), axis=1
        )
        df['end_zone'] = df.apply(
            lambda row: self._get_pitch_zone(row['end_location_x']), axis=1
        )
        
        # Categorize by pass direction
        df['is_forward'] = df['end_location_x'] > df['location_x']
        df['is_progressive'] = df.apply(self._is_progressive_pass, axis=1)
        
        return df
    
    def _get_pitch_zone(self, x: float) -> str:
        """
        Categorize pitch position by zone.
        
        Args:
            x: X coordinate (0-120)
            
        Returns:
            Zone name: 'defensive', 'middle', or 'attacking'
        """
        if x < 40:
            return 'defensive'
        elif x < 80:
            return 'middle'
        else:
            return 'attacking'
    
    def _is_progressive_pass(self, row: pd.Series) -> bool:
        """
        Determine if a pass is progressive (moves ball significantly toward goal).
        
        A pass is progressive if it:
        - Moves the ball at least 25% closer to the opponent's goal, OR
        - Enters the attacking third from outside it
        """
        start_x = row['location_x']
        end_x = row['end_location_x']
        
        # Goal is at x = 120
        start_dist_to_goal = 120 - start_x
        end_dist_to_goal = 120 - end_x
        
        # Check if pass moves ball 25% closer to goal
        if start_dist_to_goal > 0:
            progress = (start_dist_to_goal - end_dist_to_goal) / start_dist_to_goal
            if progress >= 0.25:
                return True
        
        # Check if pass enters attacking third from outside
        if start_x < 80 and end_x >= 80:
            return True
        
        return False
    
    def filter_by_time(
        self, 
        df: pd.DataFrame, 
        start_minute: int = 0, 
        end_minute: int = 90,
        period: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Filter passes by time interval.
        
        Args:
            df: Pass DataFrame
            start_minute: Start minute (inclusive)
            end_minute: End minute (exclusive)
            period: Optional period filter (1=first half, 2=second half)
            
        Returns:
            Filtered DataFrame
        """
        mask = (df['minute'] >= start_minute) & (df['minute'] < end_minute)
        
        if period is not None:
            mask = mask & (df['period'] == period)
        
        return df[mask]
    
    def filter_by_zone(
        self, 
        df: pd.DataFrame, 
        zone: str,
        zone_type: str = 'start'
    ) -> pd.DataFrame:
        """
        Filter passes by pitch zone.
        
        Args:
            df: Pass DataFrame
            zone: Zone name ('defensive', 'middle', 'attacking')
            zone_type: 'start' or 'end' zone
            
        Returns:
            Filtered DataFrame
        """
        zone_field = f'{zone_type}_zone'
        return df[df[zone_field] == zone]
    
    def filter_by_team(self, df: pd.DataFrame, team_id: int) -> pd.DataFrame:
        """Filter passes by team."""
        return df[df['team_id'] == team_id]
    
    def get_successful_passes(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter to only successful/complete passes."""
        return df[df['pass_outcome'] == 'Complete']
