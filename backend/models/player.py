"""
Player model
"""
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


class Player(Base):
    __tablename__ = 'players'
    
    player_id = Column(Integer, primary_key=True)
    player_name = Column(String(100), nullable=False)
    team_id = Column(Integer, ForeignKey('teams.team_id'))
    position = Column(String(50))
    jersey_number = Column(Integer)
    
    # Relationships
    team = relationship('Team', back_populates='players')
    events = relationship('Event', back_populates='player')
    passes_made = relationship('PassEvent', foreign_keys='PassEvent.passer_id', back_populates='passer')
    passes_received = relationship('PassEvent', foreign_keys='PassEvent.recipient_id', back_populates='recipient')
    network_metrics = relationship('NetworkMetrics', back_populates='player')
    targeted_tactics = relationship('CounterTactic', back_populates='target_player')
    
    def to_dict(self):
        return {
            'player_id': self.player_id,
            'player_name': self.player_name,
            'team_id': self.team_id,
            'position': self.position,
            'jersey_number': self.jersey_number
        }
