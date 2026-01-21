"""
Match model
"""
from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


class Match(Base):
    __tablename__ = 'matches'
    
    match_id = Column(Integer, primary_key=True)
    home_team_id = Column(Integer, ForeignKey('teams.team_id'))
    away_team_id = Column(Integer, ForeignKey('teams.team_id'))
    match_date = Column(Date)
    competition = Column(String(100))
    season = Column(String(50))
    home_score = Column(Integer)
    away_score = Column(Integer)
    
    # Relationships
    home_team = relationship('Team', foreign_keys=[home_team_id], back_populates='home_matches')
    away_team = relationship('Team', foreign_keys=[away_team_id], back_populates='away_matches')
    events = relationship('Event', back_populates='match', cascade='all, delete-orphan')
    network_metrics = relationship('NetworkMetrics', back_populates='match', cascade='all, delete-orphan')
    tactical_patterns = relationship('TacticalPattern', back_populates='match', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'match_id': self.match_id,
            'home_team': self.home_team.to_dict() if self.home_team else None,
            'away_team': self.away_team.to_dict() if self.away_team else None,
            'match_date': self.match_date.isoformat() if self.match_date else None,
            'competition': self.competition,
            'season': self.season,
            'home_score': self.home_score,
            'away_score': self.away_score
        }
