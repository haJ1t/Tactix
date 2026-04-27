"""
Train ML models using existing match data.
"""
import os
import sys
import pandas as pd

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import SessionLocal, init_db
from backend.models.pass_event import PassEvent
from backend.models.event import Event
from backend.models.player import Player
from backend.services.ml.vaep_model import VAEPModel
from backend.services.ml.pass_difficulty_model import PassDifficultyModel
from backend.services.ml.tactical_classifier import TacticalPatternClassifier


def get_pass_data_from_db():
    """Get all pass data from database."""
    db = SessionLocal()
    try:
        passes = db.query(PassEvent).join(Event).all()
        
        passes_data = []
        for p in passes:
            event = p.event
            passer = db.query(Player).filter(Player.player_id == p.passer_id).first()
            recipient = db.query(Player).filter(Player.player_id == p.recipient_id).first() if p.recipient_id else None
            
            passes_data.append({
                'pass_id': p.pass_id,
                'event_id': p.event_id,
                'passer_id': p.passer_id,
                'passer_name': passer.player_name if passer else f'Player {p.passer_id}',
                'recipient_id': p.recipient_id,
                'recipient_name': recipient.player_name if recipient else None,
                'location_x': event.location_x if event else 60,
                'location_y': event.location_y if event else 40,
                'end_location_x': p.end_location_x or 60,
                'end_location_y': p.end_location_y or 40,
                'pass_outcome': p.pass_outcome,
                'pass_length': p.pass_length,
                'pass_angle': p.pass_angle,
                'team_id': event.team_id if event else None,
                'minute': event.minute if event else 0,
                'period': event.period if event else 1,
                'event_type': 'Pass'
            })
        
        return pd.DataFrame(passes_data)
    finally:
        db.close()


def train_ml_models(passes_df: pd.DataFrame):
    """Train all ML models on the collected pass data."""
    
    print("\n" + "="*50)
    print("TRAINING ML MODELS")
    print("="*50)
    print(f"\nTotal passes: {len(passes_df)}")
    
    models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'models', 'trained')
    os.makedirs(models_dir, exist_ok=True)
    
    # Train pass difficulty model
    print("\n[1/3] Training Pass Difficulty Model (Random Forest)...")
    pass_model = PassDifficultyModel()
    pass_results = pass_model.train(passes_df)
    print(f"  ✓ Accuracy: {pass_results['accuracy']:.2%}")
    print(f"  ✓ Samples used: {pass_results['samples_used']}")
    pass_model.save_model(os.path.join(models_dir, 'pass_difficulty.joblib'))
    print("  ✓ Model saved!")

    # Train VAEP model
    print("\n[2/3] Training VAEP Model (Gradient Boosting)...")
    vaep_model = VAEPModel()
    vaep_results = vaep_model.train(passes_df)
    print(f"  ✓ Scoring Accuracy: {vaep_results['scoring_accuracy']:.2%}")
    print(f"  ✓ Conceding Accuracy: {vaep_results['conceding_accuracy']:.2%}")
    print(f"  ✓ Samples used: {vaep_results['samples_used']}")
    vaep_model.save_model(os.path.join(models_dir, 'vaep_model.joblib'))
    print("  ✓ Model saved!")

    # Initialize tactical classifier
    print("\n[3/3] Initializing Tactical Pattern Classifier...")
    pattern_classifier = TacticalPatternClassifier()
    pattern_classifier.save_model(os.path.join(models_dir, 'tactical_classifier.joblib'))
    print("  ✓ Classifier initialized!")
    
    print("\n" + "="*50)
    print("✅ ML TRAINING COMPLETE!")
    print("="*50)
    print(f"\nModels saved to: {models_dir}")
    
    return {
        'pass_difficulty': pass_results,
        'vaep': vaep_results
    }


if __name__ == '__main__':
    # Initialize database
    init_db()
    
    print("="*50)
    print("LOADING PASS DATA FROM DATABASE")
    print("="*50)
    
    passes_df = get_pass_data_from_db()
    print(f"\nLoaded {len(passes_df)} passes from database")
    
    if len(passes_df) > 50:
        train_ml_models(passes_df)
    else:
        print("\nNot enough pass data for training. Need at least 50 passes.")
