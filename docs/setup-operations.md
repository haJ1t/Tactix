# Setup and Operations Guide

## Prerequisites

- Python 3.9+
- Node.js 18+

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r ../requirements.txt
```

## Frontend Setup

```bash
cd frontend
npm install
```

## Data Preparation

### Download StatsBomb data

```bash
python scripts/download_statsbomb_data.py
```

### Load a sample match

```bash
python scripts/load_sample_data.py
```

### Alternative: load a specific season

```bash
python scripts/load_season.py --competition 55 --season 282
```

## Running The Application

### Backend

```bash
cd backend
python app.py
```

Expected port: `5001`

### Frontend

```bash
cd frontend
npm run dev
```

Expected port: `3000`

## Quick Verification Checklist

### Backend health check

- `GET http://localhost:5001/api/health`

Expected JSON:

```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

### Frontend-backend connectivity

- In development, the frontend proxies `/api` to the backend.
- The config lives in `frontend/vite.config.ts`.

## Data Locations

| Path | Contents |
| --- | --- |
| `data/raw/` | Raw StatsBomb data |
| `database/pass_network.db` | SQLite database |
| `backend/models/trained/` | Trained models |

## Common Operating Scenarios

### Team or match list is empty

Check:

- Was raw data downloaded?
- Did `load_sample_data.py` or a season-loading script run successfully?
- Was the SQLite database written successfully?

### Frontend cannot fetch data

Check:

- Is the backend running on port `5001`?
- Is the frontend running on port `3000`?
- Is the Vite proxy configuration active?

### ML analysis fails

Check:

- Are model files present under `backend/models/trained/`?
- Does the selected match/team actually have pass data?
- Have the route-level risks in `known-issues-risks.md` been reviewed?

## Testing and Verification Note

Automated test execution could not be completed during this analysis:

- the `pytest` binary was not available in the environment
- `python3 -m pytest -q` also failed because the `pytest` module was not installed

That means the repository should not currently be assumed to have an actively verified test routine.

## Minimum Pre-Release Check

1. Load one sample match.
2. Verify the `/api/matches` endpoint.
3. Open `/matches` and `/metrics` in the frontend.
4. Trigger ML analysis for a match.
5. Validate at least one export flow.
