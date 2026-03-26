import type { MatchFilters } from '@/entities/match';

export const queryKeys = {
    matches: (filters: MatchFilters = {}) => ['matches', filters] as const,
    match: (matchId: number) => ['match', matchId] as const,
    matchAnalysis: (matchId: number, teamIdOrAll: number | 'all' = 'all') =>
        ['match-analysis', matchId, teamIdOrAll] as const,
    matchNetwork: (matchId: number, teamId: number) => ['match-network', matchId, teamId] as const,
    teams: (filters: { search?: string; segment?: 'all' | 'national' | 'club' } = {}) =>
        ['teams', filters] as const,
    team: (teamId: number, season: string) => ['team', teamId, season] as const,
    teamSeasons: (teamId: number) => ['team-seasons', teamId] as const,
    teamAnalysis: (teamId: number, season: string) => ['team-analysis', teamId, season] as const,
    reports: () => ['reports'] as const,
    legacyReports: () => ['legacy-reports'] as const,
    report: (reportId: string) => ['report', reportId] as const,
    legacyReport: (reportId: string) => ['legacy-report', reportId] as const,
};
