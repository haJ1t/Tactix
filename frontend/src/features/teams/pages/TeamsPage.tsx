import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { PageTransition, FadeInUp, StaggerContainer, StaggerItem, GlassCard, AnimatedCounter } from '@/shared/ui/motion';
import { motion } from 'framer-motion';
import { Search, Shield, Globe, Building2, Eye } from 'lucide-react';

export default function TeamsPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [segment, setSegment] = useState<'all' | 'national' | 'club'>('all');
    const teamsQuery = useTeams({ search, segment });

    if (teamsQuery.isLoading) {
        return <LoadingState title="Loading teams" description="Preparing the team discovery workspace." />;
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

    return (
        <PageTransition>
            <div className="space-y-8">
                {/* Hero Section */}
                <FadeInUp>
                    <div className="relative overflow-hidden rounded-2xl border border-white/[0.04] bg-gradient-to-br from-primary-500/10 via-transparent to-transparent p-8">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/20">
                                    <Shield className="h-5 w-5 text-primary-400" />
                                </div>
                                <h1 className="text-3xl font-bold text-white">Teams</h1>
                            </div>
                            <p className="text-[#94A3B8] max-w-2xl">
                                Browse season-scoped team workspaces so player pools and tactical profiles stay aligned with the correct campaign.
                            </p>
                        </div>
                    </div>
                </FadeInUp>

                {/* Stat Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FadeInUp delay={0.05}>
                        <GlassCard hover={false} className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/15">
                                    <Shield className="h-4 w-4 text-primary-400" />
                                </div>
                                <span className="text-sm text-[#94A3B8]">Team Seasons</span>
                            </div>
                            <AnimatedCounter value={teamsQuery.data?.total || 0} className="text-2xl font-bold text-white" />
                        </GlassCard>
                    </FadeInUp>
                    <FadeInUp delay={0.1}>
                        <GlassCard hover={false} className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                                    <Globe className="h-4 w-4 text-blue-400" />
                                </div>
                                <span className="text-sm text-[#94A3B8]">National Teams</span>
                            </div>
                            <AnimatedCounter value={teamsQuery.data?.nationalCount || 0} className="text-2xl font-bold text-white" />
                        </GlassCard>
                    </FadeInUp>
                    <FadeInUp delay={0.15}>
                        <GlassCard hover={false} className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                                    <Building2 className="h-4 w-4 text-amber-400" />
                                </div>
                                <span className="text-sm text-[#94A3B8]">Club Teams</span>
                            </div>
                            <AnimatedCounter value={teamsQuery.data?.clubCount || 0} className="text-2xl font-bold text-white" />
                        </GlassCard>
                    </FadeInUp>
                    <FadeInUp delay={0.2}>
                        <GlassCard hover={false} className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
                                    <Eye className="h-4 w-4 text-emerald-400" />
                                </div>
                                <span className="text-sm text-[#94A3B8]">Current View</span>
                            </div>
                            <AnimatedCounter value={teamsQuery.data?.teams.length || 0} className="text-2xl font-bold text-white" />
                        </GlassCard>
                    </FadeInUp>
                </div>

                {/* Team Directory */}
                <FadeInUp delay={0.25}>
                    <GlassCard hover={false} className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-white">Team Directory</h3>
                            <span className="text-sm text-[#94A3B8]">{teamsQuery.data?.teams.length || 0} season entries</span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                                <input
                                    className="form-input-dark w-full pl-10"
                                    placeholder="Search team or country"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </div>
                            <select
                                className="form-select-dark"
                                value={segment}
                                onChange={(event) => setSegment(event.target.value as typeof segment)}
                            >
                                <option value="all">All team seasons</option>
                                <option value="national">National team seasons</option>
                                <option value="club">Club team seasons</option>
                            </select>
                        </div>

                        <StaggerContainer className="space-y-3">
                            {teamsQuery.data?.teams.map((team) => (
                                <StaggerItem key={`${team.team_id}-${team.season}`}>
                                    <GlassCard className="p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="text-white font-medium">{team.team_name}</span>
                                                    <span className="tag-glow">{team.season}</span>
                                                    <span className={team.segment === 'national' ? 'tag-blue' : 'tag-amber'}>
                                                        {team.segment === 'national' ? 'National' : 'Club'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-[#94A3B8]">
                                                    <span>{team.country || 'Country n/a'}</span>
                                                    <span className="text-white/20">|</span>
                                                    <span>{team.matchCount} matches</span>
                                                </div>
                                            </div>
                                            <motion.button
                                                className="btn-glow whitespace-nowrap"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => navigate(`/teams/${team.team_id}/overview?season=${encodeURIComponent(team.season)}`)}
                                            >
                                                Open Team
                                            </motion.button>
                                        </div>
                                    </GlassCard>
                                </StaggerItem>
                            ))}
                        </StaggerContainer>
                    </GlassCard>
                </FadeInUp>
            </div>
        </PageTransition>
    );
}
