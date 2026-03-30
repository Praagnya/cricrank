export type MatchStatus = "upcoming" | "live" | "completed";

export interface Match {
  id: string;
  league: string;
  season: string;
  team1: string;
  team2: string;
  venue: string;
  start_time: string;
  toss_time: string;
  status: MatchStatus;
  winner: string | null;
}

export interface AIPrediction {
  predicted_winner: string;
  win_probability: number;
  opponent_probability: number;
  insights: string[];
}

export interface CrowdPrediction {
  [team: string]: number;
  total_votes: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  points: number;
  total_predictions: number;
  correct_predictions: number;
  accuracy: number;
  current_streak: number;
  longest_streak: number;
  streak_tier: string;
  jersey_number?: number | null;
  avatar_url?: string | null;
  jersey_color?: string;
}

export interface Prediction {
  id: string;
  match_id: string;
  selected_team: string;
  is_correct: number | null;
  is_post_toss: boolean;
  points_awarded: number;
  created_at: string;
}

export interface PredictionWithMatch extends Prediction {
  match: MatchPublic;
}

export type MatchPublic = Match;

export interface LeaderboardEntry {
  rank: number;
  google_id: string;
  name: string;
  points: number;
  accuracy: number;
  total_predictions: number;
  correct_predictions: number;
  current_streak: number;
  streak_tier: string;
  jersey_number?: number | null;
  jersey_color?: string | null;
  avatar_url?: string | null;
}
