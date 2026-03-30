import { Match, AIPrediction, CrowdPrediction, User, LeaderboardEntry, Prediction } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  matches: {
    upcoming: (limit = 10, days?: number) => get<Match[]>(`/matches/upcoming?limit=${limit}${days ? `&days=${days}` : ''}`),
    today: () => get<Match[]>("/matches/today"),
    get: (id: string) => get<Match>(`/matches/${id}`),
    aiPrediction: (id: string) => get<AIPrediction>(`/matches/${id}/prediction`),
    crowd: (id: string) => get<CrowdPrediction>(`/matches/${id}/crowd`),
  },
  users: {
    upsert: (data: { google_id: string; name: string; email: string }) =>
      post<User>("/users/", data),
    get: (googleId: string) => get<User>(`/users/${googleId}`),
  },
  predictions: {
    submit: (googleId: string, matchId: string, selectedTeam: string) =>
      post<Prediction>(`/predictions/?google_id=${googleId}`, {
        match_id: matchId,
        selected_team: selectedTeam,
      }),
    byUser: (googleId: string) => get<Prediction[]>(`/predictions/user/${googleId}`),
  },
  leaderboard: {
    global: (limit = 50) => get<LeaderboardEntry[]>(`/leaderboard/global?limit=${limit}`),
    weekly: (limit = 50) => get<LeaderboardEntry[]>(`/leaderboard/weekly?limit=${limit}`),
    monthly: (limit = 50) => get<LeaderboardEntry[]>(`/leaderboard/monthly?limit=${limit}`),
  },
};
