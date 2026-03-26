import type { LegacyStoredReport, ReportArtifactSummary, ReportListItem } from '@/features/reports/types';

const compareByCreatedAt = (left: { createdAt: string }, right: { createdAt: string }) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

export const toArtifactListItem = (artifact: ReportArtifactSummary): ReportListItem => ({
    id: artifact.id,
    kind: 'artifact',
    sourceKind: artifact.source_kind,
    title: artifact.title,
    homeTeam: artifact.home_team,
    awayTeam: artifact.away_team,
    scoreline: artifact.scoreline || 'Score unavailable',
    competition: artifact.competition || 'Competition unavailable',
    matchDate: artifact.match_date || '',
    createdAt: artifact.created_at,
    artifact,
});

export const toLegacyListItem = (legacy: LegacyStoredReport): ReportListItem => ({
    id: legacy.id,
    kind: 'legacy',
    sourceKind: 'legacy',
    title: `${legacy.matchSummary.homeTeam} vs ${legacy.matchSummary.awayTeam} Analyst Dossier`,
    homeTeam: legacy.matchSummary.homeTeam,
    awayTeam: legacy.matchSummary.awayTeam,
    scoreline: legacy.matchSummary.score,
    competition: legacy.matchSummary.competition,
    matchDate: legacy.matchSummary.matchDate,
    createdAt: legacy.createdAt,
    legacy,
});

export const buildReportListItems = (
    artifacts: ReportArtifactSummary[],
    legacyReports: LegacyStoredReport[]
): ReportListItem[] => [...artifacts.map(toArtifactListItem), ...legacyReports.map(toLegacyListItem)].sort(compareByCreatedAt);
