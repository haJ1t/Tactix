import { Link } from 'react-router-dom';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { useReports } from '@/features/reports/hooks/useReports';
import { StatCard } from '@/shared/ui/StatCard';
import { LoadingState } from '@/shared/ui/LoadingState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { formatDateTime, formatMatchDate } from '@/shared/lib/format';
import { PageTransition, FadeInUp, StaggerContainer, StaggerItem, GlassCard, FloatingOrb, AnimatedCounter } from '@/shared/ui/motion';
import { motion } from 'framer-motion';
import { Crosshair, Users, FileText, TrendingUp, ArrowRight } from 'lucide-react';

export default function OverviewPage() {
    const matchesQuery = useMatches();
    const teamsQuery = useTeams();
    const reportsQuery = useReports();

    if (matchesQuery.isLoading || teamsQuery.isLoading) {
        return <LoadingState title="Loading overview" description="Building the latest workspace summary." />;
    }

    if (matchesQuery.isError || teamsQuery.isError) {
        return (
            <ErrorState
                title="Overview unavailable"
                description="Core dashboard metrics could not be loaded."
                onRetry={() => {
                    void matchesQuery.refetch();
                    void teamsQuery.refetch();
                }}
            />
        );
    }

    const latestReport = reportsQuery.data?.[0] || null;
    const recentReports = reportsQuery.data?.slice(0, 4) || [];

    return (
        <PageTransition>
            <div className="space-y-8">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-2xl p-8 lg:p-10" style={{ background: 'linear-gradient(135deg, #111118 0%, #0A0A0F 50%, #0D1A0F 100%)' }}>
                    <FloatingOrb color="#22C55E" size={300} top="-10%" left="70%" />
                    <FloatingOrb color="#3B82F6" size={200} top="60%" left="-5%" delay={2} />

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                        <div className="space-y-4 max-w-xl">
                            <motion.span
                                className="inline-block text-xs font-semibold uppercase tracking-widest text-primary-400"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                Analyst Overview
                            </motion.span>
                            <motion.h1
                                className="text-3xl lg:text-4xl font-bold text-white text-glow"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                Your Tactical Command Center
                            </motion.h1>
                            <motion.p
                                className="text-[#94A3B8] text-base leading-relaxed"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                Discover matches, analyze passing networks, and generate analyst reports from one unified workspace.
                            </motion.p>
                            <motion.div
                                className="flex gap-3 pt-2"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <Link to="/matches" className="btn-glow inline-flex items-center gap-2 text-sm">
                                    Browse Matches <ArrowRight size={16} />
                                </Link>
                                <Link to={latestReport ? `/reports/${latestReport.id}` : '/reports'} className="btn-ghost inline-flex items-center gap-2 text-sm">
                                    {latestReport ? 'Latest Report' : 'Open Reports'}
                                </Link>
                            </motion.div>
                        </div>

                        <motion.div
                            className="glass-card p-6 min-w-[240px]"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-primary-400 block mb-4">Dataset</span>
                            <div className="space-y-3">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs text-[#94A3B8]">Matches</span>
                                    <span className="text-lg font-bold text-white"><AnimatedCounter value={matchesQuery.data?.total || 0} /></span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs text-[#94A3B8]">Teams</span>
                                    <span className="text-lg font-bold text-white"><AnimatedCounter value={teamsQuery.data?.total || 0} /></span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs text-[#94A3B8]">Reports</span>
                                    <span className="text-lg font-bold text-white"><AnimatedCounter value={reportsQuery.data?.length || 0} /></span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Stat Cards */}
                <FadeInUp>
                    <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StaggerItem>
                            <StatCard label="Matches in library" value={matchesQuery.data?.total || 0} icon={<Crosshair size={16} />} tone="accent" />
                        </StaggerItem>
                        <StaggerItem>
                            <StatCard label="Team seasons" value={teamsQuery.data?.total || 0} icon={<Users size={16} />} tone="success" />
                        </StaggerItem>
                        <StaggerItem>
                            <StatCard label="Saved reports" value={reportsQuery.data?.length || 0} icon={<FileText size={16} />} tone="warning" />
                        </StaggerItem>
                        <StaggerItem>
                            <StatCard
                                label="Latest analyzed"
                                value={latestReport ? `${latestReport.homeTeam} vs ${latestReport.awayTeam}` : 'None yet'}
                                icon={<TrendingUp size={16} />}
                            />
                        </StaggerItem>
                    </StaggerContainer>
                </FadeInUp>

                {/* Quick Actions */}
                <FadeInUp delay={0.1}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <GlassCard className="p-6 group" onClick={() => {}} hover>
                            <Link to="/matches" className="block space-y-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-500/10 text-primary-400 group-hover:bg-primary-500/20 transition-colors">
                                    <Crosshair size={20} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Browse</span>
                                    <h3 className="text-base font-semibold text-white mt-0.5">Matches</h3>
                                    <p className="text-sm text-[#94A3B8] mt-1">Open the fixture library and launch a workspace.</p>
                                </div>
                            </Link>
                        </GlassCard>

                        <GlassCard className="p-6 group" onClick={() => {}} hover>
                            <Link to="/teams" className="block space-y-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Review</span>
                                    <h3 className="text-base font-semibold text-white mt-0.5">Team Seasons</h3>
                                    <p className="text-sm text-[#94A3B8] mt-1">Inspect season-scoped profiles and tactical DNA.</p>
                                </div>
                            </Link>
                        </GlassCard>

                        <GlassCard className="p-6 group" onClick={() => {}} hover>
                            <Link to={latestReport ? `/reports/${latestReport.id}` : '/reports'} className="block space-y-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Resume</span>
                                    <h3 className="text-base font-semibold text-white mt-0.5">{latestReport ? 'Latest Report' : 'Reports'}</h3>
                                    <p className="text-sm text-[#94A3B8] mt-1">{latestReport ? 'Jump back to the most recent saved analysis.' : 'Open the saved report library.'}</p>
                                </div>
                            </Link>
                        </GlassCard>
                    </div>
                </FadeInUp>

                {/* Latest Analysis */}
                {latestReport && (
                    <FadeInUp delay={0.15}>
                        <GlassCard className="p-6" hover={false}>
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-primary-400">Latest Analysis</span>
                                    <h3 className="text-lg font-semibold text-white mt-1">{latestReport.homeTeam} vs {latestReport.awayTeam}</h3>
                                </div>
                                <span className="tag-glow">{latestReport.scoreline}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <span className="text-xs text-[#94A3B8] block">Competition</span>
                                    <span className="text-sm font-medium text-white">{latestReport.competition}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-[#94A3B8] block">Match date</span>
                                    <span className="text-sm font-medium text-white">{formatMatchDate(latestReport.matchDate)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-[#94A3B8] block">Saved at</span>
                                    <span className="text-sm font-medium text-white">{formatDateTime(latestReport.createdAt)}</span>
                                </div>
                            </div>
                        </GlassCard>
                    </FadeInUp>
                )}

                {/* Recent Reports */}
                <FadeInUp delay={0.2}>
                    <GlassCard className="p-6" hover={false}>
                        <h3 className="text-sm font-semibold text-white mb-4">Recent Reports</h3>
                        {recentReports.length > 0 ? (
                            <StaggerContainer className="space-y-2" staggerDelay={0.05}>
                                {recentReports.map((report, index) => (
                                    <StaggerItem key={report.id}>
                                        <Link
                                            to={`/reports/${report.id}`}
                                            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-mono text-[#94A3B8] w-6">{String(index + 1).padStart(2, '0')}</span>
                                                <div>
                                                    <span className="text-sm font-medium text-white">{report.homeTeam} vs {report.awayTeam}</span>
                                                    <p className="text-xs text-[#94A3B8] mt-0.5">{report.competition} · {formatMatchDate(report.matchDate)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="tag-glow text-[11px]">{report.scoreline}</span>
                                                <span className="text-[11px] text-[#94A3B8]">{formatDateTime(report.createdAt)}</span>
                                            </div>
                                        </Link>
                                    </StaggerItem>
                                ))}
                            </StaggerContainer>
                        ) : (
                            <p className="text-sm text-[#94A3B8]">Saved reports will appear here once created.</p>
                        )}
                    </GlassCard>
                </FadeInUp>
            </div>
        </PageTransition>
    );
}
