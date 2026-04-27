import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildReportListItems } from '@/features/reports/model';
import { reportService } from '@/features/reports/services/reportService';
import type { LegacyStoredReport, ReportArtifactDetails, ReportDetailsResult, ReportListItem } from '@/features/reports/types';
import { queryKeys } from '@/shared/api/queryKeys';
import { getStoredReport, readStoredReports } from '@/shared/lib/reports-storage';

// Combined hook for backend and legacy reports
export const useReports = () => {
    // Backend-stored PDF reports
    const generatedQuery = useQuery({
        queryKey: queryKeys.reports(),
        queryFn: () => reportService.listReports(),
        initialData: [],
    });

    // Browser-saved legacy reports
    const legacyQuery = useQuery({
        queryKey: queryKeys.legacyReports(),
        queryFn: async () => readStoredReports(),
        initialData: [],
    });

    // Merge sources into one list
    const data = useMemo<ReportListItem[]>(
        () => buildReportListItems(generatedQuery.data || [], legacyQuery.data || []),
        [generatedQuery.data, legacyQuery.data]
    );

    return {
        ...generatedQuery,
        data,
        generatedReports: generatedQuery.data || [],
        legacyReports: legacyQuery.data || [],
        isLoading: generatedQuery.isLoading || legacyQuery.isLoading,
        isFetching: generatedQuery.isFetching || legacyQuery.isFetching,
        isError: generatedQuery.isError || legacyQuery.isError,
        refetch: async () => {
            await Promise.all([generatedQuery.refetch(), legacyQuery.refetch()]);
        },
    };
};

// Fetch one report (artifact or legacy)
export const useReport = (reportId: string | null) => {
    const artifactQuery = useQuery({
        queryKey: reportId ? queryKeys.report(reportId) : ['report', 'empty'],
        queryFn: () => reportService.getReport(reportId as string),
        enabled: Boolean(reportId),
    });

    const legacyQuery = useQuery({
        queryKey: reportId ? queryKeys.legacyReport(reportId) : ['legacy-report', 'empty'],
        queryFn: async () => getStoredReport(reportId as string),
        enabled: Boolean(reportId),
    });

    // Prefer artifact, fall back to legacy
    const data = useMemo<ReportDetailsResult | null>(() => {
        if (artifactQuery.data) {
            return { kind: 'artifact', artifact: artifactQuery.data as ReportArtifactDetails };
        }

        if (legacyQuery.data) {
            return { kind: 'legacy', legacy: legacyQuery.data as LegacyStoredReport };
        }

        return null;
    }, [artifactQuery.data, legacyQuery.data]);

    return {
        ...artifactQuery,
        data,
        isLoading: artifactQuery.isLoading || legacyQuery.isLoading,
        isFetching: artifactQuery.isFetching || legacyQuery.isFetching,
        isError: artifactQuery.isError || legacyQuery.isError,
    };
};

// Generate a new backend report
export const useGenerateReport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (matchId: number) => reportService.createReport(matchId),
        onSuccess: (report) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.reports() });
            queryClient.setQueryData(queryKeys.report(report.id), report);
        },
    });
};

// Convert legacy report into backend artifact
export const useImportLegacyReport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (legacyReport: LegacyStoredReport) => reportService.importLegacyReport(legacyReport),
        onSuccess: (report) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.reports() });
            queryClient.setQueryData(queryKeys.report(report.id), report);
        },
    });
};

// Delete a backend report
export const useDeleteReport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (reportId: string) => reportService.deleteReport(reportId),
        onSuccess: (reportId) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.reports() });
            queryClient.removeQueries({ queryKey: queryKeys.report(reportId) });
        },
    });
};
