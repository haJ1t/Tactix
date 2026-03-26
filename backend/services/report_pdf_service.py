"""
Backend-generated analyst dossier PDFs for match reports.
"""
from __future__ import annotations

import json
import math
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.graphics.shapes import Circle, Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from models.match import Match
from models.report_artifact import ReportArtifact

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REPORTS_OUTPUT_DIR = PROJECT_ROOT / 'output' / 'pdf' / 'reports'


class ReportGenerationError(RuntimeError):
    """Raised when report generation cannot be completed."""


def _display_pattern(value: Any) -> str:
    if isinstance(value, str) and value:
        return value.replace('_', ' ').title()
    return str(value or 'Unknown')


def _display_value(value: Any, fallback: str = 'Not enough data') -> str:
    if value is None:
        return fallback
    if isinstance(value, float):
        return f'{value:.2f}'
    if value == '':
        return fallback
    return str(value)


def _escape_text(value: Any) -> str:
    return escape(str(value or ''))


def _analysis_stats(analysis: dict | None) -> dict:
    analysis = analysis or {}
    network_stats = analysis.get('network_statistics') or {}
    shots = analysis.get('shot_summary') or {}
    vaep = analysis.get('vaep_summary') or {}
    players = analysis.get('player_metrics') or []
    patterns = analysis.get('patterns') or []
    tactics = analysis.get('counter_tactics') or []

    return {
        'total_passes': network_stats.get('total_passes', 0),
        'density': network_stats.get('density', 0.0),
        'reciprocity': network_stats.get('reciprocity', 0.0),
        'players': len(players),
        'patterns': len(patterns),
        'counter_tactics': len(tactics),
        'shots': shots.get('total_shots', 0),
        'xg_total': shots.get('xg_total', 0.0),
        'high_xg_shots': shots.get('high_xg_shots', 0),
        'avg_score_vaep': vaep.get('avg_scoring_vaep', 0.0),
        'avg_concede_vaep': vaep.get('avg_conceding_vaep', 0.0),
    }


def _top_players(analysis: dict | None, count: int = 3) -> list[dict]:
    players = list((analysis or {}).get('player_metrics') or [])

    def sort_key(player: dict) -> float:
        return float(player.get('betweenness_centrality', 0)) * 0.6 + float(player.get('pagerank', 0)) * 0.4

    return sorted(players, key=sort_key, reverse=True)[:count]


def _top_patterns(analysis: dict | None, count: int = 3) -> list[dict]:
    patterns = list((analysis or {}).get('patterns') or [])
    return sorted(patterns, key=lambda pattern: float(pattern.get('confidence_score', 0)), reverse=True)[:count]


def _top_tactics(analysis: dict | None, count: int = 3) -> list[dict]:
    tactics = list((analysis or {}).get('counter_tactics') or [])
    return sorted(tactics, key=lambda tactic: int(tactic.get('priority', 99)))[:count]


def _build_comparative_insights(match: Match | None, home_name: str, away_name: str, home_analysis: dict | None, away_analysis: dict | None) -> list[str]:
    home_stats = _analysis_stats(home_analysis)
    away_stats = _analysis_stats(away_analysis)
    insights: list[str] = []

    total_passes = home_stats['total_passes'] + away_stats['total_passes']
    if total_passes:
        pass_share = home_stats['total_passes'] / total_passes
        if pass_share >= 0.55:
            insights.append(f'{home_name} controlled more of the passing volume ({pass_share * 100:.0f}% share).')
        elif pass_share <= 0.45:
            insights.append(f'{away_name} controlled more of the passing volume ({(1 - pass_share) * 100:.0f}% share).')

    density_diff = home_stats['density'] - away_stats['density']
    if abs(density_diff) >= 0.05:
        leader = home_name if density_diff > 0 else away_name
        insights.append(f'{leader} operated with the denser network structure in circulation phases.')

    reciprocity_diff = home_stats['reciprocity'] - away_stats['reciprocity']
    if abs(reciprocity_diff) >= 0.05:
        leader = home_name if reciprocity_diff > 0 else away_name
        insights.append(f'{leader} showed the stronger two-way connection profile between passing pairs.')

    xg_diff = home_stats['xg_total'] - away_stats['xg_total']
    if abs(xg_diff) >= 0.35:
        leader = home_name if xg_diff > 0 else away_name
        insights.append(f'{leader} created the higher-quality shot profile on expected goals.')

    if match is not None:
        score_diff = (match.home_score or 0) - (match.away_score or 0)
        if score_diff > 0:
            insights.append(f'The final score favored {home_name}, but the underlying report should be read through structure as well as finishing.')
        elif score_diff < 0:
            insights.append(f'The final score favored {away_name}, but the underlying report should be read through structure as well as finishing.')
        else:
            insights.append('The match ended level, so network control and chance quality become the clearest separators.')

    home_pattern = _top_patterns(home_analysis, 1)
    away_pattern = _top_patterns(away_analysis, 1)
    if home_pattern:
        insights.append(f'{home_name} pattern signal: {_display_pattern(home_pattern[0].get("pattern_type"))}.')
    if away_pattern:
        insights.append(f'{away_name} pattern signal: {_display_pattern(away_pattern[0].get("pattern_type"))}.')

    return insights[:5]


def _build_executive_summary(match: Match | None, home_name: str, away_name: str, home_analysis: dict | None, away_analysis: dict | None) -> str:
    insights = _build_comparative_insights(match, home_name, away_name, home_analysis, away_analysis)
    if insights:
        return ' '.join(insights)

    return (
        f'This dossier reviews {home_name} and {away_name} through pass-network structure, tactical patterns, '
        'counter-measures, shot quality, and high-value actions. Some sections were generated with fallback phrasing '
        'because complete data was not available for both teams.'
    )


def _build_match_story(match: Match | None, home_name: str, away_name: str, home_analysis: dict | None, away_analysis: dict | None) -> str:
    if match is None:
        return f'The available snapshot compares {home_name} and {away_name} through the stored analysis artifact.'

    home_stats = _analysis_stats(home_analysis)
    away_stats = _analysis_stats(away_analysis)
    return (
        f'{home_name} vs {away_name} finished {match.home_score}-{match.away_score} in {match.competition}. '
        f'{home_name} produced {home_stats["total_passes"]} recorded passes and {home_stats["shots"]} shots, while '
        f'{away_name} produced {away_stats["total_passes"]} passes and {away_stats["shots"]} shots. '
        'The sections below separate control of circulation, player influence, tactical patterning, and chance quality.'
    )


def _build_final_conclusion(home_name: str, away_name: str, home_analysis: dict | None, away_analysis: dict | None) -> str:
    home_patterns = _top_patterns(home_analysis, 1)
    away_patterns = _top_patterns(away_analysis, 1)
    home_tactics = _top_tactics(home_analysis, 1)
    away_tactics = _top_tactics(away_analysis, 1)

    sentences = [
        f'The strongest reading of this match is to treat {home_name} and {away_name} as two distinct network stories rather than one shared average.'
    ]

    if home_patterns:
        sentences.append(f'{home_name} leaned toward {_display_pattern(home_patterns[0].get("pattern_type"))}.')
    if away_patterns:
        sentences.append(f'{away_name} leaned toward {_display_pattern(away_patterns[0].get("pattern_type"))}.')
    if home_tactics:
        sentences.append(f'Against {home_name}, the most urgent response is {home_tactics[0].get("recommendation", "to protect the main connector lane")}.')
    if away_tactics:
        sentences.append(f'Against {away_name}, the most urgent response is {away_tactics[0].get("recommendation", "to disrupt the progression structure")}.')

    return ' '.join(sentences)


def _team_summary(team_name: str, analysis: dict | None) -> dict:
    stats = _analysis_stats(analysis)
    top_player = _top_players(analysis, 1)
    return {
        'team_name': team_name,
        'total_passes': stats['total_passes'],
        'patterns': stats['patterns'],
        'counter_tactics': stats['counter_tactics'],
        'shots': stats['shots'],
        'xg_total': stats['xg_total'],
        'top_connector': top_player[0].get('player_name') if top_player else None,
    }


def _section_summary(snapshot: dict) -> list[dict]:
    team_summaries = snapshot.get('team_summaries', [])
    teams_with_data = sum(1 for item in team_summaries if item.get('total_passes', 0) > 0)
    tactics_count = sum(int(item.get('patterns', 0)) for item in team_summaries)
    shots_count = sum(int(item.get('shots', 0)) for item in team_summaries)

    return [
        {
            'id': 'executive-summary',
            'title': 'Executive Summary',
            'detail': snapshot.get('executive_summary') or 'Summary generated with fallback phrasing.',
            'status': 'complete',
        },
        {
            'id': 'match-story',
            'title': 'Match Story',
            'detail': snapshot.get('match_story') or 'Match context is partially available.',
            'status': 'complete' if snapshot.get('match_story') else 'partial',
        },
        {
            'id': 'pass-networks',
            'title': 'Pass Networks',
            'detail': f'{teams_with_data} team sections include usable pass-network data.',
            'status': 'complete' if teams_with_data == 2 else 'partial',
        },
        {
            'id': 'tactical-patterns',
            'title': 'Tactical Patterns',
            'detail': f'{tactics_count} tactical pattern signals were captured across both teams.',
            'status': 'complete' if tactics_count > 0 else 'partial',
        },
        {
            'id': 'shots-vaep',
            'title': 'Shot Quality and VAEP',
            'detail': f'{shots_count} total shots were reflected in the final artifact.',
            'status': 'complete' if shots_count > 0 else 'partial',
        },
        {
            'id': 'final-conclusion',
            'title': 'Final Conclusion',
            'detail': snapshot.get('final_conclusion') or 'Conclusion generated with fallback phrasing.',
            'status': 'complete',
        },
    ]


class ReportPdfService:
    def __init__(self, output_dir: Path | None = None):
        self.output_dir = Path(output_dir or REPORTS_OUTPUT_DIR)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.styles = self._build_styles()

    def _build_styles(self) -> dict[str, ParagraphStyle]:
        base = getSampleStyleSheet()
        return {
            'title': ParagraphStyle(
                'AnalystTitle',
                parent=base['Title'],
                fontName='Helvetica-Bold',
                fontSize=24,
                leading=28,
                textColor=colors.HexColor('#0f172a'),
                alignment=TA_CENTER,
                spaceAfter=12,
            ),
            'eyebrow': ParagraphStyle(
                'AnalystEyebrow',
                parent=base['BodyText'],
                fontName='Helvetica-Bold',
                fontSize=9,
                leading=12,
                textColor=colors.HexColor('#0f766e'),
                alignment=TA_CENTER,
                spaceAfter=8,
            ),
            'section': ParagraphStyle(
                'AnalystSection',
                parent=base['Heading2'],
                fontName='Helvetica-Bold',
                fontSize=16,
                leading=20,
                textColor=colors.HexColor('#111827'),
                spaceBefore=8,
                spaceAfter=8,
            ),
            'body': ParagraphStyle(
                'AnalystBody',
                parent=base['BodyText'],
                fontName='Helvetica',
                fontSize=10,
                leading=15,
                textColor=colors.HexColor('#334155'),
                alignment=TA_LEFT,
                spaceAfter=6,
            ),
            'small': ParagraphStyle(
                'AnalystSmall',
                parent=base['BodyText'],
                fontName='Helvetica',
                fontSize=8,
                leading=11,
                textColor=colors.HexColor('#64748b'),
                spaceAfter=4,
            ),
            'callout': ParagraphStyle(
                'AnalystCallout',
                parent=base['BodyText'],
                fontName='Helvetica-Oblique',
                fontSize=10,
                leading=14,
                textColor=colors.HexColor('#475569'),
                spaceAfter=6,
            ),
        }

    def create_generated_report(self, db, match_id: int) -> ReportArtifact:
        match = db.query(Match).filter(Match.match_id == match_id).first()
        if not match:
            raise ReportGenerationError('Match not found.')

        from api.match_routes import build_ml_analysis_payload

        analysis_payload = build_ml_analysis_payload(db, match, include_network=True)
        snapshot = self._build_generated_snapshot(match, analysis_payload)
        artifact = self._build_artifact(
            match_id=match.match_id,
            created_at=datetime.utcnow(),
            source_kind='generated',
            title=f'{match.home_team.team_name if match.home_team else "Home"} vs {match.away_team.team_name if match.away_team else "Away"} Analyst Dossier',
            home_team=match.home_team.team_name if match.home_team else 'Home',
            away_team=match.away_team.team_name if match.away_team else 'Away',
            competition=match.competition,
            match_date=match.match_date.isoformat() if match.match_date else None,
            scoreline=f'{match.home_score} - {match.away_score}',
            snapshot=snapshot,
        )
        self._persist_artifact(db, artifact, snapshot)
        return artifact

    def import_legacy_report(self, db, legacy_report: dict) -> ReportArtifact:
        match_summary = legacy_report.get('matchSummary') or {}
        if not legacy_report.get('matchId') or not match_summary:
            raise ReportGenerationError('Legacy report payload is incomplete.')

        created_at = self._parse_datetime(legacy_report.get('createdAt')) or datetime.utcnow()
        snapshot = self._build_legacy_snapshot(legacy_report)
        artifact = self._build_artifact(
            match_id=int(legacy_report['matchId']),
            created_at=created_at,
            source_kind='legacy_import',
            title=f'{match_summary.get("homeTeam", "Home")} vs {match_summary.get("awayTeam", "Away")} Analyst Dossier',
            home_team=match_summary.get('homeTeam', 'Home'),
            away_team=match_summary.get('awayTeam', 'Away'),
            competition=match_summary.get('competition'),
            match_date=match_summary.get('matchDate'),
            scoreline=match_summary.get('score'),
            snapshot=snapshot,
        )
        self._persist_artifact(db, artifact, snapshot)
        return artifact

    def delete_artifact(self, db, artifact: ReportArtifact) -> None:
        if artifact.pdf_path and os.path.exists(artifact.pdf_path):
            os.remove(artifact.pdf_path)
        db.delete(artifact)
        db.commit()

    def _build_artifact(
        self,
        *,
        match_id: int,
        created_at: datetime,
        source_kind: str,
        title: str,
        home_team: str,
        away_team: str,
        competition: str | None,
        match_date: str | None,
        scoreline: str | None,
        snapshot: dict,
    ) -> ReportArtifact:
        report_id = str(uuid.uuid4())
        pdf_path = self.output_dir / f'{report_id}.pdf'
        return ReportArtifact(
            id=report_id,
            match_id=match_id,
            created_at=created_at,
            language='en',
            source_kind=source_kind,
            title=title,
            home_team=home_team,
            away_team=away_team,
            competition=competition,
            match_date=match_date,
            scoreline=scoreline,
            pdf_path=str(pdf_path),
            snapshot_json=json.dumps(snapshot),
        )

    def _persist_artifact(self, db, artifact: ReportArtifact, snapshot: dict) -> None:
        self.render_pdf(artifact, snapshot)
        db.add(artifact)
        db.commit()
        if hasattr(db, 'refresh'):
            db.refresh(artifact)

    def _build_generated_snapshot(self, match: Match, analysis_payload: dict) -> dict:
        home_name = match.home_team.team_name if match.home_team else 'Home'
        away_name = match.away_team.team_name if match.away_team else 'Away'
        analysis_map = analysis_payload.get('analysis') or {}
        home_analysis = analysis_map.get(home_name)
        away_analysis = analysis_map.get(away_name)

        snapshot = {
            'match': match.to_dict(),
            'analysis': analysis_map,
            'executive_summary': _build_executive_summary(match, home_name, away_name, home_analysis, away_analysis),
            'match_story': _build_match_story(match, home_name, away_name, home_analysis, away_analysis),
            'final_conclusion': _build_final_conclusion(home_name, away_name, home_analysis, away_analysis),
            'team_summaries': [
                _team_summary(home_name, home_analysis),
                _team_summary(away_name, away_analysis),
            ],
        }
        snapshot['section_summary'] = _section_summary(snapshot)
        return snapshot

    def _build_legacy_snapshot(self, legacy_report: dict) -> dict:
        match_summary = legacy_report.get('matchSummary') or {}
        home_name = match_summary.get('homeTeam', 'Home')
        away_name = match_summary.get('awayTeam', 'Away')
        home_analysis = legacy_report.get('homeAnalysis') or {}
        away_analysis = legacy_report.get('awayAnalysis') or {}
        match_stub = {
            'match_id': legacy_report.get('matchId'),
            'home_team': {'team_name': home_name},
            'away_team': {'team_name': away_name},
            'match_date': match_summary.get('matchDate'),
            'competition': match_summary.get('competition'),
            'season': None,
            'home_score': None,
            'away_score': None,
        }
        snapshot = {
            'match': match_stub,
            'analysis': {
                home_name: home_analysis,
                away_name: away_analysis,
            },
            'executive_summary': _build_executive_summary(None, home_name, away_name, home_analysis, away_analysis),
            'match_story': _build_match_story(None, home_name, away_name, home_analysis, away_analysis),
            'final_conclusion': _build_final_conclusion(home_name, away_name, home_analysis, away_analysis),
            'team_summaries': [
                _team_summary(home_name, home_analysis),
                _team_summary(away_name, away_analysis),
            ],
        }
        snapshot['section_summary'] = _section_summary(snapshot)
        return snapshot

    def render_pdf(self, artifact: ReportArtifact, snapshot: dict) -> None:
        document = SimpleDocTemplate(
            artifact.pdf_path,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=18 * mm,
            bottomMargin=16 * mm,
            title=artifact.title,
            author='Tactix',
        )

        story = []
        story.extend(self._build_cover_page(artifact, snapshot))
        story.extend(self._build_executive_summary_page(snapshot))
        story.extend(self._build_match_story_page(snapshot))
        story.extend(self._build_team_network_page(snapshot, artifact.home_team))
        story.extend(self._build_team_network_page(snapshot, artifact.away_team))
        story.extend(self._build_tactics_page(snapshot, artifact.home_team, artifact.away_team))
        story.extend(self._build_shots_page(snapshot, artifact.home_team, artifact.away_team))
        story.extend(self._build_conclusion_page(snapshot))

        document.build(
            story,
            onFirstPage=self._draw_page_chrome(artifact.title),
            onLaterPages=self._draw_page_chrome(artifact.title),
        )

    def _build_cover_page(self, artifact: ReportArtifact, snapshot: dict) -> list:
        match_meta = snapshot.get('match') or {}
        story = [
            Spacer(1, 20 * mm),
            Paragraph('TACTIX ANALYST DOSSIER', self.styles['eyebrow']),
            Paragraph(_escape_text(artifact.title), self.styles['title']),
            Paragraph(_escape_text(artifact.scoreline or 'Score unavailable'), self.styles['title']),
            Spacer(1, 8 * mm),
            Paragraph(
                _escape_text(f'{artifact.competition or "Competition unavailable"} · {_display_value(artifact.match_date)} · {artifact.language.upper()} report'),
                self.styles['body'],
            ),
            Spacer(1, 4 * mm),
            self._info_table(
                [
                    ['Home team', artifact.home_team],
                    ['Away team', artifact.away_team],
                    ['Source kind', artifact.source_kind.replace('_', ' ').title()],
                    ['Created', artifact.created_at.isoformat(timespec='minutes') if artifact.created_at else 'Unknown'],
                ]
            ),
            Spacer(1, 10 * mm),
            Paragraph(_escape_text(snapshot.get('executive_summary') or 'Summary unavailable.'), self.styles['body']),
            Spacer(1, 10 * mm),
            Paragraph(
                'This dossier is generated directly from backend analysis snapshots. It is designed to read as a concise analyst briefing rather than a raw data dump.',
                self.styles['callout'],
            ),
            PageBreak(),
        ]
        return story

    def _build_executive_summary_page(self, snapshot: dict) -> list:
        story = [Paragraph('Executive Summary', self.styles['section'])]
        story.append(Paragraph(_escape_text(snapshot.get('executive_summary') or 'Summary unavailable.'), self.styles['body']))
        for item in snapshot.get('section_summary', []):
            story.append(Paragraph(f"<b>{_escape_text(item.get('title'))}</b>: {_escape_text(item.get('detail'))}", self.styles['body']))
        story.append(PageBreak())
        return story

    def _build_match_story_page(self, snapshot: dict) -> list:
        match_meta = snapshot.get('match') or {}
        home_team = ((match_meta.get('home_team') or {}).get('team_name')) or 'Home'
        away_team = ((match_meta.get('away_team') or {}).get('team_name')) or 'Away'
        analysis_map = snapshot.get('analysis') or {}
        home_analysis = analysis_map.get(home_team)
        away_analysis = analysis_map.get(away_team)
        home_stats = _analysis_stats(home_analysis)
        away_stats = _analysis_stats(away_analysis)

        story = [
            Paragraph('Match Story and Comparative Metrics', self.styles['section']),
            Paragraph(_escape_text(snapshot.get('match_story') or 'Match story unavailable.'), self.styles['body']),
            Spacer(1, 3 * mm),
            self._metric_compare_table(
                home_team,
                away_team,
                [
                    ('Total passes', home_stats['total_passes'], away_stats['total_passes']),
                    ('Network density', f'{home_stats["density"]:.2f}', f'{away_stats["density"]:.2f}'),
                    ('Reciprocity', f'{home_stats["reciprocity"]:.2f}', f'{away_stats["reciprocity"]:.2f}'),
                    ('Shots', home_stats['shots'], away_stats['shots']),
                    ('xG total', f'{home_stats["xg_total"]:.2f}', f'{away_stats["xg_total"]:.2f}'),
                    ('High xG shots', home_stats['high_xg_shots'], away_stats['high_xg_shots']),
                ]
            ),
            PageBreak(),
        ]
        return story

    def _build_team_network_page(self, snapshot: dict, team_name: str) -> list:
        analysis = (snapshot.get('analysis') or {}).get(team_name) or {}
        top_players = _top_players(analysis, 5)
        story = [Paragraph(_escape_text(f'{team_name} Pass Network and Key Connectors'), self.styles['section'])]

        network = analysis.get('network') or {}
        if network.get('nodes'):
            story.append(self._build_network_drawing(team_name, network, top_players))
            story.append(Spacer(1, 4 * mm))
        else:
            story.append(Paragraph('Not enough data was available to render the pass network for this team.', self.styles['callout']))

        if top_players:
            rows = [['Player', 'Betweenness', 'Pagerank', 'Role']]
            for player in top_players:
                rows.append([
                    player.get('player_name') or player.get('name') or f"Player {player.get('player_id')}",
                    f"{float(player.get('betweenness_centrality', 0)):.2f}",
                    f"{float(player.get('pagerank', 0)):.2f}",
                    player.get('position') or 'Unknown',
                ])
            story.append(self._styled_table(rows))
        else:
            story.append(Paragraph('Key connector rankings were not available for this team snapshot.', self.styles['callout']))

        story.append(PageBreak())
        return story

    def _build_tactics_page(self, snapshot: dict, home_team: str, away_team: str) -> list:
        analysis_map = snapshot.get('analysis') or {}
        story = [Paragraph('Tactical Patterns and Counter-Tactics', self.styles['section'])]

        for team_name in [home_team, away_team]:
            analysis = analysis_map.get(team_name) or {}
            patterns = _top_patterns(analysis, 3)
            tactics = _top_tactics(analysis, 3)
            story.append(Paragraph(f'<b>{_escape_text(team_name)}</b>', self.styles['body']))
            if patterns:
                for pattern in patterns:
                    story.append(
                        Paragraph(
                            _escape_text(
                                f"Pattern: {_display_pattern(pattern.get('pattern_type'))} "
                                f"({float(pattern.get('confidence_score', 0)):.2f} confidence). "
                                f"{pattern.get('description', 'No description available.')}"
                            ),
                            self.styles['body'],
                        )
                    )
            else:
                story.append(Paragraph('No tactical pattern signal was strong enough to render in this section.', self.styles['callout']))

            if tactics:
                for tactic in tactics:
                    story.append(
                        Paragraph(
                            _escape_text(
                                f"Counter-plan: {tactic.get('recommendation', 'Recommendation unavailable.')} "
                                f"(Priority {tactic.get('priority', 'n/a')})."
                            ),
                            self.styles['body'],
                        )
                    )
            else:
                story.append(Paragraph('No counter-tactic recommendation was available for this team snapshot.', self.styles['callout']))

            story.append(Spacer(1, 3 * mm))

        story.append(PageBreak())
        return story

    def _build_shots_page(self, snapshot: dict, home_team: str, away_team: str) -> list:
        analysis_map = snapshot.get('analysis') or {}
        home_analysis = analysis_map.get(home_team) or {}
        away_analysis = analysis_map.get(away_team) or {}
        home_shots = home_analysis.get('shot_summary') or {}
        away_shots = away_analysis.get('shot_summary') or {}
        home_vaep = home_analysis.get('vaep_summary') or {}
        away_vaep = away_analysis.get('vaep_summary') or {}

        story = [
            Paragraph('Shot Quality and VAEP', self.styles['section']),
            self._metric_compare_table(
                home_team,
                away_team,
                [
                    ('Shots', home_shots.get('total_shots', 0), away_shots.get('total_shots', 0)),
                    ('xG total', f"{float(home_shots.get('xg_total', 0)):.2f}", f"{float(away_shots.get('xg_total', 0)):.2f}"),
                    ('xG per shot', f"{float(home_shots.get('xg_per_shot', 0)):.2f}", f"{float(away_shots.get('xg_per_shot', 0)):.2f}"),
                    ('High xG shots', home_shots.get('high_xg_shots', 0), away_shots.get('high_xg_shots', 0)),
                    ('Avg scoring VAEP', f"{float(home_vaep.get('avg_scoring_vaep', 0)):.3f}", f"{float(away_vaep.get('avg_scoring_vaep', 0)):.3f}"),
                    ('Avg conceding VAEP', f"{float(home_vaep.get('avg_conceding_vaep', 0)):.3f}", f"{float(away_vaep.get('avg_conceding_vaep', 0)):.3f}"),
                ]
            ),
            Paragraph(
                'Shot-quality and VAEP sections are designed to indicate whether the network story translated into valuable or vulnerable actions, not merely volume.',
                self.styles['callout'],
            ),
            PageBreak(),
        ]
        return story

    def _build_conclusion_page(self, snapshot: dict) -> list:
        return [
            Paragraph('Final Analyst Conclusion', self.styles['section']),
            Paragraph(_escape_text(snapshot.get('final_conclusion') or 'Conclusion unavailable.'), self.styles['body']),
        ]

    def _styled_table(self, rows: list[list[Any]], column_widths: list[int] | None = None) -> Table:
        table = Table(rows, colWidths=column_widths, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dbeafe')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]
            )
        )
        return table

    def _info_table(self, rows: list[list[Any]]) -> Table:
        table = Table(rows, colWidths=[35 * mm, 110 * mm])
        table.setStyle(
            TableStyle(
                [
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
                    ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#cbd5e1')),
                    ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]
            )
        )
        return table

    def _metric_compare_table(self, home_team: str, away_team: str, rows: list[tuple[Any, Any, Any]]) -> Table:
        table_rows = [['Metric', home_team, away_team]]
        table_rows.extend([[label, home_value, away_value] for label, home_value, away_value in rows])
        return self._styled_table(table_rows, column_widths=[58 * mm, 55 * mm, 55 * mm])

    def _build_network_drawing(self, team_name: str, network: dict, top_players: list[dict]) -> Drawing:
        width = 170 * mm
        height = 92 * mm
        pitch_x = 12
        pitch_y = 10
        pitch_width = width - 24
        pitch_height = height - 24
        drawing = Drawing(width, height)
        drawing.add(Rect(0, 0, width, height, fillColor=colors.HexColor('#f8fafc'), strokeColor=colors.HexColor('#dbeafe')))
        drawing.add(Rect(pitch_x, pitch_y, pitch_width, pitch_height, fillColor=colors.HexColor('#0f172a'), strokeColor=colors.HexColor('#38bdf8'), strokeWidth=1.2))
        drawing.add(Line(pitch_x + pitch_width / 2, pitch_y, pitch_x + pitch_width / 2, pitch_y + pitch_height, strokeColor=colors.HexColor('#334155')))
        drawing.add(Circle(pitch_x + pitch_width / 2, pitch_y + pitch_height / 2, 16, strokeColor=colors.HexColor('#334155'), fillColor=None))
        drawing.add(String(pitch_x, height - 8, f'{team_name} passing map', fontName='Helvetica-Bold', fontSize=9, fillColor=colors.HexColor('#0f172a')))

        top_player_ids = {player.get('player_id') for player in top_players}
        nodes = {node.get('id'): node for node in network.get('nodes', [])}
        edges = network.get('edges', [])

        def node_pos(node: dict) -> tuple[float, float]:
            x = float(node.get('x', 60))
            y = float(node.get('y', 40))
            chart_x = pitch_x + (x / 120.0) * pitch_width
            chart_y = pitch_y + pitch_height - (y / 80.0) * pitch_height
            return chart_x, chart_y

        for edge in edges:
            source = nodes.get(edge.get('source'))
            target = nodes.get(edge.get('target'))
            if not source or not target:
                continue
            x1, y1 = node_pos(source)
            x2, y2 = node_pos(target)
            weight = max(float(edge.get('weight', 1)), 1.0)
            drawing.add(
                Line(
                    x1,
                    y1,
                    x2,
                    y2,
                    strokeColor=colors.HexColor('#7dd3fc'),
                    strokeWidth=min(4.5, 0.6 + math.log(weight + 1.0) * 1.2),
                    strokeOpacity=0.55,
                )
            )

        for node in nodes.values():
            x, y = node_pos(node)
            player_id = node.get('id')
            radius = 4.8 if player_id in top_player_ids else 3.6
            fill = colors.HexColor('#f59e0b') if player_id in top_player_ids else colors.HexColor('#e2e8f0')
            drawing.add(Circle(x, y, radius, fillColor=fill, strokeColor=colors.HexColor('#f8fafc'), strokeWidth=0.8))
            label = str(node.get('name') or f'P{player_id}')
            if len(label) > 12:
                label = label[:12]
            drawing.add(String(x + 4, y + 4, label, fontName='Helvetica', fontSize=6.5, fillColor=colors.HexColor('#e2e8f0')))

        return drawing

    def _draw_page_chrome(self, title: str):
        def callback(canvas, document):
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor('#cbd5e1'))
            canvas.setLineWidth(0.5)
            canvas.line(document.leftMargin, A4[1] - 14 * mm, A4[0] - document.rightMargin, A4[1] - 14 * mm)
            canvas.setFont('Helvetica-Bold', 8)
            canvas.setFillColor(colors.HexColor('#0f172a'))
            canvas.drawString(document.leftMargin, A4[1] - 11 * mm, 'TACTIX')
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.HexColor('#64748b'))
            canvas.drawRightString(A4[0] - document.rightMargin, A4[1] - 11 * mm, title[:90])
            canvas.drawRightString(A4[0] - document.rightMargin, 10 * mm, f'Page {canvas.getPageNumber()}')
            canvas.restoreState()

        return callback

    @staticmethod
    def _parse_datetime(raw_value: str | None) -> datetime | None:
        if not raw_value:
            return None
        try:
            return datetime.fromisoformat(raw_value.replace('Z', '+00:00')).replace(tzinfo=None)
        except ValueError:
            return None


def sanitize_pdf_filename(title: str, report_id: str) -> str:
    safe_title = re.sub(r'[^A-Za-z0-9]+', '_', title).strip('_') or 'tactix_report'
    return f'{safe_title}_{report_id}.pdf'
