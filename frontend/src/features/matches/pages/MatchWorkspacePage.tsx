import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import type { Match } from '@/entities/match';
import type { TeamAnalysis } from '@/entities/analysis';
import { buildOverviewInsights, getAnalysisForTeam, getTeamNameById, getTeamStats, getTopPatterns } from '@/entities/analysis';
import { useMatch } from '@/features/matches/hooks/useMatches';
import { useMatchAnalysis } from '@/features/analysis/hooks/useMatchAnalysis';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Tabs } from '@/shared/ui/Tabs';
import { formatMatchDate } from '@/shared/lib/format';

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

export default function MatchWorkspacePage() {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const parsedMatchId = Number(matchId);
    const matchQuery = useMatch(Number.isNaN(parsedMatchId) ? null : parsedMatchId);
    const analysisQuery = useMatchAnalysis(Number.isNaN(parsedMatchId) ? null : parsedMatchId, 'all');
    const [currentTeamId, setCurrentTeamId] = useState<number | null>(null);

    useEffect(() => {
        if (matchQuery.data?.home_team?.team_id) {
            setCurrentTeamId((current) => current ?? matchQuery.data?.home_team?.team_id ?? null);
        }
    }, [matchQuery.data?.home_team?.team_id]);

    useEffect(() => {
        const shouldRun = searchParams.get('run') === '1';
        if (!shouldRun || !matchQuery.data || analysisQuery.isFetching || analysisQuery.data) {
            return;
        }

        void analysisQuery.refetch();
    }, [analysisQuery, matchQuery.data, searchParams]);

    useEffect(() => {
        if (searchParams.get('run') !== '1' || !analysisQuery.data) {
            return;
        }

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('run');
        setSearchParams(nextParams, { replace: true });
    }, [analysisQuery.data, searchParams, setSearchParams]);

    const currentTeamName = getTeamNameById(matchQuery.data || null, currentTeamId);
    const homeAnalysis = getAnalysisForTeam(analysisQuery.data, matchQuery.data?.home_team?.team_name);
    const awayAnalysis = getAnalysisForTeam(analysisQuery.data, matchQuery.data?.away_team?.team_name);
    const currentAnalysis = getAnalysisForTeam(analysisQuery.data, currentTeamName);
    const heroSignals = useMemo(() => {
        if (!matchQuery.data || !homeAnalysis || !awayAnalysis) {
            return ['Pass network lens', 'Player influence map', 'Shot quality and counter plan'];
        }

        const homePattern = getTopPatterns(homeAnalysis, 1)[0]?.pattern_type?.replace(/_/g, ' ') || 'Structure loading';
        const awayPattern = getTopPatterns(awayAnalysis, 1)[0]?.pattern_type?.replace(/_/g, ' ') || 'Structure loading';

        return [
            `Selected lens: ${currentTeamName || matchQuery.data.home_team?.team_name || 'Home'}`,
            `Home signal: ${homePattern}`,
            `Away signal: ${awayPattern}`,
        ];
    }, [awayAnalysis, currentTeamName, homeAnalysis, matchQuery.data]);

    const heroStory = useMemo(() => {
        if (!matchQuery.data) {
            return 'Loading match context.';
        }

        if (!homeAnalysis || !awayAnalysis) {
            return 'Run analysis to unlock tactical patterns, passing structure, and shot-quality storylines for both teams.';
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

        return insights[0] || 'Analysis is ready. Use the tabs below to inspect passing, players, tactical signals, and shot quality.';
    }, [awayAnalysis, homeAnalysis, matchQuery.data]);

    const tabs = useMemo(
        () => [
            { label: 'Overview', to: 'overview' },
            { label: 'Network', to: 'network' },
            { label: 'Players', to: 'players' },
            { label: 'Tactics', to: 'tactics' },
            { label: 'Shots', to: 'shots' },
            { label: 'Report', to: 'report' },
        ],
        []
    );

    if (matchQuery.isLoading) {
        return <LoadingState title="Loading workspace" description="Preparing the match workspace." />;
    }

    if (matchQuery.isError || !matchQuery.data) {
        return (
            <ErrorState
                title="Match unavailable"
                description="The requested match could not be found."
                onRetry={() => void matchQuery.refetch()}
            />
        );
    }

    const runAnalysis = async () => {
        await analysisQuery.refetch();
    };

    return (
        <div className="workspace-stack analysis-theater">
            <section className="card workspace-hero theater-hero theater-hero-workspace">
                <div className="card-body workspace-hero-body">
                    <div className="workspace-hero-story">
                        <span className="hero-eyebrow">Match Workspace</span>
                        <div className="workspace-scoreline">
                            <div className="workspace-score-team">
                                <span className="workspace-score-name">{matchQuery.data.home_team?.team_name || 'Home'}</span>
                                <span className="workspace-score-role">Home</span>
                            </div>
                            <div className="workspace-score-core">
                                <span className="workspace-score-value">{matchQuery.data.home_score}</span>
                                <span className="workspace-score-separator">-</span>
                                <span className="workspace-score-value">{matchQuery.data.away_score}</span>
                            </div>
                            <div className="workspace-score-team workspace-score-team-away">
                                <span className="workspace-score-name">{matchQuery.data.away_team?.team_name || 'Away'}</span>
                                <span className="workspace-score-role">Away</span>
                            </div>
                        </div>
                        <div className="workspace-context-row">
                            <span className="editorial-meta-pill">{matchQuery.data.competition}</span>
                            <span>{matchQuery.data.season}</span>
                            <span className="meta-divider">•</span>
                            <span>{formatMatchDate(matchQuery.data.match_date)}</span>
                        </div>
                        <p className="workspace-storyline">{heroStory}</p>
                        <div className="workspace-signal-rail">
                            {heroSignals.map((signal) => (
                                <span key={signal} className="workspace-signal-chip">
                                    {signal}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="workspace-hero-side">
                        <div className="workspace-state-panel">
                            <span className="workspace-state-label">Analysis state</span>
                            <strong>{analysisQuery.data ? 'Ready for review' : analysisQuery.isFetching ? 'Running now' : 'Not generated yet'}</strong>
                            <p>{analysisQuery.data ? 'Use tabs below to compare structure, players, tactics, and finishing quality.' : 'Run analysis once to populate all tabs from the same cached result.'}</p>
                        </div>
                        <div className="workspace-state-mini-grid">
                            <div className="workspace-state-mini">
                                <span>Lens</span>
                                <strong>{currentTeamName || matchQuery.data.home_team?.team_name || 'Home'}</strong>
                            </div>
                            <div className="workspace-state-mini">
                                <span>Tabs</span>
                                <strong>{tabs.length}</strong>
                            </div>
                            <div className="workspace-state-mini">
                                <span>Teams</span>
                                <strong>{analysisQuery.data ? Object.keys(analysisQuery.data).length : 2}</strong>
                            </div>
                        </div>
                        <div className="workspace-hero-actions">
                            <button className="btn btn-primary btn-sm" onClick={() => void runAnalysis()} disabled={analysisQuery.isFetching}>
                                {analysisQuery.isFetching ? 'Running analysis...' : 'Run Analysis'}
                            </button>
                            <Link className="btn btn-outline btn-sm" to="/matches">
                                Back to Matches
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="workspace-hero-footer">
                    <div className="workspace-segmented-toggle" role="tablist" aria-label="Team switch">
                        {[matchQuery.data.home_team, matchQuery.data.away_team].filter(Boolean).map((team) => (
                            <button
                                key={team?.team_id}
                                className={`workspace-segment ${currentTeamId === team?.team_id ? 'active' : ''}`}
                                onClick={() => team?.team_id && setCurrentTeamId(team.team_id)}
                                type="button"
                            >
                                {team?.team_name}
                            </button>
                        ))}
                    </div>
                    <span className="workspace-segment-caption">
                        Select the team lens before moving deeper into the tabs. Current focus: {currentTeamName || matchQuery.data.home_team?.team_name || 'Home'}.
                    </span>
                </div>
            </section>

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

            <div className="workspace-footer-link theater-footer-link">
                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/reports`)}>
                    Open Saved Reports
                </button>
            </div>
        </div>
    );
}
