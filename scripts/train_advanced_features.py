"""
Advanced Feature Engineering for ML Models.

Adds:
- Game state features (score, minute, period)
- Pressure index (nearby opponents - simulated)
- xG chain contribution (goal proximity)
- Sequence features (previous passes context)
"""
import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
from sklearn.metrics import accuracy_score, f1_score
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import lightgbm as lgb
import joblib
import warnings
warnings.filterwarnings('ignore')

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal, init_db
from backend.models.event import Event
from backend.models.match import Match
from backend.models.pass_event import PassEvent
from backend.services.network_builder import NetworkBuilder
from backend.services.ml.tactical_classifier import TacticalPatternClassifier
from backend.services.ml.holdout_utils import split_holdout


def get_all_passes_from_db():
    """Get all pass data from database with enhanced fields."""
    print("Loading all passes from database...")
    db = SessionLocal()
    try:
        passes = db.query(PassEvent).join(Event).join(Match, Event.match_id == Match.match_id).all()
        
        passes_data = []
        for p in passes:
            event = p.event
            if event is None:
                continue
                
            match = event.match
            passes_data.append({
                'match_id': event.match_id,
                'event_id': p.event_id,
                'passer_id': p.passer_id,
                'recipient_id': p.recipient_id,
                'team_id': event.team_id,
                'location_x': event.location_x or 60,
                'location_y': event.location_y or 40,
                'end_location_x': p.end_location_x or 60,
                'end_location_y': p.end_location_y or 40,
                'pass_length': p.pass_length,
                'pass_angle': p.pass_angle,
                'pass_outcome': p.pass_outcome,
                'pass_type': p.pass_type,
                'pass_height': p.pass_height,
                'body_part': p.body_part,
                'competition': match.competition if match else None,
                'season': match.season if match else None,
                'minute': event.minute,
                'second': event.second,
                'period': event.period,
            })
        
        print(f"  Loaded {len(passes_data):,} passes")
        return pd.DataFrame(passes_data)
    finally:
        db.close()


def add_game_state_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add game state features: minute, period, game phase."""
    print("  Adding game state features...")
    
    # Time features
    df['total_seconds'] = df['minute'] * 60 + df['second'].fillna(0)
    df['normalized_minute'] = df['minute'] / 90  # 0-1 scale
    
    # Period features
    df['is_first_half'] = (df['period'] == 1).astype(int)
    df['is_second_half'] = (df['period'] == 2).astype(int)
    df['is_extra_time'] = (df['period'] > 2).astype(int)
    
    # Game phase (early, mid, late)
    df['game_phase_early'] = (df['minute'] < 30).astype(int)
    df['game_phase_mid'] = ((df['minute'] >= 30) & (df['minute'] < 60)).astype(int)
    df['game_phase_late'] = (df['minute'] >= 60).astype(int)
    
    # Critical moments (first 5 min, last 10 min)
    df['is_opening_minutes'] = (df['minute'] < 5).astype(int)
    df['is_closing_minutes'] = (df['minute'] >= 80).astype(int)
    
    return df


def add_pressure_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add pressure index features (simulated based on pitch position)."""
    print("  Adding pressure index features...")
    
    # Pressure is higher in dangerous areas
    # Simulate pressure based on location
    
    # Distance to opponent goal (0 at goal, 120 at own goal)
    df['distance_to_goal'] = 120 - df['location_x']
    df['end_distance_to_goal'] = 120 - df['end_location_x']
    
    # Pressure zones (higher pressure near goals)
    df['in_defensive_third'] = (df['location_x'] < 40).astype(int)
    df['in_middle_third'] = ((df['location_x'] >= 40) & (df['location_x'] < 80)).astype(int)
    df['in_attacking_third'] = (df['location_x'] >= 80).astype(int)
    
    # Simulated pressure index (0-1, higher in attacking positions)
    df['pressure_index'] = 1 - (df['distance_to_goal'] / 120)
    
    # Width pressure (edges vs center)
    df['distance_from_center'] = np.abs(df['location_y'] - 40)
    df['is_wide_position'] = (df['distance_from_center'] > 25).astype(int)
    df['is_central_position'] = (df['distance_from_center'] < 15).astype(int)
    
    # Box entry (18-yard box approximation)
    df['in_box'] = ((df['location_x'] > 102) & (np.abs(df['location_y'] - 40) < 22)).astype(int)
    df['pass_into_box'] = ((df['end_location_x'] > 102) & (np.abs(df['end_location_y'] - 40) < 22)).astype(int)
    
    return df


def add_xg_chain_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add xG chain approximation features (goal proximity contribution)."""
    print("  Adding xG chain features...")
    
    # xG proxy based on end location (simplified xG model)
    # Higher for passes closer to goal center
    goal_x, goal_y = 120, 40
    
    df['end_dist_to_goal_center'] = np.sqrt(
        (goal_x - df['end_location_x'])**2 + 
        (goal_y - df['end_location_y'])**2
    )
    
    # Angle to goal
    df['angle_to_goal'] = np.abs(np.arctan2(
        goal_y - df['end_location_y'],
        goal_x - df['end_location_x']
    ))
    
    # xG contribution proxy (0-1, higher closer to goal with good angle)
    df['xg_contribution'] = np.clip(
        (1 - df['end_dist_to_goal_center'] / 120) * 
        np.cos(df['angle_to_goal']),
        0, 1
    )
    
    # Progressive pass (moves ball significantly toward goal)
    df['progressive_distance'] = df['location_x'] - df['end_location_x']
    df['is_progressive'] = (
        (df['end_location_x'] - df['location_x'] > 10) |  # 10+ yards forward
        ((df['location_x'] < 80) & (df['end_location_x'] >= 80))  # Into final third
    ).astype(int)
    
    # Chance creation zone
    df['chance_creation_zone'] = (
        (df['end_location_x'] > 90) & 
        (df['end_location_y'] > 20) & 
        (df['end_location_y'] < 60)
    ).astype(int)
    
    return df


def add_sequence_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add sequence features from previous passes."""
    print("  Adding sequence features (previous passes context)...")
    
    # Sort by match, team, and time
    df = df.sort_values(['match_id', 'team_id', 'minute', 'second']).reset_index(drop=True)
    
    # Previous pass features (lag features)
    for lag in [1, 2, 3]:
        # Previous location
        df[f'prev_{lag}_location_x'] = df.groupby(['match_id', 'team_id'])['location_x'].shift(lag)
        df[f'prev_{lag}_location_y'] = df.groupby(['match_id', 'team_id'])['location_y'].shift(lag)
        
        # Previous pass length
        df[f'prev_{lag}_pass_length'] = df.groupby(['match_id', 'team_id'])['pass_length'].shift(lag)
        
        # Previous outcome (was it successful?)
        prev_outcome = df.groupby(['match_id', 'team_id'])['pass_outcome'].shift(lag)
        df[f'prev_{lag}_successful'] = (prev_outcome.isna() | (prev_outcome == 'Complete')).astype(float)
    
    # Fill NaN with defaults
    for lag in [1, 2, 3]:
        df[f'prev_{lag}_location_x'] = df[f'prev_{lag}_location_x'].fillna(60)
        df[f'prev_{lag}_location_y'] = df[f'prev_{lag}_location_y'].fillna(40)
        df[f'prev_{lag}_pass_length'] = df[f'prev_{lag}_pass_length'].fillna(15)
        df[f'prev_{lag}_successful'] = df[f'prev_{lag}_successful'].fillna(0.5)
    
    # Sequence patterns
    # Distance from previous pass end to current pass start
    df['sequence_continuity'] = np.sqrt(
        (df['location_x'] - df['prev_1_location_x'])**2 +
        (df['location_y'] - df['prev_1_location_y'])**2
    )
    
    # Pass tempo (quick vs slow build-up) - based on distance from previous location
    df['pass_tempo'] = 1 / (df['sequence_continuity'] + 1)  # Higher = quicker passing
    
    # Momentum (consecutive successful passes)
    df['recent_success_rate'] = (
        df['prev_1_successful'] + 
        df['prev_2_successful'] + 
        df['prev_3_successful']
    ) / 3
    
    # Direction change from previous sequence
    df['prev_dx'] = df['prev_1_location_x'] - df.groupby(['match_id', 'team_id'])['location_x'].shift(2).fillna(60)
    df['curr_dx'] = df['end_location_x'] - df['location_x']
    df['direction_change'] = (
        (df['prev_dx'] > 0) != (df['curr_dx'] > 0)
    ).astype(int)
    
    return df


def add_pass_characteristics(df: pd.DataFrame) -> pd.DataFrame:
    """Add enhanced pass characteristic features."""
    print("  Adding enhanced pass characteristics...")
    
    # Pass length categories
    df['pass_length'] = df['pass_length'].fillna(
        np.sqrt((df['end_location_x'] - df['location_x'])**2 + 
                (df['end_location_y'] - df['location_y'])**2)
    )
    
    df['is_short_pass'] = (df['pass_length'] < 10).astype(int)
    df['is_medium_pass'] = ((df['pass_length'] >= 10) & (df['pass_length'] < 25)).astype(int)
    df['is_long_pass'] = (df['pass_length'] >= 25).astype(int)
    
    # Direction
    df['dx'] = df['end_location_x'] - df['location_x']
    df['dy'] = df['end_location_y'] - df['location_y']
    
    df['is_forward'] = (df['dx'] > 5).astype(int)
    df['is_backward'] = (df['dx'] < -5).astype(int)
    df['is_lateral'] = (np.abs(df['dx']) <= 5).astype(int)
    
    # Pass angle categories
    df['pass_angle'] = df['pass_angle'].fillna(
        np.arctan2(df['dy'], df['dx'])
    )
    
    df['is_diagonal'] = (
        (np.abs(df['pass_angle']) > 0.3) & 
        (np.abs(df['pass_angle']) < 1.2)
    ).astype(int)
    
    # Switch play (cross-field pass)
    df['is_switch_play'] = (np.abs(df['dy']) > 30).astype(int)
    
    return df


def train_with_advanced_features(passes_df: pd.DataFrame, holdout_df: pd.DataFrame = None) -> dict:
    """Train model with all advanced features."""
    print("\n" + "="*60)
    print("TRAINING WITH ADVANCED FEATURES")
    print("="*60)
    
    # Apply all feature engineering
    df = passes_df.copy()
    df = add_game_state_features(df)
    df = add_pressure_features(df)
    df = add_xg_chain_features(df)
    df = add_sequence_features(df)
    df = add_pass_characteristics(df)
    
    df_hold = None
    if holdout_df is not None and not holdout_df.empty:
        df_hold = holdout_df.copy()
        df_hold = add_game_state_features(df_hold)
        df_hold = add_pressure_features(df_hold)
        df_hold = add_xg_chain_features(df_hold)
        df_hold = add_sequence_features(df_hold)
        df_hold = add_pass_characteristics(df_hold)
    
    # Define feature columns
    basic_features = ['location_x', 'location_y', 'end_location_x', 'end_location_y', 'pass_length']
    
    game_state_features = [
        'normalized_minute', 'is_first_half', 'is_second_half', 
        'game_phase_early', 'game_phase_mid', 'game_phase_late',
        'is_opening_minutes', 'is_closing_minutes'
    ]
    
    pressure_features = [
        'distance_to_goal', 'end_distance_to_goal', 'pressure_index',
        'in_defensive_third', 'in_middle_third', 'in_attacking_third',
        'distance_from_center', 'is_wide_position', 'is_central_position',
        'in_box', 'pass_into_box'
    ]
    
    xg_features = [
        'end_dist_to_goal_center', 'angle_to_goal', 'xg_contribution',
        'is_progressive', 'chance_creation_zone'
    ]
    
    sequence_features = [
        'prev_1_location_x', 'prev_1_location_y', 'prev_1_pass_length', 'prev_1_successful',
        'prev_2_location_x', 'prev_2_location_y', 'prev_2_pass_length', 'prev_2_successful',
        'prev_3_location_x', 'prev_3_location_y', 'prev_3_pass_length', 'prev_3_successful',
        'sequence_continuity', 'pass_tempo', 'recent_success_rate', 'direction_change'
    ]
    
    pass_char_features = [
        'dx', 'dy', 'is_forward', 'is_backward', 'is_lateral',
        'is_short_pass', 'is_medium_pass', 'is_long_pass',
        'is_diagonal', 'is_switch_play'
    ]
    
    cat_cols = ['pass_type', 'pass_height', 'body_part']
    
    all_features = (basic_features + game_state_features + pressure_features + 
                    xg_features + sequence_features + pass_char_features)
    
    print(f"\n  Total features: {len(all_features)}")
    print(f"    - Basic: {len(basic_features)}")
    print(f"    - Game State: {len(game_state_features)}")
    print(f"    - Pressure: {len(pressure_features)}")
    print(f"    - xG Chain: {len(xg_features)}")
    print(f"    - Sequence: {len(sequence_features)}")
    print(f"    - Pass Characteristics: {len(pass_char_features)}")
    print(f"    - Categorical: {len(cat_cols)}")
    
    # Filter to valid data
    df = df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y'])
    if df_hold is not None:
        df_hold = df_hold.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y'])
    
    # Sample for speed
    if len(df) > 100000:
        sample_idx = np.random.choice(len(df), 100000, replace=False)
        df = df.iloc[sample_idx].copy()
    
    y = (df['pass_outcome'].isna() | (df['pass_outcome'] == 'Complete')).astype(int).values
    groups = df['match_id'].values
    
    print(f"\n  Samples: {len(df):,}")
    
    def make_pipeline(model):
        preprocessor = ColumnTransformer(
            [('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cat_cols)],
            remainder='passthrough'
        )
        return Pipeline([('preprocess', preprocessor), ('model', model)])
    
    # Train with and without advanced features
    model_basic = make_pipeline(lgb.LGBMClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1))
    model_advanced = make_pipeline(lgb.LGBMClassifier(n_estimators=200, max_depth=8, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1))
    
    gkf = GroupKFold(n_splits=5)
    
    def build_feature_df(feature_list):
        X_df = df[feature_list + cat_cols].copy()
        X_df[cat_cols] = X_df[cat_cols].fillna('Unknown')
        return X_df
    
    # Basic features only
    X_basic = build_feature_df(basic_features + ['dx', 'dy', 'is_forward', 'is_long_pass'])
    
    print("\n  Comparing feature sets:")
    print(f"  {'Feature Set':<25} {'Accuracy':<12} {'F1 Score':<12}")
    print(f"  {'-'*49}")
    
    # Basic
    acc_basic = cross_val_score(model_basic, X_basic, y, cv=gkf, groups=groups, scoring='accuracy').mean()
    f1_basic = cross_val_score(model_basic, X_basic, y, cv=gkf, groups=groups, scoring='f1').mean()
    print(f"  {'Basic (10 features)':<25} {acc_basic:>10.2%}   {f1_basic:>10.2%}")
    
    # With Game State
    X_game = build_feature_df(basic_features + game_state_features + ['dx', 'dy', 'is_forward'])
    acc_game = cross_val_score(model_advanced, X_game, y, cv=gkf, groups=groups, scoring='accuracy').mean()
    f1_game = cross_val_score(model_advanced, X_game, y, cv=gkf, groups=groups, scoring='f1').mean()
    print(f"  {'+ Game State':<25} {acc_game:>10.2%}   {f1_game:>10.2%}")
    
    # With Pressure
    X_pressure = build_feature_df(basic_features + game_state_features + pressure_features + ['dx', 'dy'])
    acc_pressure = cross_val_score(model_advanced, X_pressure, y, cv=gkf, groups=groups, scoring='accuracy').mean()
    f1_pressure = cross_val_score(model_advanced, X_pressure, y, cv=gkf, groups=groups, scoring='f1').mean()
    print(f"  {'+ Pressure Index':<25} {acc_pressure:>10.2%}   {f1_pressure:>10.2%}")
    
    # With xG Chain
    X_xg = build_feature_df(basic_features + game_state_features + pressure_features + xg_features)
    acc_xg = cross_val_score(model_advanced, X_xg, y, cv=gkf, groups=groups, scoring='accuracy').mean()
    f1_xg = cross_val_score(model_advanced, X_xg, y, cv=gkf, groups=groups, scoring='f1').mean()
    print(f"  {'+ xG Chain':<25} {acc_xg:>10.2%}   {f1_xg:>10.2%}")
    
    # Full (all features)
    X_full = build_feature_df(all_features)
    acc_full = cross_val_score(model_advanced, X_full, y, cv=gkf, groups=groups, scoring='accuracy').mean()
    f1_full = cross_val_score(model_advanced, X_full, y, cv=gkf, groups=groups, scoring='f1').mean()
    print(f"  {'+ Sequence (ALL)':<25} {acc_full:>10.2%}   {f1_full:>10.2%}")
    
    # Improvement
    print(f"\n  ✅ Improvement: {(acc_full - acc_basic)*100:.2f}% accuracy, {(f1_full - f1_basic)*100:.2f}% F1")
    
    # Feature importance
    model_advanced.fit(X_full, y)
    clf = model_advanced.named_steps['model']
    pre = model_advanced.named_steps['preprocess']
    feature_names = pre.get_feature_names_out()
    importance = pd.DataFrame({
        'feature': feature_names,
        'importance': clf.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\n  Top 15 Most Important Features:")
    for i, row in importance.head(15).iterrows():
        bar = '█' * int(row['importance'] * 50)
        print(f"    {row['feature']:<25} {row['importance']:.3f} {bar}")
    
    # Holdout evaluation
    holdout_metrics = None
    if df_hold is not None and not df_hold.empty:
        X_hold = df_hold[all_features + cat_cols].copy()
        X_hold[cat_cols] = X_hold[cat_cols].fillna('Unknown')
        y_hold = (df_hold['pass_outcome'].isna() | (df_hold['pass_outcome'] == 'Complete')).astype(int).values
        
        y_pred = model_advanced.predict(X_hold)
        holdout_metrics = {
            'accuracy': accuracy_score(y_hold, y_pred),
            'f1': f1_score(y_hold, y_pred)
        }
        
        print("\n  Holdout Performance (Fixed Split):")
        print(f"    Accuracy: {holdout_metrics['accuracy']:.2%}")
        print(f"    F1 Score: {holdout_metrics['f1']:.2%}")
    
    # Save model
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    
    model_data = {
        'model': model_advanced,
        'feature_cols': all_features,
        'cat_cols': cat_cols,
        'accuracy': acc_full,
        'f1': f1_full,
        'improvement': {
            'accuracy': acc_full - acc_basic,
            'f1': f1_full - f1_basic
        }
    }
    joblib.dump(model_data, os.path.join(models_dir, 'pass_difficulty_advanced.joblib'))
    print(f"\n  Model saved to {models_dir}/pass_difficulty_advanced.joblib")
    
    return {
        'basic': {'accuracy': acc_basic, 'f1': f1_basic},
        'game_state': {'accuracy': acc_game, 'f1': f1_game},
        'pressure': {'accuracy': acc_pressure, 'f1': f1_pressure},
        'xg': {'accuracy': acc_xg, 'f1': f1_xg},
        'full': {'accuracy': acc_full, 'f1': f1_full},
        'top_features': importance.head(15).to_dict('records'),
        'holdout': holdout_metrics
    }


def main():
    """Main feature engineering training."""
    print("="*60)
    print("ADVANCED FEATURE ENGINEERING")
    print("Game State + Pressure + xG Chain + Sequence Features")
    print("="*60)
    
    init_db()
    passes_df = get_all_passes_from_db()
    
    if len(passes_df) < 1000:
        print("ERROR: Not enough data!")
        return
    
    train_df, holdout_df, holdout_info = split_holdout(passes_df)
    if holdout_info.get("enabled"):
        print("\n  Holdout Split:")
        print(f"    Rule: competition contains '{holdout_info['competition_contains']}', season contains '{holdout_info['season_contains']}'")
        print(f"    Holdout passes: {holdout_info['holdout_size']:,} from {holdout_info['holdout_matches']} matches")
        print(f"    Train passes: {holdout_info['train_size']:,}")
    
    results = train_with_advanced_features(train_df, holdout_df)
    
    # Summary
    print("\n" + "="*60)
    print("✅ ADVANCED FEATURE ENGINEERING COMPLETE!")
    print("="*60)
    
    print("\n  Feature Set Impact on Performance:")
    print(f"    Basic:           {results['basic']['accuracy']:.2%} accuracy, {results['basic']['f1']:.2%} F1")
    print(f"    + Game State:    {results['game_state']['accuracy']:.2%} accuracy, {results['game_state']['f1']:.2%} F1")
    print(f"    + Pressure:      {results['pressure']['accuracy']:.2%} accuracy, {results['pressure']['f1']:.2%} F1")
    print(f"    + xG Chain:      {results['xg']['accuracy']:.2%} accuracy, {results['xg']['f1']:.2%} F1")
    print(f"    + Sequence (ALL):{results['full']['accuracy']:.2%} accuracy, {results['full']['f1']:.2%} F1")
    
    print(f"\n  Total Improvement: +{(results['full']['accuracy'] - results['basic']['accuracy'])*100:.2f}% accuracy")


if __name__ == '__main__':
    main()
