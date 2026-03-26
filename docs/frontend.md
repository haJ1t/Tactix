# Frontend Documentation

## Frontend Summary

The frontend is built with React 18 + Vite + TypeScript. API access is handled through Axios-based service modules, and route management is handled through `react-router-dom`.

## Runtime Structure

- Entry point: `frontend/src/main.tsx`
- Router: `frontend/src/App.tsx`
- API client: `frontend/src/services/api.ts`
- Proxy config: `frontend/vite.config.ts`

In development, Vite proxies `/api` requests to `http://localhost:5001`.

## Page Map

| Route | Page | Role |
| --- | --- | --- |
| `/dashboard` | `DashboardPage` | General stats, recent activity, quick actions |
| `/matches` | `MatchesPage` | Team selection, aggregate team analysis, match-level analysis |
| `/match/:matchId` | `MatchDetailsPage` | Match details, ML analysis trigger, pass-network rendering |
| `/analysis/:matchId` | `AnalysisSummaryPage` | ML analysis summary for a selected match |
| `/metrics` | `MetricsPage` | Match-level comparison, generated insights, CSV/PDF export |
| `/reports` | `ReportsPage` | JSON report generation and export |

## Layout Layer

The shared application shell is composed of:

- `AppLayout`: wrapper for sidebar, header, and page content
- `Sidebar`: main navigation
- `Header`: page title, search field, notification icon, user profile

## Service Layer

### `matchService`

- `getMatches()`
- `getMatch(matchId)`
- `getNetwork(matchId, teamId?)`
- `analyzeMatch(matchId, teamId?)`
- `analyzeMatchML(matchId, teamId?)`

### `analysisService`

- `getMetrics()`
- `getPatterns()`
- `getCounterTactics()`
- `getTopPlayers()`

### `teamService`

- `getTeams()`
- `getTeam(teamId)`
- `getTeamMetrics(teamId, matchId?)`

## Page-Level Behavior

### DashboardPage

- Loads match and team counts.
- Derives recent activity from the first five matches.
- Exposes quick action cards for navigation into the main workflows.

### MatchesPage

- Splits teams into "National Teams" and "Club Teams".
- The split heuristic is `team_name == country`.
- When a team is selected, it triggers up to five sequential `analyzeMatchML` calls.
- It aggregates the results into a team summary:
  - wins/draws/losses
  - total passes
  - average density/clustering/reciprocity
  - key players
  - frequent patterns
  - frequent counter-tactic types

### MatchDetailsPage

- Initially loads only match metadata.
- The "Analyze" button triggers ML analysis.
- After analysis completes, it separately fetches network data for the selected team.
- The pass network is drawn inline with D3 in the page component.

### AnalysisSummaryPage

- Automatically calls `analyzeMatchML` when the page loads.
- Allows switching between home and away team views.
- Displays for the current team:
  - key metrics
  - key players
  - pattern list
  - counter-tactic summaries

### MetricsPage

- Functions as a match-comparison lab.
- Caches ML analysis responses once a match is selected.
- Generates insights from pass share, density, reciprocity, xG, and shot-quality differences.
- Supports PDF export via `jsPDF` and CSV export via string generation.

### ReportsPage

- Lets the user generate a report from an ML analysis result.
- Stores generated reports in client-side state only.
- Exports reports as JSON.

## Component Notes

### `PassNetworkGraph`

- This is a reusable D3-based network component.
- `MatchDetailsPage` does not reuse it and instead contains a second custom D3 implementation.
- That increases the risk of visual and behavioral drift.

### `Dashboard` component

- `frontend/src/components/dashboard/Dashboard.tsx` exists.
- The current router does not use it; the active dashboard route uses `DashboardPage`.
- This file should be treated as legacy or partially migrated code.

## Styling System

The frontend currently uses a mixed styling approach:

- `globals.css`
- `index.css`
- Tailwind config
- utility classes in some components

This is workable for rapid iteration, but it increases maintenance cost if the app is expected to converge on a single design system.

## Acceptance Check

After reading this document, a frontend engineer should quickly understand:

- which screens use which endpoints
- where analysis flows are triggered
- which screens support export
- where the layout boundary ends and reusable components begin
