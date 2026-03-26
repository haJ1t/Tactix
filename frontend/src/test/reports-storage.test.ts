import { beforeEach, describe, expect, it } from 'vitest';
import {
    REPORTS_STORAGE_KEY,
    createStoredReport,
    deleteStoredReport,
    readStoredReports,
    saveStoredReport,
} from '@/shared/lib/reports-storage';

describe('reports storage', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('saves, reads, and deletes reports from localStorage', () => {
        const report = createStoredReport({
            match: {
                match_id: 10,
                home_team: { team_id: 1, team_name: 'Home' },
                away_team: { team_id: 2, team_name: 'Away' },
                match_date: '2025-01-01',
                competition: 'League',
                season: '2024/25',
                home_score: 2,
                away_score: 1,
            },
            homeAnalysis: null,
            awayAnalysis: null,
        });

        saveStoredReport(report);

        expect(readStoredReports()).toHaveLength(1);
        expect(JSON.parse(window.localStorage.getItem(REPORTS_STORAGE_KEY) || '[]')).toHaveLength(1);

        deleteStoredReport(report.id);

        expect(readStoredReports()).toHaveLength(0);
    });
});
