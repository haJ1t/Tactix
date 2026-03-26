import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { LoadingState } from '@/shared/ui/LoadingState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { formatMatchDate } from '@/shared/lib/format';

export default function MatchesPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [competition, setCompetition] = useState('all');
    const [season, setSeason] = useState('all');
    const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'competition' | 'season'>('date-desc');
    const matchesQuery = useMatches({ search, competition, season, sortBy });

    const summary = useMemo(
        () => ({
            totalMatches: matchesQuery.data?.total || 0,
            filteredMatches: matchesQuery.data?.matches.length || 0,
            competitions: matchesQuery.data?.competitions.length || 0,
            seasons: matchesQuery.data?.seasons.length || 0,
        }),
        [matchesQuery.data]
    );
    const heroSignals = useMemo(
        () => [
            `${summary.competitions} competitions`,
            `${summary.seasons} season views`,
            'Analyst-grade discovery',
        ],
        [summary.competitions, summary.seasons]
    );

    if (matchesQuery.isLoading) {
        return <LoadingState title="Loading matches" description="Preparing the match discovery workspace." />;
    }

    if (matchesQuery.isError) {
        return (
            <ErrorState
                title="Matches unavailable"
                description="The match catalog could not be loaded."
                onRetry={() => void matchesQuery.refetch()}
            />
        );
    }

    return (
        <div className="workspace-stack matches-browser matches-editorial">
            <section className="matches-hero card theater-hero theater-hero-browser">
                <div className="card-body matches-hero-body">
                    <div className="matches-hero-copy">
                        <span className="hero-eyebrow">Match Discovery</span>
                        <h1 className="page-title">Matches</h1>
                        <p className="page-subtitle">
                            Browse the library, narrow the right fixture quickly, and move into a single match workspace when the story is worth investigating.
                        </p>
                        <div className="floating-signal-row">
                            {heroSignals.map((signal) => (
                                <span key={signal} className="floating-signal-chip">
                                    {signal}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="matches-hero-side">
                        <span className="hero-kicker">Visible now</span>
                        <strong>{summary.filteredMatches}</strong>
                        <p>{summary.totalMatches} matches in the current catalog</p>
                    </div>
                </div>
            </section>

            <section className="card matches-control-surface theater-rail">
                <div className="card-body workspace-stack">
                    <div className="matches-toolbar-header">
                        <div>
                            <span className="section-eyebrow">Control Surface</span>
                            <p className="section-support">Search, refine, and sort before stepping into the workspace.</p>
                        </div>
                        <span className="toolbar-caption">Fast scan</span>
                    </div>

                    <div className="matches-toolbar">
                        <div className="search-box matches-search-box">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                            </svg>
                            <input
                                className="search-input"
                                placeholder="Search team, competition, or season"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>

                        <div className="matches-toolbar-selects">
                            <select className="form-select" value={competition} onChange={(event) => setCompetition(event.target.value)}>
                                <option value="all">All competitions</option>
                                {matchesQuery.data?.competitions.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                            <select className="form-select" value={season} onChange={(event) => setSeason(event.target.value)}>
                                <option value="all">All seasons</option>
                                {matchesQuery.data?.seasons.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                            <select className="form-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                                <option value="date-desc">Newest first</option>
                                <option value="date-asc">Oldest first</option>
                                <option value="competition">Competition</option>
                                <option value="season">Season</option>
                            </select>
                        </div>
                    </div>

                    <div className="editorial-stat-row">
                        <div className="editorial-stat">
                            <span className="editorial-stat-label">Catalog size</span>
                            <strong>{summary.totalMatches}</strong>
                        </div>
                        <div className="editorial-stat">
                            <span className="editorial-stat-label">Visible results</span>
                            <strong>{summary.filteredMatches}</strong>
                        </div>
                        <div className="editorial-stat">
                            <span className="editorial-stat-label">Competitions</span>
                            <strong>{summary.competitions}</strong>
                        </div>
                        <div className="editorial-stat">
                            <span className="editorial-stat-label">Seasons</span>
                            <strong>{summary.seasons}</strong>
                        </div>
                    </div>
                </div>
            </section>

            <section className="card theater-results-shell">
                <div className="card-header matches-results-header theater-results-header">
                    <div>
                        <h3 className="card-title">Match Library</h3>
                        <p className="card-subtitle">Each row opens a full workspace or starts analysis directly.</p>
                    </div>
                    <span className="results-count">{summary.filteredMatches} matches</span>
                </div>
                <div className="card-body workspace-stack">
                    {matchesQuery.data?.matches.length ? (
                        <div className="match-list editorial-match-list">
                            {matchesQuery.data.matches.map((match) => (
                                <article key={match.match_id} className="editorial-match-row">
                                    <div className="editorial-match-main">
                                        <div className="editorial-match-teams">
                                            <div className="editorial-team-block">
                                                <span className="editorial-team-name">{match.home_team?.team_name || 'Home'}</span>
                                                <span className="editorial-team-role">Home</span>
                                            </div>
                                            <div className="editorial-match-score">
                                                <span className="editorial-score">{match.home_score}</span>
                                                <span className="editorial-score-divider">:</span>
                                                <span className="editorial-score">{match.away_score}</span>
                                            </div>
                                            <div className="editorial-team-block editorial-team-block-away">
                                                <span className="editorial-team-name">{match.away_team?.team_name || 'Away'}</span>
                                                <span className="editorial-team-role">Away</span>
                                            </div>
                                        </div>

                                        <div className="editorial-match-meta">
                                            <span className="editorial-meta-pill">{match.competition || 'Competition'}</span>
                                            <span>{match.season || 'Season n/a'}</span>
                                            <span className="meta-divider">•</span>
                                            <span>{formatMatchDate(match.match_date)}</span>
                                            <span className="editorial-link-hint">Workspace ready</span>
                                        </div>
                                    </div>

                                    <div className="editorial-match-actions">
                                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/matches/${match.match_id}/overview`)}>
                                            Open Match
                                        </button>
                                        <button className="btn btn-primary btn-sm btn-quiet-primary" onClick={() => navigate(`/matches/${match.match_id}/overview?run=1`)}>
                                            Run Analysis
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state empty-state-editorial">
                            <h3>No matches match the current view</h3>
                            <p>Widen the search or reset one of the filters to bring more fixtures back into the discovery list.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
