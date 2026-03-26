# Data and ML Pipeline Documentation

## Data Source

The system uses StatsBomb Open Data. The expected raw-data structure is:

- `data/raw/competitions.json`
- `data/raw/matches/<competition_id>/<season_id>.json`
- `data/raw/events/<match_id>.json`
- `data/raw/lineups/<match_id>.json`

The `download_statsbomb_data.py` script clones the repository into `data/raw/open-data` and copies the relevant data folders into `data/raw/`.

## Data Loading Flows

### 1. Download raw data

- Script: `scripts/download_statsbomb_data.py`
- Mechanism: `git clone --depth 1`
- Output: `data/raw/`

### 2. Load a single sample match

- Script: `scripts/load_sample_data.py`
- Responsibilities:
  - initialize the DB
  - read matches for a selected competition/season
  - load lineups
  - write event and pass rows

### 3. Load a full season

- Script: `scripts/load_full_season.py`
- Writes lineup, event, and pass data for each match in a given competition/season.

### 4. Batch season loading

- Script: `scripts/load_season.py`
- Reuses `load_sample_match()` logic in a loop.
- It works, but is not the cleanest architectural path.

### 5. Utility/training scripts

The repository also contains script families for:

- data status checks
- baseline ML training
- advanced feature training
- SMOTE / tuning / Optuna experiments
- XGBoost / ensemble experiments
- neural network training
- tactical classifier training

## Parser Layer

`backend/services/data_parser.py` contains `StatsBombParser`, which:

- parses competition JSON
- maps match lists into the internal schema
- normalizes event data
- extracts player positions from lineup data
- flattens pass events into an analysis-friendly list

## Analysis Data Shape

Backend analysis services typically expect these columns:

- `passer_id`
- `recipient_id`
- `passer_name`
- `recipient_name`
- `location_x`
- `location_y`
- `end_location_x`
- `end_location_y`
- `pass_outcome`
- `minute`
- `period`
- `team_id`

## Classic Analysis Pipeline

1. Pass data is loaded.
2. `DataCleaner.get_successful_passes()` filters complete passes.
3. `NetworkBuilder.build_pass_network()` creates the graph.
4. `MetricsCalculator` computes node and network-level metrics.
5. `PatternDetector` produces rule-based patterns.
6. `CounterTacticGenerator` produces recommendations.

## ML Analysis Pipeline

`backend/services/ml/analysis_pipeline.py` contains `MLAnalysisPipeline`, which orchestrates:

1. filtering successful passes
2. building the pass network
3. collecting node positions
4. computing network metrics
5. calculating VAEP values
6. estimating pass difficulty / pass value
7. extracting network features
8. classifying tactical patterns
9. generating counter-tactics
10. returning summary and metadata

Primary output fields:

- `network`
- `network_statistics`
- `player_metrics`
- `patterns`
- `counter_tactics`
- `vaep_summary`
- `network_features`
- `summary`
- `ml_info`

## Trained Model Artifacts

`backend/models/trained/` contains artifacts such as:

- `vaep_model.joblib`
- `pass_difficulty*.joblib`
- `tactical_classifier*.joblib`
- `neural_networks.pth`

This folder is the main output location for offline training and the default source for runtime model loading.

## ML Training Script Families

| Area | Example Script |
| --- | --- |
| Baseline training | `train_ml_simple.py`, `train_ml_models.py` |
| Feature engineering | `train_advanced_features.py`, `train_advanced_ml.py` |
| Imbalance / tuning | `train_with_smote.py`, `train_with_hyperparameter_tuning.py`, `optuna_tuning.py` |
| Model variants | `train_xgboost.py`, `train_ensemble.py`, `train_neural_networks.py` |
| Pattern classification | `train_tactical_classifier.py` |
| Evaluation | `cross_validation_analysis.py` |

## Operational Notes

- `requirements.txt` looks sufficient for the main backend, but some training scripts require additional libraries.
- At minimum, `xgboost`, `lightgbm`, and `torch` appear in the codebase but are not listed in `requirements.txt`.
- In practice, "running the app" and "running every training script" are two different dependency profiles.

## Handoff Note

A new ML contributor should start with:

1. `backend/services/ml/analysis_pipeline.py`
2. `backend/services/ml/pass_difficulty_model.py`
3. `backend/services/ml/vaep_model.py`
4. `backend/services/ml/tactical_classifier.py`
5. `scripts/train_tactical_classifier.py`
