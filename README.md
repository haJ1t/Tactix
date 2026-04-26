<div align="center">

# ⚽ Tactix

### Advanced Football Analysis Platform

**Pass-network analytics, ML-driven tactical pattern recognition, and counter-tactic generation — built on StatsBomb open data.**

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-CC%20BY--SA%204.0-lightgrey)](#license)

</div>

---

## Table of Contents

- [What is Tactix?](#what-is-tactix)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [User Guide](#user-guide)
  - [Overview Dashboard](#1-overview-dashboard)
  - [Match Library](#2-match-library)
  - [Match Workspace](#3-match-workspace)
  - [Team Library](#4-team-library)
  - [Team Workspace](#5-team-workspace)
  - [Reports](#6-reports)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Database Management](#database-management)
- [Machine Learning Pipeline](#machine-learning-pipeline)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License & Credits](#license--credits)

---

## What is Tactix?

**Tactix** is a full-stack football analytics platform designed for analysts, coaches, and tactical researchers who want to move beyond raw match statistics. By transforming StatsBomb event data into pass-network graphs, the platform reveals the hidden structure of how teams actually play — who connects with whom, which players act as bridges between attack and defense, and which tactical patterns recur across matches.

The system pairs **graph-theoretic centrality metrics** (Betweenness, PageRank, Closeness) with a **machine-learning pipeline** (CatBoost, XGBoost, LightGBM ensembles) that classifies tactical setups, predicts shot outcomes, and computes pass-difficulty signals. On top of that, an **automated counter-tactic engine** suggests opposition-specific countermeasures based on detected patterns.

Everything is exposed through a polished React workspace with interactive D3 network visualizations, multi-tab match dashboards, season-scoped team profiles, and PDF-ready dossier generation.

> **Use cases:** post-match opposition analysis, scouting reports, tactical research, sports-science dissertations, and academic study of network science applied to team sports.

---

## Key Features

### 🕸️ Pass Network Analysis
- Build directed weighted graphs from completed-pass events.
- Visualize player nodes positioned by their average pitch coordinates.
- Edge thickness encodes pass volume; node size encodes centrality.
- Filter by team, half, or possession phase.

### 📊 Centrality Metrics
- **Degree centrality** — total connections per player (in / out / total).
- **Betweenness centrality** — players who act as tactical bridges.
- **Closeness centrality** — how quickly a player can reach the rest of the team.
- **PageRank** — influence weighted by who you pass to.
- **Clustering coefficient** — local triangle density around each player.

### 🎯 Tactical Pattern Recognition
- ML classifier identifies recurring formations and play styles.
- Detects pressing intensity, build-up structure, and width usage.
- Per-pattern confidence scores with side (home / away) attribution.

### 🛡️ Counter-Tactic Generator
- Rule-based + ML-augmented engine that proposes opposition responses.
- Targets specific players (e.g., disrupt the deepest playmaker).
- Prioritized recommendations ranked by tactical impact.

### 🔫 Shot & xG Analytics
- Per-team shot maps with location, body part, technique, outcome.
- xG-style probability via gradient-boosted shot model.
- Distinguishes goals, on-target, blocked, off-target.

### 📁 Match Reports & PDF Export
- Auto-generate post-match dossiers (key passes, top players, patterns, counter-tactics).
- Persistent server-side report artifacts with download URLs.
- Backwards compatibility with legacy browser-stored reports.

### 🎨 Modern Analyst Workspace
- Glass-card UI with subtle motion (Framer Motion).
- Multi-tab match workspace: Overview, Network, Players, Tactics, Shots, Report.
- Season-scoped team profiles with aggregate metrics.
- React Query caching, Suspense-based code splitting, Vite-powered HMR.

### 🔒 Production-Ready Backend
- Flask 3 + SQLAlchemy 2 ORM with whitelist-based metric sorting.
- Rate limiting via Flask-Limiter (200/day, 50/hour by default).
- Optional `X-API-Key` authentication.
- Hardened security headers, CORS allowlist with regex support, input sanitization, safe joblib model loading with SHA-256 integrity checks.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
│  React 18 + TypeScript • Vite • TailwindCSS • React Query • D3 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / JSON
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Flask 3 API (Python)                       │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  Blueprints  ·  matches  ·  analysis  ·  teams           │  │
│   │              ·  players  ·  reports                      │  │
│   └──────────────────────────────────────────────────────────┘  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  Services                                                │  │
│   │   network_builder  ·  metrics_calculator                 │  │
│   │   pattern_detector ·  counter_tactic_generator           │  │
│   │   report_pdf_service                                     │  │
│   └──────────────────────────────────────────────────────────┘  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  ML Pipeline (services/ml/)                              │  │
│   │   tactical_classifier · pass_difficulty_model            │  │
│   │   shot_metrics · vaep_model · counter_tactic_engine      │  │
│   └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ SQLAlchemy ORM
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SQLite Database (pass_network.db)              │
│   teams · matches · players · events · passes                   │
│   network_metrics · tactical_patterns · counter_tactics         │
│   report_artifacts                                              │
└─────────────────────────────────────────────────────────────────┘
                             ▲
                             │ ETL: scripts/load_*_data.py
                             │
                  ┌──────────┴──────────┐
                  │  StatsBomb Open Data │
                  │  (raw event JSON)    │
                  └──────────────────────┘
```

### Request Lifecycle

1. **User opens the React app** → React Router resolves the route (e.g., `/matches/:id/network`).
2. **React Query** issues an `axios` GET to `${VITE_API_BASE_URL}/...`.
3. **Flask blueprint** authenticates (optional `X-API-Key`), opens a SQLAlchemy session, queries the relevant tables.
4. **Service layer** transforms ORM rows into NetworkX graphs, computes centralities, runs ML inference if requested.
5. **Response** is JSON-serialized; the frontend cache key persists the result for the session.

---

## Tech Stack

### Backend
| Component | Version | Purpose |
|-----------|---------|---------|
| Python | 3.10+ | Runtime |
| Flask | 3.1 | HTTP framework |
| Flask-CORS | 5.0 | Cross-origin policy |
| Flask-Limiter | 3.0 | Rate limiting |
| SQLAlchemy | 2.0 | ORM |
| NetworkX | 3.2 | Graph algorithms |
| pandas | 2.1 | Data manipulation |
| scikit-learn | 1.4 | Baseline ML |
| LightGBM / XGBoost / CatBoost | latest | Gradient boosting ensembles |
| Optuna | 3.5 | Hyperparameter tuning |
| ReportLab + pypdf | 4.x / 6.x | PDF report generation |

### Frontend
| Component | Version | Purpose |
|-----------|---------|---------|
| React | 18 | UI library |
| TypeScript | 5 | Type system |
| Vite | 6 | Build tool / dev server |
| React Router | 6 | Routing |
| TanStack Query | 5 | Server-state cache |
| TailwindCSS | 3 | Styling |
| D3 | 7 | Network visualizations |
| Recharts | 2 | Charts |
| Framer Motion | 12 | Animations |
| Axios | 1.7 | HTTP client |
| jsPDF | 4 | Client-side PDF |
| Vitest + Testing Library | latest | Unit / component tests |

### Infrastructure
| Layer | Service |
|-------|---------|
| Frontend hosting | Vercel |
| Backend hosting | Render (Python web service) |
| Database | SQLite (file-based, deployed with the backend) |
| Source control | GitHub |

---

## Quick Start

> **Goal:** Get a fully working local instance — backend + frontend + sample data — in under five minutes.

### Prerequisites

- Python **3.10+**
- Node.js **18+** (or 20 LTS)
- npm (bundled with Node.js)
- ~2 GB free disk space if you plan to ingest a full StatsBomb season

### One-Command Bootstrap

```bash
git clone https://github.com/haJ1t/Tactix.git
cd Tactix
./start_tactix.sh
```

The launcher script will:
1. Detect / create a Python virtualenv at `backend/venv`
2. Install backend dependencies from `requirements.txt`
3. Install frontend dependencies via `npm install`
4. Start the Flask backend on **port 5001**
5. Start the Vite dev server on **port 3000**
6. Open the app in your default browser

If everything works, you'll see the **Tactix Overview** page with the bundled 80-match sample dataset.

> **Manual setup?** See [Local Development](#local-development) for step-by-step instructions.

---

## User Guide

Tactix is organized into six main areas. Every page is reachable from the left sidebar (`AppShell`) and the top of the screen always shows your current location plus quick filters.

### 1. Overview Dashboard

**Route:** `/overview`  ·  **Purpose:** Today's analyst desk.

The Overview is your home base. It surfaces the most recent match in your library, your latest report, and aggregate library counts so you can decide where to dive in.

**What you'll see:**

| Section | Description |
|---------|-------------|
| **Latest match in library** | The newest fixture by date with a one-click link into its Match Workspace. The "Run analysis" button jumps straight into the ML analyze flow. |
| **Library counts** | Animated counters for total matches, team-seasons, and saved reports. |
| **Latest report** | Most recent generated dossier with score, competition, and creation date. |
| **Workflow shortcuts** | Direct links to Match Library, Teams, and Reports. |
| **Recent reports** | The five most recent saved dossiers, click-through to full detail. |

**Tips**
- If "No matches are available yet" appears, your database is empty — see [Database Management](#database-management).
- "Overview unavailable" means the backend rejected the request. Check the network tab and verify CORS / API URL configuration.

---

### 2. Match Library

**Route:** `/matches`  ·  **Purpose:** Browse, search, and filter every fixture in the system.

The Match Library is a sortable, filterable catalog of all matches in the database.

**Filters**
- **Search** — fuzzy match against home / away team names, competition, season.
- **Competition** — narrow to La Liga, FIFA World Cup, Premier League, etc.
- **Season** — narrow to a specific year (e.g., `2022/2023`).
- **Sort** — by date (newest / oldest), by competition name, by season label.

**Match card**
Each card shows scoreline, date, competition, season, and both team crests. Clicking any card opens the **Match Workspace** in a new tab-style layout.

**Tips**
- Filters are URL-bound; share a filtered view by copying the URL.
- The "Run analysis" shortcut on a card runs the standard analysis without ML for fast triage.

---

### 3. Match Workspace

**Route:** `/matches/:matchId`  ·  **Purpose:** Deep tactical analysis of a single fixture.

The workspace is split into **six tabs**, all sharing the match header (teams, scoreline, competition, date).

#### 3.1 Overview Tab — `/matches/:id/overview`

A high-level summary:
- Match metadata (referee, venue, kickoff if available).
- Possession share, total passes, completion % per team.
- Key events timeline (goals, red cards, substitutions if present in source data).
- Quick links to deeper tabs.

#### 3.2 Network Tab — `/matches/:id/network`

The flagship visualization. A D3-rendered force-directed graph where:
- **Nodes** are players, sized by chosen centrality.
- **Edges** are passes between two players, thickness = pass count.
- **Position** approximates the average X/Y pitch location of all that player's events.

**Controls**
- **Team selector** — toggle between home and away networks.
- **Centrality dropdown** — switch between Degree, Betweenness, Closeness, PageRank, Clustering.
- **Minimum pass threshold** — hide weak edges to declutter.
- **Highlight player** — click a node to fade everything except its first-degree connections.

**How to read it**
- A player who is **large** but **peripheral** is involved in many passes but with one or two specific partners (e.g., a fullback locked into a wing-pair).
- A player who is **central with many edges** is the team's **bridge** — usually a deep-lying playmaker or box-to-box midfielder. Their Betweenness will be high.
- A **dense cluster** indicates a tactical sub-unit (e.g., a triangle of CB-CM-FB on the build-up side).

#### 3.3 Players Tab — `/matches/:id/players`

A sortable table of every player who appeared, with all centrality metrics, pass counts, completion %, and position. Sort by any column. Click a row to see that player's individual pass map (passes they attempted overlaid on the pitch).

#### 3.4 Tactics Tab — `/matches/:id/tactics`

Lists every **tactical pattern** detected by the ML classifier, with:
- Pattern type label (e.g., "high-press build-up", "wide overload right").
- Confidence score (0–1).
- Side (home / away) and key player involved.
- Free-text description for analyst-readable context.

The pattern detector runs lazily — the first time you open a match, it may take a few seconds. Subsequent loads are instant.

#### 3.5 Shots Tab — `/matches/:id/shots`

xG-style shot map per team. Each shot is plotted at its location with:
- **Color** = outcome (goal, on-target, off-target, blocked).
- **Size** = xG probability from the gradient-boosted shot model.
- **Hover** reveals minute, body part, technique, under-pressure flag.

Aggregate stats per team: total shots, total xG, on-target %, conversion rate.

#### 3.6 Report Tab — `/matches/:id/report`

The auto-generated post-match dossier:
- Executive summary
- Top players by centrality
- Detected tactical patterns
- Counter-tactic recommendations targeted at the opposition
- Generate / re-generate / download as PDF

Generated reports are saved to the database and visible from the Reports page.

---

### 4. Team Library

**Route:** `/teams`  ·  **Purpose:** Browse all team-seasons in the database.

A team-season is a (team × season) tuple. Real Madrid 2020/21 and Real Madrid 2021/22 are separate entries.

**Segments**
- **All** — every team-season.
- **National** — international sides (auto-detected when team name == country name).
- **Club** — everything else.

**Filters**
- Search by name, country, or season.
- Cards show match count and most recent match date in the season.

---

### 5. Team Workspace

**Route:** `/teams/:teamId`  ·  **Purpose:** Season-scoped team analysis.

Selecting a team-season opens a four-tab workspace.

#### 5.1 Overview — `/teams/:id/overview`
Aggregate statistics over the whole season: matches played, total passes, average density, average clustering, average reciprocity. A radar chart compares this team's profile against league averages.

#### 5.2 Matches — `/teams/:id/matches`
Every fixture this team-season participated in, sorted by date. Click through to the per-match workspace.

#### 5.3 Players — `/teams/:id/players`
The full squad with aggregate per-season centralities. Sortable by any metric. Identify your season-long top-influencer, your best dribbler, your most-pressed midfielder.

#### 5.4 Patterns — `/teams/:id/patterns`
All detected tactical patterns for this team across the season, grouped and ranked by frequency / confidence. Useful for opposition-prep: "how often does this team build through the right half-space?"

> **Tip:** The first time you open a team's Patterns tab the ML pipeline runs analysis for the five most recent matches. This is cached for the session.

---

### 6. Reports

**Route:** `/reports`  ·  **Purpose:** Manage saved post-match dossiers.

The Reports page lists every saved analyst dossier, both server-generated artifacts and any legacy browser-stored reports imported on first load.

**Per-report actions**
- **View** — open the full report in `/reports/:id`.
- **Download** — get a PDF.
- **Delete** — remove server-side; legacy reports stay until you clear browser storage.

Each report keeps:
- Match metadata and final scoreline.
- Frozen tactical patterns and counter-tactic recommendations as of generation time.
- Top-player rankings.
- A creation timestamp for audit purposes.

---

## API Reference

> Base URL (production): `https://tactix-backend-jv55.onrender.com/api`
> Base URL (local): `http://localhost:5001/api`

All endpoints return JSON. When `TACTIX_API_KEY` is configured server-side, **all routes except `/health`** require an `X-API-Key` header.

### Health & Meta

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness check. Returns `{status, version}`. |
| `GET` | `/` | API index with endpoint listing. |

### Matches

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/matches` | List all matches with home/away team objects. |
| `GET` | `/matches/:matchId` | Get a single match. |
| `GET` | `/matches/:matchId/network?team_id=` | Pass-network nodes & edges for a team. |
| `POST` | `/matches/:matchId/analyze` | Run standard (non-ML) analysis. |
| `POST` | `/matches/:matchId/analyze-ml` | Run ML-augmented analysis. |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/analysis/:matchId/metrics?team_id=&sort_by=&limit=` | Network metrics, sortable. |
| `GET` | `/analysis/:matchId/patterns` | Detected tactical patterns. |
| `GET` | `/analysis/:matchId/countertactics` | Counter-tactic recommendations. |
| `GET` | `/analysis/:matchId/top-players?metric=&limit=` | Top players by a centrality metric. |

### Teams & Players

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/teams` | List all teams. |
| `GET` | `/teams/:teamId` | Single team with squad. |
| `GET` | `/teams/:teamId/metrics?match_id=` | Aggregate or per-match team metrics. |
| `GET` | `/players/:playerId` | Single player profile. |
| `GET` | `/players/:playerId/centrality` | Career centralities for the player. |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/reports` | List saved report artifacts. |
| `GET` | `/reports/:reportId` | Get a report's full payload. |
| `POST` | `/reports` body: `{match_id}` | Generate a new dossier for a match. |
| `POST` | `/reports/import-legacy` | Import a browser-stored legacy report. |
| `GET` | `/reports/:reportId/download` | Download report as PDF. |
| `DELETE` | `/reports/:reportId` | Delete a saved report. |

### Allowed Sort Metrics

`/analysis/:matchId/metrics` and `/analysis/:matchId/top-players` accept these values for `metric` / `sort_by`:

```
betweenness_centrality, closeness_centrality, pagerank,
degree_centrality, in_degree_centrality, out_degree_centrality,
clustering_coefficient
```

### Rate Limits

Default Flask-Limiter policy is `200 per day, 50 per hour` per IP. Override via the `RATELIMIT_DEFAULT` env var if needed.

### Example

```bash
# Get matches
curl https://tactix-backend-jv55.onrender.com/api/matches

# Get pass network for the home team of a match
curl "https://tactix-backend-jv55.onrender.com/api/matches/3773386/network?team_id=206"

# Trigger ML analysis
curl -X POST -H "Content-Type: application/json" \
  -d '{"team_id": 206}' \
  https://tactix-backend-jv55.onrender.com/api/matches/3773386/analyze-ml
```

---

## Project Structure

```
Tactix/
├── backend/                       Flask application
│   ├── app.py                     Entry point — create_app() + CORS + blueprints
│   ├── config.py                  Environment-based config classes
│   ├── api/                       Route blueprints
│   │   ├── match_routes.py        /api/matches/*
│   │   ├── analysis_routes.py     /api/analysis/*
│   │   ├── team_player_routes.py  /api/teams/* and /api/players/*
│   │   └── report_routes.py       /api/reports/*
│   ├── models/                    SQLAlchemy ORM models
│   │   ├── match.py
│   │   ├── team.py · player.py
│   │   ├── event.py · pass_event.py
│   │   ├── network_metrics.py
│   │   ├── tactical_pattern.py · counter_tactic.py
│   │   └── report_artifact.py
│   ├── services/                  Business logic
│   │   ├── network_builder.py     Builds NetworkX graphs from passes
│   │   ├── metrics_calculator.py  Centrality computation
│   │   ├── pattern_detector.py    Pattern recognition
│   │   ├── counter_tactic_generator.py
│   │   ├── data_parser.py · data_cleaner.py
│   │   ├── report_pdf_service.py  ReportLab PDF rendering
│   │   └── ml/                    ML pipeline
│   │       ├── analysis_pipeline.py
│   │       ├── tactical_classifier.py
│   │       ├── pass_difficulty_model.py
│   │       ├── shot_metrics.py
│   │       ├── vaep_model.py
│   │       └── counter_tactic_engine.py
│   ├── utils/
│   │   └── security.py            API key auth, security headers, joblib hashing
│   └── tests/                     pytest suite
│
├── frontend/                      React application
│   ├── index.html                 Vite entry HTML (CSP meta tag here)
│   ├── vite.config.ts             Vite + dev proxy
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx               React root
│       ├── App.tsx                Mounts AppRouter
│       ├── app/
│       │   ├── layouts/AppShell.tsx
│       │   ├── providers/QueryProvider.tsx
│       │   └── router/route-config.tsx
│       ├── features/              Feature modules
│       │   ├── overview/
│       │   ├── matches/
│       │   ├── analysis/
│       │   ├── teams/
│       │   └── reports/
│       ├── services/              Axios API clients
│       │   ├── api.ts             Axios instance + base URL
│       │   ├── matchService.ts
│       │   ├── teamService.ts
│       │   └── analysisService.ts
│       ├── entities/              Domain model types
│       ├── shared/                Cross-feature UI, hooks, utilities
│       └── types/                 Global TS types
│
├── database/
│   ├── pass_network.db            SQLite database (89MB sample, 80 matches)
│   └── init_db.py
│
├── scripts/                       Data ETL & ML training utilities
│   ├── load_sample_data.py        Load StatsBomb sample
│   ├── load_season.py             Load full season
│   ├── load_full_season.py
│   ├── download_statsbomb_data.py
│   ├── check_data_status.py
│   ├── train_ml_models.py · train_xgboost.py · train_ensemble.py · ...
│   └── (other training/finetune scripts)
│
├── docs/                          Architecture & operational documentation
│   ├── architecture-overview.md
│   ├── backend-api.md
│   ├── data-ml-pipeline.md
│   ├── frontend.md
│   ├── frontend-restructure-plan.md
│   ├── known-issues-risks.md
│   └── setup-operations.md
│
├── start_tactix.sh                One-command launcher
├── requirements.txt               Backend Python deps
├── render.yaml                    Render service definition
├── vercel.json                    Vercel build config
├── Procfile                       Render start command
└── README.md                      You are here
```

---

## Local Development

### Manual Setup (alternative to `start_tactix.sh`)

#### 1. Clone

```bash
git clone https://github.com/haJ1t/Tactix.git
cd Tactix
```

#### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate              # Windows: venv\Scripts\activate
pip install -r ../requirements.txt
```

Create a `.env` (in repo root or `backend/`) — see [Configuration](#configuration).

```bash
python app.py
# → Running on http://0.0.0.0:5001
```

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → Local: http://localhost:3000
```

The dev server proxies `/api/*` to `http://localhost:5001` automatically (see `vite.config.ts`).

### Useful Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` (in `frontend/`) | Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint on `src/` |
| `npm run test` / `npm run test:watch` | Vitest |
| `python app.py` (in `backend/`) | Flask dev server |
| `pytest` (in `backend/`) | Run backend test suite |

---

## Deployment

Tactix uses a **split deployment**: Vercel for the static frontend bundle, Render for the Python backend. This split is required because the ML stack (CatBoost / XGBoost / LightGBM / sklearn / pandas / numpy) exceeds Vercel's 500MB Lambda size limit on its own.

### Backend on Render

1. **Push to GitHub.** Render's GitHub integration listens for new commits on `main`.
2. **Service definition** — `render.yaml`:
   ```yaml
   services:
     - type: web
       name: tactix-backend
       runtime: python
       plan: free
       buildCommand: pip install -r requirements.txt
       startCommand: cd backend && python app.py
       envVars:
         - key: PYTHON_VERSION
           value: 3.12.0
         - key: FRONTEND_URL
           sync: false
   ```
3. **Environment variables** to set in the Render dashboard:
   - `SECRET_KEY` — required, 32-byte hex (`python -c "import secrets; print(secrets.token_hex(32))"`)
   - `TACTIX_API_KEY` — optional, leave empty to disable header auth
   - `FRONTEND_URL` — optional. Backend already accepts every `*.vercel.app` host via regex; only set this if you have a custom domain
4. **Procfile** is also provided for buildpack compatibility:
   ```
   web: cd backend && python app.py
   ```
5. **Cold-start note.** Render free-tier services sleep after 15 minutes of inactivity. The first request after wake takes ~30 seconds.

### Frontend on Vercel

1. **Import the repo** into Vercel.
2. **Framework preset:** Vite (auto-detected).
3. **Root directory:** `frontend`.
4. **Build configuration** is held in `vercel.json`:
   ```json
   {
     "version": 2,
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "framework": "vite"
   }
   ```
5. **Environment variable**:
   - `VITE_API_BASE_URL` — set to `https://tactix-backend-jv55.onrender.com/api` (note the trailing `/api`).
6. **Deploy.** Vercel will run `tsc && vite build` and serve `dist/` from its CDN.

> ⚠️ **Vite env vars are inlined at build time.** If you change `VITE_API_BASE_URL`, you must trigger a fresh Vercel deploy — runtime override won't work.

### CORS & CSP Configuration

The backend allowlists:
- `http://localhost:3000`, `http://127.0.0.1:3000` (dev)
- Every `https://*.vercel.app` subdomain (regex)
- Optionally an exact `FRONTEND_URL` for custom domains
- A literal `*` if `FRONTEND_URL=*`

The frontend's `index.html` includes a CSP meta tag whose `connect-src` allowlists `https://*.onrender.com` plus localhost. If you back the API with a different host, update the CSP.

---

## Configuration

### Backend Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SECRET_KEY` | ✅ in production | — | Flask secret. Generate with `secrets.token_hex(32)`. |
| `FLASK_APP` | optional | `app.py` | — |
| `FLASK_ENV` | optional | `production` | Selects config class. |
| `DATABASE_URL` | optional | `sqlite:///../database/pass_network.db` | SQLAlchemy URI. Switch to PostgreSQL by replacing this. |
| `TACTIX_API_KEY` | optional | unset | If set, all `/api/*` routes (except `/health`) require `X-API-Key`. |
| `FRONTEND_URL` | optional | unset | Add a single CORS origin. Set to `*` to allow any. |
| `PORT` | optional | `5001` | Bind port (Render sets this). |

### Frontend Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_API_BASE_URL` | ✅ in production | `/api` | API base URL. Local dev proxies `/api` to `:5001`; in production point this at your Render URL **including** the `/api` suffix. |

### `.env` Template

A copy-pasteable starter is at `.env.example`:

```env
# Backend
FLASK_APP=app.py
FLASK_ENV=production
DATABASE_URL=sqlite:///../database/pass_network.db
SECRET_KEY=REPLACE_WITH_STRONG_SECRET_KEY_FROM_SECRETS_TOKEN_HEX_32
TACTIX_API_KEY=

# Frontend (placed in frontend/.env or frontend/.env.local)
VITE_API_URL=http://localhost:5001/api
```

---

## Database Management

The shipped sample is **80 matches, 41 teams, 882 players, ~298K events, ~82K passes** (89 MB) — chosen to fit under GitHub's 100 MB single-file limit while still showing the platform's range. Replace it with your own dataset whenever you like.

### Inspect Current State

```bash
python scripts/check_data_status.py
```

Prints the loaded vs. available competitions / seasons / matches.

### Load Additional StatsBomb Data

StatsBomb publishes free open data on GitHub. Tactix ships scripts to ingest it.

```bash
# 1. Pull raw event JSON locally
python scripts/download_statsbomb_data.py

# 2. List what's now available
python scripts/load_sample_data.py --list

# 3. Load a specific competition × season
#    (Euro 2024 example: competition 55, season 282)
python scripts/load_season.py --competition 55 --season 282

# 4. Or load every season of a competition
python scripts/load_full_season.py --competition 11   # La Liga
```

After ingest you should see new rows in `matches`, `events`, `passes`, etc. The frontend auto-reflects the new data on next refresh.

### Build Your Own Sample Subset

When pushing a smaller sample to a deployment without LFS, use a script like this to keep your DB under 100 MB:

```python
import sqlite3, os
SOURCE = "database/pass_network.db"   # full DB
TARGET = "database/sample.db"
N = 80
con = sqlite3.connect(TARGET); src = sqlite3.connect(SOURCE)
for (sql,) in src.execute("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL"):
    con.execute(sql)
con.execute("ATTACH ? AS src", (SOURCE,))
ids = ",".join(str(r[0]) for r in src.execute(
    f"SELECT match_id FROM matches ORDER BY match_date DESC LIMIT {N}"))
con.executescript(f"""
INSERT INTO matches SELECT * FROM src.matches WHERE match_id IN ({ids});
INSERT INTO teams   SELECT * FROM src.teams
  WHERE team_id IN (SELECT home_team_id FROM matches UNION SELECT away_team_id FROM matches);
INSERT INTO players SELECT * FROM src.players WHERE player_id IN
  (SELECT DISTINCT player_id FROM src.events WHERE match_id IN ({ids}));
INSERT INTO events  SELECT * FROM src.events  WHERE match_id IN ({ids});
INSERT INTO passes  SELECT p.* FROM src.passes p
  JOIN src.events e ON p.event_id = e.event_id WHERE e.match_id IN ({ids});
INSERT INTO network_metrics  SELECT * FROM src.network_metrics  WHERE match_id IN ({ids});
INSERT INTO tactical_patterns SELECT * FROM src.tactical_patterns WHERE match_id IN ({ids});
INSERT INTO report_artifacts  SELECT * FROM src.report_artifacts  WHERE match_id IN ({ids});
""")
con.commit(); con.execute("VACUUM"); con.close()
print(f"Sample size: {os.path.getsize(TARGET)/1e6:.1f} MB")
```

---

## Machine Learning Pipeline

`backend/services/ml/` houses a multi-model pipeline driven by `analysis_pipeline.py`.

### Models

| Module | Purpose | Backbone |
|--------|---------|----------|
| `tactical_classifier.py` | Identify recurring tactical patterns | LightGBM multi-class |
| `pass_difficulty_model.py` | Score per-pass difficulty / progression | XGBoost regression |
| `shot_metrics.py` | xG-style shot probability | CatBoost binary classifier |
| `vaep_model.py` | Per-action value estimation | Gradient-boosted offensive / defensive heads |
| `counter_tactic_engine.py` | Map detected pattern → counter recommendation | Rule-based + learned weights |
| `rich_features.py` | Feature engineering pipeline shared by all models | pandas |

### Training Scripts

`scripts/` contains entry points for retraining:

```bash
# Baseline ensemble across CatBoost / XGBoost / LightGBM
python scripts/train_ensemble.py

# Hyperparameter optimization with Optuna
python scripts/optuna_tuning.py --model xgboost --trials 100

# Hold-out cross-validation
python scripts/cross_validate_runtime_models.py

# Tactical pattern classifier
python scripts/train_tactical_classifier.py
```

Trained model artifacts land in `backend/services/ml/models/` with SHA-256 sidecar files. The runtime loader in `utils/security.py` verifies these hashes before unpickling — guarding against tampered model files in the deployment artifact.

### CatBoost Note

CatBoost training emits a `catboost_info/` directory at the project root (training logs, plots). It's `.gitignore`'d but stays useful locally for inspection.

---

## Testing

### Backend

```bash
cd backend
pytest                       # full suite
pytest -k "network"          # filter by name
pytest --cov=services        # coverage on services package
```

### Frontend

```bash
cd frontend
npm run test                 # one-shot
npm run test:watch           # watch mode
```

Tests live next to their subjects (`*.test.ts(x)`) and use **Vitest + Testing Library** with a JSDOM environment. Mocking convention: `vi.mock('@/services/api')` to stub axios calls; React Query is auto-disabled for retries inside tests.

---

## Troubleshooting

### "Overview unavailable" in the UI
The frontend can't reach the backend. Check, in order:
1. **Backend health** — `curl <BASE_URL>/api/health` should return `{"status":"healthy"}`.
2. **Browser DevTools → Network tab** — what status code do `/api/teams` and `/api/matches` return?
3. **CORS** — does the response include an `Access-Control-Allow-Origin` header for your frontend's origin?
4. **CSP** — does `index.html`'s `connect-src` include the backend host? (Look for `Refused to connect` in the Console.)
5. **`VITE_API_BASE_URL`** — is it set, including the `/api` suffix, and was the frontend rebuilt after changing it?

### `ValueError: SECRET_KEY` on Render
The backend refuses to start without a `SECRET_KEY` in production. Set it in Render → Environment.

### Database empty after deploy
Render free-tier rebuilds the filesystem on every deploy, so the DB is whatever your repo ships. If you want a persistent server-side DB:
- Either commit a richer sample subset (≤100 MB)
- Or migrate to PostgreSQL and set `DATABASE_URL` in Render

### Vercel build fails: "module not found `@/shared/lib/...`"
Some `.gitignore` patterns (`lib/`) accidentally exclude `frontend/src/shared/lib/`. The repo includes a negation rule (`!frontend/src/shared/lib/`) — if you forked an older version, re-add it.

### "Bundle size 1322 MB" on Vercel
Don't try to deploy the backend to Vercel. The ML stack alone exceeds the 500 MB Lambda limit. Backend goes to Render or any container host. Vercel only ships the frontend `dist/`.

### Render backend cold-start takes 30+ seconds
Render free-tier services sleep after inactivity. Either upgrade to a paid plan or implement a periodic warm-up ping (e.g., a cron job hitting `/api/health` every 10 minutes).

---

## Roadmap

- **PostgreSQL migration path** with read-replica support
- **Live ingestion** — webhook listener for in-progress matches
- **Player-tracking integration** (broadcast tracking → richer X/Y events)
- **Multi-tenant workspaces** with project-scoped report libraries
- **Cloud-storage offload** for trained model artifacts
- **GraphQL endpoint** alongside REST
- **Enhanced xG model** with tracking-data inputs
- **Internationalization** (UI i18n)

---

## Contributing

Contributions are welcome. The flow is:

1. Fork the repository and create a feature branch off `main`.
2. Run the existing test suites locally before opening a PR (backend `pytest`, frontend `npm run test` and `npm run lint`).
3. Match the existing code style — TypeScript strict mode for frontend, type hints for new Python.
4. Add tests for new behavior. Don't ship logic that has no test.
5. Open a PR with a clear summary, testing notes, and screenshots if there are UI changes.

For non-trivial proposals (new ML model, schema change, new feature module), open an issue first to align on direction.

---

## License & Credits

### Code
Tactix's source code is provided as a final-year project portfolio piece. All rights reserved by the project author unless otherwise specified.

### Data
This project consumes [**StatsBomb Open Data**](https://github.com/statsbomb/open-data), licensed under [**CC BY-SA 4.0**](https://creativecommons.org/licenses/by-sa/4.0/). Any redistribution of derived datasets or analyses must comply with the same license terms and credit StatsBomb.

### Acknowledgements
- **StatsBomb** for releasing one of the highest-quality open event datasets in the sport.
- **NetworkX**, **scikit-learn**, **CatBoost**, **XGBoost**, **LightGBM** — without these libraries this platform wouldn't exist.
- The football-analytics community on Twitter, GitHub, and Friends-of-Tracking for years of inspiration.

---

<div align="center">

**Built with ⚽ + 📊 + ☕**

If Tactix helped your work, a star on the repo is appreciated.

</div>
