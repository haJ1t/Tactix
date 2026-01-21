"""
Team model
"""
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from . import Base


class Team(Base):
    __tablename__ = 'teams'
    
    team_id = Column(Integer, primary_key=True)
    team_name = Column(String(100), nullable=False)
    country = Column(String(50))
    
    # Relationships
    players = relationship('Player', back_populates='team')
    home_matches = relationship('Match', foreign_keys='Match.home_team_id', back_populates='home_team')
    away_matches = relationship('Match', foreign_keys='Match.away_team_id', back_populates='away_team')
    events = relationship('Event', back_populates='team')
    network_metrics = relationship('NetworkMetrics', back_populates='team')
    tactical_patterns = relationship('TacticalPattern', back_populates='team')
    
    def to_dict(self):
        return {
            'team_id': self.team_id,
            'team_name': self.team_name,
            'country': self.country
        }
