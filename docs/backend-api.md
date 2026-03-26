# Backend and API Documentation

## Backend Summary

The backend is a Flask service initialized in `backend/app.py`. The application:

- loads configuration
- enables `CORS`
- creates the database directory if needed
- initializes tables with `init_db()`
- registers match, analysis, team, and player blueprints

## Application Lifecycle

1. `create_app()` loads the selected config.
2. The `database/` directory is created if missing.
3. SQLAlchemy tables are initialized.
4. Blueprints are registered.
5. `app.run(..., port=5001)` starts the service.

## Data Model

| Model | Role |
| --- | --- |
| `Match` | Match metadata, score, season, home/away team relations |
| `Team` | Team master record |
| `Player` | Player master record and team relation |
| `Event` | All event records |
| `PassEvent` | Pass-specific details separated from `Event` |
| `NetworkMetrics` | Computed player-level network metrics |
| `TacticalPattern` | Persistent model intended for detected patterns |
| `CounterTactic` | Persistent model intended for recommendations tied to patterns |

## Service Layer

### Classic analysis services

- `DataCleaner`: pass cleanup, coordinate clipping, progressive pass derivation
- `NetworkBuilder`: `DiGraph` construction and node/edge serialization
- `MetricsCalculator`: centrality and network-level metrics
- `PatternDetector`: rule-based pattern detection
- `CounterTacticGenerator`: recommendation generation from detected patterns

### ML services

- `MLAnalysisPipeline`: orchestrates the full ML-enhanced flow
- `VAEPModel`: action valuation
- `PassDifficultyModel`: pass difficulty and pass value estimation
- `TacticalPatternClassifier`: feature extraction and pattern classification
- `CounterTacticEngine`: recommendation generation from ML features/patterns
- `shot_metrics.py`: shot summary and heuristic xG calculation

## Endpoint Inventory

### General

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | API root metadata |
| `GET` | `/api/health` | Health check |

### Match endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/matches` | List all matches |
| `GET` | `/api/matches/<match_id>` | Get a single match |
| `GET` | `/api/matches/<match_id>/network` | Return pass-network node/edge data |
| `POST` | `/api/matches/<match_id>/analyze` | Trigger classic analysis |
| `POST` | `/api/matches/<match_id>/analyze-ml` | Trigger ML-enhanced analysis |

`/network` query parameters:

- `team_id`
- `period`
- `min_passes`

`/analyze` and `/analyze-ml` request body:

- `team_id` optional

### Analysis endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/analysis/<match_id>/metrics` | Return `NetworkMetrics` rows |
| `GET` | `/api/analysis/<match_id>/patterns` | Return `TacticalPattern` rows |
| `GET` | `/api/analysis/<match_id>/countertactics` | Return `CounterTactic` rows |
| `GET` | `/api/analysis/<match_id>/top-players` | Rank players from persisted metric rows |

### Team and player endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/teams` | List all teams |
| `GET` | `/api/teams/<team_id>` | Get team + players |
| `GET` | `/api/teams/<team_id>/metrics` | Return team metric rows |
| `GET` | `/api/players/<player_id>` | Get player details |
| `GET` | `/api/players/<player_id>/centrality` | Return player metric history |

## Classic Analysis Flow

`POST /api/matches/<match_id>/analyze`

1. The match is loaded.
2. If no team is specified, home and away teams are both analyzed.
3. Shot events are loaded and passed into `calculate_shot_summary`.
4. `PassEvent + Event` rows are transformed into a DataFrame.
5. Only successful passes are used to build a `DiGraph`.
6. Player metrics and network statistics are computed.
7. Rule-based pattern detection runs.
8. Counter-tactic recommendations are generated.
9. `NetworkMetrics` rows are deleted and reinserted for that match/team.

Successful response fields:

- `network_statistics`
- `player_metrics`
- `patterns`
- `counter_tactics`
- `top_players`

## ML Analysis Flow

`POST /api/matches/<match_id>/analyze-ml`

1. The match is loaded.
2. Team-level pass data is converted into a DataFrame.
3. A `player_info` map is built.
4. `MLAnalysisPipeline.analyze_passes()` runs.
5. Returned `player_metrics` are persisted into `NetworkMetrics`.
6. The JSON result is returned to the frontend.

Expected response fields:

- `network_statistics`
- `player_metrics`
- `patterns`
- `counter_tactics`
- `vaep_summary`
- `network_features`
- `summary`
- `ml_info`
- `shot_summary`

## Persistence Behavior

At runtime, the main analysis artifact persisted during requests is `NetworkMetrics`. Although `TacticalPattern` and `CounterTactic` models exist, there is no active insert flow into those tables inside the current route logic.

That means the backend currently has two distinct result categories:

- patterns/tactics computed and returned only in the HTTP response
- player metrics persisted into the database

## Important API Notes

- The frontend mostly uses `matchService.analyzeMatchML()`.
- `analysisService` endpoints for patterns and counter-tactics are DB-backed.
- Because persistence differs between these paths, there is a behavioral mismatch between route intent and actual client usage.

## Handoff Note

Anyone working on the backend should read these files first:

1. `backend/app.py`
2. `backend/api/match_routes.py`
3. `backend/services/ml/analysis_pipeline.py`
4. `backend/services/network_builder.py`
5. `backend/services/metrics_calculator.py`
