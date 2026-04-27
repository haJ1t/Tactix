import api from './api';
import type { Match, NetworkData, AnalysisResult } from '../types';

// Match API service
export const matchService = {
    // Get all matches
    async getMatches(): Promise<{ matches: Match[]; count: number }> {
        const response = await api.get('/matches');
        return response.data;
    },

    // Get single match
    async getMatch(matchId: number): Promise<Match> {
        const response = await api.get(`/matches/${matchId}`);
        return response.data;
    },

    // Get pass network for a match
    async getNetwork(
        matchId: number,
        teamId?: number
    ): Promise<NetworkData> {
        const response = await api.get(`/matches/${matchId}/network`, {
            params: { team_id: teamId },
        });
        return response.data;
    },

    // Trigger full analysis (standard)
    async analyzeMatch(
        matchId: number,
        teamId?: number
    ): Promise<AnalysisResult> {
        const response = await api.post(`/matches/${matchId}/analyze`, {
            team_id: teamId,
        });
        return response.data;
    },

    // Trigger ML-enhanced analysis
    async analyzeMatchML(
        matchId: number,
        teamId?: number
    ): Promise<AnalysisResult> {
        const response = await api.post(`/matches/${matchId}/analyze-ml`, {
            team_id: teamId,
        });
        return response.data;
    },
};

export default matchService;
