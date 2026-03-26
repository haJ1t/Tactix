import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MatchWorkspacePage from '@/features/matches/pages/MatchWorkspacePage';
import MatchOverviewTab from '@/features/analysis/components/MatchOverviewTab';

const { getMatch, analyzeMatchML } = vi.hoisted(() => ({
    getMatch: vi.fn(),
    analyzeMatchML: vi.fn(),
}));

vi.mock('@/services/matchService', () => ({
    matchService: {
        getMatches: vi.fn(),
        getMatch,
        getNetwork: vi.fn(),
        analyzeMatch: vi.fn(),
        analyzeMatchML,
    },
}));

const renderWorkspace = (route = '/matches/1/overview') => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>
                <Routes>
                    <Route path="/matches/:matchId" element={<MatchWorkspacePage />}>
                        <Route path="overview" element={<MatchOverviewTab />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
};

describe('MatchWorkspacePage', () => {
    it('shows a manual run-analysis state and reuses the result after triggering analysis', async () => {
        getMatch.mockResolvedValue({
            match_id: 1,
            home_team: { team_id: 10, team_name: 'Alpha' },
            away_team: { team_id: 20, team_name: 'Beta' },
            match_date: '2025-01-01',
            competition: 'League',
            season: '2024/25',
            home_score: 2,
            away_score: 1,
        });

        analyzeMatchML.mockResolvedValue({
            match_id: 1,
            analysis: {
                Alpha: {
                    network_statistics: {
                        density: 0.5,
                        num_nodes: 11,
                        num_edges: 25,
                        total_passes: 420,
                        avg_clustering: 0.3,
                        avg_path_length: 2.1,
                        reciprocity: 0.52,
                    },
                    player_metrics: [],
                    patterns: [],
                    counter_tactics: [],
                    top_players: [],
                    shot_summary: {
                        total_shots: 10,
                        xg_total: 1.2,
                        xg_per_shot: 0.12,
                        avg_shot_distance: 18,
                        avg_shot_angle: 22,
                        high_xg_shots: 3,
                    },
                },
                Beta: {
                    network_statistics: {
                        density: 0.4,
                        num_nodes: 11,
                        num_edges: 20,
                        total_passes: 300,
                        avg_clustering: 0.25,
                        avg_path_length: 2.3,
                        reciprocity: 0.47,
                    },
                    player_metrics: [],
                    patterns: [],
                    counter_tactics: [],
                    top_players: [],
                    shot_summary: {
                        total_shots: 8,
                        xg_total: 0.8,
                        xg_per_shot: 0.1,
                        avg_shot_distance: 20,
                        avg_shot_angle: 18,
                        high_xg_shots: 2,
                    },
                },
            },
        });

        renderWorkspace();

        await waitFor(() => expect(screen.getAllByText('Run Analysis')[0]).toBeInTheDocument());
        await userEvent.click(screen.getAllByText('Run Analysis')[0]);

        await waitFor(() => expect(screen.getByText('420')).toBeInTheDocument());
        expect(analyzeMatchML).toHaveBeenCalledTimes(1);
    });
});
