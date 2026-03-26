import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/overview/pages/OverviewPage', () => ({
    default: () => <div>Overview Page</div>,
}));

vi.mock('@/features/matches/pages/MatchesPage', () => ({
    default: () => <div>Matches Page</div>,
}));

vi.mock('@/features/matches/pages/MatchWorkspacePage', () => ({
    default: () => <div>Match Workspace</div>,
}));

vi.mock('@/features/analysis/components/MatchOverviewTab', () => ({
    default: () => <div>Match Overview Tab</div>,
}));

vi.mock('@/features/analysis/components/MatchNetworkTab', () => ({
    default: () => <div>Match Network Tab</div>,
}));

vi.mock('@/features/analysis/components/MatchPlayersTab', () => ({
    default: () => <div>Match Players Tab</div>,
}));

vi.mock('@/features/analysis/components/MatchTacticsTab', () => ({
    default: () => <div>Match Tactics Tab</div>,
}));

vi.mock('@/features/analysis/components/MatchShotsTab', () => ({
    default: () => <div>Match Shots Tab</div>,
}));

vi.mock('@/features/analysis/components/MatchReportTab', () => ({
    default: () => <div>Match Report Tab</div>,
}));

vi.mock('@/features/teams/pages/TeamsPage', () => ({
    default: () => <div>Teams Page</div>,
}));

vi.mock('@/features/teams/pages/TeamDetailsPage', () => ({
    default: () => <div>Team Details</div>,
}));

vi.mock('@/features/teams/components/TeamOverviewTab', () => ({
    default: () => <div>Team Overview</div>,
}));

vi.mock('@/features/teams/components/TeamMatchesTab', () => ({
    default: () => <div>Team Matches</div>,
}));

vi.mock('@/features/teams/components/TeamPlayersTab', () => ({
    default: () => <div>Team Players</div>,
}));

vi.mock('@/features/teams/components/TeamPatternsTab', () => ({
    default: () => <div>Team Patterns</div>,
}));

vi.mock('@/features/reports/pages/ReportsPage', () => ({
    default: () => <div>Reports Page</div>,
}));

vi.mock('@/features/reports/pages/ReportDetailsPage', () => ({
    default: () => <div>Report Details</div>,
}));

import { AppRoutes } from '@/app/router/route-config';

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="path">{location.pathname}</div>;
}

const renderRoutes = (route: string) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>
                <AppRoutes />
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>
    );
};

describe('route redirects', () => {
    it('redirects root and dashboard to overview', () => {
        renderRoutes('/');
        expect(screen.getByTestId('path')).toHaveTextContent('/overview');

        renderRoutes('/dashboard');
        expect(screen.getAllByTestId('path')[1]).toHaveTextContent('/overview');
    });

    it('redirects legacy match routes to the new workspace overview', () => {
        renderRoutes('/match/42');
        expect(screen.getByTestId('path')).toHaveTextContent('/matches/42/overview');
    });

    it('redirects legacy analysis routes to the new workspace overview', () => {
        renderRoutes('/analysis/77');
        expect(screen.getByTestId('path')).toHaveTextContent('/matches/77/overview');
    });

    it('redirects metrics to matches', () => {
        renderRoutes('/metrics');
        expect(screen.getByTestId('path')).toHaveTextContent('/matches');
    });
});
