import { useState } from 'react';
import { Navigate, Outlet, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import type { TeamAggregateAnalysis } from '@/entities/analysis';
import type { Match } from '@/entities/match';
import type { TeamSeasonDetails } from '@/entities/team';
import { useTeam, useTeamAnalysis, useTeamSeasons } from '@/features/teams/hooks/useTeams';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Tabs } from '@/shared/ui/Tabs';
import { PageTransition, FadeInUp } from '@/shared/ui/motion';
import { Shield, Calendar, MapPin, BarChart3 } from 'lucide-react';

export interface TeamDetailsContext {
    team: TeamSeasonDetails;
    season: string;
    matches: Match[];
    aggregateAnalysis: TeamAggregateAnalysis;
    analyzedMatches: number;
    analysisRequested: boolean;
    isAnalysisPending: boolean;
    requestAnalysis: () => void;
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
    const [analysisRequested, setAnalysisRequested] = useState(false);
    const teamAnalysisQuery = useTeamAnalysis(normalizedTeamId, activeSeason, {
        includeAnalysis: analysisRequested,
    });

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

    if (teamQuery.isLoading || (!teamAnalysisQuery.data && teamAnalysisQuery.isLoading)) {
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
    const requestAnalysis = () => {
        if (analysisRequested) {
            void teamAnalysisQuery.refetch();
            return;
        }

        setAnalysisRequested(true);
    };

    return (
        <PageTransition>
            <div className="space-y-6">
                <FadeInUp>
                    <section className="glass-card overflow-hidden">
                        <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] bg-[var(--surface-raised)] p-5 md:flex-row md:items-center md:justify-between">
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                                    <Shield className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--primary-strong)]">
                                        Team workspace
                                    </p>
                                    <h1 className="mt-1 truncate text-2xl font-semibold text-[var(--text-primary)]">{teamQuery.data.team_name}</h1>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="tag-glow inline-flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Season {activeSeason}
                                </span>
                                <span className="tag-blue inline-flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {teamQuery.data.country || 'Country n/a'}
                                </span>
                                <span className="tag-amber inline-flex items-center gap-1.5">
                                    <BarChart3 className="h-3.5 w-3.5" />
                                    {teamAnalysisQuery.data.matches.length} matches
                                </span>
                            </div>
                        </div>
                        <div className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                            {analysisRequested
                                ? teamAnalysisQuery.isFetching
                                    ? 'Running sample analysis for the latest season matches.'
                                    : `${teamAnalysisQuery.data.analyzedMatches} analyzed matches available.`
                                : 'Sample analysis runs only when requested, keeping team pages fast and predictable.'}
                        </div>
                    </section>
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
                        analysisRequested,
                        isAnalysisPending: teamAnalysisQuery.isFetching,
                        requestAnalysis,
                    } satisfies TeamDetailsContext}
                />
            </div>
        </PageTransition>
    );
}
