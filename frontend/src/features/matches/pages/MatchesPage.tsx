import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Crosshair, Play, Search, SlidersHorizontal } from 'lucide-react';
import type { MatchFilters } from '@/entities/match';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { formatMatchDate } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { AnimatedCounter, FadeInUp, PageTransition, StaggerContainer, StaggerItem } from '@/shared/ui/motion';

const sortOptions: Array<NonNullable<MatchFilters['sortBy']>> = ['date-desc', 'date-asc', 'competition', 'season'];

const getSortBy = (value: string | null): NonNullable<MatchFilters['sortBy']> =>
    sortOptions.includes(value as NonNullable<MatchFilters['sortBy']>)
        ? (value as NonNullable<MatchFilters['sortBy']>)
        : 'date-desc';

export default function MatchesPage() {
    const navigate = useNavigate();
    // Read filter state from URL
    const [searchParams, setSearchParams] = useSearchParams();
    const [visibleLimit, setVisibleLimit] = useState(60);
    const search = searchParams.get('q') || '';
    const competition = searchParams.get('competition') || 'all';
    const season = searchParams.get('season') || 'all';
    const sortBy = getSortBy(searchParams.get('sort'));
    const matchesQuery = useMatches({ search, competition, season, sortBy });

    // Reset pagination on filter change
    useEffect(() => {
        setVisibleLimit(60);
    }, [competition, search, season, sortBy]);

    // Header summary numbers
    const summary = useMemo(
        () => ({
            totalMatches: matchesQuery.data?.total || 0,
            filteredMatches: matchesQuery.data?.matches.length || 0,
            competitions: matchesQuery.data?.competitions.length || 0,
            seasons: matchesQuery.data?.seasons.length || 0,
        }),
        [matchesQuery.data]
    );

    // Update or remove a URL filter
    const setFilter = (key: string, value: string, defaultValue = '') => {
        const next = new URLSearchParams(searchParams);

        if (!value || value === defaultValue) {
            next.delete(key);
        } else {
            next.set(key, value);
        }

        setSearchParams(next, { replace: true });
    };

    // Clear all filters
    const resetFilters = () => {
        setSearchParams({}, { replace: true });
    };

    // Loading branch
    if (matchesQuery.isLoading) {
        return <LoadingState title="Loading matches" description="Preparing the match catalog." />;
    }

    // Error branch
    if (matchesQuery.isError) {
        return (
            <ErrorState
                title="Matches unavailable"
                description="The match catalog could not be loaded."
                onRetry={() => void matchesQuery.refetch()}
            />
        );
    }

    // Slice for pagination
    const hasFilters = Boolean(search || competition !== 'all' || season !== 'all' || sortBy !== 'date-desc');
    const visibleMatches = (matchesQuery.data?.matches || []).slice(0, visibleLimit);
    const hasMoreMatches = visibleMatches.length < (matchesQuery.data?.matches.length || 0);

    return (
        <PageTransition>
            <div className="space-y-5">
                <section className="glass-card overflow-hidden">
                    <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] bg-[var(--surface-raised)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--primary-strong)]">Match discovery</p>
                            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Match library</h1>
                            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
                                Browse fixtures, scan scorelines, and open the right match workspace without losing filter context.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                            {[
                                ['Catalog', summary.totalMatches],
                                ['Visible', summary.filteredMatches],
                                ['Competitions', summary.competitions],
                                ['Seasons', summary.seasons],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2">
                                    <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                        {label}
                                    </span>
                                    <strong className="mt-1 block text-lg tabular-nums text-[var(--text-primary)]">
                                        <AnimatedCounter value={Number(value)} />
                                    </strong>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 p-5">
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                            <SlidersHorizontal size={15} />
                            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Filters</span>
                            {matchesQuery.isFetching && <span className="tag-blue ml-auto">Refreshing</span>}
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.35fr)_repeat(3,minmax(160px,0.65fr))_auto]">
                            <label className="relative block">
                                <span className="sr-only">Search matches</span>
                                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                <input
                                    className="form-input-dark pl-10"
                                    placeholder="Search team, competition, or season"
                                    value={search}
                                    onChange={(event) => setFilter('q', event.target.value)}
                                />
                            </label>
                            <select
                                className="form-select-dark"
                                value={competition}
                                aria-label="Filter by competition"
                                onChange={(event) => setFilter('competition', event.target.value, 'all')}
                            >
                                <option value="all">All competitions</option>
                                {matchesQuery.data?.competitions.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                            <select
                                className="form-select-dark"
                                value={season}
                                aria-label="Filter by season"
                                onChange={(event) => setFilter('season', event.target.value, 'all')}
                            >
                                <option value="all">All seasons</option>
                                {matchesQuery.data?.seasons.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                            <select
                                className="form-select-dark"
                                value={sortBy}
                                aria-label="Sort matches"
                                onChange={(event) => setFilter('sort', event.target.value, 'date-desc')}
                            >
                                <option value="date-desc">Newest first</option>
                                <option value="date-asc">Oldest first</option>
                                <option value="competition">Competition</option>
                                <option value="season">Season</option>
                            </select>
                            <button className="btn-ghost" type="button" onClick={resetFilters} disabled={!hasFilters}>
                                Reset
                            </button>
                        </div>
                    </div>
                </section>

                <FadeInUp>
                    <section className="glass-card overflow-hidden">
                        <div className="flex flex-col gap-2 border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">Fixture list</h2>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Showing {visibleMatches.length} of {summary.filteredMatches} matches
                                </p>
                            </div>
                            <span className="tag-glow inline-flex w-fit items-center gap-1">
                                <CalendarDays size={13} />
                                {sortBy === 'date-desc' ? 'Newest first' : sortBy === 'date-asc' ? 'Oldest first' : sortBy}
                            </span>
                        </div>

                        {matchesQuery.data?.matches.length ? (
                            <StaggerContainer className="divide-y divide-[var(--border-soft)]" staggerDelay={0.035}>
                                {visibleMatches.map((match) => (
                                    <StaggerItem key={match.match_id}>
                                        <article className="grid gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-soft)] lg:grid-cols-[minmax(0,1.4fr)_170px_1fr_auto] lg:items-center">
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Crosshair className="h-4 w-4 shrink-0 text-[var(--primary-strong)]" />
                                                    <h3
                                                        className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]"
                                                        title={`${match.home_team?.team_name || 'Home'} vs ${match.away_team?.team_name || 'Away'}`}
                                                    >
                                                        <span>{match.home_team?.team_name || 'Home'}</span>
                                                        <span className="px-1.5 text-[var(--text-muted)]"> vs </span>
                                                        <span>{match.away_team?.team_name || 'Away'}</span>
                                                    </h3>
                                                </div>
                                                <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                                                    {match.competition || 'Competition unavailable'} · {match.season || 'Season n/a'}
                                                </p>
                                            </div>

                                            <div className="flex w-fit items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 tabular-nums">
                                                <span className="text-xl font-bold">{match.home_score}</span>
                                                <span className="text-[var(--text-muted)]">-</span>
                                                <span className="text-xl font-bold">{match.away_score}</span>
                                            </div>

                                            <div className="text-sm text-[var(--text-secondary)]">
                                                {formatMatchDate(match.match_date)}
                                            </div>

                                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                                <button
                                                    className="btn-ghost"
                                                    type="button"
                                                    onClick={() => navigate(`/matches/${match.match_id}/overview`)}
                                                >
                                                    Open <ArrowRight size={14} />
                                                </button>
                                                <button
                                                    className="btn-glow"
                                                    type="button"
                                                    onClick={() => navigate(`/matches/${match.match_id}/overview?run=1`)}
                                                >
                                                    <Play size={14} /> Analyze
                                                </button>
                                            </div>
                                        </article>
                                    </StaggerItem>
                                ))}
                                {hasMoreMatches && (
                                    <div className="flex justify-center px-5 py-4">
                                        <button
                                            className="btn-ghost"
                                            type="button"
                                            onClick={() => setVisibleLimit((current) => current + 60)}
                                        >
                                            Show 60 more matches
                                        </button>
                                    </div>
                                )}
                            </StaggerContainer>
                        ) : (
                            <div className="p-5">
                                <EmptyState
                                    title="No matches match these filters"
                                    description="Widen the search, change competition or season, or reset the catalog filters."
                                    icon={<Search size={36} />}
                                    action={
                                        <button className="btn-ghost" type="button" onClick={resetFilters}>
                                            Reset filters
                                        </button>
                                    }
                                />
                            </div>
                        )}
                    </section>
                </FadeInUp>
            </div>
        </PageTransition>
    );
}
