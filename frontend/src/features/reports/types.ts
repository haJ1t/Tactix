import type { StoredReport } from '@/shared/lib/reports-storage';

// Lightweight report metadata
export interface ReportArtifactSummary {
    id: string;
    match_id: number;
    created_at: string;
    language: string;
    source_kind: 'generated' | 'legacy_import';
    title: string;
    home_team: string;
    away_team: string;
    competition: string | null;
    match_date: string | null;
    scoreline: string | null;
    pdf_download_url: string;
}

// Single section of a dossier
export interface ReportSectionSummary {
    id: string;
    title: string;
    detail: string;
    status: 'complete' | 'partial';
}

// Per-team summary block
export interface ReportTeamSummary {
    team_name: string;
    total_passes: number;
    patterns: number;
    counter_tactics: number;
    shots: number;
    xg_total: number;
    top_connector?: string | null;
}

// Full report with snapshot data
export interface ReportArtifactDetails extends ReportArtifactSummary {
    snapshot_summary: {
        executive_summary?: string | null;
        match_story?: string | null;
        final_conclusion?: string | null;
        section_summary: ReportSectionSummary[];
        team_summaries: ReportTeamSummary[];
    };
}

export type LegacyStoredReport = StoredReport;

// Common shape for list rows
export interface ReportListItemBase {
    id: string;
    kind: 'artifact' | 'legacy';
    title: string;
    homeTeam: string;
    awayTeam: string;
    scoreline: string;
    competition: string;
    matchDate: string;
    createdAt: string;
}

export interface ArtifactReportListItem extends ReportListItemBase {
    kind: 'artifact';
    sourceKind: ReportArtifactSummary['source_kind'];
    artifact: ReportArtifactSummary;
}

export interface LegacyReportListItem extends ReportListItemBase {
    kind: 'legacy';
    sourceKind: 'legacy';
    legacy: LegacyStoredReport;
}

export type ReportListItem = ArtifactReportListItem | LegacyReportListItem;

// Discriminated union for details view
export type ReportDetailsResult =
    | { kind: 'artifact'; artifact: ReportArtifactDetails }
    | { kind: 'legacy'; legacy: LegacyStoredReport };
