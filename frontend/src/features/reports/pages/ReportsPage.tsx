import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { useDeleteReport, useGenerateReport, useImportLegacyReport, useReports } from '@/features/reports/hooks/useReports';
import { reportService } from '@/features/reports/services/reportService';
import { formatDateTime, formatMatchDate } from '@/shared/lib/format';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { PageTransition, FadeInUp, GlassCard, StaggerContainer, StaggerItem, ShimmerButton } from '@/shared/ui/motion';
import { motion } from 'framer-motion';
import { FileText, Plus, Download, Trash2, ExternalLink, Archive, RefreshCw } from 'lucide-react';

export default function ReportsPage() {
    const navigate = useNavigate();
    const matchesQuery = useMatches();
    const reportsQuery = useReports();
    const generateReportMutation = useGenerateReport();
    const importLegacyMutation = useImportLegacyReport();
    const deleteReportMutation = useDeleteReport();
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

    const selectedMatch = useMemo(
        () => matchesQuery.data?.matches.find((match) => match.match_id === selectedMatchId) || null,
        [matchesQuery.data?.matches, selectedMatchId]
    );

    if (matchesQuery.isLoading || reportsQuery.isLoading) {
        return <LoadingState title="Loading reports" description="Preparing backend artifacts and legacy report references." />;
    }

    if (matchesQuery.isError || reportsQuery.isError) {
        return (
            <ErrorState
                title="Reports unavailable"
                description="The report library or match catalog could not be loaded."
                onRetry={() => {
                    void matchesQuery.refetch();
                    void reportsQuery.refetch();
                }}
            />
        );
    }

    const generateReport = async () => {
        if (!selectedMatchId) {
            return;
        }

        const created = await generateReportMutation.mutateAsync(selectedMatchId);
        navigate(`/reports/${created.id}`);
    };

    const downloadPdf = (reportId: string) => {
        window.open(reportService.getDownloadUrl(reportId), '_blank', 'noopener');
    };

    return (
        <PageTransition>
            <div className="space-y-8">
                {/* Hero Section */}
                <FadeInUp>
                    <div className="relative overflow-hidden rounded-2xl border border-white/[0.04] bg-gradient-to-br from-primary-500/10 via-transparent to-transparent p-8">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/20">
                                    <FileText className="h-5 w-5 text-primary-400" />
                                </div>
                                <h1 className="text-3xl font-bold text-white">Reports</h1>
                            </div>
                            <p className="text-[#94A3B8] max-w-2xl">
                                Generate backend analyst dossiers, reopen them later, and keep legacy browser reports available until you convert them to PDF.
                            </p>
                        </div>
                    </div>
                </FadeInUp>

                {/* Generate Section */}
                <FadeInUp delay={0.1}>
                    <GlassCard hover={false} className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/15">
                                <Plus className="h-4.5 w-4.5 text-primary-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Generate Analyst Report</h3>
                                <p className="text-sm text-[#94A3B8]">Create a backend-rendered English PDF dossier for a single match.</p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-4">
                            <select
                                className="form-select-dark w-full"
                                value={selectedMatchId || ''}
                                onChange={(event) => setSelectedMatchId(Number(event.target.value) || null)}
                            >
                                <option value="">Select a match...</option>
                                {matchesQuery.data?.matches.map((match) => (
                                    <option key={match.match_id} value={match.match_id}>
                                        {match.home_team?.team_name} vs {match.away_team?.team_name} ({formatMatchDate(match.match_date)})
                                    </option>
                                ))}
                            </select>

                            <div className="flex items-center gap-4 flex-wrap">
                                <ShimmerButton
                                    onClick={() => void generateReport()}
                                    disabled={!selectedMatchId || generateReportMutation.isPending}
                                >
                                    {generateReportMutation.isPending ? 'Generating PDF dossier...' : 'Generate Analyst Report'}
                                </ShimmerButton>
                                {selectedMatch && (
                                    <span className="text-sm text-[#94A3B8]">
                                        {selectedMatch.home_team?.team_name} vs {selectedMatch.away_team?.team_name} · {selectedMatch.competition}
                                    </span>
                                )}
                            </div>
                        </div>
                    </GlassCard>
                </FadeInUp>

                {/* Generated PDF Artifacts */}
                <FadeInUp delay={0.15}>
                    <GlassCard hover={false} className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
                                    <FileText className="h-4.5 w-4.5 text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">Generated PDF Artifacts</h3>
                            </div>
                            <span className="text-sm text-[#94A3B8]">{reportsQuery.generatedReports.length} dossiers</span>
                        </div>

                        {reportsQuery.generatedReports.length > 0 ? (
                            <StaggerContainer className="space-y-3">
                                {reportsQuery.generatedReports.map((report) => (
                                    <StaggerItem key={report.id}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-white">{report.home_team} vs {report.away_team}</p>
                                                <p className="text-xs text-[#94A3B8] mt-1">
                                                    {report.competition || 'Competition unavailable'} · {formatMatchDate(report.match_date || '')} · Generated {formatDateTime(report.created_at)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                                                <span className="tag-glow">{report.scoreline || 'N/A'}</span>
                                                <Link className="btn-ghost inline-flex items-center gap-1.5 text-sm" to={`/reports/${report.id}`}>
                                                    <ExternalLink className="h-3.5 w-3.5" /> Open
                                                </Link>
                                                <motion.button
                                                    className="btn-ghost inline-flex items-center gap-1.5 text-sm"
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => downloadPdf(report.id)}
                                                >
                                                    <Download className="h-3.5 w-3.5" /> PDF
                                                </motion.button>
                                                <motion.button
                                                    className="btn-danger-glow inline-flex items-center gap-1.5 text-sm"
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => void deleteReportMutation.mutateAsync(report.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                </motion.button>
                                            </div>
                                        </div>
                                    </StaggerItem>
                                ))}
                            </StaggerContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] mb-4">
                                    <FileText className="h-6 w-6 text-[#94A3B8]" />
                                </div>
                                <h3 className="text-white font-medium mb-1">No PDF dossiers yet</h3>
                                <p className="text-sm text-[#94A3B8]">Generate an analyst report above to create the first backend artifact.</p>
                            </div>
                        )}
                    </GlassCard>
                </FadeInUp>

                {/* Legacy Reports */}
                <FadeInUp delay={0.2}>
                    <GlassCard hover={false} className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
                                    <Archive className="h-4.5 w-4.5 text-amber-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">Legacy Browser Reports</h3>
                            </div>
                            <span className="text-sm text-[#94A3B8]">{reportsQuery.legacyReports.length} legacy items</span>
                        </div>

                        {reportsQuery.legacyReports.length > 0 ? (
                            <StaggerContainer className="space-y-3">
                                {reportsQuery.legacyReports.map((report) => (
                                    <StaggerItem key={report.id}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-white">{report.matchSummary.homeTeam} vs {report.matchSummary.awayTeam}</p>
                                                <p className="text-xs text-[#94A3B8] mt-1">
                                                    {report.matchSummary.competition} · {formatMatchDate(report.matchSummary.matchDate)} · Saved {formatDateTime(report.createdAt)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                                                <span className="tag-amber">Legacy</span>
                                                <Link className="btn-ghost inline-flex items-center gap-1.5 text-sm" to={`/reports/${report.id}`}>
                                                    <ExternalLink className="h-3.5 w-3.5" /> Open
                                                </Link>
                                                <motion.button
                                                    className="btn-glow inline-flex items-center gap-1.5 text-sm"
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => void importLegacyMutation.mutateAsync(report).then((created) => navigate(`/reports/${created.id}`))}
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" /> Convert to PDF
                                                </motion.button>
                                            </div>
                                        </div>
                                    </StaggerItem>
                                ))}
                            </StaggerContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] mb-4">
                                    <Archive className="h-6 w-6 text-[#94A3B8]" />
                                </div>
                                <h3 className="text-white font-medium mb-1">No legacy reports waiting</h3>
                                <p className="text-sm text-[#94A3B8]">Browser-local reports will appear here until you convert them into backend PDF dossiers.</p>
                            </div>
                        )}
                    </GlassCard>
                </FadeInUp>
            </div>
        </PageTransition>
    );
}
