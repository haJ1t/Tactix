import type { Team } from '@/entities/team';

// Single fixture record
export interface Match {
    match_id: number;
    home_team: Team | null;
    away_team: Team | null;
    match_date: string;
    competition: string;
    season: string;
    home_score: number;
    away_score: number;
}

// Match list filter options
export interface MatchFilters {
    search?: string;
    competition?: string;
    season?: string;
    sortBy?: 'date-desc' | 'date-asc' | 'competition' | 'season';
}
