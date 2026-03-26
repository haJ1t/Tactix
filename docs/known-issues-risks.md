# Known Issues and Risks

This list summarizes the main technical risks identified while reviewing the codebase. These are not generic refactor ideas; they are places where the current implementation introduces inconsistency, fragility, or maintenance risk.

## 1. Undefined `shot_summary` in the ML analysis route

File: `backend/api/match_routes.py`

`analyze_match_ml` adds `shot_summary` to the result payload, but there is no visible assignment to that variable inside the route. In its current form, the route is at risk of failing with `NameError` after a successful analysis run.

Impact:

- The frontend heavily depends on `analyzeMatchML`, so this is a broad runtime risk.

## 2. Pattern and counter-tactic read/write flows are inconsistent

Files:

- `backend/api/match_routes.py`
- `backend/api/analysis_routes.py`

The analysis routes compute patterns and tactics and return them in the response, but they do not persist them into `TacticalPattern` or `CounterTactic`. Meanwhile, `analysis_routes.py` reads from those tables.

Impact:

- `/api/analysis/<match_id>/patterns`
- `/api/analysis/<match_id>/countertactics`

may return empty or stale data.

## 3. Classic analysis and ML analysis do not share a stable response contract

Examples:

- Classic analysis does not return `shot_summary` on success.
- ML analysis is intended to return `shot_summary`.
- Classic analysis returns `top_players`.
- ML analysis returns `vaep_summary`, `network_features`, `summary`, and `ml_info`.

Impact:

- It is harder to maintain a single client-side response model across both flows.

## 4. Test coverage is effectively absent

Observation:

- `backend/tests/` contains no meaningful test suite.
- `pytest` is not installed in the current environment.

Impact:

- Route behavior, metric calculations, and ML pipeline changes are exposed to regression risk.

## 5. Analysis is synchronous and heavy inside request handlers

Frontend behavior:

- `MatchesPage` triggers up to five ML analyses in sequence when a team is selected.
- `AnalysisSummaryPage` automatically runs ML analysis on page load.
- `MetricsPage` runs ML analysis when a match is selected.

Impact:

- slow screen transitions on larger datasets
- timeout risk
- increased backend CPU pressure

## 6. Runtime dependencies and training dependencies diverge

Examples used in scripts but missing from `requirements.txt`:

- `xgboost`
- `lightgbm`
- `torch`

Impact:

- A new environment may be able to run the backend but still fail to run all training scripts.

## 7. Duplicate or likely legacy code exists in the frontend

Examples:

- `MatchDetailsPage` contains its own D3 network renderer.
- `components/network/PassNetworkGraph.tsx` already provides a reusable network renderer.
- `components/dashboard/Dashboard.tsx` is not used by the current router.

Impact:

- UI behavior drift
- repeated maintenance effort
- higher risk of dead code during refactors

## 8. The styling system is hybrid

The frontend currently mixes:

- custom global CSS
- page-specific class naming
- Tailwind config
- utility-class usage

Impact:

- the design system is not centralized
- maintaining visual consistency becomes harder as the app grows

## 9. Generated directories are present in the workspace

Observed directories:

- `frontend/node_modules`
- `frontend/dist`
- `backend/venv`

Note:

Full git status verification could not be completed because of sandbox/LFS restrictions. Even so, the presence of generated directories in the workspace should be reviewed for repository hygiene and portability.

## Recommended Priority Order

1. Fix the `analyze_match_ml` route bug.
2. Decide how pattern and counter-tactic persistence should work.
3. Standardize the analysis response contract.
4. Add baseline route and service tests.
5. Reduce request-time analysis load with queueing and/or caching.
