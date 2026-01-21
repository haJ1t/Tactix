"""
Event model
"""
from sqlalchemy import Column, Integer, String, Float, Time, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


class Event(Base):
    __tablename__ = 'events'
    
    event_id = Column(String(50), primary_key=True)
    match_id = Column(Integer, ForeignKey('matches.match_id'))
    team_id = Column(Integer, ForeignKey('teams.team_id'))
    player_id = Column(Integer, ForeignKey('players.player_id'))
    event_type = Column(String(50))
    period = Column(Integer)  # 1 = first half, 2 = second half
    timestamp = Column(String(20))
    minute = Column(Integer)
    second = Column(Integer)
    location_x = Column(Float)
    location_y = Column(Float)
    
    # Relationships
    match = relationship('Match', back_populates='events')
    team = relationship('Team', back_populates='events')
    player = relationship('Player', back_populates='events')
    pass_event = relationship('PassEvent', back_populates='event', uselist=False, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'event_id': self.event_id,
            'match_id': self.match_id,
            'team_id': self.team_id,
            'player_id': self.player_id,
            'event_type': self.event_type,
            'period': self.period,
            'minute': self.minute,
            'second': self.second,
            'location_x': self.location_x,
            'location_y': self.location_y
        }
