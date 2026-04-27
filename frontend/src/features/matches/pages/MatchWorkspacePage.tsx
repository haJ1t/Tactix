import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { Activity, ArrowLeft, Eye, FileText, Play, Radio, Users, Zap } from 'lucide-react';
import type { Match } from '@/entities/match';
import type { TeamAnalysis } from '@/entities/analysis';
import { buildOverviewInsights, getAnalysisForTeam, getTeamNameById, getTeamStats, getTopPatterns } from '@/entities/analysis';
import { useMatch } from '@/features/matches/hooks/useMatches';
import { useMatchAnalysis } from '@/features/analysis/hooks/useMatchAnalysis';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Tabs } from '@/shared/ui/Tabs';
import { formatMatchDate } from '@/shared/lib/format';
import { FadeInUp, PageTransition } from '@/shared/ui/motion';

export interface MatchWorkspaceContext {
    match: Match;
    analysis: Record<string, TeamAnalysis> | undefined;
    currentTeamId: number | null;
    currentTeamName: string | null;
    currentAnalysis: TeamAnalysis | null;
    homeAnalysis: TeamAnalysis | null;
    awayAnalysis: TeamAnalysis | null;
    isRunningAnalysis: boolean;
    runAnalysis: () => Promise<void>;
    setCurrentTeamId: (teamId: number) => void;
}

export const useMatchWorkspaceContext = () => useOutletContext<MatchWorkspaceContext>();

const teamIdsForMatch = (match: Match | null | undefined) =>
    [match?.home_team?.team_id, match?.away_team?.team_id].filter((id): id is number => Boolean(id));

export default function MatchWorkspacePage() {
    // Route and query state
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const parsedMatchId = Number(matchId);
    const matchQuery = useMatch(Number.isNaN(parsedMatchId) ? null : parsedMatchId);
    const analysisQuery = useMatchAnalysis(Number.isNaN(parsedMatchId) ? null : parsedMatchId, 'all');
    const [currentTeamId, setCurrentTeamIdState] = useState<number | null>(null);

    // Sync team lens with URL
    useEffect(() => {
        if (!matchQuery.data) {
            return;
        }

        const teamIds = teamIdsForMatch(matchQuery.data);
        const requestedTeamId = Number(searchParams.get('team'));
        const requestedIsValid = teamIds.includes(requestedTeamId);
        const fallback = teamIds.includes(currentTeamId || 0)
            ? currentTeamId
            : matchQuery.data.home_team?.team_id || teamIds[0] || null;
        const nextTeamId = requestedIsValid ? requestedTeamId : fallback;

        setCurrentTeamIdState((current) => (current === nextTeamId ? current : nextTeamId));
    }, [currentTeamId, matchQuery.data, searchParams]);

    // Auto-run analysis from URL flag
    useEffect(() => {
        const shouldRun = searchParams.get('run') === '1';
        if (!shouldRun || !matchQuery.data || analysisQuery.isFetching || analysisQuery.data) {
            return;
        }

        void analysisQuery.refetch();
    }, [analysisQuery, matchQuery.data, searchParams]);

    // Clear run flag once finished
    useEffect(() => {
        if (searchParams.get('run') !== '1' || !analysisQuery.data) {
            return;
        }

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('run');
        setSearchParams(nextParams, { replace: true });
    }, [analysisQuery.data, searchParams, setSearchParams]);

    // Update active team and URL
    const setCurrentTeamId = useCallback(
        (teamId: number) => {
            setCurrentTeamIdState(teamId);
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('team', String(teamId));
            setSearchParams(nextParams, { replace: true });
        },
        [searchParams, setSearchParams]
    );

    // Resolve team and analysis context
    const currentTeamName = getTeamNameById(matchQuery.data || null, currentTeamId);
    const homeAnalysis = getAnalysisForTeam(analysisQuery.data, matchQuery.data?.home_team?.team_name);
    const awayAnalysis = getAnalysisForTeam(analysisQuery.data, matchQuery.data?.away_team?.team_name);
    const currentAnalysis = getAnalysisForTeam(analysisQuery.data, currentTeamName);
    const analysisIsPartial = Boolean(analysisQuery.data && (!homeAnalysis || !awayAnalysis));

    // Build hero status chips
    const heroSignals = useMemo(() => {
        if (!matchQuery.data || !homeAnalysis || !awayAnalysis) {
            return ['Pass network lens', 'Player influence map', 'Shot quality and counter plan'];
        }

        const homePattern = getTopPatterns(homeAnalysis, 1)[0]?.pattern_type?.replace(/_/g, ' ') || 'No dominant pattern';
        const awayPattern = getTopPatterns(awayAnalysis, 1)[0]?.pattern_type?.replace(/_/g, ' ') || 'No dominant pattern';

        return [
            `Lens: ${currentTeamName || matchQuery.data.home_team?.team_name || 'Home'}`,
            `Home signal: ${homePattern}`,
            `Away signal: ${awayPattern}`,
        ];
    }, [awayAnalysis, currentTeamName, homeAnalysis, matchQuery.data]);

    // Pick the leading insight for hero
    const heroStory = useMemo(() => {
        if (!matchQuery.data) {
            return 'Loading match context.';
        }

        if (!homeAnalysis || !awayAnalysis) {
            return 'Run analysis to populate tactical patterns, passing structure, player influence, and shot-quality context for both teams.';
        }

        const homeStats = getTeamStats(homeAnalysis);
        const awayStats = getTeamStats(awayAnalysis);
        const totalPasses = homeStats.totalPasses + awayStats.totalPasses;
        const passShareHome = totalPasses ? homeStats.totalPasses / totalPasses : 0.5;
        const insights = buildOverviewInsights({
            homeStats,
            awayStats,
            homeName: matchQuery.data.home_team?.team_name || 'Home',
            awayName: matchQuery.data.away_team?.team_name || 'Away',
            homeGoals: matchQuery.data.home_score,
            awayGoals: matchQuery.data.away_score,
            homePatterns: getTopPatterns(homeAnalysis).map((pattern) => pattern.pattern_type),
            awayPatterns: getTopPatterns(awayAnalysis).map((pattern) => pattern.pattern_type),
            passShareHome,
        });

        return insights[0] || 'Analysis is ready. Use the tabs to inspect passing, players, tactical signals, shot quality, and report output.';
    }, [awayAnalysis, homeAnalysis, matchQuery.data]);

    // Workspace tab definitions
    const lensSearch = currentTeamId ? `?team=${currentTeamId}` : '';
    const tabs = useMemo(
        () => [
            { label: 'Overview', to: { pathname: 'overview', search: lensSearch } },
            { label: 'Network', to: { pathname: 'network', search: lensSearch } },
            { label: 'Players', to: { pathname: 'players', search: lensSearch } },
            { label: 'Tactics', to: { pathname: 'tactics', search: lensSearch } },
            { label: 'Shots', to: { pathname: 'shots', search: lensSearch } },
            { label: 'Report', to: { pathname: 'report', search: lensSearch } },
        ],
        [lensSearch]
    );

    // Loading branch
    if (matchQuery.isLoading) {
        return <LoadingState title="Loading workspace" description="Preparing the match workspace." />;
    }

    // Error branch
    if (matchQuery.isError || !matchQuery.data) {
        return (
            <ErrorState
                title="Match unavailable"
                description="The requested match could not be found."
                onRetry={() => void matchQuery.refetch()}
            />
        );
    }

    // Re-fetch analysis on demand
    const runAnalysis = async () => {
        await analysisQuery.refetch();
    };

    // Derive analysis status label
    const teams = [matchQuery.data.home_team, matchQuery.data.away_team].filter(Boolean);
    const analysisState = analysisQuery.isFetching
        ? 'Running'
        : analysisQuery.data
            ? analysisIsPartial
                ? 'Partial'
                : 'Ready'
            : 'Not run';

    return (
        <PageTransition>
            <div className="space-y-5">
                <section className="glass-card overflow-hidden">
                    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="border-b border-[var(--border-soft)] bg-[var(--surface-raised)] p-5 lg:border-b-0 lg:border-r">
                            <div className="flex flex-col gap-5">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--primary-strong)]">
                                            Match workspace
                                        </p>
                                        <div className="mt-2 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                                            <div className="min-w-0 flex-1 text-right sm:text-left">
                                                <h1 className="truncate text-lg font-semibold text-[var(--text-primary)]">
                                                    {matchQuery.data.home_team?.team_name || 'Home'}
                                                </h1>
                                                <p className="text-xs text-[var(--text-secondary)]">Home</p>
                                            </div>
                                            <div className="mx-auto flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 tabular-nums sm:mx-0">
                                                <span className="text-3xl font-bold">{matchQuery.data.home_score}</span>
                                                <span className="text-xl text-[var(--text-muted)]">-</span>
                                                <span className="text-3xl font-bold">{matchQuery.data.away_score}</span>
                                            </div>
                                            <div className="min-w-0 flex-1 text-left">
                                                <h1 className="truncate text-lg font-semibold text-[var(--text-primary)]">
                                                    {matchQuery.data.away_team?.team_name || 'Away'}
                                                </h1>
                                                <p className="text-xs text-[var(--text-secondary)]">Away</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <span className="tag-glow">{matchQuery.data.competition || 'Competition unavailable'}</span>
                                        <span className="tag-blue">{matchQuery.data.season || 'Season n/a'}</span>
                                        <span className="tag-amber">{formatMatchDate(matchQuery.data.match_date)}</span>
                                    </div>
                                </div>

                                <p className="max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">{heroStory}</p>

                                <div className="flex flex-wrap gap-2">
                                    {heroSignals.map((signal) => (
                                        <span key={signal} className="status-chip bg-[var(--surface)]">
                                            <Radio className="h-3 w-3" />
                                            {signal}
                                        </span>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] pt-4 sm:flex-row sm:items-center">
                                    <div className="inline-flex w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 sm:w-auto" role="tablist" aria-label="Team lens">
                                        {teams.map((team) => {
                                            const active = currentTeamId === team?.team_id;
                                            return (
                                                <button
                                                    key={team?.team_id}
                                                    className={[
                                                        'min-w-0 flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:min-w-[140px]',
                                                        active
                                                            ? 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                                                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]',
                                                    ].join(' ')}
                                                    onClick={() => team?.team_id && setCurrentTeamId(team.team_id)}
                                                    type="button"
                                                >
                                                    <span className="block truncate">{team?.team_name || 'Team'}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <span className="text-xs text-[var(--text-secondary)]">
                                        Current lens: <strong className="text-[var(--text-primary)]">{currentTeamName || matchQuery.data.home_team?.team_name || 'Home'}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <FadeInUp delay={0.05}>
                            <aside className="space-y-4 p-5">
                                <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                            Analysis state
                                        </span>
                                        <span className={analysisState === 'Partial' ? 'tag-amber' : analysisState === 'Ready' ? 'tag-glow' : 'tag-blue'}>
                                            {analysisState}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-sm text-[var(--text-secondary)]">
                                        {analysisQuery.data
                                            ? analysisIsPartial
                                                ? 'Analysis returned partial team data. Available tabs remain usable.'
                                                : 'Analysis is ready across the workspace tabs.'
                                            : 'Run analysis once to populate the tactical tabs from the shared result.'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Lens', value: currentTeamName || 'Home', icon: Eye },
                                        { label: 'Tabs', value: tabs.length, icon: Zap },
                                        { label: 'Teams', value: analysisQuery.data ? Object.keys(analysisQuery.data).length : 2, icon: Users },
                                    ].map((item) => (
                                        <div key={item.label} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3 text-center">
                                            <item.icon className="mx-auto mb-1 h-4 w-4 text-[var(--primary-strong)]" />
                                            <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                                {item.label}
                                            </span>
                                            <strong className="block truncate text-xs text-[var(--text-primary)]">{item.value}</strong>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => void runAnalysis()}
                                        disabled={analysisQuery.isFetching}
                                        className="btn-glow w-full"
                                        type="button"
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                        {analysisQuery.isFetching ? 'Running analysis...' : 'Run Analysis'}
                                    </button>
                                    <Link to="/matches" className="btn-ghost w-full">
                                        <ArrowLeft className="h-3.5 w-3.5" />
                                        Back to Matches
                                    </Link>
                                </div>
                            </aside>
                        </FadeInUp>
                    </div>
                </section>

                {analysisIsPartial && (
                    <div className="rounded-lg border border-[rgba(184,135,53,0.24)] bg-[var(--amber-soft)] px-4 py-3 text-sm text-[var(--text-primary)]">
                        <Activity className="mr-2 inline h-4 w-4 text-[var(--amber)]" />
                        Analysis completed with partial data. Missing sections are shown as degraded states instead of broken panels.
                    </div>
                )}

                <Tabs items={tabs} />

                <Outlet
                    context={{
                        match: matchQuery.data,
                        analysis: analysisQuery.data,
                        currentTeamId,
                        currentTeamName,
                        currentAnalysis,
                        homeAnalysis,
                        awayAnalysis,
                        isRunningAnalysis: analysisQuery.isFetching,
                        runAnalysis,
                        setCurrentTeamId,
                    } satisfies MatchWorkspaceContext}
                />

                <div className="flex justify-center pt-1 pb-3">
                    <button className="btn-ghost" onClick={() => navigate('/reports')} type="button">
                        <FileText className="h-4 w-4" />
                        Open saved reports
                    </button>
                </div>
            </div>
        </PageTransition>
    );
}
