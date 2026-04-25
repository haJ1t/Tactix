import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamOverviewTab from '@/features/teams/components/TeamOverviewTab';
import TeamMatchesTab from '@/features/teams/components/TeamMatchesTab';
import TeamDetailsPage from '@/features/teams/pages/TeamDetailsPage';
import TeamsPage from '@/features/teams/pages/TeamsPage';

const { getTeams, getTeam, getMatches, analyzeMatchML } = vi.hoisted(() => ({
    getTeams: vi.fn(),
    getTeam: vi.fn(),
    getMatches: vi.fn(),
    analyzeMatchML: vi.fn(),
}));

vi.mock('@/services/teamService', () => ({
    teamService: {
        getTeams,
        getTeam,
        getTeamMetrics: vi.fn(),
    },
}));

vi.mock('@/services/matchService', () => ({
    matchService: {
        getMatches,
        getMatch: vi.fn(),
        getNetwork: vi.fn(),
        analyzeMatch: vi.fn(),
        analyzeMatchML,
    },
}));

const teamCatalog = {
    teams: [
        { team_id: 10, team_name: 'Arsenal', country: 'England' },
        { team_id: 20, team_name: 'Chelsea', country: 'England' },
        { team_id: 30, team_name: 'Spain', country: 'Spain' },
    ],
};

const matchesCatalog = {
    matches: [
        {
            match_id: 1,
            home_team: { team_id: 10, team_name: 'Arsenal' },
            away_team: { team_id: 20, team_name: 'Chelsea' },
            match_date: '2024-05-01',
            competition: 'Premier League',
            season: '2023/24',
            home_score: 2,
            away_score: 1,
        },
        {
            match_id: 2,
            home_team: { team_id: 10, team_name: 'Arsenal' },
            away_team: { team_id: 20, team_name: 'Chelsea' },
            match_date: '2025-02-01',
            competition: 'Premier League',
            season: '2024/25',
            home_score: 1,
            away_score: 1,
        },
        {
            match_id: 3,
            home_team: { team_id: 30, team_name: 'Spain' },
            away_team: { team_id: 20, team_name: 'Chelsea' },
            match_date: '2025-03-01',
            competition: 'Friendly',
            season: '2024',
            home_score: 3,
            away_score: 0,
        },
    ],
    count: 3,
};

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

const renderTeamWorkspace = (route: string) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>
                <Routes>
                    <Route path="/teams/:teamId" element={<TeamDetailsPage />}>
                        <Route path="overview" element={<TeamOverviewTab />} />
                        <Route path="matches" element={<TeamMatchesTab />} />
                    </Route>
                </Routes>
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>
    );
};

beforeEach(() => {
    getTeams.mockReset();
    getTeam.mockReset();
    getMatches.mockReset();
    analyzeMatchML.mockReset();

    getTeams.mockResolvedValue(teamCatalog);
    getTeam.mockResolvedValue({
        team_id: 10,
        team_name: 'Arsenal',
        country: 'England',
    });
    getMatches.mockResolvedValue(matchesCatalog);
    analyzeMatchML.mockImplementation(async (matchId: number) => ({
        match_id: matchId,
        analysis: {
            Arsenal: {
                network_statistics: {
                    density: matchId === 1 ? 0.42 : 0.57,
                    num_nodes: 11,
                    num_edges: 18,
                    total_passes: matchId === 1 ? 280 : 410,
                    avg_clustering: 0.31,
                    avg_path_length: 2.1,
                    reciprocity: 0.5,
                },
                player_metrics: [
                    {
                        metric_id: matchId,
                        match_id: matchId,
                        team_id: 10,
                        player_id: 7,
                        player_name: 'Bukayo Saka',
                        degree_centrality: 0.6,
                        in_degree_centrality: 0.4,
                        out_degree_centrality: 0.5,
                        betweenness_centrality: 0.35,
                        pagerank: 0.18,
                        closeness_centrality: 0.55,
                        clustering_coefficient: 0.28,
                        in_degree: 9,
                        out_degree: 11,
                        avg_x: 62,
                        avg_y: 38,
                    },
                ],
                patterns: [
                    {
                        pattern_type: matchId === 1 ? 'left_overload' : 'right_overload',
                        confidence_score: 0.8,
                        description: 'Pattern',
                    },
                ],
                counter_tactics: [
                    {
                        tactic_type: 'press_wide',
                        recommendation: 'Force wide circulation',
                        priority: 1,
                    },
                ],
                top_players: [],
                shot_summary: {
                    total_shots: 10,
                    xg_total: 1.2,
                    xg_per_shot: 0.12,
                    avg_shot_distance: 18,
                    avg_shot_angle: 20,
                    high_xg_shots: 2,
                },
            },
        },
    }));
});

describe('Teams season scoping', () => {
    it('renders the same team as separate season entries in the teams catalog', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false, gcTime: 0 },
            },
        });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <TeamsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => expect(screen.getAllByText('Arsenal')).toHaveLength(2));
        expect(screen.getAllByText('2023/24').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2024/25').length).toBeGreaterThan(0);
        expect(screen.getByText('6 season entries')).toBeInTheDocument();
    });

    it('redirects to the latest season when no season query is provided and waits for manual analysis', async () => {
        renderTeamWorkspace('/teams/10/overview');

        await waitFor(() =>
            expect(decodeURIComponent(screen.getByTestId('location').textContent || '')).toBe('/teams/10/overview?season=2024/25')
        );

        await waitFor(() => expect(screen.getByText('Season')).toBeInTheDocument());
        expect(screen.getAllByText('2024/25').length).toBeGreaterThan(0);
        expect(screen.getByText('Sample ML Analysis Is Manual')).toBeInTheDocument();
        expect(analyzeMatchML).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: 'Run Sample Analysis' }));

        await waitFor(() => expect(analyzeMatchML).toHaveBeenCalledTimes(1));
        expect(analyzeMatchML).toHaveBeenCalledTimes(1);
        expect(analyzeMatchML).toHaveBeenCalledWith(2, 10);
    });

    it('preserves the season query while switching team tabs', async () => {
        renderTeamWorkspace('/teams/10/overview?season=2023/24');

        await waitFor(() =>
            expect(decodeURIComponent(screen.getByTestId('location').textContent || '')).toBe('/teams/10/overview?season=2023/24')
        );

        await userEvent.click(await screen.findByRole('link', { name: 'Matches' }));

        await waitFor(() =>
            expect(decodeURIComponent(screen.getByTestId('location').textContent || '')).toBe('/teams/10/matches?season=2023/24')
        );
        expect(screen.getByText('2023/24 · 1 matches')).toBeInTheDocument();
        expect(analyzeMatchML).not.toHaveBeenCalled();
    });
});
