import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import AppShell from '@/app/layouts/AppShell';
import OverviewPage from '@/features/overview/pages/OverviewPage';
import MatchesPage from '@/features/matches/pages/MatchesPage';
import MatchWorkspacePage from '@/features/matches/pages/MatchWorkspacePage';
import MatchOverviewTab from '@/features/analysis/components/MatchOverviewTab';
import MatchNetworkTab from '@/features/analysis/components/MatchNetworkTab';
import MatchPlayersTab from '@/features/analysis/components/MatchPlayersTab';
import MatchTacticsTab from '@/features/analysis/components/MatchTacticsTab';
import MatchShotsTab from '@/features/analysis/components/MatchShotsTab';
import MatchReportTab from '@/features/analysis/components/MatchReportTab';
import TeamsPage from '@/features/teams/pages/TeamsPage';
import TeamDetailsPage from '@/features/teams/pages/TeamDetailsPage';
import TeamOverviewTab from '@/features/teams/components/TeamOverviewTab';
import TeamMatchesTab from '@/features/teams/components/TeamMatchesTab';
import TeamPlayersTab from '@/features/teams/components/TeamPlayersTab';
import TeamPatternsTab from '@/features/teams/components/TeamPatternsTab';
import ReportsPage from '@/features/reports/pages/ReportsPage';
import ReportDetailsPage from '@/features/reports/pages/ReportDetailsPage';

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

            <Route element={<AppShell />}>
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/matches/:matchId" element={<MatchWorkspacePage />}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<MatchOverviewTab />} />
                    <Route path="network" element={<MatchNetworkTab />} />
                    <Route path="players" element={<MatchPlayersTab />} />
                    <Route path="tactics" element={<MatchTacticsTab />} />
                    <Route path="shots" element={<MatchShotsTab />} />
                    <Route path="report" element={<MatchReportTab />} />
                </Route>

                <Route path="/teams" element={<TeamsPage />} />
                <Route path="/teams/:teamId" element={<TeamDetailsPage />}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<TeamOverviewTab />} />
                    <Route path="matches" element={<TeamMatchesTab />} />
                    <Route path="players" element={<TeamPlayersTab />} />
                    <Route path="patterns" element={<TeamPatternsTab />} />
                </Route>

                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/reports/:reportId" element={<ReportDetailsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
    );
}
