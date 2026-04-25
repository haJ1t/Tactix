import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { LoadingState } from '@/shared/ui/LoadingState';

const AppShell = lazy(() => import('@/app/layouts/AppShell'));
const OverviewPage = lazy(() => import('@/features/overview/pages/OverviewPage'));
const MatchesPage = lazy(() => import('@/features/matches/pages/MatchesPage'));
const MatchWorkspacePage = lazy(() => import('@/features/matches/pages/MatchWorkspacePage'));
const MatchOverviewTab = lazy(() => import('@/features/analysis/components/MatchOverviewTab'));
const MatchNetworkTab = lazy(() => import('@/features/analysis/components/MatchNetworkTab'));
const MatchPlayersTab = lazy(() => import('@/features/analysis/components/MatchPlayersTab'));
const MatchTacticsTab = lazy(() => import('@/features/analysis/components/MatchTacticsTab'));
const MatchShotsTab = lazy(() => import('@/features/analysis/components/MatchShotsTab'));
const MatchReportTab = lazy(() => import('@/features/analysis/components/MatchReportTab'));
const TeamsPage = lazy(() => import('@/features/teams/pages/TeamsPage'));
const TeamDetailsPage = lazy(() => import('@/features/teams/pages/TeamDetailsPage'));
const TeamOverviewTab = lazy(() => import('@/features/teams/components/TeamOverviewTab'));
const TeamMatchesTab = lazy(() => import('@/features/teams/components/TeamMatchesTab'));
const TeamPlayersTab = lazy(() => import('@/features/teams/components/TeamPlayersTab'));
const TeamPatternsTab = lazy(() => import('@/features/teams/components/TeamPatternsTab'));
const ReportsPage = lazy(() => import('@/features/reports/pages/ReportsPage'));
const ReportDetailsPage = lazy(() => import('@/features/reports/pages/ReportDetailsPage'));

const withSuspense = (element: ReactNode) => (
    <Suspense fallback={<LoadingState title="Loading view" description="Preparing the next workspace." compact />}>
        {element}
    </Suspense>
);

function LegacyMatchRedirect() {
    const { matchId } = useParams<{ matchId: string }>();
    return <Navigate to={`/matches/${matchId}/overview`} replace />;
}

function LegacyAnalysisRedirect() {
    const { matchId } = useParams<{ matchId: string }>();
    return <Navigate to={`/matches/${matchId}/overview`} replace />;
}

export function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
            <Route path="/match/:matchId" element={<LegacyMatchRedirect />} />
            <Route path="/analysis/:matchId" element={<LegacyAnalysisRedirect />} />
            <Route path="/metrics" element={<Navigate to="/matches" replace />} />

            <Route element={withSuspense(<AppShell />)}>
                <Route path="/overview" element={withSuspense(<OverviewPage />)} />
                <Route path="/matches" element={withSuspense(<MatchesPage />)} />
                <Route path="/matches/:matchId" element={withSuspense(<MatchWorkspacePage />)}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={withSuspense(<MatchOverviewTab />)} />
                    <Route path="network" element={withSuspense(<MatchNetworkTab />)} />
                    <Route path="players" element={withSuspense(<MatchPlayersTab />)} />
                    <Route path="tactics" element={withSuspense(<MatchTacticsTab />)} />
                    <Route path="shots" element={withSuspense(<MatchShotsTab />)} />
                    <Route path="report" element={withSuspense(<MatchReportTab />)} />
                </Route>

                <Route path="/teams" element={withSuspense(<TeamsPage />)} />
                <Route path="/teams/:teamId" element={withSuspense(<TeamDetailsPage />)}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={withSuspense(<TeamOverviewTab />)} />
                    <Route path="matches" element={withSuspense(<TeamMatchesTab />)} />
                    <Route path="players" element={withSuspense(<TeamPlayersTab />)} />
                    <Route path="patterns" element={withSuspense(<TeamPatternsTab />)} />
                </Route>

                <Route path="/reports" element={withSuspense(<ReportsPage />)} />
                <Route path="/reports/:reportId" element={withSuspense(<ReportDetailsPage />)} />
            </Route>

            <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
    );
}
