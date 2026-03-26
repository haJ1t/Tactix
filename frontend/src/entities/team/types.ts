import type { Match } from '@/entities/match';

export interface Team {
    team_id: number;
    team_name: string;
    country?: string;
}

export interface TeamDetails extends Team {
    players?: Array<{
        player_id: number;
        player_name: string;
        position: string;
        jersey_number: number;
    }>;
}

export interface TeamSeasonDetails extends TeamDetails {
    season: string;
}

export interface TeamWithMatches extends Team {
    matches: Match[];
    matchCount: number;
}

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
