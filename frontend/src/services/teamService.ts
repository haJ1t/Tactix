import api from './api';
import type { Team, PlayerMetrics, TacticalPattern } from '../types';

export interface TeamDetails extends Team {
    players?: Array<{
        player_id: number;
        player_name: string;
        position: string;
        jersey_number: number;
    }>;
}

export interface TeamAggregateMetrics {
    team_id: number;
    team_name: string;
    matches_played: number;
    total_passes: number;
    avg_density: number;
    avg_clustering: number;
    avg_reciprocity: number;
    top_players: PlayerMetrics[];
    common_patterns: TacticalPattern[];
}

export interface TeamMatchSummary {
    match_id: number;
    opponent: string;
    opponent_id: number;
    match_date: string;
    competition: string;
    is_home: boolean;
    team_score: number;
    opponent_score: number;
    result: 'W' | 'D' | 'L';
}

export const teamService = {
    // Get all teams
    async getTeams(): Promise<{ teams: Team[] }> {
        const response = await api.get('/teams');
        return response.data;
    },

    // Get single team with players
    async getTeam(teamId: number): Promise<TeamDetails> {
        const response = await api.get(`/teams/${teamId}`);
        return response.data;
    },

    // Get team metrics (aggregated or for specific match)
    async getTeamMetrics(teamId: number, matchId?: number): Promise<any> {
        const response = await api.get(`/teams/${teamId}/metrics`, {
            params: matchId ? { match_id: matchId } : {},
        });
        return response.data;
    },
};

export default teamService;
