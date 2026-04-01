"use client";

import { useEffect, useState } from "react";
import { Coins, LogIn, Sparkles } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api";
import type { TossPickResponse, TossStatusResponse } from "@/types";
import { teamHex, teamShortCode } from "@/lib/utils";
import TeamCrest from "@/components/TeamCrest";

type Phase = "loading" | "pick" | "spinning" | "done" | "error";

const TOSS_COINS = 100;

export default function MatchToss({
  matchId,
  team1,
  team2,
}: {
  matchId: string;
  team1: string;
  team2: string;
}) {
  const { user, loading: authLoading, signInWithGoogle } = useUser();
  const googleId = user?.id ?? null;

  const [phase, setPhase] = useState<Phase>("loading");
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<TossPickResponse | TossStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!googleId) {
        setPhase("pick");
        return;
      }
      setPhase("loading");
      setError(null);
      try {
        const s = await api.matches.tossStatus(matchId, googleId);
        if (cancelled) return;
        if (s.played && s.winning_team && s.picked_team) {
          setResult({
            picked_team: s.picked_team,
            winning_team: s.winning_team,
            coins_won: s.coins_won,
            coins_balance: 0,
            already_played: true,
          });
          setPicked(s.picked_team);
          setPhase("done");
        } else {
          setPhase("pick");
        }
      } catch {
        if (!cancelled) setPhase("pick");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [googleId, matchId]);

  const runToss = async () => {
    if (!googleId || !picked) return;
    setError(null);
    setPhase("spinning");
    const minSpin = new Promise<void>((r) => setTimeout(r, 2200));
    try {
      const [res] = await Promise.all([api.matches.tossPick(matchId, googleId, picked), minSpin]);
      setResult(res);
      setPhase("done");
      if (res.coins_won > 0 && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cricrank-coins-refresh"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toss failed");
      setPhase("pick");
    }
  };

  const t1hex = teamHex(team1);
  const t2hex = teamHex(team2);

  if (authLoading) {
    return (
      <div className="relative overflow-hidden rounded-sm border border-[#262626] bg-[#050505] p-8">
        <div className="h-24 animate-pulse bg-[#141414] rounded" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-sm border border-amber-500/25 bg-[#060606] shadow-[0_0_60px_-12px_rgba(251,191,36,0.25)]">
      {/* Ambient gold wash */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(ellipse at center, rgba(251,191,36,0.35) 0%, transparent 65%)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{ background: t2hex }}
      />
      <div
        className="pointer-events-none absolute top-12 left-0 h-24 w-24 rounded-full opacity-15 blur-2xl"
        style={{ background: t1hex }}
      />

      <div className="relative border-b border-amber-500/15 bg-gradient-to-r from-amber-950/40 via-[#0a0a0a] to-amber-950/30 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-amber-400/30 bg-gradient-to-br from-amber-400/20 to-amber-900/20">
              <Sparkles className="h-5 w-5 text-amber-300" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-gaming text-sm tracking-[0.35em] text-white sm:text-base">GOLDEN TOSS</h3>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70">
                Pick a side · Win {TOSS_COINS} coins
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-black/40 px-3 py-1.5">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="font-gaming text-sm font-black tracking-wide text-amber-100">{TOSS_COINS}</span>
          </div>
        </div>
      </div>

      <div className="relative px-5 py-8 sm:px-8 sm:py-10">
        {!googleId && (
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="max-w-sm text-xs font-bold uppercase tracking-[0.2em] text-[#737373]">
              Sign in once to flip the coin — one toss per match, real coins in your wallet.
            </p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="group flex items-center gap-3 border border-amber-500/40 bg-gradient-to-r from-amber-500/90 to-amber-600/90 px-8 py-3.5 font-gaming text-xs font-black uppercase tracking-[0.25em] text-black shadow-[0_0_24px_rgba(251,191,36,0.35)] transition hover:from-amber-400 hover:to-amber-500"
            >
              <LogIn className="h-4 w-4" />
              Sign in to play
            </button>
          </div>
        )}

        {googleId && phase === "loading" && (
          <div className="flex justify-center py-6">
            <div className="h-12 w-12 animate-pulse rounded-full border-2 border-amber-500/30 border-t-amber-400" />
          </div>
        )}

        {googleId && phase === "pick" && (
          <div className="space-y-8">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-[#525252]">
              Choose who wins the toss
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[team1, team2].map((t) => {
                const sel = picked === t;
                const hex = teamHex(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPicked(t)}
                    className={`group relative flex flex-col items-center gap-4 border-2 p-6 transition-all duration-200 ${
                      sel
                        ? "border-white bg-white/[0.04] shadow-[0_0_32px_-4px_rgba(255,255,255,0.15)]"
                        : "border-[#262626] bg-[#0a0a0a] hover:border-[#404040]"
                    }`}
                    style={sel ? { boxShadow: `0 0 40px -8px ${hex}55` } : undefined}
                  >
                    <TeamCrest team={t} size="md" />
                    <span className="font-gaming text-3xl font-black tracking-widest text-white">{teamShortCode(t)}</span>
                    <span
                      className="text-[10px] font-black uppercase tracking-[0.3em]"
                      style={{ color: sel ? hex : "#525252" }}
                    >
                      {sel ? "Selected" : "Tap to pick"}
                    </span>
                  </button>
                );
              })}
            </div>
            {error && (
              <p className="text-center text-xs font-bold uppercase tracking-widest text-red-400">{error}</p>
            )}
            <div className="flex justify-center">
              <button
                type="button"
                disabled={!picked}
                onClick={runToss}
                className="relative overflow-hidden border border-amber-400/50 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 px-12 py-4 font-gaming text-xs font-black uppercase tracking-[0.35em] text-black shadow-[0_0_40px_rgba(251,191,36,0.45)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <span className="relative z-10">Flip the coin</span>
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition group-hover:opacity-100" />
              </button>
            </div>
          </div>
        )}

        {googleId && phase === "spinning" && (
          <div className="flex flex-col items-center gap-8 py-4">
            <div className="relative h-36 w-36 perspective-[800px] sm:h-44 sm:w-44">
              <div
                className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-amber-400/60 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-800 shadow-[0_0_48px_rgba(251,191,36,0.6),inset_0_2px_12px_rgba(255,255,255,0.4)]"
                style={{ animation: "match-toss-spin 2.2s cubic-bezier(0.45, 0.05, 0.2, 1) forwards" }}
              >
                <span className="font-gaming text-2xl font-black text-amber-950 sm:text-3xl">₹</span>
              </div>
              <div
                className="pointer-events-none absolute inset-0 rounded-full border border-amber-300/30"
                style={{ animation: "match-toss-ring 1.1s ease-in-out infinite" }}
              />
            </div>
            <p className="animate-pulse font-gaming text-xs font-black uppercase tracking-[0.4em] text-amber-200/90">
              Toss in the air…
            </p>
          </div>
        )}

        {googleId && phase === "done" && result && "winning_team" in result && (
          <div className="space-y-8 text-center">
            <div
              className={`mx-auto max-w-md border-2 px-6 py-8 ${
                result.coins_won > 0
                  ? "border-amber-400/50 bg-gradient-to-b from-amber-950/50 to-transparent shadow-[0_0_48px_-8px_rgba(251,191,36,0.35)]"
                  : "border-[#333] bg-[#0c0c0c]"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#737373]">Toss winner</p>
              <p
                className="mt-3 font-gaming text-3xl font-black tracking-[0.15em] sm:text-4xl"
                style={{ color: teamHex(result.winning_team) }}
              >
                {teamShortCode(result.winning_team)}
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-[#a3a3a3]">
                Your pick:{" "}
                <span style={{ color: teamHex(result.picked_team) }}>{teamShortCode(result.picked_team)}</span>
              </p>
              {result.coins_won > 0 ? (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/50 px-5 py-2">
                    <Coins className="h-6 w-6 text-amber-400" />
                    <span className="font-gaming text-2xl font-black tracking-wide text-amber-200">
                      +{result.coins_won} coins
                    </span>
                  </div>
                  {"coins_balance" in result && result.coins_balance > 0 && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252]">
                      Wallet · {result.coins_balance.toLocaleString()} coins
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#737373]">
                  Not this time — try the next match
                </p>
              )}
            </div>
            {result.already_played && (
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#525252]">
                You already played this toss for this match
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
