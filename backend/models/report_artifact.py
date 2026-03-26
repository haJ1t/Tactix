"""
Report artifact model for generated analyst PDFs.
"""
from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from . import Base


class ReportArtifact(Base):
    __tablename__ = 'report_artifacts'

    id = Column(String(36), primary_key=True)
    match_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    language = Column(String(8), nullable=False, default='en')
    source_kind = Column(String(32), nullable=False, default='generated')
    title = Column(String(255), nullable=False)
    home_team = Column(String(100), nullable=False)
    away_team = Column(String(100), nullable=False)
    competition = Column(String(100))
    match_date = Column(String(32))
    scoreline = Column(String(32))
    pdf_path = Column(String(512), nullable=False)
    snapshot_json = Column(Text, nullable=False)

    def _parse_snapshot(self) -> dict:
        if not self.snapshot_json:
            return {}

        try:
            return json.loads(self.snapshot_json)
        except json.JSONDecodeError:
            return {}

    def to_summary_dict(self) -> dict:
        return {
            'id': self.id,
            'match_id': self.match_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'language': self.language,
            'source_kind': self.source_kind,
            'title': self.title,
            'home_team': self.home_team,
            'away_team': self.away_team,
            'competition': self.competition,
            'match_date': self.match_date,
            'scoreline': self.scoreline,
            'pdf_download_url': f'/api/reports/{self.id}/download',
        }

    def to_detail_dict(self) -> dict:
        snapshot = self._parse_snapshot()

        return {
            **self.to_summary_dict(),
            'snapshot_summary': {
                'executive_summary': snapshot.get('executive_summary'),
                'match_story': snapshot.get('match_story'),
                'final_conclusion': snapshot.get('final_conclusion'),
                'section_summary': snapshot.get('section_summary', []),
                'team_summaries': snapshot.get('team_summaries', []),
            },
        }
