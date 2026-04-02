"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import TeamCrest from "@/components/TeamCrest";
import ChallengeCard from "@/components/ChallengeCard";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api";
import { Match, Challenge, FollowUser } from "@/types";
import { teamHex, teamShortCode, formatRelativeDate } from "@/lib/utils";
import {
  Handshake, ChevronRight, Minus, Plus, Share2, Copy,
  Check, ArrowLeft, UserCheck, SkipForward, Bell,
} from "lucide-react";

type CreateStep = "match" | "team" | "stakes" | "invite" | "share";

export default function ChallengePage() {
  const { user, loading, signInWithGoogle } = useUser();
  const googleId = user?.id ?? null;

  // Data
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  // Following list for invite step
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followingLoaded, setFollowingLoaded] = useState(false);

  // Create flow
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

  const acceptorStake = Math.max(0, challengerWants - challengerStake);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const matches = await api.matches.upcoming(20, 14).catch(() => []);
      setUpcomingMatches(matches.filter((m) => m.status === "upcoming"));

      if (googleId) {
        const res = await api.challenges.byUser(googleId).catch(() => null);
        if (res) {
          setMyChallenges(res.challenges);
          setPendingCount(res.pending_count);
        }
      }
    } finally {
      setDataLoading(false);
    }
  }, [googleId]);

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, loadData]);

  // Load following list when reaching invite step
  useEffect(() => {
    if (step === "invite" && googleId && !followingLoaded) {
      api.users.following(googleId)
        .then((list) => { setFollowing(list); setFollowingLoaded(true); })
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
        googleId,
        selectedMatch.id,
        selectedTeam,
        challengerStake,
        challengerWants,
        invitedUser?.google_id,
      );
      setCreatedChallenge(c);
      setStep("share");
      window.dispatchEvent(
        new CustomEvent("cricrank-coin-toast", { detail: { amount: challengerStake, type: "debit" } })
      );
      window.dispatchEvent(new Event("cricrank-coins-refresh"));
      const res = await api.challenges.byUser(googleId).catch(() => null);
      if (res) { setMyChallenges(res.challenges); setPendingCount(res.pending_count); }
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create challenge.");
    } finally {
      setCreating(false);
    }
  };

  const shareUrl = createdChallenge
    ? `${typeof window !== "undefined" ? window.location.origin : "https://cricrank.com"}/challenge/${createdChallenge.share_token}`
    : "";

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !createdChallenge) return;
    const match = createdChallenge.match;
    const inviteName = createdChallenge.invited_user?.name ?? null;
    const text = `${inviteName ? `Hey ${inviteName.split(" ")[0]}, ` : ""}I challenge you to a ${teamShortCode(createdChallenge.challenger_team)} vs ${teamShortCode(match.team1 === createdChallenge.challenger_team ? match.team2 : match.team1)} bet! I stake ◈${createdChallenge.challenger_stake}, winner takes ◈${createdChallenge.challenger_wants}.`;
    if (navigator.share) {
      await navigator.share({ title: "CricRank Challenge", text, url: shareUrl });
    } else {
      handleCopy();
    }
  };

  const resetFlow = () => {
    setStep("match");
    setSelectedMatch(null);
    setSelectedTeam("");
    setChallengerStake(100);
    setChallengerWants(200);
    setInvitedUser(null);
    setCreatedChallenge(null);
    setCreateError(null);
  };

  const STEPS: CreateStep[] = ["match", "team", "stakes", "invite"];
  const stepIndex = (s: CreateStep) => STEPS.indexOf(s);

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!loading && !user) {
    return (
      <>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center pb-20">
          <Handshake className="w-12 h-12 text-[#262626] mx-auto mb-4" />
          <p className="font-gaming text-2xl text-white mb-2">Challenge a Friend</p>
          <p className="text-[#525252] text-sm mb-8">Sign in to create and accept challenges.</p>
          <button
            onClick={signInWithGoogle}
            className="px-6 py-3 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-[#e6e6e6] transition-colors"
          >
            Sign In with Google
          </button>
        </main>
      </>
    );
  }

  // Separate invited challenges from self-created
  const invitedChallenges = myChallenges.filter(
    (c) => c.invited_user?.google_id === googleId && c.status === "open"
  );
  const myOtherChallenges = myChallenges.filter(
    (c) => !(c.invited_user?.google_id === googleId && c.status === "open")
  );

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* ── Pending notification banner ─────────────────────── */}
        {pendingCount > 0 && (
          <div className="border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-4 py-3 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#f59e0b] animate-pulse" />
              <span className="text-[#f59e0b] font-black text-sm">
                {pendingCount} challenge{pendingCount !== 1 ? "s" : ""} waiting for you
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#f59e0b]" />
          </div>
        )}

        {/* ── Invited challenges section ───────────────────────── */}
        {invitedChallenges.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-[#f59e0b]" />
              <h2 className="font-gaming text-base text-[#f59e0b] tracking-widest uppercase">You&apos;ve been challenged</h2>
            </div>
            <div className="space-y-3">
              {invitedChallenges.map((c) => (
                <Link key={c.id} href={`/challenge/${c.share_token}`}>
                  <ChallengeCard challenge={c} viewerGoogleId={googleId ?? undefined} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Create flow ─────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-gaming text-xl text-white tracking-widest">New Challenge</h2>
            {step !== "match" && step !== "share" && (
              <button onClick={resetFlow} className="flex items-center gap-1 text-[#525252] hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          {/* Step indicator */}
          {step !== "share" && (
            <div className="flex gap-1.5 mb-5">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`flex-1 h-1 transition-colors ${
                    step === s ? "bg-white" :
                    stepIndex(step) > i ? "bg-[#525252]" : "bg-[#1a1a1a]"
                  }`}
                />
              ))}
            </div>
          )}

          {/* STEP 1: Pick match */}
          {step === "match" && (
            <div>
              <p className="text-[#525252] text-xs font-bold uppercase tracking-widest mb-3">Pick a match</p>
              {dataLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((n) => <div key={n} className="h-16 bg-[#111111] border border-[#1a1a1a] animate-pulse" />)}
                </div>
              ) : upcomingMatches.length === 0 ? (
                <p className="text-[#525252] text-sm py-8 text-center">No upcoming matches available.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingMatches.map((m) => {
                    const t1 = teamHex(m.team1);
                    const t2 = teamHex(m.team2);
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedMatch(m); setStep("team"); }}
                        className="w-full border border-[#1a1a1a] bg-[#0a0a0a] hover:bg-[#111111] hover:border-[#333] transition-all p-3 flex items-center gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <TeamCrest team={m.team1} size="sm" />
                          <span className="text-[10px] text-[#525252] font-black">vs</span>
                          <TeamCrest team={m.team2} size="sm" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">
                            {teamShortCode(m.team1)} vs {teamShortCode(m.team2)}
                          </p>
                          <p className="text-[10px] text-[#525252]">{formatRelativeDate(m.start_time)}</p>
                        </div>
                        <div className="w-1.5 h-10 shrink-0" style={{ background: `linear-gradient(to bottom, ${t1}, ${t2})` }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Pick team */}
          {step === "team" && selectedMatch && (
            <div>
              <p className="text-[#525252] text-xs font-bold uppercase tracking-widest mb-1">
                {teamShortCode(selectedMatch.team1)} vs {teamShortCode(selectedMatch.team2)} · {formatRelativeDate(selectedMatch.start_time)}
              </p>
              <p className="text-[#525252] text-xs font-bold uppercase tracking-widest mb-4">Which team are you backing?</p>
              <div className="grid grid-cols-2 gap-3">
                {[selectedMatch.team1, selectedMatch.team2].map((team) => {
                  const hex = teamHex(team);
                  return (
                    <button
                      key={team}
                      onClick={() => { setSelectedTeam(team); setStep("stakes"); }}
                      className="border-2 p-4 flex flex-col items-center gap-3 transition-all hover:scale-[1.02]"
                      style={{ borderColor: hex + "66", background: hex + "0d" }}
                    >
                      <TeamCrest team={team} size="lg" />
                      <span className="font-black text-white text-sm">{team}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Set stakes */}
          {step === "stakes" && selectedMatch && selectedTeam && (
            <div>
              <p className="text-[#525252] text-xs font-bold uppercase tracking-widest mb-1">
                Backing <span className="text-white">{teamShortCode(selectedTeam)}</span> · {teamShortCode(selectedMatch.team1)} vs {teamShortCode(selectedMatch.team2)}
              </p>
              <p className="text-[#525252] text-xs font-bold uppercase tracking-widest mb-5">Set your stakes</p>

              <div className="mb-4">
                <p className="text-[10px] text-[#525252] uppercase tracking-widest font-bold mb-2">I put in</p>
                <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1a1a1a] p-3">
                  <button onClick={() => setChallengerStake((v) => Math.max(10, v - 10))}
                    className="w-8 h-8 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white transition-colors">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-1.5">
                    <span className="text-[#f59e0b] text-xl">◈</span>
                    <span className="font-gaming text-3xl font-black text-white tabular-nums">{challengerStake}</span>
                  </div>
                  <button onClick={() => setChallengerStake((v) => v + 10)}
                    className="w-8 h-8 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-1 mt-1.5">
                  {[50, 100, 250, 500].map((v) => (
                    <button key={v} onClick={() => setChallengerStake(v)}
                      className={`flex-1 text-[10px] font-black py-1 border transition-colors ${
                        challengerStake === v ? "border-white text-white bg-[#111]" : "border-[#1a1a1a] text-[#525252] hover:text-white hover:border-[#333]"
                      }`}>◈{v}</button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-[10px] text-[#525252] uppercase tracking-widest font-bold mb-2">I want to win</p>
                <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1a1a1a] p-3">
                  <button onClick={() => setChallengerWants((v) => Math.max(challengerStake + 10, v - 10))}
                    className="w-8 h-8 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white transition-colors">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-1.5">
                    <span className="text-[#f59e0b] text-xl">◈</span>
                    <span className="font-gaming text-3xl font-black text-white tabular-nums">{challengerWants}</span>
                  </div>
                  <button onClick={() => setChallengerWants((v) => v + 10)}
                    className="w-8 h-8 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-1 mt-1.5">
                  {[challengerStake * 1.5, challengerStake * 2, challengerStake * 3].map((v) => {
                    const rounded = Math.round(v / 10) * 10;
                    return (
                      <button key={rounded} onClick={() => setChallengerWants(rounded)}
                        className={`flex-1 text-[10px] font-black py-1 border transition-colors ${
                          challengerWants === rounded ? "border-white text-white bg-[#111]" : "border-[#1a1a1a] text-[#525252] hover:text-white hover:border-[#333]"
                        }`}>◈{rounded}</button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 mb-4">
                <p className="text-[10px] text-[#525252] uppercase tracking-widest font-bold mb-2">Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-[#a3a3a3]">Your stake</span>
                  <span className="font-bold text-white">◈{challengerStake}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#a3a3a3]">Opponent must stake</span>
                  <span className="font-bold text-white">◈{acceptorStake}</span>
                </div>
                <div className="border-t border-[#1a1a1a] mt-2 pt-2 flex justify-between text-sm">
                  <span className="text-[#a3a3a3]">Winner takes</span>
                  <span className="font-black text-[#f59e0b]">◈{challengerWants}</span>
                </div>
              </div>

              <button
                onClick={() => setStep("invite")}
                disabled={acceptorStake <= 0}
                className="w-full py-3 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-[#e6e6e6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next: Invite a Friend
              </button>
            </div>
          )}

          {/* STEP 4: Invite a follower */}
          {step === "invite" && (
            <div>
              <p className="text-[#525252] text-xs font-bold uppercase tracking-widest mb-1">Optional</p>
              <p className="text-[#525252] text-xs font-bold uppercase tracking-widest mb-4">Invite a follower to this challenge</p>

              {/* Selected invite */}
              {invitedUser && (
                <div className="flex items-center justify-between border border-[#10b981]/40 bg-[#10b981]/5 px-3 py-2.5 mb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#10b981]" />
                    <div>
                      <p className="text-white font-bold text-sm">{invitedUser.name}</p>
                      <p className="text-[10px] text-[#525252]">@{invitedUser.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setInvitedUser(null)}
                    className="text-[10px] font-black text-[#525252] hover:text-[#ef4444] uppercase tracking-widest transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Following list */}
              {!followingLoaded ? (
                <div className="space-y-2 mb-4">
                  {[1, 2, 3].map((n) => <div key={n} className="h-12 bg-[#111111] border border-[#1a1a1a] animate-pulse" />)}
                </div>
              ) : following.length === 0 ? (
                <p className="text-[#525252] text-xs py-4 text-center mb-4">You&apos;re not following anyone yet.</p>
              ) : (
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {following.map((f) => {
                    const selected = invitedUser?.google_id === f.google_id;
                    return (
                      <button
                        key={f.google_id}
                        onClick={() => setInvitedUser(selected ? null : f)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border transition-all ${
                          selected
                            ? "border-[#10b981]/60 bg-[#10b981]/5"
                            : "border-[#1a1a1a] bg-[#0a0a0a] hover:bg-[#111111] hover:border-[#333]"
                        }`}
                      >
                        {f.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={f.avatar_url} alt={f.name} width={32} height={32}
                            referrerPolicy="no-referrer" className="rounded-full shrink-0 opacity-80" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {f.name[0].toUpperCase()}
                          </div>
                        )}
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{f.name}</p>
                          <p className="text-[10px] text-[#525252]">@{f.username} · {f.streak_tier}</p>
                        </div>
                        {selected && <UserCheck className="w-4 h-4 text-[#10b981] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {createError && (
                <p className="text-[#ef4444] text-xs font-bold mb-3">{createError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setInvitedUser(null); handleCreate(); }}
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#262626] text-[#525252] hover:text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2.5 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-[#e6e6e6] disabled:opacity-40 transition-colors"
                >
                  {creating ? "Creating..." : invitedUser ? `Invite ${invitedUser.name.split(" ")[0]}` : "Create"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Share */}
          {step === "share" && createdChallenge && (
            <div>
              <div className="border border-[#10b981]/40 bg-[#10b981]/5 p-4 mb-4">
                <p className="text-[#10b981] font-black text-sm mb-1">
                  {createdChallenge.invited_user
                    ? `Challenge sent to ${createdChallenge.invited_user.name.split(" ")[0]}!`
                    : "Challenge created!"}
                </p>
                <p className="text-[#a3a3a3] text-xs">
                  {createdChallenge.invited_user
                    ? "They'll see a notification on their Challenge page. Share the link too."
                    : "Share the link — anyone who opens it can accept."}
                </p>
              </div>

              <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 mb-3">
                <p className="text-[10px] text-[#525252] uppercase tracking-widest font-bold mb-1.5">Share Link</p>
                <p className="text-white text-xs font-mono break-all mb-3">{shareUrl}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#262626] hover:bg-[#1a1a1a] text-xs font-black uppercase tracking-widest text-[#a3a3a3] hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={handleNativeShare}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#262626] hover:bg-[#1a1a1a] text-xs font-black uppercase tracking-widest text-[#a3a3a3] hover:text-white transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                </div>
              </div>

              <button
                onClick={resetFlow}
                className="w-full py-2.5 border border-[#1a1a1a] hover:border-[#333] text-xs font-black uppercase tracking-widest text-[#525252] hover:text-white transition-colors"
              >
                Create Another
              </button>
            </div>
          )}
        </div>

        {/* ── My challenges ───────────────────────────────────── */}
        {googleId && myOtherChallenges.length > 0 && (
          <div>
            <h2 className="font-gaming text-xl text-white tracking-widest mb-4">My Challenges</h2>
            <div className="space-y-3">
              {myOtherChallenges.map((c) => (
                <Link key={c.id} href={`/challenge/${c.share_token}`}>
                  <ChallengeCard challenge={c} viewerGoogleId={googleId} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
