"""
Tactical pattern model
"""
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


class TacticalPattern(Base):
    __tablename__ = 'tactical_patterns'
    
    pattern_id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey('matches.match_id'))
    team_id = Column(Integer, ForeignKey('teams.team_id'))
    pattern_type = Column(String(50))  # KEY_PLAYER_DEPENDENCY, WING_OVERLOAD, etc.
    confidence_score = Column(Float)
    description = Column(Text)
    
    # Additional pattern data (JSON-like storage)
    key_player_id = Column(Integer, ForeignKey('players.player_id'), nullable=True)
    side = Column(String(20), nullable=True)  # left, right, central
    
    # Relationships
    match = relationship('Match', back_populates='tactical_patterns')
    team = relationship('Team', back_populates='tactical_patterns')
    counter_tactics = relationship('CounterTactic', back_populates='pattern', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'pattern_id': self.pattern_id,
            'match_id': self.match_id,
            'team_id': self.team_id,
            'pattern_type': self.pattern_type,
            'confidence_score': self.confidence_score,
            'description': self.description,
            'key_player_id': self.key_player_id,
            'side': self.side
        }
