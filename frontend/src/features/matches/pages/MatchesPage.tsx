import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { LoadingState } from '@/shared/ui/LoadingState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { formatMatchDate } from '@/shared/lib/format';
import { PageTransition, FadeInUp, StaggerContainer, StaggerItem, GlassCard, FloatingOrb, AnimatedCounter } from '@/shared/ui/motion';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Play, ExternalLink } from 'lucide-react';

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
        <PageTransition>
            <div className="space-y-6">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, #111118 0%, #0A0A0F 50%, #0A0F1A 100%)' }}>
                    <FloatingOrb color="#3B82F6" size={250} top="-15%" left="75%" />
                    <FloatingOrb color="#22C55E" size={150} top="70%" left="-3%" delay={1} />

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-widest text-primary-400">Match Discovery</span>
                            <h1 className="text-2xl font-bold text-white">Matches</h1>
                            <p className="text-sm text-[#94A3B8] max-w-lg">Browse the library, narrow the right fixture, and move into a single match workspace.</p>
                        </div>
                        <div className="flex gap-3 items-center">
                            <div className="glass-card px-4 py-2 text-center">
                                <span className="text-2xl font-bold text-white block"><AnimatedCounter value={summary.filteredMatches} /></span>
                                <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Visible</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <FadeInUp>
                    <GlassCard className="p-5 space-y-4" hover={false}>
                        <div className="flex items-center gap-2 text-[#94A3B8] mb-2">
                            <SlidersHorizontal size={14} />
                            <span className="text-xs font-medium uppercase tracking-wider">Control Surface</span>
                        </div>

                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A4A5A]" />
                            <input
                                className="form-input-dark pl-10"
                                placeholder="Search team, competition, or season..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <select className="form-select-dark" value={competition} onChange={(e) => setCompetition(e.target.value)}>
                                <option value="all">All competitions</option>
                                {matchesQuery.data?.competitions.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                            <select className="form-select-dark" value={season} onChange={(e) => setSeason(e.target.value)}>
                                <option value="all">All seasons</option>
                                {matchesQuery.data?.seasons.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                            <select className="form-select-dark" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                                <option value="date-desc">Newest first</option>
                                <option value="date-asc">Oldest first</option>
                                <option value="competition">Competition</option>
                                <option value="season">Season</option>
                            </select>
                        </div>

                        <div className="flex gap-6">
                            <div>
                                <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block">Catalog</span>
                                <span className="text-sm font-semibold text-white"><AnimatedCounter value={summary.totalMatches} /></span>
                            </div>
                            <div>
                                <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block">Visible</span>
                                <span className="text-sm font-semibold text-white"><AnimatedCounter value={summary.filteredMatches} /></span>
                            </div>
                            <div>
                                <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block">Competitions</span>
                                <span className="text-sm font-semibold text-white"><AnimatedCounter value={summary.competitions} /></span>
                            </div>
                            <div>
                                <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block">Seasons</span>
                                <span className="text-sm font-semibold text-white"><AnimatedCounter value={summary.seasons} /></span>
                            </div>
                        </div>
                    </GlassCard>
                </FadeInUp>

                {/* Match List */}
                <FadeInUp delay={0.1}>
                    <GlassCard className="p-5" hover={false}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white">Match Library</h3>
                            <span className="text-xs text-[#94A3B8]">{summary.filteredMatches} matches</span>
                        </div>

                        {matchesQuery.data?.matches.length ? (
                            <StaggerContainer className="space-y-2">
                                {matchesQuery.data.matches.map((match) => (
                                    <StaggerItem key={match.match_id}>
                                        <motion.div
                                            className="flex items-center justify-between p-4 rounded-xl border border-white/[0.04] hover:border-primary-500/20 hover:bg-white/[0.02] transition-all cursor-pointer group"
                                            whileHover={{ x: 4 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-4 mb-1.5">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-semibold text-white">{match.home_team?.team_name || 'Home'}</span>
                                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04]">
                                                            <span className="text-lg font-bold text-white">{match.home_score}</span>
                                                            <span className="text-[#94A3B8] text-sm">:</span>
                                                            <span className="text-lg font-bold text-white">{match.away_score}</span>
                                                        </div>
                                                        <span className="text-sm font-semibold text-white">{match.away_team?.team_name || 'Away'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                                                    <span className="tag-glow text-[10px]">{match.competition || 'Competition'}</span>
                                                    <span>{match.season || 'Season n/a'}</span>
                                                    <span className="text-white/20">·</span>
                                                    <span>{formatMatchDate(match.match_date)}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => navigate(`/matches/${match.match_id}/overview`)}>
                                                    <ExternalLink size={14} />
                                                </button>
                                                <button className="btn-glow text-xs px-3 py-1.5 flex items-center gap-1.5" onClick={() => navigate(`/matches/${match.match_id}/overview?run=1`)}>
                                                    <Play size={12} /> Analyze
                                                </button>
                                            </div>
                                        </motion.div>
                                    </StaggerItem>
                                ))}
                            </StaggerContainer>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-sm text-[#94A3B8]">No matches match the current filters. Widen or reset to see more.</p>
                            </div>
                        )}
                    </GlassCard>
                </FadeInUp>
            </div>
        </PageTransition>
    );
}
