"""
Shot metrics and xG (heuristic) calculator.
"""
from typing import Dict
import math
import pandas as pd

GOAL_X = 120.0
GOAL_Y = 40.0
GOAL_WIDTH = 7.32

# Simple heuristic coefficients for location-only xG
INTERCEPT = -1.5
COEF_DISTANCE = -0.12
COEF_ANGLE = 1.8


def _angle_to_goal(distance: float) -> float:
    """Calculate shot angle to goal given distance."""
    return 2 * math.atan2(GOAL_WIDTH / 2, max(distance, 0.1))


def _xg_from_features(distance: float, angle: float) -> float:
    """Compute heuristic xG from distance + angle."""
    z = INTERCEPT + (COEF_DISTANCE * distance) + (COEF_ANGLE * angle)
    return 1 / (1 + math.exp(-z))


def calculate_shot_summary(shots_df: pd.DataFrame) -> Dict:
    """
    Calculate shot metrics and heuristic xG summary.

    Expected columns: location_x, location_y
    """
    if shots_df is None or shots_df.empty:
        return {
            'total_shots': 0,
            'xg_total': 0.0,
            'xg_per_shot': 0.0,
            'avg_shot_distance': 0.0,
            'avg_shot_angle': 0.0,
            'high_xg_shots': 0
        }

    valid = shots_df.dropna(subset=['location_x', 'location_y'])
    if valid.empty:
        return {
            'total_shots': 0,
            'xg_total': 0.0,
            'xg_per_shot': 0.0,
            'avg_shot_distance': 0.0,
            'avg_shot_angle': 0.0,
            'high_xg_shots': 0
        }

    distances = []
    angles = []
    xgs = []

    # Compute xG per shot
    for _, row in valid.iterrows():
        x = float(row['location_x'])
        y = float(row['location_y'])
        dx = GOAL_X - x
        dy = abs(GOAL_Y - y)
        distance = math.hypot(dx, dy)
        angle = _angle_to_goal(distance)
        xg = _xg_from_features(distance, angle)

        distances.append(distance)
        angles.append(angle)
        xgs.append(xg)

    total_shots = len(xgs)
    if total_shots == 0:
        return {
            'total_shots': 0,
            'xg_total': 0.0,
            'xg_per_shot': 0.0,
            'avg_shot_distance': 0.0,
            'avg_shot_angle': 0.0,
            'high_xg_shots': 0
        }

    # Aggregate totals
    xg_total = sum(xgs)
    high_xg_shots = sum(1 for value in xgs if value >= 0.2)

    return {
        'total_shots': total_shots,
        'xg_total': round(xg_total, 3),
        'xg_per_shot': round(xg_total / total_shots, 3),
        'avg_shot_distance': round(sum(distances) / total_shots, 2),
        'avg_shot_angle': round(sum(angles) / total_shots, 3),
        'high_xg_shots': high_xg_shots
    }
