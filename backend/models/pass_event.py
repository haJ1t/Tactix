"""
Pass event model (extends Event)
"""
from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


class PassEvent(Base):
    __tablename__ = 'passes'
    
    pass_id = Column(String(50), primary_key=True)
    event_id = Column(String(50), ForeignKey('events.event_id'))
    passer_id = Column(Integer, ForeignKey('players.player_id'))
    recipient_id = Column(Integer, ForeignKey('players.player_id'))
    end_location_x = Column(Float)
    end_location_y = Column(Float)
    pass_length = Column(Float)
    pass_angle = Column(Float)
    pass_outcome = Column(String(20))  # Complete, Incomplete, Out, etc.
    pass_type = Column(String(50))  # Ground, High, Through Ball, etc.
    pass_height = Column(String(20))  # Ground, Low, High
    body_part = Column(String(30))  # Right Foot, Left Foot, Head
    technique = Column(String(50))
    is_cross = Column(Boolean)
    is_switch = Column(Boolean)
    is_through_ball = Column(Boolean)
    is_cut_back = Column(Boolean)
    
    # Relationships
    event = relationship('Event', back_populates='pass_event')
    passer = relationship('Player', foreign_keys=[passer_id], back_populates='passes_made')
    recipient = relationship('Player', foreign_keys=[recipient_id], back_populates='passes_received')
    
    def to_dict(self):
        return {
            'pass_id': self.pass_id,
            'event_id': self.event_id,
            'passer_id': self.passer_id,
            'recipient_id': self.recipient_id,
            'passer_name': self.passer.player_name if self.passer else None,
            'recipient_name': self.recipient.player_name if self.recipient else None,
            'end_location_x': self.end_location_x,
            'end_location_y': self.end_location_y,
            'pass_length': self.pass_length,
            'pass_angle': self.pass_angle,
            'pass_outcome': self.pass_outcome,
            'pass_type': self.pass_type,
            'technique': self.technique,
            'is_cross': self.is_cross,
            'is_switch': self.is_switch,
            'is_through_ball': self.is_through_ball,
            'is_cut_back': self.is_cut_back
        }
