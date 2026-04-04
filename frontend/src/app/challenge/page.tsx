"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import TeamCrest from "@/components/TeamCrest";
import ChallengeCard, { TERMINAL_STATUSES } from "@/components/ChallengeCard";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api";
import { Match, Challenge, FollowUser } from "@/types";
import { teamHex, teamShortCode, formatRelativeDate } from "@/lib/utils";
import {
  Handshake, ChevronRight, Minus, Plus, Share2, Copy,
  Check, ArrowLeft, UserCheck, SkipForward, Bell, Globe, RefreshCw,
} from "lucide-react";

type CreateStep = "match" | "team" | "stakes" | "invite" | "share";
type PageTab = "new" | "open" | "mine";

export default function ChallengePage() {
  const { user, loading, signInWithGoogle } = useUser();
  const googleId = user?.id ?? null;

  const [tab, setTab] = useState<PageTab>("new");
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [openChallenges, setOpenChallenges] = useState<Challenge[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [openLoading, setOpenLoading] = useState(false);
  const [openLoaded, setOpenLoaded] = useState(false);

  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followingLoaded, setFollowingLoaded] = useState(false);

  const [step, setStep] = useState<CreateStep>("match");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [challengerStake, setChallengerStake] = useState(100);
  const [challengerWants, setChallengerWants] = useState(200);
  const [invitedUser, setInvitedUser] = useState<FollowUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdChallenge, setCreatedChallenge] = useState<Challenge | null>(null);
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const acceptorStake = Math.max(0, challengerWants - challengerStake);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const matches = await api.matches.upcoming(20, 14).catch(() => []);
      setUpcomingMatches(matches.filter((m) => m.status === "upcoming"));
      if (googleId) {
        const res = await api.challenges.byUser(googleId).catch(() => null);
        if (res) { setMyChallenges(res.challenges); setPendingCount(res.pending_count); }
      }
    } finally { setDataLoading(false); }
  }, [googleId]);

  const loadOpen = useCallback(async () => {
    setOpenLoading(true);
    try {
      setOpenChallenges(await api.challenges.open(googleId ?? undefined));
    } catch { setOpenChallenges([]); }
    finally { setOpenLoading(false); setOpenLoaded(true); }
  }, [googleId]);

  useEffect(() => { if (!loading) loadData(); }, [loading, loadData]);

  useEffect(() => {
    if (tab === "open" && !openLoaded && !openLoading) loadOpen();
  }, [tab, openLoaded, openLoading, loadOpen]);

  useEffect(() => {
    if (step === "invite" && googleId && !followingLoaded) {
      api.users.following(googleId)
        .then((l) => { setFollowing(l); setFollowingLoaded(true); })
        .catch(() => setFollowingLoaded(true));
    }
  }, [step, googleId, followingLoaded]);

  const handleCreate = async () => {
    if (!googleId || !selectedMatch || !selectedTeam) return;
    if (challengerStake <= 0 || challengerWants <= challengerStake) {
      setCreateError("Winning target must exceed your stake.");
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      const c = await api.challenges.create(
        googleId, selectedMatch.id, selectedTeam,
        challengerStake, challengerWants, invitedUser?.google_id,
      );
      setCreatedChallenge(c);
      setStep("share");
      window.dispatchEvent(new CustomEvent("cricrank-coin-toast", { detail: { amount: challengerStake, type: "debit" } }));
      window.dispatchEvent(new Event("cricrank-coins-refresh"));
      const res = await api.challenges.byUser(googleId).catch(() => null);
      if (res) { setMyChallenges(res.challenges); setPendingCount(res.pending_count); }
      setOpenChallenges([]);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create challenge.");
    } finally { setCreating(false); }
  };

  const shareUrl = createdChallenge
    ? `${typeof window !== "undefined" ? window.location.origin : "https://cricrank.com"}/challenge/${createdChallenge.share_token}`
    : "";

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !createdChallenge) return;
    const m = createdChallenge.match;
    const opp = teamShortCode(m.team1 === createdChallenge.challenger_team ? m.team2 : m.team1);
    const text = `I challenge you — ${teamShortCode(createdChallenge.challenger_team)} vs ${opp}. Stake ◈${createdChallenge.challenger_stake}, winner takes ◈${createdChallenge.challenger_wants}.`;
    navigator.share ? await navigator.share({ title: "CricRank Challenge", text, url: shareUrl }) : handleCopy();
  };

  const resetFlow = () => {
    setStep("match"); setSelectedMatch(null); setSelectedTeam("");
    setChallengerStake(100); setChallengerWants(200);
    setInvitedUser(null); setCreatedChallenge(null); setCreateError(null);
  };

  const STEPS: CreateStep[] = ["match", "team", "stakes", "invite"];

  const tabCls = (t: PageTab) =>
    `flex-1 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${
      tab === t ? "border-white text-white" : "border-transparent text-[#525252] hover:text-[#a3a3a3]"
    }`;

  const invitedChallenges = myChallenges.filter(c => c.invited_user?.google_id === googleId && c.status === "open");
  const myOtherChallenges = myChallenges.filter(c => !(c.invited_user?.google_id === googleId && c.status === "open"));
  const myActiveChallenges = myOtherChallenges.filter(c => !TERMINAL_STATUSES.includes(c.status));
  const myHistoryChallenges = myOtherChallenges.filter(c => TERMINAL_STATUSES.includes(c.status));

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!loading && !user) {
    return (
      <>
        <Header />
        <main className="px-4 py-16 text-center pb-20">
          <Handshake className="w-10 h-10 text-[#262626] mx-auto mb-3" />
          <p className="font-gaming text-xl text-white mb-1">Challenge a Friend</p>
          <p className="text-[#525252] text-sm mb-6">Sign in to create and accept challenges.</p>
          <button onClick={signInWithGoogle}
            className="px-6 py-2.5 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-[#e6e6e6] transition-colors">
            Sign In with Google
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pb-24">
        <div className="max-w-2xl mx-auto">

        {/* Pending banner */}
        {pendingCount > 0 && (
          <button onClick={() => setTab("mine")}
            className="w-full border-b border-[#f59e0b]/30 bg-[#f59e0b]/5 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#f59e0b] animate-pulse shrink-0" />
              <span className="text-[#f59e0b] font-black text-sm">
                {pendingCount} challenge{pendingCount !== 1 ? "s" : ""} waiting for you
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#f59e0b] shrink-0" />
          </button>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#1a1a1a] px-2">
          <button onClick={() => setTab("new")} className={tabCls("new")}>New</button>
          <button onClick={() => setTab("open")} className={tabCls("open")}>
            <span className="flex items-center justify-center gap-1.5"><Globe className="w-3.5 h-3.5" />Open</span>
          </button>
          <button onClick={() => setTab("mine")} className={tabCls("mine")}>
            Mine{myChallenges.length > 0 && <span className="ml-1.5 text-[10px] bg-[#1a1a1a] px-1.5 py-0.5 rounded-full">{myChallenges.length}</span>}
          </button>
        </div>

        {/* ══ NEW ════════════════════════════════════════════════ */}
        {tab === "new" && (
          <div className="px-4 pt-5">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-gaming text-lg text-white tracking-widest">New Challenge</span>
              {step !== "match" && step !== "share" && (
                <button onClick={resetFlow} className="flex items-center gap-1 text-[#525252] hover:text-white text-xs font-black uppercase tracking-widest transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />Reset
                </button>
              )}
            </div>

            {/* Step dots */}
            {step !== "share" && (
              <div className="flex gap-1 mb-4">
                {STEPS.map((s, i) => (
                  <div key={s} className={`flex-1 h-0.5 rounded-full transition-colors ${
                    step === s ? "bg-white" : STEPS.indexOf(step) > i ? "bg-[#444]" : "bg-[#1a1a1a]"
                  }`} />
                ))}
              </div>
            )}

            {/* ── STEP 1: Match ── */}
            {step === "match" && (
              <div>
                <p className="text-[#525252] text-xs font-black uppercase tracking-widest mb-3">Pick a match</p>
                {dataLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(n => <div key={n} className="h-16 bg-[#111] border border-[#1a1a1a] animate-pulse rounded" />)}
                  </div>
                ) : upcomingMatches.length === 0 ? (
                  <p className="text-[#525252] text-sm py-8 text-center">No upcoming matches.</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingMatches.map(m => {
                      const t1 = teamHex(m.team1), t2 = teamHex(m.team2);
                      return (
                        <button key={m.id}
                          onClick={() => { setSelectedMatch(m); setStep("team"); }}
                          className="w-full border border-[#1a1a1a] bg-[#0a0a0a] active:bg-[#111] p-3 flex items-center gap-3 text-left">
                          <div className="flex items-center gap-2 shrink-0">
                            <TeamCrest team={m.team1} size="sm" />
                            <span className="text-[10px] text-[#525252] font-black">vs</span>
                            <TeamCrest team={m.team2} size="sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm truncate">{teamShortCode(m.team1)} vs {teamShortCode(m.team2)}</p>
                            <p className="text-xs text-[#525252]">{formatRelativeDate(m.start_time)}</p>
                          </div>
                          <div className="w-1 h-9 shrink-0 rounded-full" style={{ background: `linear-gradient(to bottom, ${t1}, ${t2})` }} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Team ── */}
            {step === "team" && selectedMatch && (
              <div>
                <p className="text-[#525252] text-xs font-black uppercase tracking-widest mb-4">
                  {teamShortCode(selectedMatch.team1)} vs {teamShortCode(selectedMatch.team2)} · {formatRelativeDate(selectedMatch.start_time)}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[selectedMatch.team1, selectedMatch.team2].map(team => {
                    const hex = teamHex(team);
                    return (
                      <button key={team}
                        onClick={() => { setSelectedTeam(team); setStep("stakes"); }}
                        className="border p-4 flex flex-col items-center gap-3 active:scale-[0.98] transition-transform"
                        style={{ borderColor: hex + "55", background: hex + "0d" }}>
                        <TeamCrest team={team} size="md" />
                        <span className="font-black text-white text-sm text-center leading-tight">{team}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── STEP 3: Stakes ── */}
            {step === "stakes" && selectedMatch && selectedTeam && (
              <div>
                <p className="text-[#525252] text-xs font-black uppercase tracking-widest mb-4">
                  Backing <span className="text-white">{teamShortCode(selectedTeam)}</span>
                  <span className="text-[#333]"> · </span>
                  {teamShortCode(selectedMatch.team1)} vs {teamShortCode(selectedMatch.team2)}
                </p>

                {/* Stake rows */}
                {([
                  { label: "I put in", value: challengerStake, set: setChallengerStake, min: 10, presets: [50, 100, 250, 500] },
                  { label: "I want to win", value: challengerWants, set: setChallengerWants, min: challengerStake + 10,
                    presets: [1.5, 2, 3].map(x => Math.round(challengerStake * x / 10) * 10) },
                ] as const).map(({ label, value, set, min, presets }) => (
                  <div key={label} className="mb-4">
                    <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#1a1a1a] px-3 py-3">
                      <span className="text-[#525252] text-xs font-black uppercase tracking-widest">{label}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => set((v: number) => Math.max(min, v - 10))}
                          className="w-8 h-8 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white transition-colors">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center gap-1 w-24 justify-center">
                          <span className="text-[#f59e0b] text-base">◈</span>
                          <span className="font-gaming text-2xl font-black text-white tabular-nums">{value}</span>
                        </div>
                        <button onClick={() => set((v: number) => v + 10)}
                          className="w-8 h-8 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      {presets.map(v => (
                        <button key={v} onClick={() => set(v as number)}
                          className={`flex-1 text-xs font-black py-1.5 border transition-colors ${
                            value === v ? "border-white text-white bg-[#111]" : "border-[#1a1a1a] text-[#525252] hover:text-white"
                          }`}>◈{v}</button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Summary */}
                <div className="flex items-center justify-between border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-[#525252] uppercase tracking-widest mb-1">You stake</p>
                    <p className="text-base font-black text-white">◈{challengerStake}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-[#525252] uppercase tracking-widest mb-1">They stake</p>
                    <p className="text-base font-black text-white">◈{acceptorStake}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-[#525252] uppercase tracking-widest mb-1">Winner gets</p>
                    <p className="text-lg font-black text-[#f59e0b]">◈{challengerWants}</p>
                  </div>
                </div>

                <button onClick={() => setStep("invite")} disabled={acceptorStake <= 0}
                  className="w-full py-3 bg-white text-black font-black uppercase tracking-widest text-sm hover:bg-[#e6e6e6] disabled:opacity-40 transition-colors">
                  Next: Invite a Friend
                </button>
              </div>
            )}

            {/* ── STEP 4: Invite ── */}
            {step === "invite" && (
              <div>
                <p className="text-[#525252] text-xs font-black uppercase tracking-widest mb-4">
                  Invite a follower <span className="text-[#333] normal-case font-normal tracking-normal">— optional</span>
                </p>

                {invitedUser && (
                  <div className="flex items-center justify-between border border-[#10b981]/40 bg-[#10b981]/5 px-3 py-2 mb-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-[#10b981]" />
                      <div>
                        <p className="text-white font-bold text-xs">{invitedUser.name}</p>
                        <p className="text-[9px] text-[#525252]">@{invitedUser.username}</p>
                      </div>
                    </div>
                    <button onClick={() => setInvitedUser(null)}
                      className="text-[9px] font-black text-[#525252] hover:text-[#ef4444] uppercase tracking-widest transition-colors">
                      Remove
                    </button>
                  </div>
                )}

                {!followingLoaded ? (
                  <div className="space-y-1.5 mb-3">
                    {[1, 2, 3].map(n => <div key={n} className="h-11 bg-[#111] border border-[#1a1a1a] animate-pulse" />)}
                  </div>
                ) : following.length === 0 ? (
                  <p className="text-[#525252] text-xs py-4 text-center mb-3">Not following anyone yet.</p>
                ) : (
                  <div className="space-y-1 mb-3 max-h-52 overflow-y-auto">
                    {following.map(f => {
                      const selected = invitedUser?.google_id === f.google_id;
                      return (
                        <button key={f.google_id} onClick={() => setInvitedUser(selected ? null : f)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 border transition-all ${
                            selected ? "border-[#10b981]/50 bg-[#10b981]/5" : "border-[#1a1a1a] bg-[#0a0a0a] hover:bg-[#111]"
                          }`}>
                          {f.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={f.avatar_url} alt={f.name} width={28} height={28} referrerPolicy="no-referrer"
                              className="rounded-full shrink-0 opacity-80" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xs font-bold text-white shrink-0">
                              {f.name[0].toUpperCase()}
                            </div>
                          )}
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-white font-bold text-xs truncate">{f.name}</p>
                            <p className="text-[9px] text-[#525252]">@{f.username} · {f.streak_tier}</p>
                          </div>
                          {selected && <UserCheck className="w-3.5 h-3.5 text-[#10b981] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {createError && <p className="text-[#ef4444] text-xs font-bold mb-2">{createError}</p>}

                <div className="flex gap-2">
                  <button onClick={() => { setInvitedUser(null); handleCreate(); }} disabled={creating}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 border border-[#262626] text-[#525252] hover:text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 transition-colors">
                    <SkipForward className="w-3.5 h-3.5" />Skip
                  </button>
                  <button onClick={handleCreate} disabled={creating}
                    className="flex-1 py-3 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-[#e6e6e6] disabled:opacity-40 transition-colors">
                    {creating ? "Creating..." : invitedUser ? `Send to ${invitedUser.name.split(" ")[0]}` : "Create"}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 5: Share ── */}
            {step === "share" && createdChallenge && (
              <div>
                <div className="border border-[#10b981]/40 bg-[#10b981]/5 px-3 py-2.5 mb-3">
                  <p className="text-[#10b981] font-black text-xs mb-0.5">
                    {createdChallenge.invited_user
                      ? `Sent to ${createdChallenge.invited_user.name.split(" ")[0]}!`
                      : "Challenge live!"}
                  </p>
                  <p className="text-[#525252] text-[10px]">
                    {createdChallenge.invited_user
                      ? "They'll see a notification. Share the link too."
                      : "Visible in Open Challenges. Share the link to get faster responses."}
                  </p>
                </div>

                <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2.5 mb-2">
                  <p className="text-[9px] text-[#525252] uppercase tracking-widest font-bold mb-1.5">Share Link</p>
                  <p className="text-white text-[10px] font-mono break-all mb-2.5 leading-relaxed">{shareUrl}</p>
                  <div className="flex gap-2">
                    <button onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 border border-[#262626] hover:bg-[#1a1a1a] text-xs font-black uppercase tracking-widest text-[#a3a3a3] hover:text-white transition-colors">
                      {copied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={handleNativeShare}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 border border-[#262626] hover:bg-[#1a1a1a] text-xs font-black uppercase tracking-widest text-[#a3a3a3] hover:text-white transition-colors">
                      <Share2 className="w-3.5 h-3.5" />Share
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => { resetFlow(); setTab("open"); loadOpen(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#262626] hover:bg-[#1a1a1a] text-xs font-black uppercase tracking-widest text-[#525252] hover:text-white transition-colors">
                    <Globe className="w-3.5 h-3.5" />View Open
                  </button>
                  <button onClick={resetFlow}
                    className="flex-1 py-2.5 border border-[#1a1a1a] hover:border-[#333] text-xs font-black uppercase tracking-widest text-[#525252] hover:text-white transition-colors">
                    Create Another
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ OPEN ══════════════════════════════════════════════ */}
        {tab === "open" && (
          <div className="px-4 pt-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-gaming text-lg text-white tracking-widest">Open Challenges</span>
              <button onClick={() => { setOpenLoaded(false); loadOpen(); }} disabled={openLoading}
                className="flex items-center gap-1.5 text-[#525252] hover:text-white text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${openLoading ? "animate-spin" : ""}`} />Refresh
              </button>
            </div>

            {openLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(n => <div key={n} className="h-36 bg-[#111] border border-[#1a1a1a] animate-pulse" />)}
              </div>
            ) : openChallenges.length === 0 ? (
              <div className="py-14 text-center">
                <Globe className="w-9 h-9 text-[#262626] mx-auto mb-2.5" />
                <p className="text-white font-bold text-sm mb-1">No open challenges</p>
                <p className="text-[#525252] text-xs mb-5">Create one and it appears here for anyone to accept.</p>
                <button onClick={() => setTab("new")}
                  className="px-5 py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-[#e6e6e6] transition-colors">
                  Create Challenge
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {openChallenges.map(c => (
                  <Link key={c.id} href={`/challenge/${c.share_token}`}>
                    <ChallengeCard challenge={c} viewerGoogleId={googleId ?? undefined} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ MINE ══════════════════════════════════════════════ */}
        {tab === "mine" && (
          <div className="px-4 pt-5">
            {invitedChallenges.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Bell className="w-3.5 h-3.5 text-[#f59e0b]" />
                  <span className="font-gaming text-sm text-[#f59e0b] tracking-widest uppercase">You&apos;ve been challenged</span>
                </div>
                <div className="space-y-2">
                  {invitedChallenges.map(c => (
                    <Link key={c.id} href={`/challenge/${c.share_token}`}>
                      <ChallengeCard challenge={c} viewerGoogleId={googleId ?? undefined} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {myOtherChallenges.length > 0 ? (
              <div className="flex flex-col gap-5">
                {/* Active challenges — full cards */}
                {myActiveChallenges.length > 0 && (
                  <div>
                    <p className="font-gaming text-base text-white tracking-widest mb-2">Active</p>
                    <div className="space-y-2">
                      {myActiveChallenges.map(c => (
                        <Link key={c.id} href={`/challenge/${c.share_token}`}>
                          <ChallengeCard challenge={c} viewerGoogleId={googleId ?? undefined} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* History — compact ledger rows */}
                {myHistoryChallenges.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-gaming text-sm text-[#525252] tracking-widest uppercase">History</p>
                      <div className="h-px flex-1 bg-[#1a1a1a]" />
                    </div>
                    <div className="space-y-px">
                      {myHistoryChallenges.slice(0, visibleCount).map(c => (
                        <Link key={c.id} href={`/challenge/${c.share_token}`}>
                          <ChallengeCard challenge={c} viewerGoogleId={googleId ?? undefined} compact />
                        </Link>
                      ))}
                    </div>
                    {myHistoryChallenges.length > visibleCount && (
                      <button
                        onClick={() => setVisibleCount(v => v + 10)}
                        className="w-full mt-2 py-2 border border-[#1a1a1a] text-[#525252] hover:text-white hover:border-[#333] text-xs font-black uppercase tracking-widest transition-colors"
                      >
                        Show {Math.min(10, myHistoryChallenges.length - visibleCount)} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : invitedChallenges.length === 0 && (
              <div className="py-14 text-center">
                <Handshake className="w-9 h-9 text-[#262626] mx-auto mb-2.5" />
                <p className="text-white font-bold text-sm mb-1">No challenges yet</p>
                <p className="text-[#525252] text-xs mb-5">Create one or pick up an open challenge.</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setTab("new")}
                    className="px-4 py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-[#e6e6e6] transition-colors">
                    Create
                  </button>
                  <button onClick={() => setTab("open")}
                    className="px-4 py-2 border border-[#262626] text-[#a3a3a3] font-black text-[10px] uppercase tracking-widest hover:text-white hover:border-[#333] transition-colors">
                    Browse Open
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </div>{/* max-w-2xl */}
      </main>
    </>
  );
}
