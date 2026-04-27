import type { Match } from '@/entities/match';

// Base team record
export interface Team {
    team_id: number;
    team_name: string;
    country?: string;
}

// Team with player roster
export interface TeamDetails extends Team {
    players?: Array<{
        player_id: number;
        player_name: string;
        position: string;
        jersey_number: number;
    }>;
}

// Team scoped to a season
export interface TeamSeasonDetails extends TeamDetails {
    season: string;
}

// Team plus its match list
export interface TeamWithMatches extends Team {
    matches: Match[];
    matchCount: number;
}

// Team grouped by season
export interface TeamSeasonEntry extends Team {
    season: string;
    matches: Match[];
    matchCount: number;
    latestMatchDate: string;
    segment: 'national' | 'club';
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
