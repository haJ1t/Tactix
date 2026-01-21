"""
Tactical Pattern Classifier
Based on Bialkowski et al. (2014) and Pappalardo et al. (2019).

Classifies tactical patterns from network features using:
- K-Means (unsupervised) for playing style clustering
- GradientBoosting (supervised) for pattern classification
"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import networkx as nx
from typing import Dict, List, Tuple
import joblib
import os


class TacticalPatternClassifier:
    """
    Classify tactical patterns using K-Means + GradientBoosting.
    
    K-Means: Unsupervised clustering of playing styles
    GradientBoosting: Supervised classification of tactical patterns
    """

    PATTERN_TYPES = [
        'CENTRAL_BUILDUP',      # High centrality in central midfielders
        'WING_OVERLOAD_LEFT',   # Asymmetric weight to left wing
        'WING_OVERLOAD_RIGHT',  # Asymmetric weight to right wing
        'DIRECT_PLAY',          # Low average path length, high forward passes
        'POSSESSION_RECYCLING', # High clustering, many backward/lateral passes
        'KEY_PLAYER_DEPENDENCY',# Single node with very high betweenness
        'BALANCED_ATTACK',      # Even distribution across all channels
        'COUNTER_ATTACKING',    # Few passes, high progressive distance
        'TIKI_TAKA',            # High pass volume, short passes, high clustering
        'LONG_BALL'             # High proportion of long passes
    ]

    # Cluster names for K-Means interpretation
    CLUSTER_NAMES = [
        'POSSESSION_DOMINANT',
        'DIRECT_ATTACKING',
        'WING_FOCUSED',
        'CENTRAL_CONTROL',
        'BALANCED_STYLE'
    ]

    def __init__(self):
        self.scaler = StandardScaler()
        # Use GradientBoosting for supervised classification
        self.classifier = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        # K-Means for unsupervised style clustering
        self.kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
        self.is_trained = False
        self.kmeans_trained = False
        self.cluster_centers_ = None
        self.feature_columns = []

    def extract_network_features(self, G: nx.DiGraph,
                                 node_positions: Dict = None) -> Dict:
        """
        Extract features from pass network for classification.
        """
        features = {}

        if G.number_of_nodes() == 0:
            return self._empty_features()

        # Basic network metrics
        features['density'] = nx.density(G)
        features['num_nodes'] = G.number_of_nodes()
        features['num_edges'] = G.number_of_edges()
        features['total_passes'] = sum(d.get('weight', 1) for _, _, d in G.edges(data=True))

        # Centrality features
        try:
            degree_cent = nx.degree_centrality(G)
            features['max_degree_centrality'] = max(degree_cent.values()) if degree_cent else 0
            features['avg_degree_centrality'] = np.mean(list(degree_cent.values())) if degree_cent else 0
            features['std_degree_centrality'] = np.std(list(degree_cent.values())) if degree_cent else 0
        except:
            features['max_degree_centrality'] = 0
            features['avg_degree_centrality'] = 0
            features['std_degree_centrality'] = 0

        try:
            betweenness = nx.betweenness_centrality(G, weight='weight')
            features['max_betweenness'] = max(betweenness.values()) if betweenness else 0
            features['avg_betweenness'] = np.mean(list(betweenness.values())) if betweenness else 0
            features['gini_betweenness'] = self._gini_coefficient(list(betweenness.values()))
        except:
            features['max_betweenness'] = 0
            features['avg_betweenness'] = 0
            features['gini_betweenness'] = 0

        try:
            pagerank = nx.pagerank(G, weight='weight')
            features['max_pagerank'] = max(pagerank.values()) if pagerank else 0
            features['std_pagerank'] = np.std(list(pagerank.values())) if pagerank else 0
        except:
            features['max_pagerank'] = 0
            features['std_pagerank'] = 0

        # Clustering
        try:
            features['avg_clustering'] = nx.average_clustering(G.to_undirected())
        except:
            features['avg_clustering'] = 0

        # Reciprocity
        try:
            features['reciprocity'] = nx.reciprocity(G)
        except:
            features['reciprocity'] = 0

        # Spatial features (if positions available)
        if node_positions and len(node_positions) > 0:
            x_coords = [pos[0] for pos in node_positions.values() if pos[0] is not None]
            y_coords = [pos[1] for pos in node_positions.values() if pos[1] is not None]

            if x_coords and y_coords:
                features['avg_x_position'] = np.mean(x_coords)
                features['avg_y_position'] = np.mean(y_coords)
                features['x_spread'] = np.std(x_coords) if len(x_coords) > 1 else 0
                features['y_spread'] = np.std(y_coords) if len(y_coords) > 1 else 0

                # Left vs Right balance (pitch is 80 wide, center at y=40)
                left_players = sum(1 for y in y_coords if y < 34)
                right_players = sum(1 for y in y_coords if y > 46)
                center_players = len(y_coords) - left_players - right_players
                features['lateral_balance'] = (right_players - left_players) / max(len(y_coords), 1)
                features['center_ratio'] = center_players / max(len(y_coords), 1)
            else:
                features.update(self._default_spatial_features())
        else:
            features.update(self._default_spatial_features())

        # Pass direction analysis
        total_weight = sum(d.get('weight', 1) for _, _, d in G.edges(data=True))
        forward_passes = 0
        backward_passes = 0
        lateral_passes = 0
        short_passes = 0
        long_passes = 0

        for u, v, d in G.edges(data=True):
            weight = d.get('weight', 1)
            if node_positions and u in node_positions and v in node_positions:
                u_pos = node_positions[u]
                v_pos = node_positions[v]
                if u_pos[0] is not None and v_pos[0] is not None:
                    dx = v_pos[0] - u_pos[0]
                    dy = abs(v_pos[1] - u_pos[1]) if v_pos[1] is not None and u_pos[1] is not None else 0
                    distance = np.sqrt(dx**2 + dy**2)

                    if dx > 5:
                        forward_passes += weight
                    elif dx < -5:
                        backward_passes += weight
                    else:
                        lateral_passes += weight

                    if distance < 15:
                        short_passes += weight
                    elif distance > 30:
                        long_passes += weight

        total_weight = max(total_weight, 1)
        features['forward_ratio'] = forward_passes / total_weight
        features['backward_ratio'] = backward_passes / total_weight
        features['lateral_ratio'] = lateral_passes / total_weight
        features['short_pass_ratio'] = short_passes / total_weight
        features['long_pass_ratio'] = long_passes / total_weight

        return features

    def _empty_features(self) -> Dict:
        """Return empty feature dict."""
        return {
            'density': 0, 'num_nodes': 0, 'num_edges': 0, 'total_passes': 0,
            'max_degree_centrality': 0, 'avg_degree_centrality': 0, 'std_degree_centrality': 0,
            'max_betweenness': 0, 'avg_betweenness': 0, 'gini_betweenness': 0,
            'max_pagerank': 0, 'std_pagerank': 0,
            'avg_clustering': 0, 'reciprocity': 0,
            'avg_x_position': 60, 'avg_y_position': 40, 'x_spread': 0, 'y_spread': 0,
            'lateral_balance': 0, 'center_ratio': 0,
            'forward_ratio': 0, 'backward_ratio': 0, 'lateral_ratio': 0,
            'short_pass_ratio': 0, 'long_pass_ratio': 0
        }

    def _default_spatial_features(self) -> Dict:
        """Default spatial features when no positions available."""
        return {
            'avg_x_position': 60,
            'avg_y_position': 40,
            'x_spread': 20,
            'y_spread': 15,
            'lateral_balance': 0,
            'center_ratio': 0.3
        }

    def _gini_coefficient(self, values: List) -> float:
        """Calculate Gini coefficient for inequality measurement."""
        if not values or len(values) == 0:
            return 0
        sorted_values = np.sort(values)
        n = len(sorted_values)
        if n == 0 or np.sum(sorted_values) == 0:
            return 0
        cumsum = np.cumsum(sorted_values)
        return float((2 * np.sum((np.arange(1, n+1) * sorted_values)) / (n * np.sum(sorted_values))) - (n + 1) / n)

    def detect_patterns_rule_based(self, features: Dict) -> List[Dict]:
        """
        Rule-based pattern detection (no training required).
        Returns list of detected patterns with confidence scores.
        """
        patterns = []

        # Key Player Dependency
        if features['max_betweenness'] > 0.15:
            confidence = min(features['max_betweenness'] * 3, 1.0)
            patterns.append({
                'pattern_type': 'KEY_PLAYER_DEPENDENCY',
                'confidence_score': confidence,
                'description': f"High dependency on key player - betweenness: {features['max_betweenness']:.3f}",
                'evidence': {'max_betweenness': features['max_betweenness']}
            })

        # High Gini = unequal distribution
        if features['gini_betweenness'] > 0.35:
            patterns.append({
                'pattern_type': 'UNBALANCED_DISTRIBUTION',
                'confidence_score': min(features['gini_betweenness'], 1.0),
                'description': f"Unbalanced play distribution - Gini: {features['gini_betweenness']:.3f}",
                'evidence': {'gini_betweenness': features['gini_betweenness']}
            })

        # Wing Overload
        if features.get('lateral_balance', 0) > 0.15:
            patterns.append({
                'pattern_type': 'WING_OVERLOAD_RIGHT',
                'confidence_score': min(abs(features['lateral_balance']) * 3, 1.0),
                'description': f"Right wing overload - lateral balance: {features['lateral_balance']:.2f}",
                'evidence': {'lateral_balance': features['lateral_balance']}
            })
        elif features.get('lateral_balance', 0) < -0.15:
            patterns.append({
                'pattern_type': 'WING_OVERLOAD_LEFT',
                'confidence_score': min(abs(features['lateral_balance']) * 3, 1.0),
                'description': f"Left wing overload - lateral balance: {features['lateral_balance']:.2f}",
                'evidence': {'lateral_balance': features['lateral_balance']}
            })

        # Direct Play vs Possession
        if features['forward_ratio'] > 0.45:
            patterns.append({
                'pattern_type': 'DIRECT_PLAY',
                'confidence_score': min(features['forward_ratio'] * 1.5, 1.0),
                'description': f"Direct playing style - {features['forward_ratio']:.0%} forward passes",
                'evidence': {'forward_ratio': features['forward_ratio']}
            })

        if features['backward_ratio'] + features['lateral_ratio'] > 0.5:
            patterns.append({
                'pattern_type': 'POSSESSION_RECYCLING',
                'confidence_score': min((features['backward_ratio'] + features['lateral_ratio']), 1.0),
                'description': f"Possession recycling style - {features['backward_ratio'] + features['lateral_ratio']:.0%} non-forward passes",
                'evidence': {
                    'backward_ratio': features['backward_ratio'],
                    'lateral_ratio': features['lateral_ratio']
                }
            })

        # Central Buildup
        if features.get('center_ratio', 0) > 0.4 and features['avg_clustering'] > 0.25:
            patterns.append({
                'pattern_type': 'CENTRAL_BUILDUP',
                'confidence_score': min(features['center_ratio'] + features['avg_clustering'], 1.0),
                'description': f"Central buildup play - {features['center_ratio']:.0%} central players, {features['avg_clustering']:.2f} clustering",
                'evidence': {
                    'center_ratio': features['center_ratio'],
                    'avg_clustering': features['avg_clustering']
                }
            })

        # Tiki-Taka style
        if features['short_pass_ratio'] > 0.5 and features['avg_clustering'] > 0.4 and features['total_passes'] > 300:
            patterns.append({
                'pattern_type': 'TIKI_TAKA',
                'confidence_score': 0.8,
                'description': f"Tiki-taka style - {features['short_pass_ratio']:.0%} short passes, high clustering",
                'evidence': {
                    'short_pass_ratio': features['short_pass_ratio'],
                    'avg_clustering': features['avg_clustering'],
                    'total_passes': features['total_passes']
                }
            })

        # Long Ball style
        if features['long_pass_ratio'] > 0.25:
            patterns.append({
                'pattern_type': 'LONG_BALL',
                'confidence_score': min(features['long_pass_ratio'] * 2, 1.0),
                'description': f"Long ball style - {features['long_pass_ratio']:.0%} long passes",
                'evidence': {'long_pass_ratio': features['long_pass_ratio']}
            })

        # Balanced Attack
        if features['gini_betweenness'] < 0.25 and abs(features.get('lateral_balance', 0)) < 0.1:
            patterns.append({
                'pattern_type': 'BALANCED_ATTACK',
                'confidence_score': 0.7,
                'description': "Balanced attack - even distribution across channels",
                'evidence': {
                    'gini_betweenness': features['gini_betweenness'],
                    'lateral_balance': features.get('lateral_balance', 0)
                }
            })

        # Sort by confidence
        return sorted(patterns, key=lambda x: x['confidence_score'], reverse=True)

    def train_classifier(self, training_data: List[Tuple[Dict, str]]) -> Dict:
        """
        Train GradientBoosting classifier on labeled match data.
        training_data: list of (features_dict, pattern_label) tuples
        """
        if len(training_data) < 10:
            return {'error': 'Not enough training data (need at least 10 samples)'}

        X = pd.DataFrame([d[0] for d in training_data])
        y = [d[1] for d in training_data]
        
        self.feature_columns = list(X.columns)
        
        # Split for validation
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        self.classifier.fit(X_train_scaled, y_train)
        self.is_trained = True

        train_accuracy = self.classifier.score(X_train_scaled, y_train)
        test_accuracy = self.classifier.score(X_test_scaled, y_test)

        return {
            'train_accuracy': float(train_accuracy),
            'test_accuracy': float(test_accuracy),
            'samples_used': len(X),
            'classes': list(self.classifier.classes_),
            'algorithm': 'GradientBoosting'
        }

    def train_kmeans(self, features_list: List[Dict], n_clusters: int = 5) -> Dict:
        """
        Train K-Means clustering on network features (unsupervised).
        """
        if len(features_list) < n_clusters:
            return {'error': f'Not enough data (need at least {n_clusters} samples)'}
        
        X = pd.DataFrame(features_list)
        self.feature_columns = list(X.columns)
        X_scaled = self.scaler.fit_transform(X)

        self.kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = self.kmeans.fit_predict(X_scaled)
        
        self.kmeans_trained = True
        self.cluster_centers_ = self.kmeans.cluster_centers_
        
        # Calculate cluster statistics
        cluster_stats = {}
        for i in range(n_clusters):
            cluster_mask = labels == i
            cluster_data = X[cluster_mask]
            cluster_stats[self.CLUSTER_NAMES[i] if i < len(self.CLUSTER_NAMES) else f'Cluster_{i}'] = {
                'size': int(sum(cluster_mask)),
                'avg_forward_ratio': float(cluster_data['forward_ratio'].mean()) if 'forward_ratio' in cluster_data else 0,
                'avg_clustering': float(cluster_data['avg_clustering'].mean()) if 'avg_clustering' in cluster_data else 0,
            }

        return {
            'n_clusters': n_clusters,
            'samples_clustered': len(features_list),
            'cluster_stats': cluster_stats,
            'inertia': float(self.kmeans.inertia_),
            'algorithm': 'K-Means'
        }

    def auto_train(self, features_list: List[Dict]) -> Dict:
        """
        Auto-train both K-Means and GradientBoosting using rule-based labels.
        
        This allows training without manually labeled data by using
        rule-based detection as pseudo-labels.
        """
        if len(features_list) < 10:
            return {'error': 'Not enough features for training (need at least 10)'}
        
        results = {}
        
        # 1. Train K-Means (unsupervised)
        print("  Training K-Means clustering...")
        kmeans_results = self.train_kmeans(features_list)
        results['kmeans'] = kmeans_results
        
        # 2. Generate pseudo-labels using rule-based detection
        print("  Generating pseudo-labels from rule-based detection...")
        training_data = []
        for features in features_list:
            patterns = self.detect_patterns_rule_based(features)
            if patterns:
                # Use the highest confidence pattern as label
                primary_pattern = patterns[0]['pattern_type']
                training_data.append((features, primary_pattern))
        
        # 3. Train GradientBoosting on pseudo-labels
        if len(training_data) >= 10:
            print("  Training GradientBoosting classifier...")
            gb_results = self.train_classifier(training_data)
            results['gradient_boosting'] = gb_results
        else:
            results['gradient_boosting'] = {'skipped': 'Not enough labeled samples'}
        
        return results

    def cluster_playing_styles(self, features_list: List[Dict]) -> Tuple[np.ndarray, Dict]:
        """
        Cluster teams/matches by playing style using trained K-Means.
        Returns (cluster labels, cluster interpretations).
        """
        X = pd.DataFrame(features_list)
        
        if not self.kmeans_trained:
            # Train K-Means if not already trained
            self.train_kmeans(features_list)
        
        X_scaled = self.scaler.transform(X)
        labels = self.kmeans.predict(X_scaled)

        # Interpret clusters
        interpretations = {}
        for i, label in enumerate(labels):
            cluster_name = self.CLUSTER_NAMES[label] if label < len(self.CLUSTER_NAMES) else f'Cluster_{label}'
            interpretations[i] = cluster_name

        return labels, interpretations

    def predict_patterns(self, features: Dict) -> List[Dict]:
        """
        Predict patterns using K-Means + GradientBoosting.
        Falls back to rule-based if not trained.
        """
        patterns = []
        
        # Rule-based patterns (always applied)
        rule_patterns = self.detect_patterns_rule_based(features)
        
        # K-Means style clustering
        if self.kmeans_trained:
            try:
                X = pd.DataFrame([features])
                # Ensure columns match training
                for col in self.feature_columns:
                    if col not in X.columns:
                        X[col] = 0
                X = X[self.feature_columns]
                X_scaled = self.scaler.transform(X)
                cluster_label = self.kmeans.predict(X_scaled)[0]
                cluster_name = self.CLUSTER_NAMES[cluster_label] if cluster_label < len(self.CLUSTER_NAMES) else f'Cluster_{cluster_label}'
                
                patterns.append({
                    'pattern_type': f'STYLE_{cluster_name}',
                    'confidence_score': 0.85,
                    'description': f'K-Means clustered as {cluster_name} playing style',
                    'evidence': {'cluster_id': int(cluster_label), 'algorithm': 'K-Means'}
                })
            except Exception as e:
                pass  # Fall back silently
        
        # GradientBoosting classification
        if self.is_trained:
            try:
                X = pd.DataFrame([features])
                for col in self.feature_columns:
                    if col not in X.columns:
                        X[col] = 0
                X = X[self.feature_columns]
                X_scaled = self.scaler.transform(X)

                # Get probabilities for all classes
                proba = self.classifier.predict_proba(X_scaled)[0]
                classes = self.classifier.classes_

                for i, p in enumerate(proba):
                    if p > 0.15:  # Threshold for reporting
                        patterns.append({
                            'pattern_type': classes[i],
                            'confidence_score': float(p),
                            'description': f'GradientBoosting classified as {classes[i]}',
                            'evidence': {'ml_probability': float(p), 'algorithm': 'GradientBoosting'}
                        })
            except Exception as e:
                pass  # Fall back to rule-based
        
        # Add rule-based patterns that don't overlap
        for rp in rule_patterns:
            if not any(p['pattern_type'] == rp['pattern_type'] for p in patterns):
                patterns.append(rp)

        return sorted(patterns, key=lambda x: x['confidence_score'], reverse=True)

    def get_playing_style(self, features: Dict) -> Dict:
        """
        Get a comprehensive playing style analysis.
        """
        result = {
            'patterns': self.predict_patterns(features),
            'style_category': None,
            'ml_status': {
                'kmeans_trained': self.kmeans_trained,
                'classifier_trained': self.is_trained
            }
        }
        
        if self.kmeans_trained:
            try:
                X = pd.DataFrame([features])
                for col in self.feature_columns:
                    if col not in X.columns:
                        X[col] = 0
                X = X[self.feature_columns]
                X_scaled = self.scaler.transform(X)
                cluster_label = self.kmeans.predict(X_scaled)[0]
                result['style_category'] = self.CLUSTER_NAMES[cluster_label] if cluster_label < len(self.CLUSTER_NAMES) else f'Cluster_{cluster_label}'
            except:
                pass
        
        return result

    def save_model(self, path: str):
        """Save trained models."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({
            'classifier': self.classifier,
            'scaler': self.scaler,
            'kmeans': self.kmeans,
            'is_trained': self.is_trained,
            'kmeans_trained': self.kmeans_trained,
            'feature_columns': self.feature_columns,
            'cluster_centers': self.cluster_centers_
        }, path)

    def load_model(self, path: str):
        """Load trained models."""
        if os.path.exists(path):
            data = joblib.load(path)
            self.classifier = data.get('classifier', self.classifier)
            self.scaler = data.get('scaler', self.scaler)
            self.kmeans = data.get('kmeans', self.kmeans)
            self.is_trained = data.get('is_trained', False)
            self.kmeans_trained = data.get('kmeans_trained', False)
            self.feature_columns = data.get('feature_columns', [])
            self.cluster_centers_ = data.get('cluster_centers', None)
