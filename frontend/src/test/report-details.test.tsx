import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportDetailsPage from '@/features/reports/pages/ReportDetailsPage';
import { render } from '@testing-library/react';
import { reportService } from '@/features/reports/services/reportService';

describe('ReportDetailsPage', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    // Test missing report empty state
    it('shows a controlled empty state when the report is missing', async () => {
        vi.spyOn(reportService, 'getReport').mockResolvedValue(null);

        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false, gcTime: 0 },
            },
        });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/reports/missing']}>
                    <Routes>
                        <Route path="/reports/:reportId" element={<ReportDetailsPage />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(await screen.findByText('Report not found')).toBeInTheDocument();
    });
});
