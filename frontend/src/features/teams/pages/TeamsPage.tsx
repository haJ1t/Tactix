import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, Globe, Search, Shield } from 'lucide-react';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { formatMatchDate } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { AnimatedCounter, FadeInUp, PageTransition, StaggerContainer, StaggerItem } from '@/shared/ui/motion';

type TeamSegment = 'all' | 'national' | 'club';

const getSegment = (value: string | null): TeamSegment =>
    value === 'national' || value === 'club' ? value : 'all';

export default function TeamsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const search = searchParams.get('q') || '';
    const segment = getSegment(searchParams.get('segment'));
    const teamsQuery = useTeams({ search, segment });

    const setFilter = (key: string, value: string, defaultValue = '') => {
        const next = new URLSearchParams(searchParams);

        if (!value || value === defaultValue) {
            next.delete(key);
        } else {
            next.set(key, value);
        }

        setSearchParams(next, { replace: true });
    };

    const resetFilters = () => {
        setSearchParams({}, { replace: true });
    };

    if (teamsQuery.isLoading) {
        return <LoadingState title="Loading teams" description="Preparing season-scoped team entries." />;
    }

    if (teamsQuery.isError) {
        return (
            <ErrorState
                title="Teams unavailable"
                description="The team catalog could not be loaded."
                onRetry={() => void teamsQuery.refetch()}
            />
        );
    }

    const visibleCount = teamsQuery.data?.teams.length || 0;
    const totalCount = teamsQuery.data?.total || 0;

    return (
        <PageTransition>
            <div className="space-y-5">
                <section className="glass-card overflow-hidden">
                    <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] bg-[var(--surface-raised)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--primary-strong)]">Team seasons</p>
                            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Teams</h1>
                            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
                                Browse team identity by season so match history, player pools, and tactical profiles stay in scope.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                            {[
                                { label: 'Season entries', value: totalCount, icon: Shield },
                                { label: 'Visible', value: visibleCount, icon: Search },
                                { label: 'National', value: teamsQuery.data?.nationalCount || 0, icon: Globe },
                                { label: 'Club', value: teamsQuery.data?.clubCount || 0, icon: Building2 },
                            ].map((item) => (
                                <div key={item.label} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2">
                                    <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                        <item.icon size={13} />
                                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em]">{item.label}</span>
                                    </div>
                                    <strong className="mt-1 block text-lg tabular-nums text-[var(--text-primary)]">
                                        <AnimatedCounter value={item.value} />
                                    </strong>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-3 p-5 lg:grid-cols-[minmax(240px,1fr)_220px_auto]">
                        <label className="relative block">
                            <span className="sr-only">Search teams</span>
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                            <input
                                className="form-input-dark pl-10"
                                placeholder="Search team, country, or season"
                                value={search}
                                onChange={(event) => setFilter('q', event.target.value)}
                            />
                        </label>
                        <select
                            className="form-select-dark"
                            value={segment}
                            aria-label="Filter teams by segment"
                            onChange={(event) => setFilter('segment', event.target.value, 'all')}
                        >
                            <option value="all">All team seasons</option>
                            <option value="national">National teams</option>
                            <option value="club">Club teams</option>
                        </select>
                        <button className="btn-ghost" type="button" onClick={resetFilters} disabled={!search && segment === 'all'}>
                            Reset
                        </button>
                    </div>
                </section>

                <FadeInUp>
                    <section className="glass-card overflow-hidden">
                        <div className="flex flex-col gap-2 border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">Team directory</h2>
                                <p className="text-sm text-[var(--text-secondary)]">{visibleCount} visible entries</p>
                            </div>
                            <span className="tag-glow w-fit">{totalCount} season entries</span>
                        </div>

                        {teamsQuery.data?.teams.length ? (
                            <StaggerContainer className="divide-y divide-[var(--border-soft)]" staggerDelay={0.035}>
                                {teamsQuery.data.teams.map((team) => (
                                    <StaggerItem key={`${team.team_id}-${team.season}`}>
                                        <article className="grid gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-soft)] lg:grid-cols-[minmax(0,1fr)_180px_160px_auto] lg:items-center">
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                    <Shield className="h-4 w-4 shrink-0 text-[var(--primary-strong)]" />
                                                    <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]" title={team.team_name}>
                                                        {team.team_name}
                                                    </h3>
                                                    <span className={team.segment === 'national' ? 'tag-blue' : 'tag-amber'}>
                                                        {team.segment === 'national' ? 'National' : 'Club'}
                                                    </span>
                                                </div>
                                                <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                                                    {team.country || 'Country n/a'} · latest match {formatMatchDate(team.latestMatchDate)}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Season</span>
                                                <strong className="text-sm text-[var(--text-primary)]">{team.season}</strong>
                                            </div>

                                            <div>
                                                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Matches</span>
                                                <strong className="text-sm tabular-nums text-[var(--text-primary)]">{team.matchCount}</strong>
                                            </div>

                                            <button
                                                className="btn-glow w-full sm:w-fit lg:justify-self-end"
                                                type="button"
                                                onClick={() => navigate(`/teams/${team.team_id}/overview?season=${encodeURIComponent(team.season)}`)}
                                            >
                                                Open team <ArrowRight size={14} />
                                            </button>
                                        </article>
                                    </StaggerItem>
                                ))}
                            </StaggerContainer>
                        ) : (
                            <div className="p-5">
                                <EmptyState
                                    title="No team seasons match these filters"
                                    description="Try a broader search or reset the segment filter."
                                    icon={<Shield size={36} />}
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
