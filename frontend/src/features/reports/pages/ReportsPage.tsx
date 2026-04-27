import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, ArrowRight, Download, ExternalLink, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { useDeleteReport, useGenerateReport, useImportLegacyReport, useReports } from '@/features/reports/hooks/useReports';
import { reportService } from '@/features/reports/services/reportService';
import { formatDateTime, formatMatchDate } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { LoadingState } from '@/shared/ui/LoadingState';
import { FadeInUp, PageTransition, StaggerContainer, StaggerItem } from '@/shared/ui/motion';

export default function ReportsPage() {
    const navigate = useNavigate();
    // Read selection state from URL
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedMatchId = Number(searchParams.get('match')) || null;
    const matchesQuery = useMatches();
    const reportsQuery = useReports();
    const generateReportMutation = useGenerateReport();
    const importLegacyMutation = useImportLegacyReport();
    const deleteReportMutation = useDeleteReport();

    // Memoize chosen match
    const selectedMatch = useMemo(
        () => matchesQuery.data?.matches.find((match) => match.match_id === selectedMatchId) || null,
        [matchesQuery.data?.matches, selectedMatchId]
    );

    // Sync selection back to URL
    const setSelectedMatchId = (matchId: number | null) => {
        const next = new URLSearchParams(searchParams);
        if (matchId) {
            next.set('match', String(matchId));
        } else {
            next.delete('match');
        }
        setSearchParams(next, { replace: true });
    };

    // Loading branch
    if (matchesQuery.isLoading || reportsQuery.isLoading) {
        return <LoadingState title="Loading reports" description="Preparing report artifacts and match options." />;
    }

    // Error branch
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

    // Create new dossier for selected match
    const generateReport = async () => {
        if (!selectedMatchId) {
            return;
        }

        const created = await generateReportMutation.mutateAsync(selectedMatchId);
        navigate(`/reports/${created.id}`);
    };

    // Open the PDF in a new tab
    const downloadPdf = (reportId: string) => {
        window.open(reportService.getDownloadUrl(reportId), '_blank', 'noopener');
    };

    // Confirm and delete report
    const deleteReport = async (reportId: string) => {
        const confirmed = window.confirm('Delete this generated report? This removes the backend artifact.');
        if (!confirmed) {
            return;
        }

        await deleteReportMutation.mutateAsync(reportId);
    };

    return (
        <PageTransition>
            <div className="space-y-5">
                <section className="glass-card overflow-hidden">
                    <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] bg-[var(--surface-raised)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--primary-strong)]">Report library</p>
                            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Reports</h1>
                            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
                                Generate backend PDF dossiers, reopen saved artifacts, and convert legacy browser reports when needed.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:min-w-[320px]">
                            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2">
                                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                    PDFs
                                </span>
                                <strong className="mt-1 block text-lg tabular-nums">{reportsQuery.generatedReports.length}</strong>
                            </div>
                            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2">
                                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                    Legacy
                                </span>
                                <strong className="mt-1 block text-lg tabular-nums">{reportsQuery.legacyReports.length}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]" htmlFor="report-match">
                                Match
                            </label>
                            <select
                                id="report-match"
                                className="form-select-dark"
                                value={selectedMatchId || ''}
                                onChange={(event) => setSelectedMatchId(Number(event.target.value) || null)}
                            >
                                <option value="">Select a match to generate a dossier</option>
                                {matchesQuery.data?.matches.map((match) => (
                                    <option key={match.match_id} value={match.match_id}>
                                        {match.home_team?.team_name} vs {match.away_team?.team_name} ({formatMatchDate(match.match_date)})
                                    </option>
                                ))}
                            </select>
                            {selectedMatch && (
                                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                    {selectedMatch.home_team?.team_name} vs {selectedMatch.away_team?.team_name} · {selectedMatch.competition || 'Competition unavailable'}
                                </p>
                            )}
                        </div>
                        <button
                            className="btn-glow"
                            onClick={() => void generateReport()}
                            disabled={!selectedMatchId || generateReportMutation.isPending}
                            type="button"
                        >
                            <Plus size={15} />
                            {generateReportMutation.isPending ? 'Generating PDF...' : 'Generate report'}
                        </button>
                    </div>
                </section>

                {generateReportMutation.isError && (
                    <div className="rounded-lg border border-[rgba(184,91,79,0.22)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                        Report generation failed. The match selection was preserved so you can try again.
                    </div>
                )}

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                    <FadeInUp>
                        <div className="glass-card overflow-hidden">
                            <div className="flex flex-col gap-2 border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                                        <FileText size={17} />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-semibold text-[var(--text-primary)]">Generated PDF dossiers</h2>
                                        <p className="text-sm text-[var(--text-secondary)]">{reportsQuery.generatedReports.length} saved artifacts</p>
                                    </div>
                                </div>
                            </div>

                            {reportsQuery.generatedReports.length > 0 ? (
                                <StaggerContainer className="divide-y divide-[var(--border-soft)]" staggerDelay={0.035}>
                                    {reportsQuery.generatedReports.map((report) => (
                                        <StaggerItem key={report.id}>
                                            <article className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                                                <div className="min-w-0">
                                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                        <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                            {report.home_team} vs {report.away_team}
                                                        </h3>
                                                        <span className="tag-glow">{report.scoreline || 'Score n/a'}</span>
                                                    </div>
                                                    <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                                                        {report.competition || 'Competition unavailable'} · {formatMatchDate(report.match_date || '')} · Generated{' '}
                                                        {formatDateTime(report.created_at)}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                                    <Link className="btn-ghost" to={`/reports/${report.id}`}>
                                                        <ExternalLink size={14} /> Open
                                                    </Link>
                                                    <button className="btn-ghost" type="button" onClick={() => downloadPdf(report.id)}>
                                                        <Download size={14} /> PDF
                                                    </button>
                                                    <button className="btn-danger-glow" type="button" onClick={() => void deleteReport(report.id)}>
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                </div>
                                            </article>
                                        </StaggerItem>
                                    ))}
                                </StaggerContainer>
                            ) : (
                                <div className="p-5">
                                    <EmptyState
                                        title="No generated PDF dossiers yet"
                                        description="Select a match above and generate a backend-stored analyst report."
                                        icon={<FileText size={36} />}
                                    />
                                </div>
                            )}
                        </div>
                    </FadeInUp>

                    <FadeInUp delay={0.08}>
                        <div className="glass-card overflow-hidden">
                            <div className="flex items-center gap-3 border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 py-4">
                                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--amber-soft)] text-[var(--amber)]">
                                    <Archive size={17} />
                                </span>
                                <div>
                                    <h2 className="text-base font-semibold text-[var(--text-primary)]">Legacy browser reports</h2>
                                    <p className="text-sm text-[var(--text-secondary)]">{reportsQuery.legacyReports.length} local items</p>
                                </div>
                            </div>

                            {reportsQuery.legacyReports.length > 0 ? (
                                <StaggerContainer className="divide-y divide-[var(--border-soft)]" staggerDelay={0.035}>
                                    {reportsQuery.legacyReports.map((report) => (
                                        <StaggerItem key={report.id}>
                                            <article className="space-y-3 px-5 py-4">
                                                <div className="min-w-0">
                                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                        <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                            {report.matchSummary.homeTeam} vs {report.matchSummary.awayTeam}
                                                        </h3>
                                                        <span className="tag-amber">Legacy</span>
                                                    </div>
                                                    <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                                                        {report.matchSummary.competition} · {formatMatchDate(report.matchSummary.matchDate)} · Saved {formatDateTime(report.createdAt)}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Link className="btn-ghost" to={`/reports/${report.id}`}>
                                                        <ExternalLink size={14} /> Open
                                                    </Link>
                                                    <button
                                                        className="btn-glow"
                                                        type="button"
                                                        onClick={() => void importLegacyMutation.mutateAsync(report).then((created) => navigate(`/reports/${created.id}`))}
                                                        disabled={importLegacyMutation.isPending}
                                                    >
                                                        <RefreshCw size={14} /> Convert
                                                    </button>
                                                </div>
                                            </article>
                                        </StaggerItem>
                                    ))}
                                </StaggerContainer>
                            ) : (
                                <div className="p-5">
                                    <EmptyState
                                        title="No legacy reports waiting"
                                        description="Browser-local reports will appear here until they are converted into PDFs."
                                        icon={<Archive size={36} />}
                                    />
                                </div>
                            )}
                        </div>
                    </FadeInUp>
                </section>

                <div className="flex justify-center">
                    <Link className="btn-ghost" to="/matches">
                        Browse match library <ArrowRight size={14} />
                    </Link>
                </div>
            </div>
        </PageTransition>
    );
}
