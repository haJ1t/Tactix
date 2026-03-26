import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatchesPage from '@/features/matches/pages/MatchesPage';
import { renderWithProviders } from '@/test/renderWithProviders';

const { getMatches, analyzeMatchML } = vi.hoisted(() => ({
    getMatches: vi.fn(),
    analyzeMatchML: vi.fn(),
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

describe('MatchesPage', () => {
    it('does not auto-run analysis when the page renders', async () => {
        getMatches.mockResolvedValue({
            matches: [
                {
                    match_id: 1,
                    home_team: { team_id: 10, team_name: 'Alpha' },
                    away_team: { team_id: 20, team_name: 'Beta' },
                    match_date: '2025-01-01',
                    competition: 'League',
                    season: '2024/25',
                    home_score: 2,
                    away_score: 1,
                },
            ],
            count: 1,
        });

        renderWithProviders(<MatchesPage />);

        await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
        expect(analyzeMatchML).not.toHaveBeenCalled();
    });
});
