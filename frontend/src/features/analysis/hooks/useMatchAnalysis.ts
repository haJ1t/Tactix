import { useQuery } from '@tanstack/react-query';
import type { NetworkData, TeamAnalysis } from '@/entities/analysis';
import { queryKeys } from '@/shared/api/queryKeys';
import { matchService } from '@/services/matchService';

interface MatchAnalysisOptions {
    enabled?: boolean;
}

// Run ML analysis for a match
export const useMatchAnalysis = (
    matchId: number | null,
    teamIdOrAll: number | 'all' = 'all',
    options: MatchAnalysisOptions = {}
) =>
    useQuery({
        queryKey: matchId ? queryKeys.matchAnalysis(matchId, teamIdOrAll) : ['match-analysis', 'empty'],
        queryFn: async (): Promise<Record<string, TeamAnalysis>> => {
            // Fetch all teams or one team
            const response =
                teamIdOrAll === 'all'
                    ? await matchService.analyzeMatchML(matchId as number)
                    : await matchService.analyzeMatchML(matchId as number, teamIdOrAll);

            return response.analysis;
        },
        enabled: Boolean(matchId) && Boolean(options.enabled),
    });

// Pass network for a single team
export const useMatchNetwork = (
    matchId: number | null,
    teamId: number | null,
    options: MatchAnalysisOptions = {}
) =>
    useQuery({
        queryKey: matchId && teamId ? queryKeys.matchNetwork(matchId, teamId) : ['match-network', 'empty'],
        queryFn: (): Promise<NetworkData> => matchService.getNetwork(matchId as number, teamId as number),
        enabled: Boolean(matchId) && Boolean(teamId) && Boolean(options.enabled),
    });
