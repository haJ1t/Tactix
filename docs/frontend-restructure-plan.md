# Frontend Restructure Plan

## Goal

Restructure the frontend so it feels like a product, not a collection of separate feature demos.

The main UX goals are:

- reduce page fragmentation
- make the match workflow feel unified
- separate discovery screens from deep-analysis screens
- improve maintainability through feature-based code organization
- create stable boundaries for data fetching, UI composition, and route ownership

## Current UX Problems

The current frontend has these structural issues:

- one match is spread across multiple screens (`/match/:id`, `/analysis/:id`, `/metrics`)
- `MatchesPage` mixes listing, aggregate team analysis, and match-level analysis
- advanced analyst tooling is exposed at the same level as basic user flows
- layout contains placeholder UX elements that are not tied to real product behavior
- reusable charting/components are not consistently reused
- page components own too much fetching, shaping, and presentation logic

## Proposed Product Navigation

Top-level navigation should become:

1. `Overview`
2. `Matches`
3. `Teams`
4. `Reports`

Optional later addition:

5. `Analyst Mode`

This keeps the main product understandable for end users while preserving room for deeper workflows.

## Proposed Route Tree

```text
/
  -> /overview

/overview
  Product summary dashboard

/matches
  Match library with search, filters, and quick actions

/matches/:matchId
  Match workspace shell
    /matches/:matchId/overview
    /matches/:matchId/network
    /matches/:matchId/players
    /matches/:matchId/tactics
    /matches/:matchId/shots
    /matches/:matchId/report

/teams
  Team library with filters and search

/teams/:teamId
  Team profile shell
    /teams/:teamId/overview
    /teams/:teamId/matches
    /teams/:teamId/players
    /teams/:teamId/patterns

/reports
  Saved reports list

/reports/:reportId
  Report viewer
```

## Screen Responsibilities

### 1. Overview

Purpose:

- give the user confidence that data is loaded
- show the latest usable content
- present 2-3 primary actions only

Recommended content:

- total matches
- total teams
- last analyzed match
- recently generated reports
- quick links:
  - browse matches
  - open latest report
  - continue last analysis

What should be removed:

- placeholder metrics with `-`
- fake activities not tied to real persisted events

### 2. Matches

Purpose:

- discovery screen only

Recommended content:

- search by team / competition / season
- table or card list of matches
- filter bar
- sort by date, competition, result
- CTA per row:
  - `Open Match`
  - `Analyze`

What should not happen here:

- running 5 match analyses automatically
- aggregate team-level analysis inside the same page

### 3. Match Workspace

Purpose:

- become the single source of truth for one match

This should replace the current split between:

- `MatchDetailsPage`
- `AnalysisSummaryPage`
- large parts of `MetricsPage`

Recommended tab layout:

- `Overview`
  - scoreline
  - possession/pass-share summary
  - quick insights
- `Network`
  - pass network graph
  - team switcher
  - node/edge metrics
- `Players`
  - key players
  - centrality tables
  - influence ranking
- `Tactics`
  - patterns
  - counter-tactics
  - tactical narrative summary
- `Shots`
  - xG
  - shot profile
  - chance-quality breakdown
- `Report`
  - export actions
  - preview of report payload

UX rule:

- if analysis does not exist yet, the workspace should show a single clear action: `Run Analysis`
- once analysis exists, all tabs reuse the same cached analysis resource

### 4. Teams

Purpose:

- team discovery and aggregate analysis

Recommended structure:

- `/teams` shows searchable team list
- `/teams/:teamId` becomes team detail

Team detail tabs:

- `Overview`
- `Matches`
- `Players`
- `Patterns`

This is where the current `MatchesPage` aggregate logic belongs, not inside a match list screen.

### 5. Reports

Purpose:

- move from temporary client-side export utility to a first-class user outcome

Recommended content:

- generated reports list
- report metadata
- open report
- export again
- delete/archive

Longer term:

- reports should be backend-backed, not only stored in in-memory page state

## Proposed `frontend/src` Structure

```text
frontend/src/
  app/
    layouts/
      AppShell.tsx
      WorkspaceShell.tsx
    providers/
      QueryProvider.tsx
      RouterProvider.tsx
    router/
      index.tsx
      route-config.tsx

  features/
    overview/
      pages/
        OverviewPage.tsx
      components/
        OverviewStats.tsx
        RecentActivity.tsx

    matches/
      pages/
        MatchesPage.tsx
        MatchWorkspacePage.tsx
      components/
        MatchFilters.tsx
        MatchList.tsx
        MatchHeader.tsx
      hooks/
        useMatches.ts
        useMatchWorkspace.ts

    teams/
      pages/
        TeamsPage.tsx
        TeamDetailsPage.tsx
      components/
        TeamList.tsx
        TeamOverviewPanel.tsx
        TeamMatchesPanel.tsx
      hooks/
        useTeams.ts
        useTeamDetails.ts

    analysis/
      components/
        AnalysisTabs.tsx
        NetworkPanel.tsx
        PlayersPanel.tsx
        TacticsPanel.tsx
        ShotsPanel.tsx
        AnalysisEmptyState.tsx
      hooks/
        useMatchAnalysis.ts
      lib/
        analysis-mappers.ts
        insight-builder.ts

    reports/
      pages/
        ReportsPage.tsx
        ReportDetailsPage.tsx
      components/
        ReportList.tsx
        ReportPreview.tsx
        ExportActions.tsx
      hooks/
        useReports.ts

  entities/
    match/
      model.ts
      types.ts
    team/
      model.ts
      types.ts
    player/
      model.ts
      types.ts
    analysis/
      model.ts
      types.ts

  shared/
    api/
      client.ts
      endpoints.ts
    ui/
      Button.tsx
      Card.tsx
      EmptyState.tsx
      ErrorState.tsx
      LoadingState.tsx
      Tabs.tsx
      DataTable.tsx
      FilterBar.tsx
    charts/
      PassNetworkGraph.tsx
      MetricBarChart.tsx
      ShotQualityChart.tsx
    hooks/
      useDebouncedValue.ts
    lib/
      format.ts
      dates.ts
      routes.ts
```

## Data-Fetching Architecture

The current page-level `useEffect + useState` pattern should be replaced with a query layer.

Recommended direction:

- TanStack Query for server state
- route-aware prefetching for match/team detail
- one cached analysis resource per match/team combination

Recommended query keys:

- `['matches', filters]`
- `['match', matchId]`
- `['match-analysis', matchId, teamId]`
- `['teams', filters]`
- `['team', teamId]`
- `['team-analysis', teamId]`
- `['reports']`
- `['report', reportId]`

## UI System Rules

To make the product feel more professional and stable:

- only show controls that actually work
- keep one shell layout across all authenticated app screens
- use one reusable `EmptyState`, `ErrorState`, and `LoadingState`
- use one reusable tab component for workspace/detail screens
- unify cards, tables, and filter bars under shared UI primitives
- remove duplicate D3 implementations

## Component Boundary Rules

### Page components should:

- own route params
- compose feature panels
- trigger high-level actions

### Feature hooks should:

- fetch and cache server data
- normalize API results
- expose a stable view model to UI

### Shared components should:

- stay domain-agnostic
- accept data through props only

### Entity layer should:

- hold types
- contain pure helpers, formatters, and selectors
- avoid UI rendering

## Migration Plan

### Phase 1: Information architecture cleanup

- replace current top-level nav with `Overview`, `Matches`, `Teams`, `Reports`
- keep existing pages but rename/reposition them
- hide `Metrics` from primary navigation

### Phase 2: Match workspace unification

- merge `MatchDetailsPage` and `AnalysisSummaryPage`
- move relevant `MetricsPage` panels into match workspace tabs
- standardize one analysis-loading flow

### Phase 3: Team area separation

- split team exploration out of `MatchesPage`
- create dedicated `TeamsPage` and `TeamDetailsPage`

### Phase 4: Shared frontend platform

- add query provider
- centralize API hooks
- create shared state/empty/loading/error components
- remove duplicate dashboard and duplicate network rendering

### Phase 5: Reporting maturity

- move reports toward backend persistence
- support named reports and report detail pages

## High-Impact Refactor Targets In The Current Codebase

Start with these files:

1. `frontend/src/App.tsx`
2. `frontend/src/pages/MatchesPage.tsx`
3. `frontend/src/pages/MatchDetailsPage.tsx`
4. `frontend/src/pages/AnalysisSummaryPage.tsx`
5. `frontend/src/pages/MetricsPage.tsx`
6. `frontend/src/pages/ReportsPage.tsx`
7. `frontend/src/components/layout/Header.tsx`
8. `frontend/src/components/layout/AppLayout.tsx`
9. `frontend/src/components/network/PassNetworkGraph.tsx`

## Acceptance Criteria

The restructure is successful when:

- a user can complete all match analysis work from one match workspace
- team exploration is separate from match exploration
- advanced analytics no longer fragment the main user flow
- page components become smaller and mostly compositional
- data fetching is cached and reused instead of repeatedly recomputed
- the UI shell contains only real, supported product actions
