import axios from 'axios';
import api from '@/services/api';
import type { LegacyStoredReport, ReportArtifactDetails, ReportArtifactSummary } from '@/features/reports/types';

export const reportService = {
    async listReports(): Promise<ReportArtifactSummary[]> {
        const response = await api.get('/reports');
        return response.data.reports || [];
    },

    async getReport(reportId: string): Promise<ReportArtifactDetails | null> {
        try {
            const response = await api.get(`/reports/${reportId}`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    },

    async createReport(matchId: number): Promise<ReportArtifactDetails> {
        const response = await api.post('/reports', { match_id: matchId });
        return response.data;
    },

    async importLegacyReport(legacyReport: LegacyStoredReport): Promise<ReportArtifactDetails> {
        const response = await api.post('/reports/import-legacy', { legacy_report: legacyReport });
        return response.data;
    },

    async deleteReport(reportId: string): Promise<string> {
        await api.delete(`/reports/${reportId}`);
        return reportId;
    },

    getDownloadUrl(reportId: string): string {
        return `/api/reports/${reportId}/download`;
    },
};
