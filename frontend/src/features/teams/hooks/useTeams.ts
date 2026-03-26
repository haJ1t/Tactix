import { useQuery } from '@tanstack/react-query';
import type { TeamAggregateAnalysis, TeamAnalysis } from '@/entities/analysis';
import { aggregateTeamAnalysis } from '@/entities/analysis';
import type { Match } from '@/entities/match';
import type { TeamSeasonDetails, TeamSeasonEntry } from '@/entities/team';
import { queryKeys } from '@/shared/api/queryKeys';
import { matchService } from '@/services/matchService';
import { teamService } from '@/services/teamService';

interface TeamFilters {
    search?: string;
    segment?: 'all' | 'national' | 'club';
}

interface TeamsCatalogResult {
    teams: TeamSeasonEntry[];
    total: number;
    nationalCount: number;
    clubCount: number;
}

export interface TeamAnalysisResult {
    team: TeamSeasonDetails;
    matches: Match[];
    aggregateAnalysis: TeamAggregateAnalysis;
    analyzedMatches: number;
}

interface TeamSeasonsResult {
    entries: TeamSeasonEntry[];
    latestSeason: string | null;
}

const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase();

export const isLikelyNationalTeam = (team?: { team_name?: string; country?: string } | null): boolean => {
    if (!team?.team_name || !team?.country) {
        return false;
    }

    return normalizeText(team.team_name) === normalizeText(team.country);
};

const compareByRecentMatch = (first: { latestMatchDate: string }, second: { latestMatchDate: string }) =>
    new Date(second.latestMatchDate).getTime() - new Date(first.latestMatchDate).getTime();

const buildTeamSeasonEntries = (
    teams: Array<{ team_id: number; team_name: string; country?: string }>,
    matches: Match[]
): TeamSeasonEntry[] => {
    const teamMap = new Map(teams.map((team) => [team.team_id, team]));
    const grouped = new Map<string, TeamSeasonEntry>();

    matches.forEach((match) => {
        const season = match.season?.trim();
        const participants = [match.home_team, match.away_team];

        participants.forEach((participant) => {
            if (!participant?.team_id || !season) {
                return;
            }

            const team = teamMap.get(participant.team_id);

            if (!team) {
                return;
            }

            const key = `${team.team_id}:${season}`;
            const existing = grouped.get(key);

            if (existing) {
                existing.matches.push(match);
                existing.matchCount += 1;

                if (new Date(match.match_date).getTime() > new Date(existing.latestMatchDate).getTime()) {
                    existing.latestMatchDate = match.match_date;
                }

                return;
            }

            grouped.set(key, {
                ...team,
                season,
                matches: [match],
                matchCount: 1,
                latestMatchDate: match.match_date,
                segment: isLikelyNationalTeam(team) ? 'national' : 'club',
            });
        });
    });

    grouped.forEach((entry) => {
        entry.matches.sort((first, second) => new Date(second.match_date).getTime() - new Date(first.match_date).getTime());
        entry.latestMatchDate = entry.matches[0]?.match_date || entry.latestMatchDate;
    });

    return Array.from(grouped.values()).sort((first, second) => {
        const recentDelta = compareByRecentMatch(first, second);
        return recentDelta !== 0 ? recentDelta : second.matchCount - first.matchCount;
    });
};

export const useTeams = (filters: TeamFilters = {}) =>
    useQuery({
        queryKey: queryKeys.teams(filters),
        queryFn: async (): Promise<TeamsCatalogResult> => {
            const [teamsData, matchesData] = await Promise.all([teamService.getTeams(), matchService.getMatches()]);
            const allTeams = buildTeamSeasonEntries(teamsData.teams || [], matchesData.matches || []);
            const search = filters.search?.trim().toLowerCase() || '';

            const filtered = allTeams.filter((team) => {
                const matchesSearch =
                    !search ||
                    team.team_name.toLowerCase().includes(search) ||
                    team.country?.toLowerCase().includes(search) ||
                    team.season.toLowerCase().includes(search);

                if (filters.segment === 'national') {
                    return matchesSearch && team.segment === 'national';
                }

                if (filters.segment === 'club') {
                    return matchesSearch && team.segment === 'club';
                }

                return matchesSearch;
            });

            return {
                teams: filtered,
                total: allTeams.length,
                nationalCount: allTeams.filter((team) => team.segment === 'national').length,
                clubCount: allTeams.filter((team) => team.segment === 'club').length,
            };
        },
    });

export const useTeamSeasons = (teamId: number | null) =>
    useQuery({
        queryKey: teamId ? queryKeys.teamSeasons(teamId) : ['team-seasons', 'empty'],
        queryFn: async (): Promise<TeamSeasonsResult> => {
            const [teamsData, matchesData] = await Promise.all([teamService.getTeams(), matchService.getMatches()]);
            const entries = buildTeamSeasonEntries(teamsData.teams || [], matchesData.matches || []).filter(
                (entry) => entry.team_id === teamId
            );

            return {
                entries,
                latestSeason: entries[0]?.season || null,
            };
        },
        enabled: Boolean(teamId),
    });

export const useTeam = (teamId: number | null, season: string | null) =>
    useQuery({
        queryKey: teamId && season ? queryKeys.team(teamId, season) : ['team', 'empty'],
        queryFn: async (): Promise<TeamSeasonDetails> => {
            const team = await teamService.getTeam(teamId as number);
            return { ...team, season: season as string };
        },
        enabled: Boolean(teamId && season),
    });

export const useTeamAnalysis = (teamId: number | null, season: string | null) =>
    useQuery({
        queryKey: teamId && season ? queryKeys.teamAnalysis(teamId, season) : ['team-analysis', 'empty'],
        queryFn: async (): Promise<TeamAnalysisResult> => {
            const [team, matchesData] = await Promise.all([
                teamService.getTeam(teamId as number),
                matchService.getMatches(),
            ]);

            const matches = (matchesData.matches || []).filter(
                (match) =>
                    (match.home_team?.team_id === teamId || match.away_team?.team_id === teamId) &&
                    match.season === season
            );

            const teamWithMatches: TeamSeasonEntry = {
                ...team,
                season: season as string,
                matches,
                matchCount: matches.length,
                latestMatchDate: matches[0]?.match_date || '',
                segment: isLikelyNationalTeam(team) ? 'national' : 'club',
            };

            const settled = await Promise.allSettled(
                matches.slice(0, 5).map((match) => matchService.analyzeMatchML(match.match_id, teamId as number))
            );

            const results: TeamAnalysis[] = settled.flatMap((result) => {
                if (result.status !== 'fulfilled') {
                    return [];
                }

                const analysis = result.value.analysis?.[team.team_name];
                return analysis ? [analysis] : [];
            });

            return {
                team: {
                    ...team,
                    season: season as string,
                },
                matches,
                aggregateAnalysis: aggregateTeamAnalysis(teamWithMatches, results),
                analyzedMatches: results.length,
            };
        },
        enabled: Boolean(teamId && season),
    });
