"use client";

import { useEffect, useState } from "react";
import { Trophy, Target, Zap, Activity, AlertTriangle, ChevronLeft, Edit2, X, Shirt, RefreshCw, Coins, Users, Copy, Check, CloudOff } from "lucide-react";
import Link from "next/link";
import { PredictionWithMatch, User, LeaderboardEntry, Squad, FollowUser } from "@/types";

/** Sort / label key: real settlement time when scored, else scheduled match start. */
function predictionLedgerTimeMs(p: PredictionWithMatch): number {
  if (p.settled_at) return new Date(p.settled_at).getTime();
  return new Date(p.match.start_time).getTime();
}
import { streakTierColor, teamFullName, teamHex, teamShortCode, teamTextColor } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import CricketAvatar from "./CricketAvatar";
import CountdownTimer from "./CountdownTimer";


const SQUAD_SUGGESTIONS = ["Dream XI", "Home Ground", "Office XI", "Champions", "Work Gang", "Super Over"];

const NO_RESULT_SNIPPETS = [
  "no result",
  "without result",
  "abandoned",
  "called off",
  "washout",
  "washed out",
  "no play possible",
  "match tied",
  "ended in a tie",
  "scores are level",
  "match drawn",
  "ends in a draw",
];

function statusLooksNoResult(summary: string | null | undefined): boolean {
  const s = (summary ?? "").trim().toLowerCase();
  if (!s) return false;
  return NO_RESULT_SNIPPETS.some((snippet) => s.includes(snippet));
}

interface ProfileViewProps {
  userId: string;
  isEditable?: boolean;
  currentUserId?: string | null;
  /** When true, follow UI waits for session so we do not flash the wrong Follow/Following state. */
  authLoading?: boolean;
}

export default function ProfileView({
  userId,
  isEditable = false,
  currentUserId = null,
  authLoading = false,
}: ProfileViewProps) {
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [predictions, setPredictions] = useState<PredictionWithMatch[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [weeklyRank, setWeeklyRank] = useState<number | null>(null);
  const [monthlyRank, setMonthlyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  /** Distinguish real 404 from network / server errors (both left dbUser null before). */
  const [profileFetchError, setProfileFetchError] = useState<string | null>(null);
  const [visiblePredCount, setVisiblePredCount] = useState(10);

  // Customization State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState<number | "">("");
  const [editColor, setEditColor] = useState("#ffffff");
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [changingPredId, setChangingPredId] = useState<string | null>(null);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [followListModal, setFollowListModal] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followStatsLoading, setFollowStatsLoading] = useState(true);

  // Squad invite state
  const [inviteModal, setInviteModal] = useState(false);
  const [mySquads, setMySquads] = useState<Squad[]>([]);
  const [squadsLoading, setSquadsLoading] = useState(false);
  const [squadCopied, setSquadCopied] = useState<string | null>(null);
  const [refLinkCopied, setRefLinkCopied] = useState(false);
  const [createSquadName, setCreateSquadName] = useState("");
  const [creatingSquad, setCreatingSquad] = useState(false);
  const [createSquadError, setCreateSquadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchProfileData() {
      const BASE = getApiBaseUrl();
      let googleId = userId;

      try {
        const userRes = await fetchWithRetry(`${BASE}/users/${encodeURIComponent(userId)}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (userRes.ok) {
          if (!cancelled) setProfileFetchError(null);
          const userData = await userRes.json();
          if (cancelled) return;
          setDbUser(userData);
          googleId = userData.google_id;
        } else if (userRes.status === 404) {
          setDbUser(null);
          if (!cancelled) setProfileFetchError(null);
          if (!cancelled) setLoading(false);
          return;
        } else {
          setDbUser(null);
          if (!cancelled) {
            setProfileFetchError(`Could not load profile (${userRes.status}). Try again.`);
            setLoading(false);
          }
          return;
        }

        const predRes = await fetchWithRetry(`${BASE}/predictions/user/${encodeURIComponent(googleId)}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (predRes.ok) {
          const predData = await predRes.json();
          if (cancelled) return;
          setPredictions(predData);
        }

        if (!cancelled) setLoading(false);

        const [globalRes, weeklyRes, monthlyRes] = await Promise.all([
          fetchWithRetry(`${BASE}/leaderboard/global?limit=100`, { cache: "no-store" }),
          fetchWithRetry(`${BASE}/leaderboard/weekly?limit=100`, { cache: "no-store" }),
          fetchWithRetry(`${BASE}/leaderboard/monthly?limit=100`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (globalRes.ok) {
          const data: LeaderboardEntry[] = await globalRes.json();
          if (cancelled) return;
          const entry = data.find((e) => e.google_id === googleId);
          if (entry) setRank(entry.rank);
        }
        if (weeklyRes.ok) {
          const data: LeaderboardEntry[] = await weeklyRes.json();
          if (cancelled) return;
          const entry = data.find((e) => e.google_id === googleId);
          if (entry) setWeeklyRank(entry.rank);
        }
        if (monthlyRes.ok) {
          const data: LeaderboardEntry[] = await monthlyRes.json();
          if (cancelled) return;
          const entry = data.find((e) => e.google_id === googleId);
          if (entry) setMonthlyRank(entry.rank);
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to fetch profile data:", err);
        if (!cancelled) {
          setDbUser(null);
          setProfileFetchError(
            "Connection problem — check your network or try again in a moment."
          );
          setLoading(false);
        }
      }
    }

    if (userId) {
      setLoading(true);
      setProfileFetchError(null);
      fetchProfileData();
    }
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Follow stats: same URL identifier as /users/{id} (username or google_id). Waits for auth on
  // public profiles so the first request includes viewer_id and avoids a wrong "Follow" flash.
  useEffect(() => {
    if (authLoading) {
      setFollowStatsLoading(true);
      return;
    }
    let cancelled = false;
    const BASE = getApiBaseUrl();
    const enc = encodeURIComponent(userId);
    const qs = currentUserId ? `?viewer_id=${encodeURIComponent(currentUserId)}` : "";
    setFollowStatsLoading(true);
    fetchWithRetry(`${BASE}/users/${enc}/follow-stats${qs}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((fs) => {
        if (cancelled || !fs) return;
        setFollowerCount(fs.follower_count);
        setFollowingCount(fs.following_count);
        setIsFollowing(fs.is_following);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFollowStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, currentUserId, authLoading]);

  const handleFollow = async () => {
    if (!currentUserId || followLoading) return;
    setFollowLoading(true);
    try {
      const BASE = getApiBaseUrl();
      const method = isFollowing ? "DELETE" : "POST";
      const gid = dbUser?.google_id ?? userId;
      const res = await fetch(`${BASE}/users/${gid}/follow?follower_id=${currentUserId}`, { method });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        setFollowerCount((c) => c + (isFollowing ? -1 : 1));
      }
    } catch {}
    finally { setFollowLoading(false); }
  };

  const openFollowList = async (type: "followers" | "following") => {
    setFollowListModal(type);
    setFollowList([]);
    setFollowListLoading(true);
    try {
      const gid = dbUser?.google_id ?? userId;
      const res = await fetch(`${getApiBaseUrl()}/users/${gid}/${type}`);
      if (res.ok) setFollowList(await res.json());
    } catch {}
    finally { setFollowListLoading(false); }
  };

  const openInviteModal = async () => {
    setInviteModal(true);
    setSquadsLoading(true);
    setCreateSquadName("");
    setCreateSquadError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/squads/my/${currentUserId}`);
      if (res.ok) setMySquads(await res.json());
    } catch {}
    finally { setSquadsLoading(false); }
  };

  const handleCreateAndInvite = async () => {
    if (!currentUserId || !createSquadName.trim()) return;
    setCreatingSquad(true);
    setCreateSquadError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/squads/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_id: currentUserId, name: createSquadName.trim() }),
      });
      if (res.status === 400) { setCreateSquadError((await res.json()).detail); return; }
      const squad: Squad = await res.json();
      setMySquads([squad]);
      setCreateSquadName("");
    } catch { setCreateSquadError("Something went wrong"); }
    finally { setCreatingSquad(false); }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setSquadCopied(code);
    setTimeout(() => setSquadCopied(null), 2000);
  };

  const handleChangePick = async (pred: PredictionWithMatch, newTeam: string) => {
    setChangingPredId(pred.id);
    try {
      const BASE = getApiBaseUrl();
      const res = await fetchWithRetry(
        `${BASE}/predictions/?google_id=${encodeURIComponent(userId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match_id: pred.match_id, selected_team: newTeam }),
          cache: "no-store",
        }
      );
      if (res.ok) {
        setPredictions((prev) =>
          prev.map((p) => p.id === pred.id ? { ...p, selected_team: newTeam } : p)
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChangingPredId(null);
    }
  };

  const handleSaveIdentity = async () => {
    if (!editNumber) return;
    setIsSaving(true);
    try {
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/users/${userId}/identity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jersey_number: editNumber,
          jersey_color: editColor,
          display_name: editName.trim() || dbUser?.name,
          ...(editUsername.trim() && { username: editUsername.trim() }),
        })
      });
      if (res.status === 409) {
        const err = await res.json();
        if (err.detail === "Username already taken") {
          setUsernameError("Username already taken");
        } else {
          setNameError(err.detail || "Name already taken");
        }
        return;
      }
      if (res.ok) {
        const updatedUser = await res.json();
        setDbUser(updatedUser);
        setIsEditModalOpen(false);
        setNameError("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Running streak + broken-from per prediction (oldest → newest)
  const streakMap: Record<string, number> = {};
  const brokenFromMap: Record<string, number> = {};
  {
    const sorted = [...predictions].sort(
      (a, b) => new Date(a.match.start_time).getTime() - new Date(b.match.start_time).getTime()
    );
    let run = 0;
    for (const p of sorted) {
      if (p.is_correct === 1) {
        run++;
        streakMap[p.id] = run;
      } else if (p.is_correct === 0) {
        brokenFromMap[p.id] = run; // streak that just died
        run = 0;
        streakMap[p.id] = 0;
      } else {
        streakMap[p.id] = run;
      }
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 animate-pulse" aria-busy="true" aria-label="Loading profile">
        <div className="h-3 w-28 bg-[#1a1a1a] mb-8" />
        <div className="border border-[#262626] bg-[#000000] p-6 sm:p-10 flex flex-col sm:flex-row gap-6 sm:gap-8">
          <div className="w-28 h-28 sm:w-40 sm:h-40 bg-[#1a1a1a] border border-[#262626] shrink-0 mx-auto sm:mx-0" />
          <div className="flex-1 space-y-3 min-w-0 pt-1">
            <div className="h-10 sm:h-14 w-48 sm:w-64 bg-[#1a1a1a] max-w-full" />
            <div className="h-3 w-32 bg-[#1a1a1a]" />
            <div className="flex gap-2">
              <div className="h-7 w-24 bg-[#1a1a1a]" />
              <div className="h-7 w-24 bg-[#1a1a1a]" />
            </div>
          </div>
        </div>
        <div className="mt-8 h-32 border border-[#262626] bg-[#000000]" />
      </div>
    );
  }

  if (profileFetchError) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-12 h-12 text-[#f59e0b] mb-4" />
        <h1 className="font-gaming text-2xl tracking-widest text-center mb-2">UNABLE TO LOAD</h1>
        <p className="text-[#a3a3a3] text-sm text-center max-w-sm mb-2">{profileFetchError}</p>
        <p className="tracking-widest text-[#525252] text-[10px] uppercase mb-8">
          Not the same as &quot;user not found&quot; — your link may still be valid.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-white text-black font-gaming font-bold tracking-widest hover:bg-[#c8c8c8] transition-colors mb-4"
        >
          RETRY
        </button>
        <Link href="/leaderboard" className="text-xs font-bold tracking-widest text-[#737373] hover:text-white uppercase">
          Back to leaderboard
        </Link>
      </div>
    );
  }

  if (!dbUser) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-12 h-12 text-[#ef4444] mb-4" />
        <h1 className="font-gaming text-2xl tracking-widest text-center mb-2">RECORD NOT FOUND</h1>
        <p className="tracking-widest text-[#a3a3a3] text-xs uppercase mb-8">This operative does not exist in the database.</p>
        <Link href="/leaderboard" className="px-8 py-4 bg-white text-black font-gaming font-bold tracking-widest hover:bg-[#c8c8c8] transition-colors">
          RETURN TO LEADERBOARD
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
      <Link href="/leaderboard" className="inline-flex items-center gap-2 text-[#737373] hover:text-white transition-colors mb-8 group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs font-black uppercase tracking-[0.2em]">Back to Leaderboard</span>
      </Link>

      {/* HERO SECTION */}
      <div className="border border-[#262626] bg-[#000000] p-6 sm:p-10 mb-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] -translate-y-32 translate-x-32 pointer-events-none" />
        
        {/* MASSIVE JERSEY WATERMARK */}
        {dbUser.jersey_number != null && (
          <div className="absolute -right-8 -bottom-16 sm:-right-12 sm:-bottom-24 pointer-events-none select-none opacity-[0.03] group-hover:opacity-[0.10] transition-opacity duration-700">
            <span 
              className="font-gaming text-[200px] sm:text-[350px] leading-none tracking-tighter drop-shadow-2xl"
              style={{ color: dbUser.jersey_color ?? '#ffffff' }}
            >
              {dbUser.jersey_number.toString().padStart(2, '0')}
            </span>
          </div>
        )}
        
        {/* Edit button — top right */}
        {isEditable && (
          <button
            onClick={() => {
              setEditName(dbUser?.name ?? "");
              setEditUsername(dbUser?.username ?? "");
              setEditNumber(dbUser?.jersey_number ?? "");
              setEditColor(dbUser?.jersey_color ?? "#1e3a8a");
              setNameError("");
              setUsernameError("");
              setIsEditModalOpen(true);
            }}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] border border-[#2a2a2a] text-[#737373] hover:text-white hover:border-[#444] transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">Edit</span>
          </button>
        )}

        <div className="flex flex-col gap-1.5 relative z-10">
          <span className="text-[#737373] text-[9px] font-black tracking-[0.28em] uppercase leading-none">Player Profile</span>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          <div className="flex items-center gap-5 sm:gap-8">
            {/* Jersey — bigger */}
            <div className="w-28 h-28 sm:w-40 sm:h-40 bg-[#111111] overflow-hidden shadow-2xl border border-[#262626] flex items-center justify-center shrink-0">
              <CricketAvatar
                seed={dbUser.name ?? "U"}
                jerseyNumber={dbUser.jersey_number}
                jerseyColor={dbUser.jersey_color}
              />
            </div>

            <div className="flex flex-col gap-3">
              <h1 className="text-4xl sm:text-6xl font-gaming tracking-tighter leading-none text-white">
                {dbUser.name}
              </h1>
              {dbUser.username && (
                <p className="text-[#525252] text-xs font-mono tracking-wider -mt-1">@{dbUser.username}</p>
              )}

              {/* Badges row */}
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 bg-[#111111] border border-[#2a2a2a] inline-flex items-center gap-2 rounded-sm ${streakTierColor(dbUser.streak_tier)}`}>
                  <Zap className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{dbUser.streak_tier}</span>
                </div>
                <div className="px-3 py-1 bg-[#111111] border border-[#2a2a2a] inline-flex items-center gap-2 rounded-sm">
                  <Coins className="w-3.5 h-3.5 text-[#fbbf24]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24]">{(dbUser.coins ?? 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Action buttons — compare google_id to URL id (username) */}
              {(() => {
                const isOtherProfile = Boolean(
                  currentUserId && dbUser && currentUserId !== dbUser.google_id
                );
                if (!isOtherProfile) return null;
                if (followStatsLoading || authLoading) {
                  return (
                    <div className="flex items-center gap-2 flex-nowrap h-8">
                      <div className="h-8 w-[5.5rem] bg-[#1a1a1a] border border-[#262626] animate-pulse" />
                      <div className="h-8 w-[4.5rem] bg-[#1a1a1a] border border-[#262626] animate-pulse" />
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-2 flex-nowrap">
                    <button
                      type="button"
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 border transition-colors disabled:opacity-50 shrink-0 ${
                        isFollowing
                          ? "bg-[#052016] border-[#10b981] text-[#10b981] hover:bg-[#111] hover:border-[#525252] hover:text-[#525252]"
                          : "bg-[#111111] border-[#2a2a2a] text-[#737373] hover:text-white hover:border-white hover:bg-[#1a1a1a]"
                      }`}
                    >
                      {isFollowing && <Check className="w-3 h-3" />}
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {isFollowing ? "Following" : "Follow"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={openInviteModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#111111] border border-[#2a2a2a] text-[#737373] hover:text-white hover:border-[#444] transition-colors shrink-0"
                    >
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Invite</span>
                    </button>
                  </div>
                );
              })()}

              {/* Followers / Following — inline stats */}
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => openFollowList("followers")}
                  className="flex flex-col items-start hover:opacity-70 transition-opacity disabled:opacity-50"
                  disabled={followStatsLoading || authLoading}
                >
                  <span className="font-gaming text-2xl text-white leading-none min-h-8 flex items-center">
                    {followStatsLoading || authLoading ? (
                      <span className="inline-block w-10 h-7 bg-[#1a1a1a] animate-pulse" />
                    ) : (
                      followerCount
                    )}
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.25em] text-[#525252] mt-0.5">Followers</span>
                </button>
                <div className="w-px h-8 bg-[#262626]" />
                <button
                  type="button"
                  onClick={() => openFollowList("following")}
                  className="flex flex-col items-start hover:opacity-70 transition-opacity disabled:opacity-50"
                  disabled={followStatsLoading || authLoading}
                >
                  <span className="font-gaming text-2xl text-white leading-none min-h-8 flex items-center">
                    {followStatsLoading || authLoading ? (
                      <span className="inline-block w-10 h-7 bg-[#1a1a1a] animate-pulse" />
                    ) : (
                      followingCount
                    )}
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.25em] text-[#525252] mt-0.5">Following</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
            {/* All Time — hero rank */}
            <div className="bg-[#0a0a0a] border border-[#262626] px-6 py-5 flex items-center justify-between gap-8 group hover:bg-[#0f0f0f] transition-colors">
              <div>
                <span className="text-[#525252] text-[9px] font-black tracking-[0.3em] uppercase block mb-1">All Time</span>
                <div className="flex items-end gap-0.5">
                  <span className="font-gaming text-3xl text-[#444] leading-none mb-1">#</span>
                  <span className="font-gaming text-6xl tracking-tighter text-white leading-none">
                    {rank ?? "—"}
                  </span>
                </div>
              </div>
              <div className="w-px self-stretch bg-[#1a1a1a]" />
              <span className="text-[#1e1e1e] font-gaming text-7xl tracking-tighter leading-none select-none group-hover:text-[#252525] transition-colors">
                G
              </span>
            </div>

            {/* Weekly + Monthly side by side */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "This Week", value: weeklyRank, letter: "W" },
                { label: "This Month", value: monthlyRank, letter: "M" },
              ].map(({ label, value, letter }) => (
                <div key={label} className="bg-[#0a0a0a] border border-[#262626] px-4 py-4 flex flex-col hover:bg-[#0f0f0f] transition-colors">
                  <span className="text-[#525252] text-[9px] font-black tracking-[0.25em] uppercase mb-2">{label}</span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-end gap-0.5">
                      <span className="font-gaming text-lg text-[#444] leading-none mb-0.5">#</span>
                      <span className="font-gaming text-3xl tracking-tighter text-white leading-none">
                        {value ?? "—"}
                      </span>
                    </div>
                    <span className="text-[#1a1a1a] font-gaming text-4xl leading-none select-none">{letter}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* LIFETIME STATS MODULE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {/* Points */}
        <div className="border border-[#262626] bg-[#000000] p-4 sm:p-6 flex flex-col justify-between h-full hover:bg-[#0a0a0a] transition-colors group">
          <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Trophy className="w-4 h-4 mt-0.5 shrink-0 text-[#737373] group-hover:text-white transition-colors" />
            <span className="text-[9px] sm:text-[10px] leading-tight font-black tracking-[0.2em] text-[#a3a3a3] uppercase group-hover:text-white transition-colors">Score</span>
          </div>
          <p className="font-gaming text-3xl sm:text-4xl tracking-widest text-[#ffffff] mt-auto">{dbUser.points.toLocaleString()}</p>
        </div>

        {/* Accuracy */}
        <div className="border border-[#262626] bg-[#000000] p-4 sm:p-6 flex flex-col justify-between h-full hover:bg-[#0a0a0a] transition-colors group">
          <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Target className="w-4 h-4 mt-0.5 shrink-0 text-[#737373] group-hover:text-white transition-colors" />
            <span className="text-[9px] sm:text-[10px] leading-tight font-black tracking-[0.2em] text-[#a3a3a3] uppercase group-hover:text-white transition-colors">Accuracy</span>
          </div>
          <div className="mt-auto">
            <div className="flex items-end gap-1.5 sm:gap-2 text-[#ffffff]">
              <p className="font-gaming text-3xl sm:text-4xl tracking-widest leading-none">{dbUser.accuracy.toFixed(1)}</p>
              <span className="text-[#737373] text-lg sm:text-xl font-gaming mb-0.5">%</span>
            </div>
            <p className="text-[8px] sm:text-[9px] font-bold text-[#525252] mt-1.5 sm:mt-2 uppercase tracking-widest">{dbUser.correct_predictions}/{dbUser.settled_predictions} Hits</p>
          </div>
        </div>

        {/* Active Streak */}
        <div className="border border-[#262626] bg-[#000000] p-4 sm:p-6 flex flex-col justify-between h-full hover:bg-[#0a0a0a] transition-colors group">
          <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Activity className="w-4 h-4 mt-0.5 shrink-0 text-[#737373] group-hover:text-white transition-colors" />
            <span className="text-[9px] sm:text-[10px] leading-tight font-black tracking-[0.2em] text-[#a3a3a3] uppercase group-hover:text-white transition-colors">Current Streak</span>
          </div>
          <p className="font-gaming text-3xl sm:text-4xl tracking-widest text-[#ffffff] mt-auto">{dbUser.current_streak}</p>
        </div>

        {/* Best Streak */}
        <div className="border border-[#262626] bg-[#000000] p-4 sm:p-6 flex flex-col justify-between h-full hover:bg-[#0a0a0a] transition-colors group">
          <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Zap className="w-4 h-4 mt-0.5 shrink-0 text-[#737373] group-hover:text-white transition-colors" />
            <span className="text-[9px] sm:text-[10px] leading-tight font-black tracking-[0.2em] text-[#a3a3a3] uppercase group-hover:text-white transition-colors">Best Streak</span>
          </div>
          <p className="font-gaming text-3xl sm:text-4xl tracking-widest text-[#ffffff] mt-auto">{dbUser.longest_streak}</p>
        </div>

      </div>

      {/* INVITE FRIENDS — own profile only */}
      {isEditable && dbUser.referral_code && (() => {
        const refUrl = `${typeof window !== "undefined" ? window.location.origin : "https://cricrank.app"}/?ref=${dbUser.referral_code}`;
        const copyRef = async () => {
          try { await navigator.clipboard.writeText(refUrl); setRefLinkCopied(true); setTimeout(() => setRefLinkCopied(false), 2000); }
          catch { /* ignore */ }
        };
        return (
          <div className="border border-[#262626] bg-[#000000]">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[#262626]">
              <div className="w-[3px] h-5 bg-[#f59e0b]" />
              <h2 className="font-gaming text-[13px] uppercase tracking-[0.25em] text-white">Invite Friends</h2>
              <div className="h-px flex-1 bg-[#262626]" />
              <span className="font-gaming text-[10px] font-black tracking-[0.2em] text-[#f59e0b] uppercase">+◈2,000</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-[9px] font-bold tracking-[0.2em] text-[#525252] uppercase mb-3">
                Share your link — earn 2,000 coins per friend who signs up
              </p>
              <div className="flex items-center gap-2 border border-[#262626] bg-[#0a0a0a] px-3 py-2.5">
                <span className="font-mono text-[10px] text-[#a3a3a3] flex-1 truncate">{refUrl}</span>
                <button onClick={copyRef}
                  className="flex items-center gap-1.5 font-gaming text-[9px] font-black uppercase tracking-[0.2em] text-[#525252] hover:text-white transition-colors shrink-0">
                  {refLinkCopied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
                  {refLinkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PREDICTION LEDGER */}
      <div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-2 h-2 bg-white" />
          <h2 className="text-xl font-gaming uppercase tracking-widest text-white">Prediction Ledger</h2>
          <div className="h-px flex-1 bg-[#262626]" />
          <span className="text-[10px] font-black tracking-[0.2em] text-[#737373] uppercase">{predictions.length} records</span>
        </div>

        {predictions.length === 0 ? (
          <div className="border border-[#262626] bg-[#000000] p-12 text-center">
            <Target className="w-8 h-8 text-[#262626] mx-auto mb-4" />
            <p className="text-sm font-bold tracking-widest text-[#737373] uppercase">No predictions yet</p>
            <p className="text-[10px] text-[#525252] tracking-widest mt-2">{dbUser.name} hasn&apos;t made any predictions yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {[...predictions].sort((a, b) => predictionLedgerTimeMs(b) - predictionLedgerTimeMs(a)).slice(0, visiblePredCount).map((pred) => {
              const isUnlocked = pred.is_correct === null && new Date(pred.match.toss_time) > new Date();
              const isChanging = changingPredId === pred.id;

              /* ── PENDING (pre-toss) ── */
              if (isUnlocked) {
                return (
                  <div
                    key={pred.id}
                    className="bg-[#0a0a0a] border border-[#333333] overflow-hidden"
                    style={{ boxShadow: `0 0 24px ${teamHex(pred.selected_team)}22` }}
                  >
                    {/* Header bar */}
                    <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-[#262626] bg-[#111111] gap-2">
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[9px] font-black tracking-[0.3em] text-amber-400 uppercase">Pre-Toss</span>
                      </div>
                      <span className="text-xs sm:text-sm text-white font-black tracking-widest uppercase">
                        {new Date(pred.match.toss_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <div className="shrink-0">
                        <CountdownTimer tossTime={pred.match.toss_time} />
                      </div>
                    </div>

                    {/* Team picker */}
                    <div className="grid grid-cols-2">
                      {[pred.match.team1, pred.match.team2].map((team, idx) => {
                        const isActive = team === pred.selected_team;
                        const hex = teamHex(team);
                        return (
                          <button
                            key={team}
                            disabled={isChanging || (isActive && !isEditable)}
                            onClick={() => isEditable && !isActive && handleChangePick(pred, team)}
                            className={`relative flex flex-col items-center justify-center gap-2 py-7 transition-all duration-300 overflow-hidden ${
                              idx === 0 ? "border-r border-[#262626]" : ""
                            } ${isEditable && !isActive ? "cursor-pointer group" : "cursor-default"}`}
                            style={{ backgroundColor: isActive ? `${hex}28` : "#141414" }}
                          >
                            {/* Active glow */}
                            {isActive && (
                              <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${hex}80` }} />
                            )}
                            {/* Hover overlay */}
                            {isEditable && !isActive && (
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ backgroundColor: `${hex}14` }} />
                            )}

                            <span
                              className="font-gaming text-4xl sm:text-5xl tracking-widest leading-none transition-all duration-300 drop-shadow-sm"
                              style={{
                                color: isActive ? teamTextColor(team) : "#d4d4d4",
                                textShadow: isActive ? `0 0 24px ${hex}66` : "none",
                              }}
                            >
                              {isChanging ? "..." : teamShortCode(team)}
                            </span>
                            <span className="text-[9px] font-black tracking-[0.18em] text-[#b0b0b0] uppercase text-center px-3">
                              {teamFullName(team)}
                            </span>

                            {isActive ? (
                              <div
                                className="flex items-center gap-1.5 px-3 py-1 border"
                                style={{ borderColor: `${hex}66`, backgroundColor: `${hex}35` }}
                              >
                                <Zap className="w-3 h-3" style={{ color: teamTextColor(team) }} fill={teamTextColor(team)} />
                                <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: teamTextColor(team) }}>
                                  {isEditable ? "Your Pick" : "Picked"}
                                </span>
                              </div>
                            ) : isEditable ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 border border-[#3f3f3f] opacity-0 group-hover:opacity-100 transition-opacity">
                                <RefreshCw className="w-3 h-3 text-[#a3a3a3]" />
                                <span className="text-[9px] font-black tracking-[0.2em] text-[#a3a3a3] uppercase">Switch</span>
                              </div>
                            ) : (
                              <div className="h-6" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-[#262626] bg-[#111111]">
                      <span className="text-[9px] text-[#b8b8b8] font-bold tracking-widest uppercase leading-snug">{pred.match.venue}</span>
                      <span className="font-gaming text-[#9ca3af] text-sm shrink-0">— pts</span>
                    </div>
                  </div>
                );
              }

              /* ── NO RESULT: match completed with no decisive winner — not scored, not "pending" ── */
              const matchHasNoWinner =
                pred.match.winner == null || String(pred.match.winner).trim() === "";
              const hasNoResultSummary = statusLooksNoResult(pred.match.result_summary);
              const isNoResultLedger =
                pred.is_correct === null &&
                pred.match.status === "completed" &&
                matchHasNoWinner &&
                hasNoResultSummary;

              if (isNoResultLedger) {
                const nrHex = "#64748b";
                const summary = (pred.match.result_summary || "").trim();
                return (
                  <div
                    key={pred.id}
                    className="bg-[#000000] border border-[#262626] overflow-hidden hover:bg-[#050505] transition-colors flex"
                    style={{ borderLeft: `3px solid ${nrHex}` }}
                  >
                    <div
                      className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-2.5 sm:py-5 border-r border-[#161616] shrink-0 min-w-[56px] sm:min-w-[80px]"
                      style={{ backgroundColor: `${nrHex}12` }}
                    >
                      <CloudOff className="w-3.5 h-3.5 sm:w-5 sm:h-5" style={{ color: nrHex }} strokeWidth={2} />
                      <span
                        className="font-gaming text-[9px] sm:text-xs tracking-widest text-center leading-tight mt-0.5 sm:mt-0 px-0.5"
                        style={{ color: nrHex }}
                      >
                        NO
                        <br className="sm:hidden" />
                        <span className="hidden sm:inline"> </span>
                        RESULT
                      </span>
                      <span className="text-[7.5px] sm:text-[10px] text-[#737373] font-bold tracking-wider text-center leading-[1.2] mt-0.5">
                        {new Date(pred.match.start_time).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="flex-1 px-3 sm:px-5 py-2 sm:py-4 flex flex-col justify-center gap-1 overflow-hidden min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="font-gaming text-lg sm:text-3xl tracking-widest leading-none truncate text-[#c8c8c8]">
                          {teamShortCode(pred.match.team1)}
                        </span>
                        <span className="text-[8px] sm:text-[10px] text-[#737373] font-black italic tracking-widest shrink-0">VS</span>
                        <span className="font-gaming text-lg sm:text-3xl tracking-widest leading-none truncate text-[#c8c8c8]">
                          {teamShortCode(pred.match.team2)}
                        </span>
                      </div>
                      {summary ? (
                        <p className="text-[9px] sm:text-[10px] text-[#737373] font-bold tracking-wide uppercase leading-snug line-clamp-2">
                          {summary}
                        </p>
                      ) : (
                        <p className="text-[9px] sm:text-[10px] text-[#525252] font-bold tracking-widest uppercase">
                          No winner declared — pick not scored
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1 px-2.5 sm:px-5 py-2.5 sm:py-4 border-l border-[#161616] shrink-0 min-w-[56px] sm:min-w-[88px]">
                      <span className="font-gaming text-lg sm:text-2xl text-[#525252] leading-none">0</span>
                      <span className="text-[7px] sm:text-[9px] text-[#525252] font-black tracking-widest uppercase">pts</span>
                    </div>
                  </div>
                );
              }

              /* ── SETTLED (hit / miss / still waiting on result) ── */
              const isHit  = pred.is_correct === 1;
              const isMiss = pred.is_correct === 0;
              const statusHex  = isHit ? "#22c55e" : isMiss ? "#ef4444" : "#525252";
              const statusText = isHit ? "HIT" : isMiss ? "MISS" : "PENDING";
              const streakAtPred  = streakMap[pred.id] ?? 0;
              const brokenFrom    = brokenFromMap[pred.id] ?? 0;

              return (
                <div
                  key={pred.id}
                  className="bg-[#000000] border border-[#262626] overflow-hidden hover:bg-[#050505] transition-colors flex"
                  style={{ borderLeft: `3px solid ${statusHex}` }}
                >
                  {/* Status column */}
                  <div
                    className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-2.5 sm:py-5 border-r border-[#161616] shrink-0 min-w-[56px] sm:min-w-[80px]"
                    style={{ backgroundColor: `${statusHex}10` }}
                  >
                    {/* Icon */}
                    {isHit
                      ? <Zap className="w-3.5 h-3.5 sm:w-5 sm:h-5" style={{ color: statusHex }} fill={statusHex} />
                      : isMiss
                      ? <X className="w-3.5 h-3.5 sm:w-5 sm:h-5" style={{ color: statusHex }} strokeWidth={3} />
                      : <Target className="w-3.5 h-3.5 sm:w-5 sm:h-5" style={{ color: statusHex }} />
                    }
                    {/* Status word */}
                    <span className="font-gaming text-[10px] sm:text-base tracking-widest mt-0.5 sm:mt-0" style={{ color: statusHex, textShadow: `0 0 12px ${statusHex}60` }}>
                      {statusText}
                    </span>
                    {/* Date — single readable line */}
                    <span className="text-[7.5px] sm:text-[10px] text-[#737373] font-bold tracking-wider text-center leading-[1.2] sm:leading-snug mt-0.5 sm:mt-0">
                      {(() => {
                        const d = new Date(pred.settled_at ?? pred.match.start_time);
                        return (
                          <>
                            {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            <br className="hidden sm:block" />
                            <span className="sm:hidden"> </span>
                            {d.getFullYear()}
                          </>
                        );
                      })()}
                    </span>
                  </div>

                  {/* Teams + pick */}
                  <div className="flex-1 px-3 sm:px-5 py-2 sm:py-4 flex flex-col justify-center gap-1.5 sm:gap-3 overflow-hidden">
                    {/* Teams row */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="font-gaming text-lg sm:text-3xl tracking-widest leading-none truncate text-[#c8c8c8]">
                        {teamShortCode(pred.match.team1)}
                      </span>
                      <span className="text-[8px] sm:text-[10px] text-[#737373] font-black italic tracking-widest shrink-0">VS</span>
                      <span className="font-gaming text-lg sm:text-3xl tracking-widest leading-none truncate text-[#c8c8c8]">
                        {teamShortCode(pred.match.team2)}
                      </span>
                    </div>
                    {/* Pending: show which side they picked (match in progress / awaiting result) */}
                    {!isHit && !isMiss && pred.selected_team && (
                      <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap min-w-0">
                        <span className="text-[8px] sm:text-[9px] font-black tracking-[0.2em] text-[#737373] uppercase shrink-0">
                          {isEditable ? "Your pick" : "Pick"}
                        </span>
                        <span
                          className="font-gaming text-base sm:text-xl tracking-widest shrink-0"
                          style={{
                            color: teamTextColor(pred.selected_team),
                            textShadow: `0 0 14px ${teamHex(pred.selected_team)}55`,
                          }}
                        >
                          {teamShortCode(pred.selected_team)}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold text-[#a3a3a3] uppercase tracking-wide truncate">
                          {teamFullName(pred.selected_team)}
                        </span>
                      </div>
                    )}

                  </div>

                  {/* Points + streak column */}
                  <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-2.5 sm:py-4 border-l border-[#161616] shrink-0 min-w-[56px] sm:min-w-[88px]">
                    {isHit ? (
                      <>
                        <span className="font-gaming text-[22px] sm:text-3xl text-[#22c55e] leading-none">+{pred.points_awarded}</span>
                        <span className="text-[7px] sm:text-[9px] text-[#22c55e]/50 font-black tracking-widest uppercase mt-0.5 sm:mt-0">pts</span>
                      </>
                    ) : isMiss ? (
                      <div className="flex flex-col items-center gap-1.5">
                        {brokenFrom > 0 ? (
                          <>
                            <div className="flex items-center gap-0.5 sm:gap-1">
                              <Zap className="w-2.5 h-2.5 sm:w-4 sm:h-4 text-[#ef4444]" fill="currentColor" />
                              <span className="font-gaming text-[15px] sm:text-2xl text-[#ef4444] leading-none" style={{ textShadow: '0 0 16px #ef444460' }}>
                                {brokenFrom}
                              </span>
                            </div>
                            <div className="w-6 sm:w-10 h-px sm:h-[2px] bg-[#ef4444]/70 rotate-[-20deg] my-0.5 sm:my-0" />
                            <span className="font-gaming text-[9px] sm:text-sm tracking-widest text-[#ef4444]/80 uppercase mt-0 sm:mt-0">Gone</span>
                          </>
                        ) : (
                          <span className="font-gaming text-sm sm:text-xl tracking-widest text-[#ef4444]">MISS</span>
                        )}
                      </div>
                    ) : (
                      <span className="font-gaming text-xl sm:text-2xl text-[#333]">—</span>
                    )}
                    {/* Running streak at this point */}
                    {streakAtPred > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <Zap className="w-3 h-3 text-amber-400" fill="currentColor" />
                        <span className="font-gaming text-sm text-amber-400 leading-none">{streakAtPred}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {predictions.length > visiblePredCount && (
              <button
                onClick={() => setVisiblePredCount(v => v + 10)}
                className="w-full py-2.5 border border-[#262626] text-[#525252] hover:text-white hover:border-[#333] text-xs font-black uppercase tracking-widest transition-colors"
              >
                Show {Math.min(10, predictions.length - visiblePredCount)} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* FOLLOWERS / FOLLOWING MODAL */}
      {followListModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-[#262626] w-full max-w-sm relative flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
              <h2 className="font-gaming text-lg tracking-widest uppercase">
                {followListModal === "followers" ? "Followers" : "Following"}
              </h2>
              <button onClick={() => setFollowListModal(null)} className="text-[#737373] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {followListLoading ? (
                <div className="text-center py-12 text-[#525252] text-[10px] font-black tracking-[0.3em] uppercase animate-pulse">Loading...</div>
              ) : followList.length === 0 ? (
                <div className="text-center py-12 text-[#525252] text-[10px] font-black tracking-[0.2em] uppercase">
                  {followListModal === "followers" ? "No followers yet" : "Not following anyone yet"}
                </div>
              ) : (
                followList.map((u) => (
                  <Link
                    key={u.google_id}
                    href={`/profile/${u.username ?? u.google_id}`}
                    onClick={() => setFollowListModal(null)}
                    className="flex items-center gap-4 px-6 py-4 border-b border-[#111] hover:bg-[#111] transition-colors"
                  >
                    <div className="w-10 h-10 shrink-0">
                      <CricketAvatar seed={u.name} jerseyNumber={u.jersey_number} jerseyColor={u.jersey_color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-gaming text-sm tracking-wide text-white truncate">{u.name}</p>
                      <p className={`text-[9px] font-black tracking-widest uppercase mt-0.5 ${streakTierColor(u.streak_tier)}`}>{u.streak_tier}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-white">{u.points}</p>
                      <p className="text-[8px] text-[#525252] font-bold uppercase tracking-widest">pts</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SQUAD INVITE MODAL */}
      {inviteModal && currentUserId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-[#262626] w-full max-w-sm p-6 relative">
            <button onClick={() => setInviteModal(false)} className="absolute top-4 right-4 text-[#737373] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-gaming text-xl tracking-widest mb-1 uppercase">Invite to Squad</h2>
            <p className="text-[10px] text-[#525252] font-bold tracking-[0.2em] uppercase mb-6">
              Share invite code with {dbUser?.name ?? "this player"}
            </p>

            {squadsLoading ? (
              <div className="text-center py-8 text-[#525252] text-[10px] font-black tracking-[0.3em] uppercase animate-pulse">Loading...</div>
            ) : mySquads.length === 0 ? (
              <>
                <p className="text-[10px] text-[#737373] font-bold tracking-[0.2em] uppercase mb-3">Create a squad first:</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {SQUAD_SUGGESTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => { setCreateSquadName(n); setCreateSquadError(""); }}
                      className={`px-3 py-1.5 text-[9px] font-black tracking-widest uppercase border transition-colors ${createSquadName === n ? "border-white text-white bg-[#1a1a1a]" : "border-[#333] text-[#525252] hover:border-[#555] hover:text-white"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  maxLength={30}
                  value={createSquadName}
                  onChange={(e) => { setCreateSquadName(e.target.value); setCreateSquadError(""); }}
                  placeholder="Or type a custom name..."
                  className="w-full bg-[#111] border border-[#333] text-white font-gaming px-4 py-3 text-lg focus:outline-none focus:border-white transition-colors placeholder:text-[#444] mb-2"
                />
                {createSquadError && <p className="text-[9px] text-[#ef4444] font-bold tracking-widest uppercase mb-3">{createSquadError}</p>}
                <button
                  onClick={handleCreateAndInvite}
                  disabled={creatingSquad || !createSquadName.trim()}
                  className="w-full py-3 bg-white text-black font-gaming tracking-widest hover:bg-[#c8c8c8] disabled:opacity-50 transition-colors uppercase"
                >
                  {creatingSquad ? "Creating..." : "Create & Get Invite Code"}
                </button>
              </>
            ) : (
              <>
                <p className="text-[10px] text-[#525252] font-bold tracking-[0.2em] uppercase mb-4">Copy an invite code and share it:</p>
                <div className="flex flex-col gap-2">
                  {mySquads.map((squad) => (
                    <div key={squad.id} className="flex items-center justify-between bg-[#111] border border-[#222] px-4 py-3">
                      <div>
                        <p className="text-[10px] font-black tracking-widest uppercase text-white">{squad.name}</p>
                        <p className="text-[8px] text-[#525252] font-bold tracking-widest mt-1">{squad.member_count} {squad.member_count === 1 ? "member" : "members"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-gaming text-xl tracking-widest text-white">{squad.invite_code}</span>
                        <button
                          onClick={() => copyInviteCode(squad.invite_code)}
                          className="text-[#525252] hover:text-[#fbbf24] transition-colors"
                          title="Copy invite code"
                        >
                          {squadCopied === squad.invite_code ? <Check className="w-4 h-4 text-[#10b981]" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-[#525252] text-center mt-4 tracking-widest">
                  Send the code to {dbUser?.name ?? "them"} — they can join via the leaderboard dropdown
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* IDENTITY MODAL — scrollable overlay so mobile keyboard + long form can reach CONFIRM */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm [touch-action:pan-y]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex min-h-[100dvh] w-full justify-center px-4 pt-6 pb-32 sm:min-h-screen sm:items-center sm:py-10 sm:pb-10">
            <div className="bg-[#0a0a0a] border border-[#262626] w-full max-w-lg p-5 sm:p-8 relative my-auto sm:my-0">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 text-[#737373] hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 mb-8">
              <Shirt className="w-5 h-5 text-[#737373]" />
              <h2 className="font-gaming text-2xl tracking-widest">CUSTOMIZE IDENTITY</h2>
            </div>

            {/* Live Preview */}
            <div className="flex items-center gap-6 bg-[#111111] border border-[#1a1a1a] p-6 mb-8">
              <div className="w-24 h-24 shrink-0">
                <CricketAvatar
                  seed={editName || dbUser.name || "U"}
                  jerseyNumber={editNumber !== "" ? editNumber : dbUser.jersey_number}
                  jerseyColor={editColor || null}
                />
              </div>
              <div>
                <p className="text-[9px] font-black tracking-[0.3em] text-[#525252] uppercase mb-1">Preview</p>
                <p className="font-gaming text-xl text-white tracking-wider">{editName || dbUser.name}</p>
                <p className="text-[10px] text-[#737373] font-bold tracking-widest mt-1 uppercase">
                  #{editNumber !== "" ? editNumber : dbUser.jersey_number ?? "—"}
                </p>
              </div>
              <div
                className="ml-auto w-8 h-8 rounded-full border-2 border-[#333] shrink-0"
                style={{ backgroundColor: editColor }}
              />
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[#737373] text-[10px] font-black tracking-[0.2em] mb-2 uppercase">Display Name</label>
                <input
                  type="text"
                  maxLength={30}
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setNameError(""); }}
                  placeholder={dbUser.name}
                  className={`w-full bg-[#111] border text-white font-gaming px-4 py-3 text-lg focus:outline-none transition-colors placeholder:text-[#444] ${nameError ? "border-[#ef4444]" : "border-[#333] focus:border-white"}`}
                />
                <div className="flex justify-between mt-1">
                  {nameError ? <p className="text-[9px] text-[#ef4444] font-bold tracking-widest uppercase">{nameError}</p> : <span />}
                  <p className="text-[9px] text-[#525252]">{editName.length}/30</p>
                </div>
              </div>

              <div>
                <label className="block text-[#737373] text-[10px] font-black tracking-[0.2em] mb-2 uppercase">Username</label>
                <div className="flex items-center">
                  <span className="bg-[#111] border-l border-t border-b border-[#333] text-[#525252] px-3 py-3 font-gaming text-lg select-none">@</span>
                  <input
                    type="text"
                    maxLength={20}
                    value={editUsername}
                    onChange={(e) => { setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameError(""); }}
                    placeholder={dbUser.username}
                    className={`flex-1 bg-[#111] border text-white font-gaming px-4 py-3 text-lg focus:outline-none transition-colors placeholder:text-[#444] ${usernameError ? "border-[#ef4444]" : "border-[#333] focus:border-white"}`}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  {usernameError ? <p className="text-[9px] text-[#ef4444] font-bold tracking-widest uppercase">{usernameError}</p> : <span className="text-[9px] text-[#525252]">3–20 chars · a-z 0-9 _</span>}
                  <p className="text-[9px] text-[#525252]">{editUsername.length}/20</p>
                </div>
              </div>

              <div>
                <label className="block text-[#737373] text-[10px] font-black tracking-[0.2em] mb-2 uppercase">Jersey Number (1–999)</label>
                <input
                  type="number"
                  min="1" max="999"
                  value={editNumber}
                  onChange={(e) => setEditNumber(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full bg-[#111] border border-[#333] text-white font-gaming pl-4 py-3 text-2xl focus:outline-none focus:border-white transition-colors"
                  placeholder={String(dbUser.jersey_number ?? "")}
                />
              </div>

              <div>
                <label className="block text-[#737373] text-[10px] font-black tracking-[0.2em] mb-3 uppercase">Jersey Color</label>
                <div className="flex gap-3 flex-wrap items-center">
                  {[
                    { color: '#1e3a8a', label: 'Mumbai' },
                    { color: '#fbbf24', label: 'Chennai' },
                    { color: '#7f1d1d', label: 'Bangalore' },
                    { color: '#831843', label: 'Rajasthan' },
                    { color: '#3730a3', label: 'Kolkata' },
                    { color: '#064e3b', label: 'Delhi' },
                    { color: '#991b1b', label: 'Punjab' },
                    { color: '#ea580c', label: 'Hyderabad' },
                  ].map(({ color, label }) => (
                    <button
                      key={color}
                      title={label}
                      onClick={() => setEditColor(color)}
                      className={`w-9 h-9 rounded-full border-2 transition-all ${editColor === color ? 'border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.35)]' : 'border-transparent hover:scale-105 opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {/* Custom color picker */}
                  <div className="relative w-9 h-9">
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div
                      className="absolute inset-0 rounded-full border-2 border-dashed border-[#444] flex items-center justify-center pointer-events-none"
                      style={{ backgroundColor: editColor }}
                    >
                      <span className="text-[11px] font-black text-white mix-blend-difference">+</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveIdentity}
                disabled={isSaving || !editNumber}
                className="w-full py-4 mt-2 bg-white text-black font-gaming tracking-widest hover:bg-[#c8c8c8] disabled:opacity-50 transition-colors uppercase"
              >
                {isSaving ? "SAVING..." : "CONFIRM IDENTITY"}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
