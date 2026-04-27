import type { MatchFilters } from '@/entities/match';

// Centralized react query keys
export const queryKeys = {
    // Match-related keys
    matches: (_filters: MatchFilters = {}) => ['matches'] as const,
    match: (matchId: number) => ['match', matchId] as const,
    matchAnalysis: (matchId: number, teamIdOrAll: number | 'all' = 'all') =>
        ['match-analysis', matchId, teamIdOrAll] as const,
    matchNetwork: (matchId: number, teamId: number) => ['match-network', matchId, teamId] as const,
    // Team-related keys
    teams: (_filters: { search?: string; segment?: 'all' | 'national' | 'club' } = {}) => ['teams'] as const,
    team: (teamId: number, season: string) => ['team', teamId, season] as const,
    teamSeasons: (teamId: number) => ['team-seasons', teamId] as const,
    teamAnalysis: (teamId: number, season: string, includeAnalysis = false) =>
        ['team-analysis', teamId, season, includeAnalysis] as const,
    // Report-related keys
    reports: () => ['reports'] as const,
    legacyReports: () => ['legacy-reports'] as const,
    report: (reportId: string) => ['report', reportId] as const,
    legacyReport: (reportId: string) => ['legacy-report', reportId] as const,
};
