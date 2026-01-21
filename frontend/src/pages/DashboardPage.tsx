import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { Match } from '../types';
import { matchService } from '../services/matchService';
import { teamService } from '../services/teamService';

interface DashboardStats {
    totalMatches: number;
    totalTeams: number;
}

interface ActivityItem {
    id: number;
    type: 'analysis' | 'report' | 'match_added';
    title: string;
    description: string;
    timestamp: Date;
}

export default function DashboardPage() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        totalMatches: 0,
        totalTeams: 0,
    });
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // Load matches and teams in parallel
            let allMatches: Match[] = [];
            let allTeams: { team_id: number; team_name: string }[] = [];

            try {
                const [matchesData, teamsData] = await Promise.all([
                    matchService.getMatches(),
                    teamService.getTeams(),
                ]);
                allMatches = matchesData.matches || [];
                allTeams = teamsData.teams || [];
            } catch (e) {
                console.warn('Failed to load some data:', e);
            }

            setMatches(allMatches);

            // Set stats
            setStats({
                totalMatches: allMatches.length,
                totalTeams: allTeams.length,
            });

            // Generate activities from matches
            const initialActivities: ActivityItem[] = allMatches.slice(0, 5).map((match, idx) => ({
                id: idx + 1,
                type: 'match_added' as const,
                title: `${match.home_team?.team_name} vs ${match.away_team?.team_name}`,
                description: `Match data loaded - ${match.competition}`,
                timestamp: new Date(match.match_date),
            }));
            setActivities(initialActivities);

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeAgo = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'analysis':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3v18h18" />
                        <path d="m18 9-5 5-4-4-3 3" />
                    </svg>
                );
            case 'report':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                );
            default:
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="m15 9-6 6M9 9l6 6" />
                    </svg>
                );
        }
    };

    return (
        <AppLayout title="Dashboard">
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-subtitle">Welcome to Tactix - Football Pass Network Analysis System</p>
            </div>

            {loading ? (
                <div className="dashboard-loading">
                    <div className="spinner"></div>
                    <p>Loading dashboard data...</p>
                </div>
            ) : (
                <div className="dashboard-content">
                    {/* Hero Stats Section */}
                    <div className="hero-stats">
                        <div className="hero-stat-card">
                            <div className="hero-stat-icon blue">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="m15 9-6 6M9 9l6 6" />
                                </svg>
                            </div>
                            <div className="hero-stat-content">
                                <span className="hero-stat-value">{stats.totalMatches}</span>
                                <span className="hero-stat-label">Total Matches</span>
                            </div>
                        </div>

                        <div className="hero-stat-card">
                            <div className="hero-stat-icon green">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <div className="hero-stat-content">
                                <span className="hero-stat-value">{stats.totalTeams}</span>
                                <span className="hero-stat-label">Total Teams</span>
                            </div>
                        </div>

                        <div className="hero-stat-card">
                            <div className="hero-stat-icon purple">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <div className="hero-stat-content">
                                <span className="hero-stat-value">-</span>
                                <span className="hero-stat-label">Analyzed</span>
                            </div>
                        </div>

                        <div className="hero-stat-card">
                            <div className="hero-stat-icon orange">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                            </div>
                            <div className="hero-stat-content">
                                <span className="hero-stat-value">-</span>
                                <span className="hero-stat-label">Patterns Found</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Access Cards */}
                    <div className="quick-access-section">
                        <h3 className="dashboard-section-title">Quick Access</h3>
                        <div className="quick-access-grid">
                            <div className="quick-access-card" onClick={() => navigate('/matches')}>
                                <div className="quick-access-icon blue">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                    </svg>
                                </div>
                                <div className="quick-access-content">
                                    <h4>New Analysis</h4>
                                    <p>Select a team and analyze matches</p>
                                </div>
                                <svg className="quick-access-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>

                            <div className="quick-access-card" onClick={() => navigate('/metrics')}>
                                <div className="quick-access-icon green">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 3v18h18" />
                                        <path d="M18 9l-5 5-4-4-3 3" />
                                    </svg>
                                </div>
                                <div className="quick-access-content">
                                    <h4>Compare Teams</h4>
                                    <p>View detailed metrics comparison</p>
                                </div>
                                <svg className="quick-access-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>

                            <div className="quick-access-card" onClick={() => navigate('/reports')}>
                                <div className="quick-access-icon purple">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                </div>
                                <div className="quick-access-content">
                                    <h4>Generate Report</h4>
                                    <p>Create and export analysis reports</p>
                                </div>
                                <svg className="quick-access-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>

                            <div className="quick-access-card" onClick={() => navigate('/matches')}>
                                <div className="quick-access-icon orange">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                </div>
                                <div className="quick-access-content">
                                    <h4>Browse Matches</h4>
                                    <p>View all available match data</p>
                                </div>
                                <svg className="quick-access-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Main Dashboard Grid */}
                    <div className="dashboard-grid">
                        {/* Left Column - Available Matches */}
                        <div className="dashboard-left">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Available Matches</h3>
                                    <button
                                        className="btn btn-sm btn-outline"
                                        onClick={() => navigate('/matches')}
                                    >
                                        View All
                                    </button>
                                </div>
                                <div className="card-body" style={{ padding: matches.length === 0 ? 20 : 0 }}>
                                    {matches.length > 0 ? (
                                        <div className="matches-mini-list">
                                            {matches.slice(0, 8).map((match) => (
                                                <div
                                                    key={match.match_id}
                                                    className="match-mini-item"
                                                    onClick={() => navigate(`/match/${match.match_id}`)}
                                                >
                                                    <div className="match-mini-teams">
                                                        <div className="match-mini-team">
                                                            <span className="mini-team-badge">
                                                                {match.home_team?.team_name?.[0] || 'H'}
                                                            </span>
                                                            <span className="mini-team-name">
                                                                {match.home_team?.team_name}
                                                            </span>
                                                        </div>
                                                        <span className="match-mini-score">
                                                            {match.home_score} - {match.away_score}
                                                        </span>
                                                        <div className="match-mini-team away">
                                                            <span className="mini-team-name">
                                                                {match.away_team?.team_name}
                                                            </span>
                                                            <span className="mini-team-badge">
                                                                {match.away_team?.team_name?.[0] || 'A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="match-mini-meta">
                                                        <span>{match.competition}</span>
                                                        <span>{match.match_date}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-section">
                                            <p>No matches available. Load sample data first.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="dashboard-right">
                            {/* Activity Feed */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Recent Activity</h3>
                                </div>
                                <div className="card-body">
                                    {activities.length > 0 ? (
                                        <div className="activity-feed">
                                            {activities.map((activity) => (
                                                <div key={activity.id} className="activity-item">
                                                    <div className={`activity-icon ${activity.type}`}>
                                                        {getActivityIcon(activity.type)}
                                                    </div>
                                                    <div className="activity-content">
                                                        <span className="activity-title">{activity.title}</span>
                                                        <span className="activity-desc">{activity.description}</span>
                                                    </div>
                                                    <span className="activity-time">
                                                        {formatTimeAgo(activity.timestamp)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-section">
                                            <p>No recent activity.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Getting Started Guide */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Getting Started</h3>
                                </div>
                                <div className="card-body">
                                    <div className="getting-started-list">
                                        <div className="getting-started-item">
                                            <div className="step-number">1</div>
                                            <div className="step-content">
                                                <h4>Browse Teams</h4>
                                                <p>Go to Matches page and select a team to analyze</p>
                                            </div>
                                        </div>
                                        <div className="getting-started-item">
                                            <div className="step-number">2</div>
                                            <div className="step-content">
                                                <h4>View Analysis</h4>
                                                <p>See aggregate analysis and select specific matches</p>
                                            </div>
                                        </div>
                                        <div className="getting-started-item">
                                            <div className="step-number">3</div>
                                            <div className="step-content">
                                                <h4>Generate Reports</h4>
                                                <p>Export tactical analysis and recommendations</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
