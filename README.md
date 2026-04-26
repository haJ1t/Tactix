# Tactix - Football Tactical Analysis Platform

Tactix is a full-stack football analysis prototype that turns StatsBomb event data into match, team, pass-network, tactical-pattern, shot-quality, and report views. The core end-to-end feature is: choose a match, run analysis, inspect the generated tactical outputs, and create a PDF match report.

## Core Features Implemented

- Match library with search, competition filters, season filters, sorting, and match workspace navigation.
- Match analysis workflow that generates pass-network statistics, player centrality metrics, tactical pattern signals, counter-tactic recommendations, shot summaries, and analyst insights.
- Interactive pass network view with player nodes, pass-volume edges, and a minimum-pass filter.
- Team pages with season-scoped match, player, and pattern views.
- Reports area that generates backend-stored PDF match dossiers and allows reopening or downloading generated artifacts.
- Flask API endpoints for matches, teams, players, analysis, report creation, and health checks.
- Local SQLite data store populated from StatsBomb Open Data.

## Tech Stack

- Backend: Python, Flask, SQLAlchemy, Pandas, NetworkX, scikit-learn, XGBoost/CatBoost/LightGBM support, ReportLab.
- Frontend: React, Vite, TypeScript, React Query, Tailwind CSS, D3, Recharts.
- Database: SQLite via SQLAlchemy ORM.
- Data source: StatsBomb Open Data.

## Prerequisites

- Python 3.9 or newer.
- Node.js 18 or newer.
- npm.
- macOS/Linux shell for `start_tactix.sh`. Windows users can run the backend and frontend in separate terminals using the manual commands below.

## Setup

Run all commands from the repository root unless a step says otherwise.

### 1. Create the backend environment

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 2. Create the local environment file

```bash
cp .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
```

Open `.env` and replace `REPLACE_WITH_STRONG_SECRET_KEY_FROM_SECRETS_TOKEN_HEX_32` with the generated value.

For local marking and demo use, leave `TACTIX_API_KEY=` blank. The backend supports API-key protection, but the local frontend demo is configured to use the development proxy without sending an API key.

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Confirm sample data is present

This submission snapshot includes a populated local database:

- 661 matches
- 97 teams
- 2,362,742 events
- 624,859 passes

You can check the local data status with:

```bash
backend/venv/bin/python scripts/check_data_status.py
```

If you start from an empty database, download and load StatsBomb data:

```bash
backend/venv/bin/python scripts/download_statsbomb_data.py
backend/venv/bin/python scripts/load_sample_data.py
```

## Loading Match Data

Tactix reads match data from the local SQLite database at `database/pass_network.db`. If you want to add or refresh fixtures, load StatsBomb data into that database first and then restart the backend if it is already running.

### Download the raw StatsBomb data

If `data/raw` is missing or incomplete, download the open-data source first:

```bash
backend/venv/bin/python scripts/download_statsbomb_data.py
```

### List available competitions and seasons

Use the bundled helper to see the competition and season IDs available in the dataset:

```bash
backend/venv/bin/python scripts/load_sample_data.py --list
```

### Load one match

Load a specific match by competition, season, and match index:

```bash
backend/venv/bin/python scripts/load_sample_data.py --competition 11 --season 90 --match 0
```

### Load a full season

To batch-load every match for a competition and season, use the full-season loader:

```bash
backend/venv/bin/python scripts/load_full_season.py --competition 55 --season 282
```

### Verify the database

After loading data, check the counts to confirm the database updated correctly:

```bash
backend/venv/bin/python scripts/check_data_status.py
```

## Running the Application

### Option A: Start both services together

```bash
./start_tactix.sh
```

Then open:

- Frontend: http://localhost:3000
- Backend health check: http://localhost:5001/api/health

Press `Ctrl+C` in the terminal running `start_tactix.sh` to stop both services.

### Option B: Start services manually

Terminal 1 - backend:

```bash
source backend/venv/bin/activate
cd backend
python app.py
```

Terminal 2 - frontend:

```bash
cd frontend
npm run dev
```

Then open http://localhost:3000.

## How to Use the Prototype

1. Open http://localhost:3000.
2. Go to `Matches`.
3. Search for a sample fixture, for example `Argentina`, and open `Argentina vs France` from the 2022 FIFA World Cup final, match ID `3869685`.
4. Click `Analyze` or open the match workspace and press `Run Analysis`.
5. Wait until the match workspace analysis state changes to `Ready`.
6. Use the tabs:
   - `Overview`: match-level summary and key signals.
   - `Network`: pass network graph and minimum-pass slider.
   - `Players`: centrality and player influence rankings.
   - `Tactics`: detected pattern signals and counter-tactic recommendations.
   - `Shots`: shot-quality summary.
   - `Report`: match report actions.
7. Go to `Reports`, select a match, click `Generate report`, then open or download the generated PDF dossier.

## Suggested Demo Recording Flow

For a 5 minute screen recording:

1. Show the backend and frontend running.
2. Open http://localhost:3000 and briefly show the Overview page.
3. Go to `Matches`, search `Argentina`, and open match ID `3869685`.
4. Run analysis and wait for the workspace state to become `Ready`.
5. Show the `Network`, `Players`, `Tactics`, and `Shots` tabs.
6. Go to `Reports`, generate a report for the same match, and open or download the PDF.
7. End by briefly mentioning the known limitations listed below.

## Sample Inputs

- No login credentials are required.
- Recommended frontend demo search: `Argentina`.
- Recommended match: `Argentina vs France`, FIFA World Cup 2022, match ID `3869685`.
- Alternative match: `Spain vs England`, UEFA Euro 2024, match ID `3943043`.
- API smoke test:

```bash
curl http://localhost:5001/api/health
curl http://localhost:5001/api/matches
```

Expected health response:

```json
{"status":"healthy","version":"1.0.0"}
```

## Testing and Verification

Backend tests:

```bash
backend/venv/bin/python -m pytest backend/tests -q
```

Frontend tests:

```bash
npm --prefix frontend test
```

Frontend production build:

```bash
npm --prefix frontend run build
```

Useful manual checks:

- `GET /api/health` returns HTTP 200.
- `GET /api/matches` returns the loaded match catalog.
- The frontend `Matches` page lists fixtures.
- Running analysis on a match populates Network, Players, Tactics, Shots, and Report views.
- Generating a report creates a PDF artifact under `output/pdf/reports/`.

## Project Structure

```text
backend/                 Flask app, API routes, models, services, ML analysis, PDF reports
backend/api/             Match, analysis, report, team, and player endpoints
backend/models/          SQLAlchemy models and database initialization
backend/services/        Data parsing, network analysis, metrics, ML, and reporting logic
backend/tests/           Backend route and service tests
frontend/                React/Vite/TypeScript client
frontend/src/features/   Feature modules for overview, matches, analysis, teams, and reports
database/                SQLite database snapshot
data/                    StatsBomb raw data files
scripts/                 Data loading, status, training, and maintenance scripts
output/                  Generated runtime outputs, including PDF reports
```

## Known Limitations

- This is a prototype, not a production deployment.
- The system analyzes StatsBomb event data; it does not ingest live match feeds or video tracking data.
- The bundled database is a partial local snapshot of available StatsBomb data, not the complete open-data archive.
- SQLite is used for local demonstration and is not intended for concurrent multi-user production workloads.
- Some ML outputs depend on available model artifacts and event coverage; degraded model conditions are handled with fallback outputs where possible.
- First analysis or report generation for a match can take several seconds depending on machine performance.
- Local API-key authentication should remain disabled for the submitted frontend demo unless the frontend is extended to send `X-API-Key`.

## Submission Notes

For marking, submit a GitHub repository link or zipped copy of this source tree. The marker should be able to follow this README to install dependencies, run the system, execute the main analysis workflow, and inspect the generated outputs.

StatsBomb Open Data is licensed under CC BY-SA 4.0.
