"""
Network metrics model (computed analysis results)
"""
from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


class NetworkMetrics(Base):
    __tablename__ = 'network_metrics'
    
    metric_id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey('matches.match_id'))
    team_id = Column(Integer, ForeignKey('teams.team_id'))
    player_id = Column(Integer, ForeignKey('players.player_id'))
    
    # Centrality metrics
    degree_centrality = Column(Float)
    in_degree_centrality = Column(Float)
    out_degree_centrality = Column(Float)
    betweenness_centrality = Column(Float)
    closeness_centrality = Column(Float)
    pagerank = Column(Float)
    clustering_coefficient = Column(Float)
    
    # Degree counts
    in_degree = Column(Integer)
    out_degree = Column(Integer)
    
    # Position data
    avg_x = Column(Float)
    avg_y = Column(Float)
    
    # Relationships
    match = relationship('Match', back_populates='network_metrics')
    team = relationship('Team', back_populates='network_metrics')
    player = relationship('Player', back_populates='network_metrics')
    
    def to_dict(self):
        return {
            'metric_id': self.metric_id,
            'match_id': self.match_id,
            'team_id': self.team_id,
            'player_id': self.player_id,
            'player_name': self.player.player_name if self.player else None,
            'jersey_number': self.player.jersey_number if self.player else None,
            'degree_centrality': self.degree_centrality,
            'in_degree_centrality': self.in_degree_centrality,
            'out_degree_centrality': self.out_degree_centrality,
            'betweenness_centrality': self.betweenness_centrality,
            'closeness_centrality': self.closeness_centrality,
            'pagerank': self.pagerank,
            'clustering_coefficient': self.clustering_coefficient,
            'in_degree': self.in_degree,
            'out_degree': self.out_degree,
            'avg_x': self.avg_x,
            'avg_y': self.avg_y
        }
