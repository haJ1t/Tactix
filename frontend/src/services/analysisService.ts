import api from './api';
import type { PlayerMetrics, TacticalPattern, CounterTactic } from '../types';

// Analysis API service
export const analysisService = {
    // Get metrics for a match
    async getMetrics(
        matchId: number,
        teamId?: number
    ): Promise<{ match_id: number; metrics: PlayerMetrics[] }> {
        const response = await api.get(`/analysis/${matchId}/metrics`, {
            params: teamId ? { team_id: teamId } : {},
        });
        return response.data;
    },

    // Get patterns for a match
    async getPatterns(
        matchId: number,
        teamId?: number
    ): Promise<{ match_id: number; patterns: TacticalPattern[] }> {
        const response = await api.get(`/analysis/${matchId}/patterns`, {
            params: teamId ? { team_id: teamId } : {},
        });
        return response.data;
    },

    // Get counter-tactics for a match
    async getCounterTactics(
        matchId: number,
        teamId?: number
    ): Promise<{ match_id: number; counter_tactics: CounterTactic[] }> {
        const response = await api.get(`/analysis/${matchId}/countertactics`, {
            params: teamId ? { team_id: teamId } : {},
        });
        return response.data;
    },

    // Get top players by metric
    async getTopPlayers(
        matchId: number,
        options?: {
            team_id?: number;
            metric?: string;
            limit?: number;
        }
    ): Promise<{ match_id: number; metric: string; top_players: PlayerMetrics[] }> {
        const response = await api.get(`/analysis/${matchId}/top-players`, {
            params: options,
        });
        return response.data;
    },
};

export default analysisService;
