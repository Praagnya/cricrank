import {
  Match,
  AIPrediction,
  CrowdPrediction,
  TossPickResponse,
  TossStatusResponse,
  FirstInningsPickResponse,
  FirstInningsStatusResponse,
  User,
  LeaderboardEntry,
  Prediction,
  Squad,
  FollowUser,
} from "@/types";
import { getApiBaseUrl } from "@/lib/api-base";

const BASE = getApiBaseUrl();

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

async function getNoStore<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function postNoStore<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `API error ${res.status}`;
    try {
      const j = (await res.json()) as { detail?: string | unknown };
      if (j.detail !== undefined) {
        detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  matches: {
    upcoming: (limit = 10, days?: number) => get<Match[]>(`/matches/upcoming?limit=${limit}${days ? `&days=${days}` : ''}`),
    today: () => get<Match[]>("/matches/today"),
    recentCompleted: (limit = 5) => get<Match[]>(`/matches/recent-completed?limit=${limit}`),
    get: (id: string) => get<Match>(`/matches/${id}`),
    aiPrediction: (id: string) => get<AIPrediction>(`/matches/${id}/prediction`),
    crowd: (id: string) => get<CrowdPrediction>(`/matches/${id}/crowd`),
    tossStatus: (matchId: string, googleId: string) =>
      getNoStore<TossStatusResponse>(
        `/matches/${matchId}/toss-status?google_id=${encodeURIComponent(googleId)}`
      ),
    tossPick: (matchId: string, googleId: string, pickedTeam: string) =>
      postNoStore<TossPickResponse>(
        `/matches/${matchId}/toss-pick?google_id=${encodeURIComponent(googleId)}`,
        { picked_team: pickedTeam }
      ),
    firstInningsStatus: (matchId: string, googleId: string) =>
      getNoStore<FirstInningsStatusResponse>(
        `/matches/${matchId}/first-innings-status?google_id=${encodeURIComponent(googleId)}`
      ),
    firstInningsPick: (matchId: string, googleId: string, predictedTeam: string, predictedScore: number) =>
      postNoStore<FirstInningsPickResponse>(
        `/matches/${matchId}/first-innings-pick?google_id=${encodeURIComponent(googleId)}`,
        { predicted_team: predictedTeam, predicted_score: predictedScore }
      ),
  },
  users: {
    upsert: (data: { google_id: string; name: string; email: string }) =>
      post<User>("/users/", data),
    get: (identifier: string) => get<User>(`/users/${identifier}`),
    search: (q: string) => get<FollowUser[]>(`/users/search?q=${encodeURIComponent(q)}`),
    followStats: (targetId: string, viewerId?: string) =>
      get<{ follower_count: number; following_count: number; is_following: boolean }>(
        `/users/${targetId}/follow-stats${viewerId ? `?viewer_id=${viewerId}` : ""}`
      ),
    follow: (targetId: string, followerId: string) =>
      fetch(`${BASE}/users/${targetId}/follow?follower_id=${followerId}`, { method: "POST" }),
    unfollow: (targetId: string, followerId: string) =>
      fetch(`${BASE}/users/${targetId}/follow?follower_id=${followerId}`, { method: "DELETE" }),
  },
  predictions: {
    submit: (googleId: string, matchId: string, selectedTeam: string) =>
      post<Prediction>(`/predictions/?google_id=${googleId}`, {
        match_id: matchId,
        selected_team: selectedTeam,
      }),
    byUser: (googleId: string) => get<Prediction[]>(`/predictions/user/${googleId}`),
  },
  squads: {
    my: (googleId: string) => get<Squad[]>(`/squads/my/${googleId}`),
    create: (googleId: string, name: string) =>
      post<Squad>("/squads/", { google_id: googleId, name }),
    join: (inviteCode: string, googleId: string) =>
      post<Squad>(`/squads/join/${inviteCode}?google_id=${googleId}`, {}),
    leave: (squadId: string, googleId: string) =>
      fetch(`${BASE}/squads/${squadId}/leave?google_id=${googleId}`, { method: "DELETE" }),
    leaderboard: (squadId: string) =>
      get<LeaderboardEntry[]>(`/squads/${squadId}/leaderboard`),
  },
  leaderboard: {
    global: (limit = 50) => get<LeaderboardEntry[]>(`/leaderboard/global?limit=${limit}`),
    weekly: (limit = 50) => get<LeaderboardEntry[]>(`/leaderboard/weekly?limit=${limit}`),
    monthly: (limit = 50) => get<LeaderboardEntry[]>(`/leaderboard/monthly?limit=${limit}`),
    myRank: (googleId: string, period = "alltime") =>
      get<LeaderboardEntry | null>(`/leaderboard/rank/${googleId}?period=${period}`),
    following: (googleId: string, limit = 100) =>
      get<LeaderboardEntry[]>(`/leaderboard/following/${googleId}?limit=${limit}`),
  },
};
