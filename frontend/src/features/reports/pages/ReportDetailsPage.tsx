import { useNavigate, useParams } from 'react-router-dom';
import { useDeleteReport, useImportLegacyReport, useReport } from '@/features/reports/hooks/useReports';
import { reportService } from '@/features/reports/services/reportService';
import { downloadTextFile } from '@/shared/lib/download';
import { formatDateTime, formatMatchDate } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/EmptyState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { PageTransition, FadeInUp, GlassCard, StaggerContainer, StaggerItem } from '@/shared/ui/motion';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Trash2, RefreshCw, FileJson, FileText, Trophy, Zap, Users, MessageSquare } from 'lucide-react';

export default function ReportDetailsPage() {
    const navigate = useNavigate();
    const { reportId } = useParams<{ reportId: string }>();
    const reportQuery = useReport(reportId || null);
    const deleteReportMutation = useDeleteReport();
    const importLegacyMutation = useImportLegacyReport();

    // Loading branch
    if (reportQuery.isLoading) {
        return <LoadingState title="Loading report" description="Preparing the analyst dossier details." compact />;
    }

    // Not found branch
    if (!reportQuery.data) {
        return (
            <EmptyState
                title="Report not found"
                description="The requested report no longer exists or has not been created on this browser yet."
                action={
                    <motion.button
                        className="btn-glow"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/reports')}
                    >
                        Back to Reports
                    </motion.button>
                }
            />
        );
    }

    // Delete then go back
    const deleteAndExit = async () => {
        if (reportQuery.data?.kind !== 'artifact') {
            return;
        }

        await deleteReportMutation.mutateAsync(reportQuery.data.artifact.id);
        navigate('/reports');
    };

    // Render legacy report variant
    if (reportQuery.data.kind === 'legacy') {
        const report = reportQuery.data.legacy;

        return (
            <PageTransition>
                <div className="space-y-6">
                    {/* Header */}
                    <FadeInUp>
                        <div className="relative overflow-hidden rounded-2xl border border-white/[0.04] bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-8">
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                                        <FileText className="h-5 w-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold text-white">Legacy Report</h1>
                                        <p className="text-sm text-[#94A3B8]">Browser-local report -- convert to backend PDF for persistence.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </FadeInUp>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Match Summary */}
                        <FadeInUp delay={0.05}>
                            <GlassCard hover={false} className="p-6 h-full">
                                <h3 className="text-lg font-semibold text-white mb-5">Match Summary</h3>
                                <div className="space-y-4">
                                    {[
                                        { label: 'Match', value: `${report.matchSummary.homeTeam} vs ${report.matchSummary.awayTeam}` },
                                        { label: 'Score', value: report.matchSummary.score },
                                        { label: 'Competition', value: report.matchSummary.competition },
                                        { label: 'Saved at', value: formatDateTime(report.createdAt) },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                                            <span className="text-sm text-[#94A3B8]">{item.label}</span>
                                            <span className="text-sm font-medium text-white">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        </FadeInUp>

                        {/* Actions */}
                        <FadeInUp delay={0.1}>
                            <GlassCard hover={false} className="p-6 h-full">
                                <h3 className="text-lg font-semibold text-white mb-5">Actions</h3>
                                <div className="space-y-3">
                                    <motion.button
                                        className="btn-glow w-full inline-flex items-center justify-center gap-2"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => void importLegacyMutation.mutateAsync(report).then((created) => navigate(`/reports/${created.id}`))}
                                    >
                                        <RefreshCw className="h-4 w-4" /> Convert to PDF
                                    </motion.button>
                                    <motion.button
                                        className="btn-ghost w-full inline-flex items-center justify-center gap-2"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => downloadTextFile(JSON.stringify(report, null, 2), `legacy_report_${report.id}.json`, 'application/json')}
                                    >
                                        <FileJson className="h-4 w-4" /> Export JSON
                                    </motion.button>
                                    <motion.button
                                        className="btn-ghost w-full inline-flex items-center justify-center gap-2"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => navigate('/reports')}
                                    >
                                        <ArrowLeft className="h-4 w-4" /> Back to Reports
                                    </motion.button>
                                </div>
                            </GlassCard>
                        </FadeInUp>
                    </div>
                </div>
            </PageTransition>
        );
    }

    // Backend artifact branch
    const report = reportQuery.data.artifact;

    return (
        <PageTransition>
            <div className="space-y-6">
                {/* Header */}
                <FadeInUp>
                    <div className="relative overflow-hidden rounded-2xl border border-white/[0.04] bg-gradient-to-br from-primary-500/10 via-transparent to-transparent p-8">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/20">
                                    <FileText className="h-5 w-5 text-primary-400" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">Report Details</h1>
                                    <p className="text-sm text-[#94A3B8]">
                                        Backend-generated analyst dossier for {report.home_team} vs {report.away_team}.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </FadeInUp>

                {/* Metadata + Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FadeInUp delay={0.05}>
                        <GlassCard hover={false} className="p-6 h-full">
                            <h3 className="text-lg font-semibold text-white mb-5">Artifact Metadata</h3>
                            <div className="space-y-4">
                                {[
                                    { label: 'Match', value: `${report.home_team} vs ${report.away_team}` },
                                    { label: 'Score', value: report.scoreline || 'Unavailable' },
                                    { label: 'Competition', value: report.competition || 'Unavailable' },
                                    { label: 'Match date', value: formatMatchDate(report.match_date || '') },
                                    { label: 'Created', value: formatDateTime(report.created_at) },
                                    { label: 'Source', value: report.source_kind.replace('_', ' ') },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                                        <span className="text-sm text-[#94A3B8]">{item.label}</span>
                                        <span className="text-sm font-medium text-white">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    </FadeInUp>

                    <FadeInUp delay={0.1}>
                        <GlassCard hover={false} className="p-6 h-full">
                            <h3 className="text-lg font-semibold text-white mb-5">Actions</h3>
                            <div className="space-y-3">
                                <motion.button
                                    className="btn-glow w-full inline-flex items-center justify-center gap-2"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => window.open(reportService.getDownloadUrl(report.id), '_blank', 'noopener')}
                                >
                                    <Download className="h-4 w-4" /> Download PDF
                                </motion.button>
                                <motion.button
                                    className="btn-danger-glow w-full inline-flex items-center justify-center gap-2"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => void deleteAndExit()}
                                >
                                    <Trash2 className="h-4 w-4" /> Delete Report
                                </motion.button>
                                <motion.button
                                    className="btn-ghost w-full inline-flex items-center justify-center gap-2"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => navigate('/reports')}
                                >
                                    <ArrowLeft className="h-4 w-4" /> Back to Reports
                                </motion.button>
                            </div>
                        </GlassCard>
                    </FadeInUp>
                </div>

                {/* Executive Summary */}
                <FadeInUp delay={0.15}>
                    <GlassCard hover={false} className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/15">
                                <MessageSquare className="h-4.5 w-4.5 text-primary-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Executive Summary</h3>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-[#94A3B8] leading-relaxed">{report.snapshot_summary.executive_summary || 'Summary unavailable.'}</p>
                            <p className="text-sm text-[#94A3B8] leading-relaxed">{report.snapshot_summary.match_story || 'Match story unavailable.'}</p>
                        </div>
                    </GlassCard>
                </FadeInUp>

                {/* Section Summary + Team Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FadeInUp delay={0.2}>
                        <GlassCard hover={false} className="p-6 h-full">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
                                    <Zap className="h-4.5 w-4.5 text-blue-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">Section Summary</h3>
                            </div>
                            {report.snapshot_summary.section_summary.length > 0 ? (
                                <StaggerContainer className="space-y-3">
                                    {report.snapshot_summary.section_summary.map((section) => (
                                        <StaggerItem key={section.id}>
                                            <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-white">{section.title}</p>
                                                    <p className="text-xs text-[#94A3B8] mt-1">{section.detail}</p>
                                                </div>
                                                <span className="tag-glow shrink-0">{section.status}</span>
                                            </div>
                                        </StaggerItem>
                                    ))}
                                </StaggerContainer>
                            ) : (
                                <p className="text-sm text-[#94A3B8]">Section summary is not available for this artifact.</p>
                            )}
                        </GlassCard>
                    </FadeInUp>

                    <FadeInUp delay={0.25}>
                        <GlassCard hover={false} className="p-6 h-full">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
                                    <Users className="h-4.5 w-4.5 text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">Team Summary</h3>
                            </div>
                            {report.snapshot_summary.team_summaries.length > 0 ? (
                                <StaggerContainer className="space-y-6">
                                    {report.snapshot_summary.team_summaries.map((team) => (
                                        <StaggerItem key={team.team_name}>
                                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                                <h4 className="text-sm font-semibold text-white mb-3">{team.team_name}</h4>
                                                <div className="space-y-2">
                                                    {[
                                                        { label: 'Passes', value: team.total_passes },
                                                        { label: 'Patterns', value: team.patterns },
                                                        { label: 'Counter tactics', value: team.counter_tactics },
                                                        { label: 'Shots / xG', value: `${team.shots} / ${team.xg_total.toFixed(2)}` },
                                                        { label: 'Top connector', value: team.top_connector || 'Unavailable' },
                                                    ].map((item) => (
                                                        <div key={item.label} className="flex items-center justify-between py-1">
                                                            <span className="text-xs text-[#94A3B8]">{item.label}</span>
                                                            <span className="text-xs font-medium text-white">{item.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </StaggerItem>
                                    ))}
                                </StaggerContainer>
                            ) : (
                                <p className="text-sm text-[#94A3B8]">Team summary is not available for this artifact.</p>
                            )}
                        </GlassCard>
                    </FadeInUp>
                </div>

                {/* Final Conclusion */}
                <FadeInUp delay={0.3}>
                    <GlassCard hover={false} className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
                                <Trophy className="h-4.5 w-4.5 text-amber-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Final Conclusion</h3>
                        </div>
                        <p className="text-sm text-[#94A3B8] leading-relaxed">{report.snapshot_summary.final_conclusion || 'Conclusion unavailable.'}</p>
                    </GlassCard>
                </FadeInUp>
            </div>
        </PageTransition>
    );
}
