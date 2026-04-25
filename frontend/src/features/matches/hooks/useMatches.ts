import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Match, MatchFilters } from '@/entities/match';
import { queryKeys } from '@/shared/api/queryKeys';
import { matchService } from '@/services/matchService';

interface MatchCatalogResult {
    matches: Match[];
    total: number;
    competitions: string[];
    seasons: string[];
}

const sortMatches = (matches: Match[], sortBy: MatchFilters['sortBy']) => {
    const copy = [...matches];

    switch (sortBy) {
        case 'date-asc':
            return copy.sort((first, second) => new Date(first.match_date).getTime() - new Date(second.match_date).getTime());
        case 'competition':
            return copy.sort((first, second) => first.competition.localeCompare(second.competition));
        case 'season':
            return copy.sort((first, second) => first.season.localeCompare(second.season));
        case 'date-desc':
        default:
            return copy.sort((first, second) => new Date(second.match_date).getTime() - new Date(first.match_date).getTime());
    }
};

export const useMatches = (filters: MatchFilters = {}) =>
    {
        const query = useQuery({
        queryKey: queryKeys.matches(filters),
        queryFn: () => matchService.getMatches(),
    });

        const data = useMemo((): MatchCatalogResult | undefined => {
            if (!query.data) {
                return undefined;
            }

            const allMatches = query.data.matches || [];
            const search = filters.search?.trim().toLowerCase() || '';

            const filtered = allMatches.filter((match) => {
                const home = match.home_team?.team_name?.toLowerCase() || '';
                const away = match.away_team?.team_name?.toLowerCase() || '';
                const competition = match.competition?.toLowerCase() || '';
                const season = match.season?.toLowerCase() || '';

                const matchesSearch =
                    !search ||
                    home.includes(search) ||
                    away.includes(search) ||
                    competition.includes(search) ||
                    season.includes(search);
                const matchesCompetition = !filters.competition || filters.competition === 'all' || match.competition === filters.competition;
                const matchesSeason = !filters.season || filters.season === 'all' || match.season === filters.season;

                return matchesSearch && matchesCompetition && matchesSeason;
            });

            return {
                matches: sortMatches(filtered, filters.sortBy),
                total: allMatches.length,
                competitions: Array.from(new Set(allMatches.map((match) => match.competition).filter(Boolean))).sort(),
                seasons: Array.from(new Set(allMatches.map((match) => match.season).filter(Boolean))).sort(),
            };
        }, [filters.competition, filters.search, filters.season, filters.sortBy, query.data]);

        return {
            ...query,
            data,
        };
    };

export const useMatch = (matchId: number | null) =>
    useQuery({
        queryKey: matchId ? queryKeys.match(matchId) : ['match', 'empty'],
        queryFn: () => matchService.getMatch(matchId as number),
        enabled: Boolean(matchId),
    });
