"""
Counter tactic model
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


class CounterTactic(Base):
    __tablename__ = 'counter_tactics'
    
    tactic_id = Column(Integer, primary_key=True, autoincrement=True)
    pattern_id = Column(Integer, ForeignKey('tactical_patterns.pattern_id'))
    recommendation = Column(Text)
    priority = Column(Integer)  # 1 = highest priority
    target_player_id = Column(Integer, ForeignKey('players.player_id'), nullable=True)
    tactic_type = Column(String(50))  # PRESS, MAN_MARK, BLOCK_CHANNEL, etc.
    
    # Relationships
    pattern = relationship('TacticalPattern', back_populates='counter_tactics')
    target_player = relationship('Player', back_populates='targeted_tactics')
    
    def to_dict(self):
        return {
            'tactic_id': self.tactic_id,
            'pattern_id': self.pattern_id,
            'recommendation': self.recommendation,
            'priority': self.priority,
            'target_player_id': self.target_player_id,
            'target_player_name': self.target_player.player_name if self.target_player else None,
            'tactic_type': self.tactic_type
        }
