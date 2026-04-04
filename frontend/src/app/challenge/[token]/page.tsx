"use client";

import { useEffect, useState, use } from "react";
import TeamCrest from "@/components/TeamCrest";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api";
import { Challenge } from "@/types";
import { teamHex, teamShortCode, formatRelativeDate } from "@/lib/utils";
import {
  Handshake, CheckCircle, XCircle, RefreshCw, Trophy,
  Minus, Plus, Copy, Check, Share2, ArrowLeft, Bell,
} from "lucide-react";
import Link from "next/link";

export default function ChallengeTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading, signInWithGoogle } = useUser();
  const googleId = user?.id ?? null;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  // Counter flow
  const [showCounter, setShowCounter] = useState(false);
  const [counterStake, setCounterStake] = useState(100);
  const [counterWants, setCounterWants] = useState(200);

  // Copy state
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/challenge/${token}`
    : `https://cricrank.com/challenge/${token}`;

  useEffect(() => {
    async function load() {
      setFetching(true);
      try {
        const c = await api.challenges.byToken(token);
        setChallenge(c);
        setCounterStake(c.challenger_stake);
        setCounterWants(c.challenger_wants);
      } catch {
        setError("Challenge not found or has expired.");
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [token]);

  const fireToasts = (amount: number, type: "credit" | "debit") => {
    window.dispatchEvent(
      new CustomEvent("cricrank-coin-toast", { detail: { amount, type } })
    );
    window.dispatchEvent(new Event("cricrank-coins-refresh"));
  };

  const handleAccept = async () => {
    if (!googleId || !challenge) return;
    setActing(true);
    setActionError(null);
    try {
      const updated = await api.challenges.accept(challenge.id, googleId);
      setChallenge(updated);
      fireToasts(updated.acceptor_stake, "debit");
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to accept.");
    } finally {
      setActing(false);
    }
  };

  const handleCounter = async () => {
    if (!googleId || !challenge) return;
    if (counterStake <= 0 || counterWants <= counterStake) {
      setActionError("Winning target must exceed your stake.");
      return;
    }
    setActing(true);
    setActionError(null);
    try {
      const updated = await api.challenges.counter(challenge.id, googleId, counterStake, counterWants);
      setChallenge(updated);
      setShowCounter(false);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to submit counter.");
    } finally {
      setActing(false);
    }
  };

  const handleAcceptCounter = async () => {
    if (!googleId || !challenge) return;
    setActing(true);
    setActionError(null);
    try {
      const updated = await api.challenges.acceptCounter(challenge.id, googleId);
      setChallenge(updated);
      const newStake = updated.challenger_stake;
      // Challenger stake may have changed; fire debit/credit accordingly
      fireToasts(newStake, "debit");
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to accept counter.");
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!googleId || !challenge) return;
    setActing(true);
    setActionError(null);
    try {
      const updated = await api.challenges.decline(challenge.id, googleId);
      setChallenge(updated);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to decline.");
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!googleId || !challenge) return;
    setActing(true);
    setActionError(null);
    try {
      const updated = await api.challenges.cancel(challenge.id, googleId);
      setChallenge(updated);
      fireToasts(updated.challenger_stake, "credit");
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to cancel.");
    } finally {
      setActing(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleNativeShare = async () => {
    if (challenge) {
      const match = challenge.match;
      const text = `I challenge you to a ${teamShortCode(challenge.challenger_team)} vs ${teamShortCode(match.team1 === challenge.challenger_team ? match.team2 : match.team1)} bet! Stake ◈${challenge.challenger_stake}, winner takes ◈${challenge.challenger_wants}.`;
      if (navigator.share) {
        await navigator.share({ title: "CricRank Challenge", text, url: shareUrl });
        return;
      }
    }
    handleCopy();
  };

  // ── Loading states ─────────────────────────────────────────────────────────
  if (fetching || loading) {
    return (
      <>
        <main className="max-w-lg mx-auto px-4 py-16 pb-24">
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-[#111111] border border-[#1a1a1a] animate-pulse" />
            ))}
          </div>
        </main>
      </>
    );
  }

  if (error || !challenge) {
    return (
      <>
        <main className="max-w-lg mx-auto px-4 py-16 text-center pb-24">
          <XCircle className="w-12 h-12 text-[#ef4444] mx-auto mb-4" />
          <p className="font-gaming text-xl text-white mb-2">{error ?? "Challenge not found"}</p>
          <Link href="/challenge" className="text-[#525252] hover:text-white text-sm transition-colors">
            Back to Challenges
          </Link>
        </main>
      </>
    );
  }

  const match = challenge.match;
  const t1hex = teamHex(match.team1);
  const t2hex = teamHex(match.team2);
  const challengerHex = teamHex(challenge.challenger_team);
  const opponentTeam = match.team1 === challenge.challenger_team ? match.team2 : match.team1;
  const opponentHex = teamHex(opponentTeam);

  const isChallenger = googleId === challenge.challenger.google_id;
  const isAcceptor = challenge.acceptor && googleId === challenge.acceptor.google_id;
  const isInvited = challenge.invited_user && googleId === challenge.invited_user.google_id;

  const counterAcceptorStake = Math.max(0, counterWants - counterStake);

  const STATUS_COLORS: Record<string, string> = {
    open: "text-[#f59e0b]",
    accepted: "text-[#10b981]",
    counter_offered: "text-[#8b5cf6]",
    declined: "text-[#ef4444]",
    expired: "text-[#525252]",
    cancelled: "text-[#525252]",
    settled: "text-[#10b981]",
  };

  return (
    <>
      <main className="max-w-lg mx-auto px-4 py-6 pb-24">

        {/* Back + title */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/challenge" className="text-[#525252] hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="font-gaming text-xl text-white tracking-widest">Challenge</p>
            <p className={`text-xs font-black uppercase tracking-widest ${STATUS_COLORS[challenge.status] ?? "text-[#525252]"}`}>
              {challenge.status.replace("_", " ")}
            </p>
          </div>
        </div>

        {/* Invited notification banner */}
        {isInvited && challenge.status === "open" && (
          <div className="border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-4 py-3 mb-5 flex items-center gap-3">
            <Bell className="w-4 h-4 text-[#f59e0b] shrink-0 animate-pulse" />
            <div>
              <p className="text-[#f59e0b] font-black text-sm leading-tight">
                {challenge.challenger.name.split(" ")[0]} challenged you!
              </p>
              <p className="text-[#a3a3a3] text-xs">Accept, counter, or decline below.</p>
            </div>
          </div>
        )}

        {/* Match header */}
        <div
          className="h-[3px] w-full mb-4"
          style={{ background: `linear-gradient(to right, ${t1hex}, ${t2hex})` }}
        />
        <div className="flex items-center gap-3 mb-6">
          <TeamCrest team={match.team1} size="md" />
          <div className="flex-1 text-center">
            <p className="text-white font-black">{teamShortCode(match.team1)} vs {teamShortCode(match.team2)}</p>
            <p className="text-[10px] text-[#525252]">{formatRelativeDate(match.start_time)}</p>
          </div>
          <TeamCrest team={match.team2} size="md" />
        </div>

        {/* Stakes card */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            {/* Challenger */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-black text-white"
                style={{ background: challengerHex }}
              >
                {teamShortCode(challenge.challenger_team)}
              </div>
              <p className="text-white font-bold text-sm text-center">{challenge.challenger.name.split(" ")[0]}</p>
              <p className="text-[10px] text-[#525252]">backs {teamShortCode(challenge.challenger_team)}</p>
              <div className="flex items-center gap-1">
                <span className="text-[#f59e0b]">◈</span>
                <span className="text-xl font-black text-white">{challenge.challenger_stake}</span>
              </div>
            </div>

            {/* Center */}
            <div className="flex flex-col items-center gap-1 px-4">
              <Handshake className="w-6 h-6 text-[#262626]" />
              <p className="text-[9px] text-[#525252] uppercase tracking-widest">pot</p>
              <div className="flex items-center gap-1">
                <span className="text-[#f59e0b]">◈</span>
                <span className="text-2xl font-black text-white">{challenge.challenger_wants}</span>
              </div>
            </div>

            {/* Acceptor */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-black border"
                style={{
                  background: challenge.acceptor ? opponentHex : "transparent",
                  borderColor: challenge.acceptor ? opponentHex : "#262626",
                  color: challenge.acceptor ? "white" : "#525252",
                }}
              >
                {challenge.acceptor ? teamShortCode(opponentTeam) : "?"}
              </div>
              <p className="text-white font-bold text-sm text-center">
                {challenge.acceptor ? challenge.acceptor.name.split(" ")[0] : "Open"}
              </p>
              <p className="text-[10px] text-[#525252]">backs {teamShortCode(opponentTeam)}</p>
              <div className="flex items-center gap-1">
                <span className="text-[#f59e0b]">◈</span>
                <span className="text-xl font-black text-white">{challenge.acceptor_stake}</span>
              </div>
            </div>
          </div>

          {/* Settled winner */}
          {challenge.status === "settled" && (
            <div className="border-t border-[#1a1a1a] pt-3 flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4 text-[#f59e0b]" />
              <span className="text-[#f59e0b] font-black text-sm">
                {challenge.challenger_team === match.winner
                  ? challenge.challenger.name.split(" ")[0]
                  : (challenge.acceptor?.name.split(" ")[0] ?? "Opponent")} won ◈{challenge.challenger_wants}
              </span>
            </div>
          )}
        </div>

        {/* Counter offer block (challenger sees it) */}
        {challenge.status === "counter_offered" &&
          challenge.counter_challenger_stake != null &&
          challenge.counter_challenger_wants != null && (
          <div className="border border-[#3b1f6e] bg-[#1a0a2e] p-4 mb-6">
            <p className="text-[#8b5cf6] font-black text-sm mb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Counter Offer from {challenge.acceptor?.name.split(" ")[0]}
            </p>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-[#a3a3a3]">Your stake becomes</span>
                <span className="font-bold text-white">◈{challenge.counter_challenger_stake}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a3a3a3]">Opponent stakes</span>
                <span className="font-bold text-white">◈{challenge.counter_challenger_wants - challenge.counter_challenger_stake}</span>
              </div>
              <div className="flex justify-between border-t border-[#2d1854] pt-1.5">
                <span className="text-[#a3a3a3]">Winner takes</span>
                <span className="font-black text-[#f59e0b]">◈{challenge.counter_challenger_wants}</span>
              </div>
            </div>
            {isChallenger && (
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptCounter}
                  disabled={acting}
                  className="flex-1 py-2.5 bg-[#8b5cf6] text-white font-black text-xs uppercase tracking-widest hover:bg-[#7c3aed] disabled:opacity-40 transition-colors"
                >
                  {acting ? "..." : "Accept Counter"}
                </button>
                <button
                  onClick={handleDecline}
                  disabled={acting}
                  className="flex-1 py-2.5 border border-[#3b1f6e] text-[#8b5cf6] font-black text-xs uppercase tracking-widest hover:bg-[#1a0a2e] disabled:opacity-40 transition-colors"
                >
                  {acting ? "..." : "Decline"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action error */}
        {actionError && (
          <p className="text-[#ef4444] text-xs font-bold mb-4 border border-[#ef4444]/30 bg-[#ef4444]/5 p-3">
            {actionError}
          </p>
        )}

        {/* Actions for non-involved viewers (open challenge) */}
        {!loading && !user && challenge.status === "open" && (
          <div className="border border-[#262626] p-4 mb-4">
            <p className="text-[#a3a3a3] text-sm mb-3">Sign in to accept this challenge.</p>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("challenge-redirect", window.location.pathname);
                }
                signInWithGoogle();
              }}
              className="w-full py-3 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-[#e6e6e6] transition-colors"
            >
              Sign In to Accept
            </button>
          </div>
        )}

        {/* Actions for logged-in acceptor on open challenge */}
        {googleId && challenge.status === "open" && !isChallenger && !isAcceptor && (
          <div className="space-y-3 mb-4">
            {!showCounter ? (
              <>
                <button
                  onClick={handleAccept}
                  disabled={acting}
                  className="w-full py-3 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-[#e6e6e6] disabled:opacity-40 transition-colors"
                >
                  {acting ? "Accepting..." : `Accept — stake ◈${challenge.acceptor_stake}`}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCounter(true)}
                    className="flex-1 py-2.5 border border-[#262626] text-[#a3a3a3] font-black text-xs uppercase tracking-widest hover:text-white hover:border-[#333] transition-colors"
                  >
                    Counter Offer
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={acting}
                    className="flex-1 py-2.5 border border-[#ef4444]/30 text-[#ef4444] font-black text-xs uppercase tracking-widest hover:bg-[#ef4444]/10 disabled:opacity-40 transition-colors"
                  >
                    {acting ? "..." : "Decline"}
                  </button>
                </div>
              </>
            ) : (
              <div className="border border-[#262626] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[#a3a3a3] text-xs font-black uppercase tracking-widest">Counter Offer</p>
                  <button onClick={() => setShowCounter(false)} className="text-[#525252] hover:text-white text-xs">Cancel</button>
                </div>

                <div>
                  <p className="text-[10px] text-[#525252] uppercase tracking-widest font-bold mb-2">Challenger puts in</p>
                  <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1a1a1a] p-2.5">
                    <button onClick={() => setCounterStake((v) => Math.max(10, v - 10))}
                      className="w-7 h-7 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white">
                      <Minus className="w-3 h-3" />
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-1">
                      <span className="text-[#f59e0b]">◈</span>
                      <span className="font-black text-xl text-white tabular-nums">{counterStake}</span>
                    </div>
                    <button onClick={() => setCounterStake((v) => v + 10)}
                      className="w-7 h-7 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-[#525252] uppercase tracking-widest font-bold mb-2">Winner takes</p>
                  <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1a1a1a] p-2.5">
                    <button onClick={() => setCounterWants((v) => Math.max(counterStake + 10, v - 10))}
                      className="w-7 h-7 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white">
                      <Minus className="w-3 h-3" />
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-1">
                      <span className="text-[#f59e0b]">◈</span>
                      <span className="font-black text-xl text-white tabular-nums">{counterWants}</span>
                    </div>
                    <button onClick={() => setCounterWants((v) => v + 10)}
                      className="w-7 h-7 flex items-center justify-center border border-[#262626] hover:bg-[#1a1a1a] text-white">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="text-sm text-[#525252]">
                  You stake: <span className="text-white font-bold">◈{counterAcceptorStake}</span>
                </div>

                <button
                  onClick={handleCounter}
                  disabled={acting || counterAcceptorStake <= 0}
                  className="w-full py-2.5 bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-[#e6e6e6] disabled:opacity-40 transition-colors"
                >
                  {acting ? "Sending..." : "Send Counter"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Challenger can cancel open/counter_offered challenges */}
        {isChallenger && (challenge.status === "open") && (
          <button
            onClick={handleCancel}
            disabled={acting}
            className="w-full py-2.5 border border-[#ef4444]/30 text-[#ef4444] font-black text-xs uppercase tracking-widest hover:bg-[#ef4444]/10 disabled:opacity-40 transition-colors mb-4"
          >
            {acting ? "..." : "Cancel Challenge (Refund ◈" + challenge.challenger_stake + ")"}
          </button>
        )}

        {/* Share link — always visible */}
        <div className="border border-[#1a1a1a] p-3">
          <p className="text-[10px] text-[#525252] uppercase tracking-widest font-bold mb-2">Share Link</p>
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
      </main>
    </>
  );
}
