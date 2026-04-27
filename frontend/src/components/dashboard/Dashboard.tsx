import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { matchService } from '../../services/matchService';
import type { Match } from '../../types';

export default function Dashboard() {
    // Component state
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch matches on mount
    useEffect(() => {
        loadMatches();
    }, []);

    // Load match list from API
    const loadMatches = async () => {
        try {
            setLoading(true);
            const data = await matchService.getMatches();
            setMatches(data.matches);
        } catch (err) {
            setError('Failed to load matches. Make sure the backend is running and data is loaded.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Show loading spinner
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
                    <p className="mt-4 text-gray-400">Loading matches...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Hero Section */}
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-white mb-4">
                    Football Pass Network Analysis
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                    Analyze team passing patterns, identify key players, detect tactical structures,
                    and generate counter-tactical recommendations.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/20 rounded-lg">
                            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">{matches.length}</p>
                            <p className="text-gray-400">Available Matches</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-lg">
                            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">
                                {new Set(matches.flatMap(m => [m.home_team?.team_id, m.away_team?.team_id])).size}
                            </p>
                            <p className="text-gray-400">Teams</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/20 rounded-lg">
                            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">5</p>
                            <p className="text-gray-400">Pattern Types</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-8">
                    <p className="text-red-300">{error}</p>
                    <p className="text-red-400 text-sm mt-2">
                        Run the following commands to set up:
                        <code className="block bg-gray-900 p-2 mt-2 rounded">
                            python scripts/download_statsbomb_data.py<br />
                            python scripts/load_sample_data.py<br />
                            python backend/app.py
                        </code>
                    </p>
                </div>
            )}

            {/* Matches List */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Recent Matches</h2>

                {matches.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <h3 className="text-xl font-medium text-gray-300 mb-2">No matches loaded</h3>
                        <p className="text-gray-500">Load StatsBomb data to get started with analysis</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {matches.map((match) => (
                            <Link
                                key={match.match_id}
                                to={`/analysis/${match.match_id}`}
                                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-green-500 transition-all hover:shadow-lg hover:shadow-green-500/10 group"
                            >
                                {/* Competition Badge */}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-medium text-green-400 bg-green-500/20 px-2 py-1 rounded">
                                        {match.competition}
                                    </span>
                                    <span className="text-xs text-gray-500">{match.season}</span>
                                </div>

                                {/* Teams */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="text-center flex-1">
                                        <p className="font-semibold text-white truncate">
                                            {match.home_team?.team_name || 'Unknown'}
                                        </p>
                                        <p className="text-3xl font-bold text-white mt-2">
                                            {match.home_score}
                                        </p>
                                    </div>
                                    <div className="text-gray-500 px-4">vs</div>
                                    <div className="text-center flex-1">
                                        <p className="font-semibold text-white truncate">
                                            {match.away_team?.team_name || 'Unknown'}
                                        </p>
                                        <p className="text-3xl font-bold text-white mt-2">
                                            {match.away_score}
                                        </p>
                                    </div>
                                </div>

                                {/* Date */}
                                <div className="text-center text-sm text-gray-500">
                                    {match.match_date ? new Date(match.match_date).toLocaleDateString() : 'Date unknown'}
                                </div>

                                {/* Analyze Button */}
                                <div className="mt-4 text-center">
                                    <span className="text-green-400 text-sm group-hover:underline">
                                        Analyze Match →
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Features Section */}
            <div className="mt-16">
                <h2 className="text-2xl font-bold text-white mb-8 text-center">Analysis Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <FeatureCard
                        icon="🔗"
                        title="Pass Network"
                        description="Visualize passing connections between players"
                    />
                    <FeatureCard
                        icon="📊"
                        title="Centrality Metrics"
                        description="Identify key players using network analysis"
                    />
                    <FeatureCard
                        icon="🎯"
                        title="Pattern Detection"
                        description="Detect tactical patterns automatically"
                    />
                    <FeatureCard
                        icon="⚔️"
                        title="Counter-Tactics"
                        description="Generate tactical recommendations"
                    />
                </div>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
    return (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 text-center">
            <div className="text-4xl mb-4">{icon}</div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-gray-400 text-sm">{description}</p>
        </div>
    );
}
