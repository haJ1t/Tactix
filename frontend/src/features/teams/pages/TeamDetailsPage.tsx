import { Navigate, Outlet, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import type { TeamAggregateAnalysis } from '@/entities/analysis';
import type { Match } from '@/entities/match';
import type { TeamSeasonDetails } from '@/entities/team';
import { useTeam, useTeamAnalysis, useTeamSeasons } from '@/features/teams/hooks/useTeams';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Tabs } from '@/shared/ui/Tabs';
import { PageTransition, FadeInUp, GlassCard } from '@/shared/ui/motion';
import { Shield, Calendar, MapPin, BarChart3 } from 'lucide-react';

export interface TeamDetailsContext {
    team: TeamSeasonDetails;
    season: string;
    matches: Match[];
    aggregateAnalysis: TeamAggregateAnalysis;
    analyzedMatches: number;
}

export const useTeamDetailsContext = () => useOutletContext<TeamDetailsContext>();

export default function TeamDetailsPage() {
    const { teamId } = useParams<{ teamId: string }>();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const parsedTeamId = Number(teamId);
    const normalizedTeamId = Number.isNaN(parsedTeamId) ? null : parsedTeamId;
    const requestedSeason = searchParams.get('season');
    const teamSeasonsQuery = useTeamSeasons(normalizedTeamId);
    const availableSeasons = teamSeasonsQuery.data?.entries.map((entry) => entry.season) || [];
    const activeSeason = requestedSeason && availableSeasons.includes(requestedSeason) ? requestedSeason : null;
    const teamQuery = useTeam(normalizedTeamId, activeSeason);
    const teamAnalysisQuery = useTeamAnalysis(normalizedTeamId, activeSeason);

    if (teamSeasonsQuery.isLoading) {
        return <LoadingState title="Loading team workspace" description="Preparing available seasons for this team." />;
    }

    if (teamSeasonsQuery.isError || !teamSeasonsQuery.data || teamSeasonsQuery.data.entries.length === 0) {
        return (
            <ErrorState
                title="Team workspace unavailable"
                description="No season-specific team data could be loaded."
                onRetry={() => void teamSeasonsQuery.refetch()}
            />
        );
    }

    if (!activeSeason) {
        return (
            <Navigate
                replace
                to={{
                    pathname: location.pathname,
                    search: `?season=${encodeURIComponent(teamSeasonsQuery.data.latestSeason as string)}`,
                }}
            />
        );
    }

    if (teamQuery.isLoading || teamAnalysisQuery.isLoading) {
        return <LoadingState title="Loading team workspace" description="Preparing the team profile and aggregate analysis." />;
    }

    if (teamQuery.isError || teamAnalysisQuery.isError || !teamQuery.data || !teamAnalysisQuery.data) {
        return (
            <ErrorState
                title="Team workspace unavailable"
                description="The requested team profile could not be loaded."
                onRetry={() => {
                    void teamQuery.refetch();
                    void teamAnalysisQuery.refetch();
                }}
            />
        );
    }

    const seasonSearch = `?season=${encodeURIComponent(activeSeason)}`;

    return (
        <PageTransition>
            <div className="space-y-6">
                {/* Team Header Card */}
                <FadeInUp>
                    <GlassCard hover={false} className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500/20 shrink-0">
                                <Shield className="h-7 w-7 text-primary-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-2xl font-bold text-white mb-2">{teamQuery.data.team_name}</h1>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#94A3B8]">
                                    <span className="inline-flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {activeSeason}
                                    </span>
                                    <span className="text-white/20">|</span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {teamQuery.data.country || 'Country n/a'}
                                    </span>
                                    <span className="text-white/20">|</span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <BarChart3 className="h-3.5 w-3.5" />
                                        {teamAnalysisQuery.data.matches.length} matches in library
                                    </span>
                                    <span className="text-white/20">|</span>
                                    <span>{teamAnalysisQuery.data.analyzedMatches} analyzed</span>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </FadeInUp>

                <Tabs
                    items={[
                        { label: 'Overview', to: { pathname: 'overview', search: seasonSearch } },
                        { label: 'Matches', to: { pathname: 'matches', search: seasonSearch } },
                        { label: 'Players', to: { pathname: 'players', search: seasonSearch } },
                        { label: 'Patterns', to: { pathname: 'patterns', search: seasonSearch } },
                    ]}
                />

                <Outlet
                    context={{
                        team: teamQuery.data,
                        season: activeSeason,
                        matches: teamAnalysisQuery.data.matches,
                        aggregateAnalysis: teamAnalysisQuery.data.aggregateAnalysis,
                        analyzedMatches: teamAnalysisQuery.data.analyzedMatches,
                    } satisfies TeamDetailsContext}
                />
            </div>
        </PageTransition>
    );
}
