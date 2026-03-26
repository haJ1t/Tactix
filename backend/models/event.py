"""
Event model
"""
from sqlalchemy import Boolean, Column, Integer, String, Float, Time, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


class Event(Base):
    __tablename__ = 'events'
    
    event_id = Column(String(50), primary_key=True)
    match_id = Column(Integer, ForeignKey('matches.match_id'))
    team_id = Column(Integer, ForeignKey('teams.team_id'))
    player_id = Column(Integer, ForeignKey('players.player_id'))
    event_type = Column(String(50))
    event_index = Column(Integer)
    period = Column(Integer)  # 1 = first half, 2 = second half
    timestamp = Column(String(20))
    duration = Column(Float)
    minute = Column(Integer)
    second = Column(Integer)
    location_x = Column(Float)
    location_y = Column(Float)
    possession_id = Column(Integer)
    possession_team_id = Column(Integer)
    play_pattern = Column(String(100))
    position_name = Column(String(100))
    under_pressure = Column(Boolean)
    outcome_name = Column(String(100))
    shot_outcome = Column(String(100))
    is_goal = Column(Boolean)
    
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
            'event_index': self.event_index,
            'period': self.period,
            'duration': self.duration,
            'minute': self.minute,
            'second': self.second,
            'location_x': self.location_x,
            'location_y': self.location_y,
            'possession_id': self.possession_id,
            'possession_team_id': self.possession_team_id,
            'play_pattern': self.play_pattern,
            'position_name': self.position_name,
            'under_pressure': self.under_pressure,
            'outcome_name': self.outcome_name,
            'shot_outcome': self.shot_outcome,
            'is_goal': self.is_goal
        }
