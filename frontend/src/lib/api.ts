import {
  Match,
  AIPrediction,
  CrowdPrediction,
  TossPickResponse,
  TossStatusResponse,
  FirstInningsPickResponse,
  FirstInningsStatusResponse,
  MatchLiveResponse,
  MatchScorecardResponse,
  User,
  LeaderboardEntry,
  Prediction,
  Squad,
  FollowUser,
  Challenge,
  ChallengeListResponse,
} from "@/types";
import { getApiBaseUrl } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/fetch-with-retry";

const BASE = getApiBaseUrl();

/** Short client-side cache for toss / first-innings status (Next fetch cache is weak for cross-origin client calls). */
const SIDE_GAME_TTL_MS = 30_000;
const sideGameCache = new Map<string, { expires: number; data: unknown }>();

function sideCacheTake<T>(key: string): T | null {
  const e = sideGameCache.get(key);
  if (!e || Date.now() > e.expires) {
    if (e) sideGameCache.delete(key);
    return null;
  }
  return e.data as T;
}

function sideCachePut<T>(key: string, data: T) {
  sideGameCache.set(key, { expires: Date.now() + SIDE_GAME_TTL_MS, data });
}

function bustSideGameCache(matchId: string, googleId: string, which: "toss" | "fi" | "both") {
  if (which === "toss" || which === "both") {
    sideGameCache.delete(`toss:${matchId}:${googleId}`);
  }
  if (which === "fi" || which === "both") {
    sideGameCache.delete(`fi:${matchId}:${googleId}`);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function getNoStore<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function postNoStore<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRetry(`${BASE}${path}`, {
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

async function deleteNoStore(path: string): Promise<void> {
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method: "DELETE",
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
}

export const api = {
  matches: {
    upcoming: (limit = 10, days?: number) => get<Match[]>(`/matches/upcoming?limit=${limit}${days ? `&days=${days}` : ''}`),
    today: () => get<Match[]>("/matches/today"),
    recentCompleted: (limit = 5) => get<Match[]>(`/matches/recent-completed?limit=${limit}`),
    get: (id: string) => get<Match>(`/matches/${id}`),
    /** No client TTL — stale line scores felt "stuck"; backend still dedupes CricAPI (~30–60s). */
    live: (matchId: string) =>
      getNoStore<MatchLiveResponse>(`/matches/${encodeURIComponent(matchId)}/live`),
    scorecard: (matchId: string) =>
      getNoStore<MatchScorecardResponse>(`/matches/${encodeURIComponent(matchId)}/scorecard`),
    aiPrediction: (id: string) => getNoStore<AIPrediction>(`/matches/${encodeURIComponent(id)}/prediction`),
    crowd: (id: string) => getNoStore<CrowdPrediction>(`/matches/${encodeURIComponent(id)}/crowd`),
    tossStatus: async (matchId: string, googleId: string) => {
      const key = `toss:${matchId}:${googleId}`;
      const hit = sideCacheTake<TossStatusResponse>(key);
      if (hit) return hit;
      const data = await getNoStore<TossStatusResponse>(
        `/matches/${encodeURIComponent(matchId)}/toss-status?google_id=${encodeURIComponent(googleId)}`
      );
      sideCachePut(key, data);
      return data;
    },
    tossPick: async (matchId: string, googleId: string, pickedTeam: string, stake: number) => {
      const data = await postNoStore<TossPickResponse>(
        `/matches/${encodeURIComponent(matchId)}/toss-pick?google_id=${encodeURIComponent(googleId)}`,
        { picked_team: pickedTeam, stake }
      );
      bustSideGameCache(matchId, googleId, "toss");
      return data;
    },
    firstInningsStatus: async (matchId: string, googleId: string) => {
      const key = `fi:${matchId}:${googleId}`;
      const hit = sideCacheTake<FirstInningsStatusResponse>(key);
      if (hit) return hit;
      const data = await getNoStore<FirstInningsStatusResponse>(
        `/matches/${encodeURIComponent(matchId)}/first-innings-status?google_id=${encodeURIComponent(googleId)}`
      );
      sideCachePut(key, data);
      return data;
    },
    firstInningsPick: async (matchId: string, googleId: string, predictedScore: number) => {
      const data = await postNoStore<FirstInningsPickResponse>(
        `/matches/${encodeURIComponent(matchId)}/first-innings-pick?google_id=${encodeURIComponent(googleId)}`,
        { predicted_score: predictedScore }
      );
      bustSideGameCache(matchId, googleId, "fi");
      return data;
    },
  },
  users: {
    upsert: (data: { google_id: string; name: string; email: string }) =>
      post<User>("/users/", data),
    get: (identifier: string) => get<User>(`/users/${encodeURIComponent(identifier)}`),
    search: (q: string) => getNoStore<FollowUser[]>(`/users/search?q=${encodeURIComponent(q)}`),
    followStats: (targetId: string, viewerId?: string) =>
      getNoStore<{ follower_count: number; following_count: number; is_following: boolean }>(
        `/users/${encodeURIComponent(targetId)}/follow-stats${
          viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : ""
        }`
      ),
    follow: (targetId: string, followerId: string) =>
      fetch(`${BASE}/users/${targetId}/follow?follower_id=${followerId}`, { method: "POST" }),
    unfollow: (targetId: string, followerId: string) =>
      fetch(`${BASE}/users/${targetId}/follow?follower_id=${followerId}`, { method: "DELETE" }),
    following: (googleId: string) =>
      getNoStore<FollowUser[]>(`/users/${encodeURIComponent(googleId)}/following`),
  },
  predictions: {
    submit: (googleId: string, matchId: string, selectedTeam: string) =>
      postNoStore<Prediction>(`/predictions/?google_id=${encodeURIComponent(googleId)}`, {
        match_id: matchId,
        selected_team: selectedTeam,
      }),
    remove: (googleId: string, matchId: string) =>
      deleteNoStore(
        `/predictions/${encodeURIComponent(matchId)}?google_id=${encodeURIComponent(googleId)}`
      ),
    byUser: (googleId: string) =>
      getNoStore<Prediction[]>(`/predictions/user/${encodeURIComponent(googleId)}`),
  },
  squads: {
    my: (googleId: string) => getNoStore<Squad[]>(`/squads/my/${encodeURIComponent(googleId)}`),
    create: (googleId: string, name: string) =>
      post<Squad>("/squads/", { google_id: googleId, name }),
    join: (inviteCode: string, googleId: string) =>
      post<Squad>(`/squads/join/${inviteCode}?google_id=${googleId}`, {}),
    leave: (squadId: string, googleId: string) =>
      fetch(`${BASE}/squads/${squadId}/leave?google_id=${googleId}`, { method: "DELETE" }),
    leaderboard: (squadId: string) =>
      get<LeaderboardEntry[]>(`/squads/${squadId}/leaderboard`),
  },
  challenges: {
    create: (googleId: string, matchId: string, challengerTeam: string, challengerStake: number, challengerWants: number, invitedGoogleId?: string) =>
      postNoStore<Challenge>(`/challenges/?google_id=${encodeURIComponent(googleId)}`, {
        match_id: matchId,
        challenger_team: challengerTeam,
        challenger_stake: challengerStake,
        challenger_wants: challengerWants,
        ...(invitedGoogleId ? { invited_google_id: invitedGoogleId } : {}),
      }),
    byToken: (token: string) => getNoStore<Challenge>(`/challenges/token/${encodeURIComponent(token)}`),
    byUser: (googleId: string) =>
      getNoStore<ChallengeListResponse>(`/challenges/user/${encodeURIComponent(googleId)}`),
    pendingCount: (googleId: string) =>
      getNoStore<{ count: number }>(`/challenges/pending-count/${encodeURIComponent(googleId)}`),
    open: (googleId?: string, limit = 20) =>
      getNoStore<Challenge[]>(`/challenges/open?limit=${limit}${googleId ? `&google_id=${encodeURIComponent(googleId)}` : ""}`),
    accept: (challengeId: string, googleId: string) =>
      postNoStore<Challenge>(`/challenges/${challengeId}/accept?google_id=${encodeURIComponent(googleId)}`, {}),
    counter: (challengeId: string, googleId: string, challengerStake: number, challengerWants: number) =>
      postNoStore<Challenge>(`/challenges/${challengeId}/counter?google_id=${encodeURIComponent(googleId)}`, {
        challenger_stake: challengerStake,
        challenger_wants: challengerWants,
      }),
    acceptCounter: (challengeId: string, googleId: string) =>
      postNoStore<Challenge>(`/challenges/${challengeId}/accept-counter?google_id=${encodeURIComponent(googleId)}`, {}),
    decline: (challengeId: string, googleId: string) =>
      postNoStore<Challenge>(`/challenges/${challengeId}/decline?google_id=${encodeURIComponent(googleId)}`, {}),
    cancel: (challengeId: string, googleId: string) =>
      postNoStore<Challenge>(`/challenges/${challengeId}/cancel?google_id=${encodeURIComponent(googleId)}`, {}),
  },
  leaderboard: {
    global: (limit = 50) => get<LeaderboardEntry[]>(`/leaderboard/global?limit=${limit}`),
    weekly: (limit = 50) => get<LeaderboardEntry[]>(`/leaderboard/weekly?limit=${limit}`),
    monthly: (limit = 50) => get<LeaderboardEntry[]>(`/leaderboard/monthly?limit=${limit}`),
    myRank: (googleId: string, period = "alltime", scope: "global" | "following" = "global") =>
      get<LeaderboardEntry | null>(
        `/leaderboard/rank/${encodeURIComponent(googleId)}?period=${period}&scope=${scope}`
      ),
    following: (googleId: string, period = "alltime", limit = 100) =>
      get<LeaderboardEntry[]>(
        `/leaderboard/following/${encodeURIComponent(googleId)}?period=${period}&limit=${limit}`
      ),
  },
};
