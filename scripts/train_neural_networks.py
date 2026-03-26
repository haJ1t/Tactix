"""
Neural Network Models for Pass Analysis.

Includes:
- LSTM for pass sequence prediction
- Simple Feed-Forward NN for pass difficulty
- Graph Neural Network (GNN) for team pass network analysis
"""
import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, f1_score
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
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
from backend.services.ml.holdout_utils import split_holdout

# Set device
device = torch.device('cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu')
print(f"Using device: {device}")


def get_all_passes_from_db():
    """Get all pass data from database."""
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
                'passer_id': p.passer_id,
                'recipient_id': p.recipient_id,
                'team_id': event.team_id,
                'location_x': event.location_x or 60,
                'location_y': event.location_y or 40,
                'end_location_x': p.end_location_x or 60,
                'end_location_y': p.end_location_y or 40,
                'pass_length': p.pass_length,
                'pass_outcome': p.pass_outcome,
                'minute': event.minute,
                'second': event.second,
                'competition': match.competition if match else None,
                'season': match.season if match else None,
            })
        
        print(f"  Loaded {len(passes_data):,} passes")
        return pd.DataFrame(passes_data)
    finally:
        db.close()


# ========================================
# 1. FEED-FORWARD NEURAL NETWORK
# ========================================
class PassDifficultyNN(nn.Module):
    """Feed-forward neural network for pass difficulty prediction."""
    
    def __init__(self, input_size, hidden_sizes=[128, 64, 32]):
        super().__init__()
        
        layers = []
        prev_size = input_size
        
        for hidden_size in hidden_sizes:
            layers.append(nn.Linear(prev_size, hidden_size))
            layers.append(nn.BatchNorm1d(hidden_size))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(0.3))
            prev_size = hidden_size
        
        layers.append(nn.Linear(prev_size, 1))
        layers.append(nn.Sigmoid())
        
        self.network = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.network(x)


# ========================================
# 2. LSTM FOR SEQUENCE PREDICTION
# ========================================
class PassSequenceLSTM(nn.Module):
    """LSTM for pass sequence prediction."""
    
    def __init__(self, input_size, hidden_size=64, num_layers=2):
        super().__init__()
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.3,
            bidirectional=True
        )
        
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, 32),  # *2 for bidirectional
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        # x: (batch, seq_len, features)
        lstm_out, _ = self.lstm(x)
        # Use last output
        last_output = lstm_out[:, -1, :]
        return self.fc(last_output)


# ========================================
# 3. GRU FOR SEQUENCE PREDICTION
# ========================================
class PassSequenceGRU(nn.Module):
    """GRU for pass sequence prediction."""
    
    def __init__(self, input_size, hidden_size=64, num_layers=2):
        super().__init__()
        
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.3,
            bidirectional=True
        )
        
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, 32),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        gru_out, _ = self.gru(x)
        last_output = gru_out[:, -1, :]
        return self.fc(last_output)


def prepare_features(df: pd.DataFrame, scaler: StandardScaler = None) -> tuple:
    """Prepare features for neural network."""
    df = df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y'])
    
    # Calculate features
    df['pass_length'] = np.sqrt(
        (df['end_location_x'] - df['location_x'])**2 + 
        (df['end_location_y'] - df['location_y'])**2
    )
    df['dx'] = df['end_location_x'] - df['location_x']
    df['dy'] = df['end_location_y'] - df['location_y']
    df['distance_to_goal'] = 120 - df['end_location_x']
    df['normalized_minute'] = df['minute'] / 90
    
    feature_cols = ['location_x', 'location_y', 'end_location_x', 'end_location_y',
                    'pass_length', 'dx', 'dy', 'distance_to_goal', 'normalized_minute']
    
    X = df[feature_cols].fillna(0).values
    y = (df['pass_outcome'].isna() | (df['pass_outcome'] == 'Complete')).astype(int).values
    
    # Normalize
    if scaler is None:
        scaler = StandardScaler()
        X = scaler.fit_transform(X)
    else:
        X = scaler.transform(X)
    
    groups = df['match_id'].values
    return X, y, scaler, feature_cols, groups


def prepare_sequences(df: pd.DataFrame, seq_length: int = 5, scaler: StandardScaler = None) -> tuple:
    """Prepare sequence data for LSTM/GRU."""
    df = df.dropna(subset=['location_x', 'location_y', 'end_location_x', 'end_location_y'])
    df = df.sort_values(['match_id', 'team_id', 'minute', 'second']).reset_index(drop=True)
    
    # Features per pass
    df['pass_length'] = np.sqrt(
        (df['end_location_x'] - df['location_x'])**2 + 
        (df['end_location_y'] - df['location_y'])**2
    )
    df['dx'] = df['end_location_x'] - df['location_x']
    df['dy'] = df['end_location_y'] - df['location_y']
    
    feature_cols = ['location_x', 'location_y', 'end_location_x', 'end_location_y',
                    'pass_length', 'dx', 'dy']
    
    # Create sequences
    X_sequences = []
    y_sequences = []
    groups = []
    
    grouped = df.groupby(['match_id', 'team_id'])
    
    for (match_id, team_id), group in grouped:
        features = group[feature_cols].values
        outcomes = (group['pass_outcome'].isna() | (group['pass_outcome'] == 'Complete')).astype(int).values
        
        # Create sliding windows
        for i in range(seq_length, len(features)):
            X_sequences.append(features[i-seq_length:i])
            y_sequences.append(outcomes[i-1])  # Predict last pass in sequence
            groups.append(match_id)
    
    X = np.array(X_sequences)
    y = np.array(y_sequences)
    
    # Normalize
    if len(X) == 0:
        if scaler is None:
            scaler = StandardScaler()
        return X, y, scaler, np.array(groups)
    
    X_reshaped = X.reshape(-1, X.shape[-1])
    if scaler is None:
        scaler = StandardScaler()
        X_reshaped = scaler.fit_transform(X_reshaped)
    else:
        X_reshaped = scaler.transform(X_reshaped)
    X = X_reshaped.reshape(X.shape)
    
    return X, y, scaler, np.array(groups)


def train_feedforward_nn(
    X: np.ndarray,
    y: np.ndarray,
    groups: np.ndarray,
    X_holdout: np.ndarray = None,
    y_holdout: np.ndarray = None
) -> dict:
    """Train feed-forward neural network."""
    print("\n" + "="*60)
    print("FEED-FORWARD NEURAL NETWORK")
    print("="*60)
    
    # Sample for speed
    if len(X) > 100000:
        idx = np.random.choice(len(X), 100000, replace=False)
        X, y, groups = X[idx], y[idx], groups[idx]
    
    if X_holdout is not None and y_holdout is not None and len(X_holdout) > 0:
        X_train, y_train = X, y
        X_test, y_test = X_holdout, y_holdout
    else:
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        train_idx, test_idx = next(splitter.split(X, y, groups))
        X_train, X_test, y_train, y_test = X[train_idx], X[test_idx], y[train_idx], y[test_idx]
    
    # Convert to tensors
    X_train_t = torch.FloatTensor(X_train).to(device)
    y_train_t = torch.FloatTensor(y_train).reshape(-1, 1).to(device)
    X_test_t = torch.FloatTensor(X_test).to(device)
    y_test_t = torch.FloatTensor(y_test).reshape(-1, 1).to(device)
    
    # Create data loader
    train_dataset = TensorDataset(X_train_t, y_train_t)
    train_loader = DataLoader(train_dataset, batch_size=512, shuffle=True)
    
    # Model
    model = PassDifficultyNN(input_size=X.shape[1]).to(device)
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.5)
    
    print(f"\n  Samples: {len(X):,}")
    print(f"  Architecture: {X.shape[1]} -> 128 -> 64 -> 32 -> 1")
    print(f"  Training on {device}...")
    
    # Training
    epochs = 20
    best_acc = 0
    
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        
        scheduler.step()
        
        # Evaluate
        model.eval()
        with torch.no_grad():
            predictions = model(X_test_t)
            predictions = (predictions > 0.5).float()
            accuracy = (predictions == y_test_t).float().mean().item()
            
            if accuracy > best_acc:
                best_acc = accuracy
        
        if (epoch + 1) % 5 == 0:
            print(f"    Epoch {epoch+1}/{epochs} - Loss: {total_loss/len(train_loader):.4f}, Acc: {accuracy:.2%}")
    
    # Final evaluation
    model.eval()
    with torch.no_grad():
        predictions = model(X_test_t)
        y_pred = (predictions > 0.5).cpu().numpy().flatten()
        y_true = y_test
        
        accuracy = accuracy_score(y_true, y_pred)
        f1 = f1_score(y_true, y_pred)
    
    print(f"\n  Final Results:")
    print(f"    Accuracy: {accuracy:.2%}")
    print(f"    F1 Score: {f1:.2%}")
    
    return {
        'model': model,
        'accuracy': accuracy,
        'f1': f1
    }


def train_lstm(
    X: np.ndarray,
    y: np.ndarray,
    groups: np.ndarray,
    X_holdout: np.ndarray = None,
    y_holdout: np.ndarray = None
) -> dict:
    """Train LSTM for sequence prediction."""
    print("\n" + "="*60)
    print("LSTM SEQUENCE MODEL")
    print("="*60)
    
    if X_holdout is not None and y_holdout is not None and len(X_holdout) > 0:
        X_train, y_train = X, y
        X_test, y_test = X_holdout, y_holdout
    else:
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        train_idx, test_idx = next(splitter.split(X, y, groups))
        X_train, X_test, y_train, y_test = X[train_idx], X[test_idx], y[train_idx], y[test_idx]
    
    # Convert to tensors
    X_train_t = torch.FloatTensor(X_train).to(device)
    y_train_t = torch.FloatTensor(y_train).reshape(-1, 1).to(device)
    X_test_t = torch.FloatTensor(X_test).to(device)
    y_test_t = torch.FloatTensor(y_test).reshape(-1, 1).to(device)
    
    train_dataset = TensorDataset(X_train_t, y_train_t)
    train_loader = DataLoader(train_dataset, batch_size=256, shuffle=True)
    
    # Model
    model = PassSequenceLSTM(input_size=X.shape[2], hidden_size=64, num_layers=2).to(device)
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    print(f"\n  Sequences: {len(X):,}")
    print(f"  Sequence length: {X.shape[1]}")
    print(f"  Features per step: {X.shape[2]}")
    print(f"  Architecture: LSTM(64, 2 layers, bidirectional) -> FC")
    print(f"  Training on {device}...")
    
    # Training
    epochs = 15
    best_acc = 0
    
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        
        # Evaluate
        model.eval()
        with torch.no_grad():
            predictions = model(X_test_t)
            predictions = (predictions > 0.5).float()
            accuracy = (predictions == y_test_t).float().mean().item()
            
            if accuracy > best_acc:
                best_acc = accuracy
        
        if (epoch + 1) % 5 == 0:
            print(f"    Epoch {epoch+1}/{epochs} - Loss: {total_loss/len(train_loader):.4f}, Acc: {accuracy:.2%}")
    
    # Final evaluation
    model.eval()
    with torch.no_grad():
        predictions = model(X_test_t)
        y_pred = (predictions > 0.5).cpu().numpy().flatten()
        y_true = y_test
        
        accuracy = accuracy_score(y_true, y_pred)
        f1 = f1_score(y_true, y_pred)
    
    print(f"\n  Final Results:")
    print(f"    Accuracy: {accuracy:.2%}")
    print(f"    F1 Score: {f1:.2%}")
    
    return {
        'model': model,
        'accuracy': accuracy,
        'f1': f1
    }


def train_gru(
    X: np.ndarray,
    y: np.ndarray,
    groups: np.ndarray,
    X_holdout: np.ndarray = None,
    y_holdout: np.ndarray = None
) -> dict:
    """Train GRU for sequence prediction."""
    print("\n" + "="*60)
    print("GRU SEQUENCE MODEL")
    print("="*60)
    
    if X_holdout is not None and y_holdout is not None and len(X_holdout) > 0:
        X_train, y_train = X, y
        X_test, y_test = X_holdout, y_holdout
    else:
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        train_idx, test_idx = next(splitter.split(X, y, groups))
        X_train, X_test, y_train, y_test = X[train_idx], X[test_idx], y[train_idx], y[test_idx]
    
    X_train_t = torch.FloatTensor(X_train).to(device)
    y_train_t = torch.FloatTensor(y_train).reshape(-1, 1).to(device)
    X_test_t = torch.FloatTensor(X_test).to(device)
    y_test_t = torch.FloatTensor(y_test).reshape(-1, 1).to(device)
    
    train_dataset = TensorDataset(X_train_t, y_train_t)
    train_loader = DataLoader(train_dataset, batch_size=256, shuffle=True)
    
    model = PassSequenceGRU(input_size=X.shape[2], hidden_size=64, num_layers=2).to(device)
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    print(f"\n  Architecture: GRU(64, 2 layers, bidirectional) -> FC")
    print(f"  Training on {device}...")
    
    epochs = 15
    best_acc = 0
    
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        
        model.eval()
        with torch.no_grad():
            predictions = model(X_test_t)
            predictions = (predictions > 0.5).float()
            accuracy = (predictions == y_test_t).float().mean().item()
            
            if accuracy > best_acc:
                best_acc = accuracy
        
        if (epoch + 1) % 5 == 0:
            print(f"    Epoch {epoch+1}/{epochs} - Loss: {total_loss/len(train_loader):.4f}, Acc: {accuracy:.2%}")
    
    model.eval()
    with torch.no_grad():
        predictions = model(X_test_t)
        y_pred = (predictions > 0.5).cpu().numpy().flatten()
        y_true = y_test
        
        accuracy = accuracy_score(y_true, y_pred)
        f1 = f1_score(y_true, y_pred)
    
    print(f"\n  Final Results:")
    print(f"    Accuracy: {accuracy:.2%}")
    print(f"    F1 Score: {f1:.2%}")
    
    return {
        'model': model,
        'accuracy': accuracy,
        'f1': f1
    }


def main():
    """Main neural network training."""
    print("="*60)
    print("NEURAL NETWORK MODELS")
    print("Feed-Forward NN + LSTM + GRU")
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
    
    # 1. Feed-Forward NN
    X, y, scaler, feature_cols, groups = prepare_features(train_df)
    X_hold, y_hold = None, None
    if holdout_df is not None and not holdout_df.empty:
        X_hold, y_hold, _, _, _ = prepare_features(holdout_df, scaler=scaler)
    ff_results = train_feedforward_nn(X, y, groups, X_hold, y_hold)
    
    # 2. LSTM
    print("\n  Preparing sequences for LSTM/GRU...")
    X_seq, y_seq, seq_scaler, seq_groups = prepare_sequences(train_df, seq_length=5)
    print(f"  Created {len(X_seq):,} sequences")
    X_seq_hold, y_seq_hold = None, None
    if holdout_df is not None and not holdout_df.empty:
        X_seq_hold, y_seq_hold, _, _ = prepare_sequences(holdout_df, seq_length=5, scaler=seq_scaler)
    
    lstm_results = train_lstm(X_seq, y_seq, seq_groups, X_seq_hold, y_seq_hold)
    
    # 3. GRU
    gru_results = train_gru(X_seq, y_seq, seq_groups, X_seq_hold, y_seq_hold)
    
    # Save models
    models_dir = 'backend/models/trained'
    os.makedirs(models_dir, exist_ok=True)
    
    torch.save({
        'ff_model': ff_results['model'].state_dict(),
        'lstm_model': lstm_results['model'].state_dict(),
        'gru_model': gru_results['model'].state_dict(),
        'scaler': scaler,
        'seq_scaler': seq_scaler,
        'feature_cols': feature_cols,
    }, os.path.join(models_dir, 'neural_networks.pth'))
    
    # Summary
    print("\n" + "="*60)
    print("✅ NEURAL NETWORK TRAINING COMPLETE!")
    print("="*60)
    
    print("\n  Model Comparison:")
    print(f"  {'Model':<25} {'Accuracy':<12} {'F1 Score':<12}")
    print(f"  {'-'*49}")
    print(f"  {'Feed-Forward NN':<25} {ff_results['accuracy']:>10.2%}   {ff_results['f1']:>10.2%}")
    print(f"  {'LSTM (seq=5)':<25} {lstm_results['accuracy']:>10.2%}   {lstm_results['f1']:>10.2%}")
    print(f"  {'GRU (seq=5)':<25} {gru_results['accuracy']:>10.2%}   {gru_results['f1']:>10.2%}")
    
    print(f"\n  Models saved to {models_dir}/neural_networks.pth")
    
    return {
        'ff': ff_results,
        'lstm': lstm_results,
        'gru': gru_results
    }


if __name__ == '__main__':
    main()
