export type MatchStatus = "upcoming" | "live" | "completed";

export interface Match {
  id: string;
  cricapi_id: string | null;
  series_id: string | null;
  series_name: string | null;
  league: string;
  season: string;
  team1: string;
  team2: string;
  venue: string;
  start_time: string;
  toss_time: string;
  status: MatchStatus;
  winner: string | null;
  result_summary: string | null;
  toss_winner?: string | null;
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

export interface FirstInningsPickItem {
  predicted_team?: string | null;
  predicted_score: number;
  stake: number;
  actual_team?: string | null;
  actual_score?: number | null;
  coins_won: number;
  pending: boolean;
  settled: boolean;
}

export interface FirstInningsStatusResponse {
  played: boolean;
  picks: FirstInningsPickItem[];
  pick_count: number;
  next_stake: number | null;
}

export interface FirstInningsPickResponse {
  picks: FirstInningsPickItem[];
  pick_count: number;
  next_stake: number | null;
  coins_balance: number;
}

export interface TossStatusResponse {
  played: boolean;
  picked_team?: string;
  stake?: number;
  winning_team?: string;
  coins_won: number;
  pending?: boolean;
  settled?: boolean;
}

export interface TossPickResponse {
  picked_team: string;
  stake: number;
  winning_team?: string | null;
  coins_won: number;
  coins_balance: number;
  already_played: boolean;
  pending?: boolean;
  settled?: boolean;
}

export interface User {
  id: string;
  google_id: string;
  username: string;
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
  coins: number;
  referral_code?: string | null;
  /** Present on POST /users/ (login upsert) when daily bonus was evaluated */
  daily_login_coins_awarded?: number;
  referral_coins_awarded?: number;
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

export interface Squad {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
  is_creator: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  google_id: string;
  username: string;
  name: string;
  points: number;
  accuracy: number;
  total_predictions: number;
  settled_predictions: number;
  correct_predictions: number;
  current_streak: number;
  streak_tier: string;
  jersey_number?: number | null;
  jersey_color?: string | null;
  avatar_url?: string | null;
}

export type ChallengeStatus =
  | "open"
  | "accepted"
  | "counter_offered"
  | "declined"
  | "expired"
  | "cancelled"
  | "settled";

export interface ChallengeUser {
  google_id: string;
  username: string;
  name: string;
  avatar_url?: string | null;
}

export interface Challenge {
  id: string;
  match_id: string;
  share_token: string;
  status: ChallengeStatus;
  challenger_team: string;
  challenger_stake: number;
  challenger_wants: number;
  acceptor_stake: number;
  challenger: ChallengeUser;
  acceptor?: ChallengeUser | null;
  invited_user?: ChallengeUser | null;
  match: Match;
  counter_challenger_stake?: number | null;
  counter_challenger_wants?: number | null;
  created_at?: string | null;
  expires_at: string;
}

export interface ChallengeListResponse {
  challenges: Challenge[];
  pending_count: number;
}

export interface FollowUser {
  google_id: string;
  username: string;
  name: string;
  avatar_url?: string | null;
  jersey_number?: number | null;
  jersey_color?: string | null;
  streak_tier: string;
  current_streak: number;
  points: number;
}
