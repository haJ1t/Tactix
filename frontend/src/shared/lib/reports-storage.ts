import type { Match } from '@/entities/match';
import type { TeamAnalysis } from '@/entities/analysis';

export const REPORTS_STORAGE_KEY = 'tactix_reports_v1';

export interface StoredReport {
    id: string;
    matchId: number;
    createdAt: string;
    matchSummary: {
        homeTeam: string;
        awayTeam: string;
        score: string;
        competition: string;
        matchDate: string;
    };
    homeAnalysis: TeamAnalysis | null;
    awayAnalysis: TeamAnalysis | null;
}

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const readStoredReports = (): StoredReport[] => {
    if (!isBrowser()) {
        return [];
    }

    const raw = window.localStorage.getItem(REPORTS_STORAGE_KEY);
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw) as StoredReport[];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to parse reports storage:', error);
        return [];
    }
};

export const writeStoredReports = (reports: StoredReport[]) => {
    if (!isBrowser()) {
        return;
    }

    window.localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
};

export const createStoredReport = ({
    match,
    homeAnalysis,
    awayAnalysis,
}: {
    match: Match;
    homeAnalysis: TeamAnalysis | null;
    awayAnalysis: TeamAnalysis | null;
}): StoredReport => ({
    id: crypto.randomUUID(),
    matchId: match.match_id,
    createdAt: new Date().toISOString(),
    matchSummary: {
        homeTeam: match.home_team?.team_name || 'Home',
        awayTeam: match.away_team?.team_name || 'Away',
        score: `${match.home_score} - ${match.away_score}`,
        competition: match.competition,
        matchDate: match.match_date,
    },
    homeAnalysis,
    awayAnalysis,
});

export const saveStoredReport = (report: StoredReport) => {
    const reports = readStoredReports();
    const next = [report, ...reports];
    writeStoredReports(next);
    return next;
};

export const deleteStoredReport = (reportId: string) => {
    const next = readStoredReports().filter((report) => report.id !== reportId);
    writeStoredReports(next);
    return next;
};

export const getStoredReport = (reportId: string) =>
    readStoredReports().find((report) => report.id === reportId) || null;
