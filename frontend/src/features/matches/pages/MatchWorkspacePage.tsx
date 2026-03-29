import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, FileText, Eye, Users, Zap, Radio } from 'lucide-react';
import type { Match } from '@/entities/match';
import type { TeamAnalysis } from '@/entities/analysis';
import { buildOverviewInsights, getAnalysisForTeam, getTeamNameById, getTeamStats, getTopPatterns } from '@/entities/analysis';
import { useMatch } from '@/features/matches/hooks/useMatches';
import { useMatchAnalysis } from '@/features/analysis/hooks/useMatchAnalysis';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Tabs } from '@/shared/ui/Tabs';
import { formatMatchDate } from '@/shared/lib/format';
import { PageTransition, FloatingOrb, ShimmerButton, FadeInUp } from '@/shared/ui/motion';

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

    const teams = [matchQuery.data.home_team, matchQuery.data.away_team].filter(Boolean);

    return (
        <PageTransition>
            <div className="space-y-6">
                {/* Hero Section */}
                <div className="glass-card border-white/[0.04] relative overflow-hidden">
                    {/* Floating orbs background */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <FloatingOrb color="rgba(99,102,241,0.12)" size={300} top="-10%" left="-5%" delay={0} />
                        <FloatingOrb color="rgba(168,85,247,0.08)" size={200} top="60%" left="80%" delay={2} />
                    </div>

                    <div className="relative z-10 p-6 lg:p-8">
                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Left: Match Info */}
                            <div className="flex-1 space-y-5">
                                <span className="text-xs font-medium tracking-widest uppercase text-primary-400">
                                    Match Workspace
                                </span>

                                {/* Scoreline */}
                                <div className="flex items-center gap-6">
                                    <div className="text-right flex-1">
                                        <div className="text-lg font-semibold text-white">{matchQuery.data.home_team?.team_name || 'Home'}</div>
                                        <div className="text-xs text-[#94A3B8] mt-0.5">Home</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <motion.span
                                            className="text-4xl font-bold text-white tabular-nums"
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.4, delay: 0.1 }}
                                        >
                                            {matchQuery.data.home_score}
                                        </motion.span>
                                        <span className="text-2xl text-[#94A3B8] font-light">-</span>
                                        <motion.span
                                            className="text-4xl font-bold text-white tabular-nums"
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.4, delay: 0.2 }}
                                        >
                                            {matchQuery.data.away_score}
                                        </motion.span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-lg font-semibold text-white">{matchQuery.data.away_team?.team_name || 'Away'}</div>
                                        <div className="text-xs text-[#94A3B8] mt-0.5">Away</div>
                                    </div>
                                </div>

                                {/* Meta pills */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="tag-glow">{matchQuery.data.competition}</span>
                                    <span className="tag-blue">{matchQuery.data.season}</span>
                                    <span className="text-xs text-[#94A3B8]">{formatMatchDate(matchQuery.data.match_date)}</span>
                                </div>

                                {/* Story */}
                                <p className="text-sm text-[#94A3B8] leading-relaxed max-w-xl">
                                    {heroStory}
                                </p>

                                {/* Signal chips */}
                                <div className="flex flex-wrap gap-2">
                                    {heroSignals.map((signal) => (
                                        <motion.span
                                            key={signal}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-[#94A3B8]"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <Radio className="w-3 h-3 text-primary-400" />
                                            {signal}
                                        </motion.span>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Analysis State Panel */}
                            <FadeInUp delay={0.15}>
                                <div className="lg:w-72 space-y-4">
                                    <div className="glass-card border-white/[0.04] p-4 space-y-2">
                                        <span className="text-xs font-medium tracking-wider uppercase text-[#94A3B8]">Analysis State</span>
                                        <strong className="block text-sm text-white">
                                            {analysisQuery.data ? 'Ready for review' : analysisQuery.isFetching ? 'Running now' : 'Not generated yet'}
                                        </strong>
                                        <p className="text-xs text-[#94A3B8] leading-relaxed">
                                            {analysisQuery.data
                                                ? 'Use tabs below to compare structure, players, tactics, and finishing quality.'
                                                : 'Run analysis once to populate all tabs from the same cached result.'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="glass-card border-white/[0.04] p-3 text-center">
                                            <Eye className="w-3.5 h-3.5 text-primary-400 mx-auto mb-1" />
                                            <span className="text-[10px] text-[#94A3B8] block">Lens</span>
                                            <strong className="text-xs text-white block truncate">{currentTeamName || matchQuery.data.home_team?.team_name || 'Home'}</strong>
                                        </div>
                                        <div className="glass-card border-white/[0.04] p-3 text-center">
                                            <Zap className="w-3.5 h-3.5 text-primary-400 mx-auto mb-1" />
                                            <span className="text-[10px] text-[#94A3B8] block">Tabs</span>
                                            <strong className="text-xs text-white block">{tabs.length}</strong>
                                        </div>
                                        <div className="glass-card border-white/[0.04] p-3 text-center">
                                            <Users className="w-3.5 h-3.5 text-primary-400 mx-auto mb-1" />
                                            <span className="text-[10px] text-[#94A3B8] block">Teams</span>
                                            <strong className="text-xs text-white block">{analysisQuery.data ? Object.keys(analysisQuery.data).length : 2}</strong>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <ShimmerButton
                                            onClick={() => void runAnalysis()}
                                            disabled={analysisQuery.isFetching}
                                            className="w-full text-sm"
                                        >
                                            <Play className="w-3.5 h-3.5 mr-2 inline-block" />
                                            {analysisQuery.isFetching ? 'Running analysis...' : 'Run Analysis'}
                                        </ShimmerButton>
                                        <Link to="/matches" className="btn-ghost text-center text-sm py-2 px-4 rounded-lg">
                                            <ArrowLeft className="w-3.5 h-3.5 mr-2 inline-block" />
                                            Back to Matches
                                        </Link>
                                    </div>
                                </div>
                            </FadeInUp>
                        </div>

                        {/* Team Selector */}
                        <div className="mt-6 pt-6 border-t border-white/[0.04]">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="glass-card border-white/[0.04] inline-flex p-1 rounded-xl relative" role="tablist" aria-label="Team switch">
                                    {teams.map((team) => (
                                        <button
                                            key={team?.team_id}
                                            className={`relative z-10 px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                                                currentTeamId === team?.team_id
                                                    ? 'text-white'
                                                    : 'text-[#94A3B8] hover:text-white'
                                            }`}
                                            onClick={() => team?.team_id && setCurrentTeamId(team.team_id)}
                                            type="button"
                                        >
                                            {currentTeamId === team?.team_id && (
                                                <motion.div
                                                    layoutId="team-selector"
                                                    className="absolute inset-0 rounded-lg bg-primary-500/20 border border-primary-500/30"
                                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                                />
                                            )}
                                            <span className="relative z-10">{team?.team_name}</span>
                                        </button>
                                    ))}
                                </div>
                                <span className="text-xs text-[#94A3B8]">
                                    Select the team lens before moving deeper into the tabs. Current focus: <span className="text-white font-medium">{currentTeamName || matchQuery.data.home_team?.team_name || 'Home'}</span>.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs items={tabs} />

                {/* Outlet */}
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

                {/* Footer */}
                <div className="flex justify-center pt-2 pb-4">
                    <motion.button
                        className="btn-ghost text-sm py-2 px-5 rounded-lg inline-flex items-center gap-2"
                        onClick={() => navigate(`/reports`)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <FileText className="w-4 h-4" />
                        Open Saved Reports
                    </motion.button>
                </div>
            </div>
        </PageTransition>
    );
}
