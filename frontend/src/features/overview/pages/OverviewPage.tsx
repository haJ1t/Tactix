import { Link } from 'react-router-dom';
import { ArrowRight, Crosshair, FileText, TrendingUp, Users } from 'lucide-react';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { useReports } from '@/features/reports/hooks/useReports';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { formatDateTime, formatMatchDate } from '@/shared/lib/format';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { StatCard } from '@/shared/ui/StatCard';
import { AnimatedCounter, FadeInUp, PageTransition, StaggerContainer, StaggerItem } from '@/shared/ui/motion';

export default function OverviewPage() {
    const matchesQuery = useMatches();
    const teamsQuery = useTeams();
    const reportsQuery = useReports();

    if (matchesQuery.isLoading || teamsQuery.isLoading) {
        return <LoadingState title="Loading overview" description="Preparing the analyst workspace summary." />;
    }

    if (matchesQuery.isError || teamsQuery.isError) {
        return (
            <ErrorState
                title="Overview unavailable"
                description="Core match and team data could not be loaded."
                onRetry={() => {
                    void matchesQuery.refetch();
                    void teamsQuery.refetch();
                }}
            />
        );
    }

    const matches = matchesQuery.data?.matches || [];
    const latestMatch = matches[0] || null;
    const latestReport = reportsQuery.data?.[0] || null;
    const recentReports = reportsQuery.data?.slice(0, 5) || [];

    return (
        <PageTransition>
            <div className="space-y-6">
                <section className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
                    <div className="glass-card overflow-hidden">
                        <div className="border-b border-[var(--border-soft)] bg-[var(--surface-raised)] px-5 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--primary-strong)]">Analyst desk</p>
                            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Today&apos;s tactical workspace</h1>
                            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
                                Pick up the latest match review, open the fixture catalog, or move into team-season analysis.
                            </p>
                        </div>

                        <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                    Latest match in library
                                </p>
                                {latestMatch ? (
                                    <div className="mt-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
                                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                                                    {latestMatch.home_team?.team_name || 'Home'} vs {latestMatch.away_team?.team_name || 'Away'}
                                                </p>
                                                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                                    {latestMatch.competition || 'Competition unavailable'} · {latestMatch.season || 'Season n/a'} ·{' '}
                                                    {formatMatchDate(latestMatch.match_date)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 tabular-nums">
                                                <span className="text-xl font-bold">{latestMatch.home_score}</span>
                                                <span className="text-[var(--text-muted)]">-</span>
                                                <span className="text-xl font-bold">{latestMatch.away_score}</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Link className="btn-glow" to={`/matches/${latestMatch.match_id}/overview`}>
                                                Open workspace <ArrowRight size={15} />
                                            </Link>
                                            <Link className="btn-ghost" to={`/matches/${latestMatch.match_id}/overview?run=1`}>
                                                Run analysis
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-3 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-secondary)]">
                                        No matches are available yet.
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border border-[rgba(79,143,101,0.2)] bg-[var(--primary-soft)] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary-strong)]">Library</p>
                                <div className="mt-4 space-y-3">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-sm text-[var(--text-secondary)]">Matches</span>
                                        <strong className="text-xl tabular-nums"><AnimatedCounter value={matchesQuery.data?.total || 0} /></strong>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-sm text-[var(--text-secondary)]">Team seasons</span>
                                        <strong className="text-xl tabular-nums"><AnimatedCounter value={teamsQuery.data?.total || 0} /></strong>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-sm text-[var(--text-secondary)]">Reports</span>
                                        <strong className="text-xl tabular-nums"><AnimatedCounter value={reportsQuery.data?.length || 0} /></strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">Latest report</p>
                        {latestReport ? (
                            <div className="mt-3 space-y-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                        {latestReport.homeTeam} vs {latestReport.awayTeam}
                                    </h2>
                                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                        {latestReport.competition} · {formatMatchDate(latestReport.matchDate)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="tag-glow">{latestReport.scoreline}</span>
                                    <span className="tag-blue">{formatDateTime(latestReport.createdAt)}</span>
                                </div>
                                <Link className="btn-ghost w-full" to={`/reports/${latestReport.id}`}>
                                    Review dossier <ArrowRight size={15} />
                                </Link>
                            </div>
                        ) : (
                            <div className="mt-3 space-y-4">
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Generated match dossiers will appear here once reports are created.
                                </p>
                                <Link className="btn-ghost w-full" to="/reports">Open reports</Link>
                            </div>
                        )}
                        {reportsQuery.isError && (
                            <p className="mt-4 rounded-md border border-[rgba(184,135,53,0.25)] bg-[var(--amber-soft)] px-3 py-2 text-xs text-[var(--amber)]">
                                Report history could not be refreshed. Match and team summaries remain available.
                            </p>
                        )}
                    </div>
                </section>

                <FadeInUp>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard label="Matches" value={matchesQuery.data?.total || 0} icon={<Crosshair size={16} />} tone="success" />
                        <StatCard label="Team seasons" value={teamsQuery.data?.total || 0} icon={<Users size={16} />} tone="accent" />
                        <StatCard label="Saved reports" value={reportsQuery.data?.length || 0} icon={<FileText size={16} />} tone="warning" />
                        <StatCard
                            label="Latest analyzed"
                            value={latestReport ? latestReport.scoreline : 'None'}
                            icon={<TrendingUp size={16} />}
                        />
                    </div>
                </FadeInUp>

                <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <FadeInUp delay={0.05} className="min-w-0">
                        <div className="glass-card p-5">
                            <h2 className="text-base font-semibold text-[var(--text-primary)]">Workflow shortcuts</h2>
                            <div className="mt-4 grid gap-2">
                                {[
                                    { label: 'Open Match Library', desc: 'Browse fixtures and start a match workspace.', to: '/matches', icon: Crosshair },
                                    { label: 'Review Teams', desc: 'Inspect season-scoped team profiles.', to: '/teams', icon: Users },
                                    { label: 'Open Reports', desc: 'Generate or review analyst dossiers.', to: '/reports', icon: FileText },
                                ].map((item) => (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        className="group flex min-w-0 items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3 transition-colors hover:border-[rgba(79,143,101,0.28)] hover:bg-[var(--surface-soft)]"
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                                            <item.icon size={17} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{item.label}</span>
                                            <span className="block truncate text-xs text-[var(--text-secondary)]">{item.desc}</span>
                                        </span>
                                        <ArrowRight size={15} className="text-[var(--text-muted)] group-hover:text-[var(--primary-strong)]" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </FadeInUp>

                    <FadeInUp delay={0.1} className="min-w-0">
                        <div className="glass-card p-5">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent reports</h2>
                                <Link className="text-sm font-semibold text-[var(--primary-strong)] hover:underline" to="/reports">
                                    View all
                                </Link>
                            </div>
                            {recentReports.length > 0 ? (
                                <StaggerContainer className="mt-4 divide-y divide-[var(--border-soft)]" staggerDelay={0.04}>
                                    {recentReports.map((report) => (
                                        <StaggerItem key={report.id}>
                                            <Link
                                                to={`/reports/${report.id}`}
                                                className="flex min-w-0 items-center justify-between gap-3 py-3"
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
                                                        {report.homeTeam} vs {report.awayTeam}
                                                    </span>
                                                    <span className="block truncate text-xs text-[var(--text-secondary)]">
                                                        {report.competition} · {formatMatchDate(report.matchDate)}
                                                    </span>
                                                </span>
                                                <span className="flex shrink-0 items-center gap-2">
                                                    <span className="tag-glow">{report.scoreline}</span>
                                                    <ArrowRight size={14} className="text-[var(--text-muted)]" />
                                                </span>
                                            </Link>
                                        </StaggerItem>
                                    ))}
                                </StaggerContainer>
                            ) : (
                                <p className="mt-4 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-secondary)]">
                                    No reports have been saved yet.
                                </p>
                            )}
                        </div>
                    </FadeInUp>
                </section>
            </div>
        </PageTransition>
    );
}
