"""
Shared contextual feature builders for enriched ML training and runtime inference.
"""

from __future__ import annotations

import re
from typing import Dict

import numpy as np
import pandas as pd


PASS_NUMERIC_COLS = [
    'distance',
    'forward_distance',
    'lateral_distance',
    'start_third',
    'end_third',
    'is_progressive',
    'into_box',
    'angle',
    'start_dist_goal',
    'end_dist_goal',
    'goal_progress',
    'is_short',
    'is_medium',
    'is_long',
    'minute',
    'period',
    'normalized_time',
    'possession_pass_index',
    'possession_length',
    'time_since_prev',
    'recent_success_rate',
    'recent_forward_ratio',
    'zone_transition',
    'final_third_entry',
    'set_piece_pass',
    'under_pressure',
    'score_diff',
    'final_goal_diff',
    'team_strength',
]


PASS_CAT_COLS = [
    'pass_type',
    'pass_height',
    'body_part',
    'technique',
    'play_pattern',
    'player_role',
    'pass_bucket',
]


def _safe_series(df: pd.DataFrame, column: str, default):
    if column in df.columns:
        return df[column]
    return pd.Series([default] * len(df), index=df.index)


def _safe_text(df: pd.DataFrame, column: str, default: str = 'Unknown') -> pd.Series:
    return _safe_series(df, column, default).fillna(default).astype(str)


def _safe_numeric(df: pd.DataFrame, column: str, default: float = 0.0) -> pd.Series:
    return pd.to_numeric(_safe_series(df, column, default), errors='coerce').fillna(default)


def _safe_bool(df: pd.DataFrame, column: str) -> pd.Series:
    return _safe_numeric(df, column, 0).astype(int)


def _bucket_pitch(values: pd.Series) -> pd.Series:
    return pd.cut(values, bins=[-1, 40, 80, 121], labels=[0, 1, 2]).astype(float).fillna(1)


def categorize_player_role(position_name: str) -> str:
    text = (position_name or '').lower()
    if 'keeper' in text:
        return 'GK'
    if any(token in text for token in ['center back', 'centre back', 'sweeper']):
        return 'CB'
    if any(token in text for token in ['left back', 'right back', 'wing back', 'fullback']):
        return 'FB'
    if any(token in text for token in ['defensive midfield', 'central midfield', 'midfield']):
        return 'CM'
    if any(token in text for token in ['attacking midfield', 'second striker', 'number 10']):
        return 'AM'
    if any(token in text for token in ['left wing', 'right wing', 'winger']):
        return 'WING'
    if any(token in text for token in ['forward', 'striker']):
        return 'ST'
    return 'OTHER'


def assign_pass_bucket(passes_df: pd.DataFrame) -> pd.Series:
    pass_types = _safe_text(passes_df, 'pass_type', '')
    play_patterns = _safe_text(passes_df, 'play_pattern', '')
    technique = _safe_text(passes_df, 'technique', '')
    is_cross = _safe_bool(passes_df, 'is_cross').astype(bool)
    is_through = _safe_bool(passes_df, 'is_through_ball').astype(bool)
    distance = _safe_numeric(passes_df, 'pass_length', 0)

    set_piece_mask = (
        pass_types.str.contains('corner|free kick|goal kick|kick off|throw', case=False, na=False)
        | play_patterns.str.contains('from throw|free kick|corner|kick off', case=False, na=False)
        | technique.str.contains('set piece', case=False, na=False)
    )

    bucket = pd.Series('MEDIUM', index=passes_df.index)
    bucket[distance < 10] = 'SHORT'
    bucket[distance >= 25] = 'LONG'
    bucket[is_cross | pass_types.str.contains('cross', case=False, na=False)] = 'CROSS'
    bucket[is_through | pass_types.str.contains('through', case=False, na=False)] = 'THROUGH_BALL'
    bucket[set_piece_mask] = 'SET_PIECE'
    return bucket


def build_pass_feature_frame(passes_df: pd.DataFrame) -> pd.DataFrame:
    df = passes_df.copy()
    if df.empty:
        return pd.DataFrame(columns=PASS_NUMERIC_COLS + PASS_CAT_COLS)

    minute = _safe_numeric(df, 'minute', 45)
    second = _safe_numeric(df, 'second', 0)
    period = _safe_numeric(df, 'period', 1)
    start_x = _safe_numeric(df, 'location_x', 60)
    start_y = _safe_numeric(df, 'location_y', 40)
    end_x = _safe_numeric(df, 'end_location_x', 60)
    end_y = _safe_numeric(df, 'end_location_y', 40)
    position_name = _safe_text(df, 'position_name', 'Unknown')

    features = pd.DataFrame(index=df.index)
    features['distance'] = np.sqrt((end_x - start_x) ** 2 + (end_y - start_y) ** 2)
    features['forward_distance'] = end_x - start_x
    features['lateral_distance'] = np.abs(end_y - start_y)
    features['start_third'] = _bucket_pitch(start_x)
    features['end_third'] = _bucket_pitch(end_x)
    features['is_progressive'] = (features['forward_distance'] > 10).astype(int)
    features['into_box'] = ((end_x > 102) & (end_y > 18) & (end_y < 62)).astype(int)
    features['angle'] = np.arctan2(end_y - start_y, end_x - start_x)
    features['start_dist_goal'] = np.sqrt((120 - start_x) ** 2 + (40 - start_y) ** 2)
    features['end_dist_goal'] = np.sqrt((120 - end_x) ** 2 + (40 - end_y) ** 2)
    features['goal_progress'] = features['start_dist_goal'] - features['end_dist_goal']
    features['is_short'] = (features['distance'] < 10).astype(int)
    features['is_medium'] = ((features['distance'] >= 10) & (features['distance'] < 25)).astype(int)
    features['is_long'] = (features['distance'] >= 25).astype(int)
    features['minute'] = minute
    features['period'] = period
    features['normalized_time'] = ((period - 1) * 45 + minute) / 120
    features['under_pressure'] = _safe_bool(df, 'under_pressure')
    features['score_diff'] = _safe_numeric(df, 'score_diff', 0)
    features['final_goal_diff'] = _safe_numeric(df, 'final_goal_diff', 0)
    features['team_strength'] = _safe_numeric(df, 'team_strength', 0)

    sort_cols = []
    if 'match_id' in df.columns:
        sort_cols.append('match_id')
    if 'possession_id' in df.columns:
        sort_cols.append('possession_id')
    if 'event_index' in df.columns:
        sort_cols.append('event_index')
    else:
        sort_cols.extend(['minute', 'second'])

    ordered = df.assign(_row_id=df.index, _abs_seconds=(period - 1) * 2700 + minute * 60 + second)
    ordered = ordered.sort_values(sort_cols if sort_cols else ['_row_id'])
    success = (
        _safe_text(ordered, 'pass_outcome', 'Complete').isin(['Complete', 'Success', 'Successful', 'nan'])
        | ordered['pass_outcome'].isna()
    ).astype(float) if 'pass_outcome' in ordered.columns else pd.Series(1.0, index=ordered.index)
    forward = (_safe_numeric(ordered, 'end_location_x', 60) - _safe_numeric(ordered, 'location_x', 60) > 0).astype(float)

    group_cols = [col for col in ['match_id', 'team_id'] if col in ordered.columns]
    if 'possession_id' in ordered.columns:
        group_cols.append('possession_id')
    if not group_cols:
        ordered['_sequence_group'] = 0
        group_cols = ['_sequence_group']

    ordered['possession_pass_index'] = ordered.groupby(group_cols).cumcount() + 1
    ordered['possession_length'] = ordered.groupby(group_cols)['event_id'].transform('count') if 'event_id' in ordered.columns else ordered.groupby(group_cols)['_row_id'].transform('count')
    ordered['time_since_prev'] = ordered.groupby(group_cols)['_abs_seconds'].diff().fillna(0).clip(lower=0)
    ordered['recent_success_rate'] = success.groupby([ordered[col] for col in group_cols]).transform(lambda s: s.rolling(5, min_periods=1).mean())
    ordered['recent_forward_ratio'] = forward.groupby([ordered[col] for col in group_cols]).transform(lambda s: s.rolling(5, min_periods=1).mean())

    pass_bucket = assign_pass_bucket(df)
    features['pass_bucket'] = pass_bucket
    features['possession_pass_index'] = ordered.set_index('_row_id')['possession_pass_index'].reindex(df.index).fillna(1)
    features['possession_length'] = ordered.set_index('_row_id')['possession_length'].reindex(df.index).fillna(1)
    features['time_since_prev'] = ordered.set_index('_row_id')['time_since_prev'].reindex(df.index).fillna(0)
    features['recent_success_rate'] = ordered.set_index('_row_id')['recent_success_rate'].reindex(df.index).fillna(1)
    features['recent_forward_ratio'] = ordered.set_index('_row_id')['recent_forward_ratio'].reindex(df.index).fillna(0.5)
    features['zone_transition'] = features['start_third'] * 3 + features['end_third']
    features['final_third_entry'] = ((start_x < 80) & (end_x >= 80)).astype(int)
    features['set_piece_pass'] = (pass_bucket == 'SET_PIECE').astype(int)

    features['pass_type'] = _safe_text(df, 'pass_type')
    features['pass_height'] = _safe_text(df, 'pass_height')
    features['body_part'] = _safe_text(df, 'body_part')
    features['technique'] = _safe_text(df, 'technique')
    features['play_pattern'] = _safe_text(df, 'play_pattern')
    features['player_role'] = position_name.map(categorize_player_role)

    for col in PASS_NUMERIC_COLS:
        features[col] = pd.to_numeric(features.get(col, 0), errors='coerce').fillna(0)
    for col in PASS_CAT_COLS:
        features[col] = features.get(col, 'Unknown').fillna('Unknown').astype(str)

    return features[PASS_NUMERIC_COLS + PASS_CAT_COLS]


def extract_tactical_context_features(passes_df: pd.DataFrame) -> Dict[str, float]:
    df = passes_df.copy()
    if df.empty:
        return {
            'avg_possession_length': 0.0,
            'avg_tempo_seconds': 0.0,
            'under_pressure_ratio': 0.0,
            'cross_ratio': 0.0,
            'through_ball_ratio': 0.0,
            'switch_ratio': 0.0,
            'high_pass_ratio': 0.0,
            'ground_pass_ratio': 0.0,
            'progressive_pass_ratio': 0.0,
            'final_third_entry_ratio': 0.0,
            'left_usage_ratio': 0.0,
            'right_usage_ratio': 0.0,
            'center_usage_ratio': 0.0,
            'avg_score_diff': 0.0,
            'final_goal_diff': 0.0,
            'competition_world_cup': 0.0,
            'competition_domestic_league': 0.0,
            'season_end_year': 0.0,
            'set_piece_ratio': 0.0,
            'open_play_ratio': 0.0,
        }

    features = build_pass_feature_frame(df)
    total = max(len(features), 1)
    competition = _safe_text(df, 'competition', '')
    season_text = _safe_text(df, 'season', '')

    season_end_year = season_text.str.extract(r'(\d{4})').astype(float).fillna(0)
    if season_end_year.shape[1] == 0:
        season_value = 0.0
    else:
        season_value = float(season_end_year.iloc[:, -1].mean())

    left_usage = (_safe_numeric(df, 'location_y', 40) < 28).mean()
    right_usage = (_safe_numeric(df, 'location_y', 40) > 52).mean()
    center_usage = 1 - left_usage - right_usage

    play_pattern = _safe_text(df, 'play_pattern', '')
    possession_group_cols = [col for col in ['match_id', 'team_id'] if col in df.columns]
    if 'possession_id' in df.columns:
        possession_group_cols.append('possession_id')
    if not possession_group_cols:
        df = df.copy()
        df['_sequence_group'] = 0
        possession_group_cols = ['_sequence_group']

    possession_lengths = df.groupby(possession_group_cols).size()
    abs_seconds = ((_safe_numeric(df, 'period', 1) - 1) * 2700) + (_safe_numeric(df, 'minute', 0) * 60) + _safe_numeric(df, 'second', 0)
    sort_cols = [col for col in ['match_id', 'team_id'] if col in df.columns]
    sort_cols.append('possession_id' if 'possession_id' in df.columns else 'minute')
    sort_cols.append('event_index' if 'event_index' in df.columns else 'second')
    ordered = df.assign(_abs_seconds=abs_seconds).sort_values(sort_cols)
    tempo_series = ordered.groupby(possession_group_cols)['_abs_seconds'].diff().fillna(0).clip(lower=0)

    set_piece_ratio = max(
        float((features['pass_bucket'] == 'SET_PIECE').mean()),
        float(play_pattern.str.contains('from ', case=False, na=False).mean()),
    )

    return {
        'avg_possession_length': float(possession_lengths.mean()) if not possession_lengths.empty else 0.0,
        'avg_tempo_seconds': float(tempo_series.mean()) if not tempo_series.empty else 0.0,
        'under_pressure_ratio': float(features['under_pressure'].mean()),
        'cross_ratio': float((features['pass_bucket'] == 'CROSS').mean()),
        'through_ball_ratio': float((features['pass_bucket'] == 'THROUGH_BALL').mean()),
        'switch_ratio': float(_safe_bool(df, 'is_switch').mean()),
        'high_pass_ratio': float((_safe_text(df, 'pass_height', '').str.contains('high', case=False, na=False)).mean()),
        'ground_pass_ratio': float((_safe_text(df, 'pass_height', '').str.contains('ground', case=False, na=False)).mean()),
        'progressive_pass_ratio': float(features['is_progressive'].mean()),
        'final_third_entry_ratio': float(features['final_third_entry'].mean()),
        'left_usage_ratio': float(left_usage),
        'right_usage_ratio': float(right_usage),
        'center_usage_ratio': float(center_usage),
        'avg_score_diff': float(features['score_diff'].mean()),
        'final_goal_diff': float(features['final_goal_diff'].mean()),
        'competition_world_cup': float(competition.str.contains('world cup', case=False, na=False).mean()),
        'competition_domestic_league': float(competition.str.contains('league', case=False, na=False).mean()),
        'season_end_year': season_value,
        'set_piece_ratio': set_piece_ratio,
        'open_play_ratio': float((~play_pattern.str.contains('from ', case=False, na=False)).mean()),
    }
