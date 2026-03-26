# Tactix Documentation Index

This folder contains technical documentation prepared from the current Tactix codebase. The content describes the implementation that actually exists in the repository, not an intended future architecture.

## Scope

- Analysis date: 2026-03-09
- Sources reviewed: `backend/`, `frontend/`, `scripts/`, `requirements.txt`, root `README.md`
- Assumption: no active roadmap or sprint documentation exists in the repository

## Project Summary

Tactix is a football analysis platform that loads StatsBomb open data into a SQLite database, performs network analysis and ML-assisted tactical interpretation through a Python/Flask backend, and presents the results through a React/Vite frontend.

The system operates in three main modes:

1. Data acquisition and loading
2. Analysis serving
3. Offline model training

## Document Map

- [architecture-overview.md](./architecture-overview.md): system boundaries, runtime flows, and folder responsibilities
- [backend-api.md](./backend-api.md): Flask application, data model, services, and endpoints
- [frontend.md](./frontend.md): React app structure, pages, client services, and UI flows
- [data-ml-pipeline.md](./data-ml-pipeline.md): StatsBomb data flow, loading scripts, and ML/training pipeline
- [setup-operations.md](./setup-operations.md): setup, runtime, and operational checks
- [known-issues-risks.md](./known-issues-risks.md): implementation gaps, inconsistencies, and technical risks found during analysis

## Quick Orientation

- Backend entry point: `backend/app.py`
- Frontend entry point: `frontend/src/main.tsx`
- Frontend router: `frontend/src/App.tsx`
- Vite proxy: `frontend/vite.config.ts`
- Data source directory: `data/raw/`
- SQLite database: `database/pass_network.db`
- Trained models: `backend/models/trained/`

## Key Findings From The Analysis

- The application contains two separate service flows: classic network analysis and ML-enhanced analysis.
- The frontend primarily relies on `POST /api/matches/<match_id>/analyze-ml`.
- ML analysis results are computed on demand and persisted into `NetworkMetrics`; there is no active write flow for pattern and counter-tactic tables.
- The repository includes a substantial offline training/tooling layer, but runtime dependencies and training dependencies are not fully aligned.
- Test coverage is effectively absent; `backend/tests` is currently close to empty.

## Success Criteria

This documentation set should answer the following questions:

- What does the project do?
- Which modules own which responsibilities?
- How does data enter the system, get processed, and get displayed?
- Which APIs are used by the frontend?
- What are the main technical risks in the current codebase?
