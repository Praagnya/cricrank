"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api";
import type { TossPickResponse } from "@/types";
import { teamHex, teamShortCode } from "@/lib/utils";

type Phase = "loading" | "pick" | "submitting" | "pending" | "done";

const TOSS_COINS = 100;

const CoinDot = () => (
  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#fbbf24] border border-[#92400e] align-middle mb-[1px] shrink-0" />
);

type TossView = Pick<
  TossPickResponse,
  "picked_team" | "winning_team" | "coins_won" | "coins_balance" | "already_played" | "pending" | "settled"
>;

export default function MatchToss({
  matchId,
  team1,
  team2,
  tossTime,
}: {
  matchId: string;
  team1: string;
  team2: string;
  tossTime?: string;
}) {
  /** Wall clock for lock (updated on interval so we never call Date.now() during render). */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const id = setInterval(tick, 10_000);
    tick();
    return () => clearInterval(id);
  }, [tossTime]);

  const isLocked = tossTime ? nowMs >= new Date(tossTime).getTime() : false;
  const { user, loading: authLoading, signInWithGoogle } = useUser();
  const googleId = user?.id ?? null;

  const [phase, setPhase] = useState<Phase>("loading");
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<TossView | null>(null);
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
        if (s.played && s.picked_team) {
          setPicked(s.picked_team);
          setResult({
            picked_team: s.picked_team,
            winning_team: s.winning_team ?? undefined,
            coins_won: s.coins_won,
            coins_balance: 0,
            already_played: true,
            pending: s.pending ?? !s.settled,
            settled: s.settled ?? false,
          });
          setPhase(s.settled ? "done" : "pending");
        } else {
          setPhase("pick");
        }
      } catch {
        if (!cancelled) setPhase("pick");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [googleId, matchId, isLocked]);

  const submitPick = async () => {
    if (!googleId || !picked) return;
    setError(null);
    setPhase("submitting");
    try {
      const res = await api.matches.tossPick(matchId, googleId, picked);
      setResult({
        picked_team: res.picked_team,
        winning_team: res.winning_team ?? undefined,
        coins_won: res.coins_won,
        coins_balance: res.coins_balance,
        already_played: res.already_played,
        pending: res.pending ?? !res.settled,
        settled: res.settled ?? false,
      });
      setPhase(res.settled ? "done" : "pending");
      // Coins were staked — always refresh balance
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cricrank-coins-refresh"));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg === "insufficient_coins" ? "Not enough coins to stake" : "Could not save pick");
      setPhase("pick");
    }
  };

  if (authLoading) {
    return (
      <div className="border border-[#262626] bg-[#000000] px-5 py-4">
        <div className="h-4 w-32 animate-pulse bg-[#111111]" />
      </div>
    );
  }

  return (
    <div className="border border-[#262626] bg-[#000000]">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-5 bg-[#f59e0b]" />
          <div>
            <p className="font-gaming text-[11px] font-black uppercase tracking-[0.25em] text-white">
              Toss Prediction
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#525252] mt-0.5">
              One entry per match
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-gaming text-sm font-black text-[#737373] flex items-center gap-1"><CoinDot />{TOSS_COINS}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-[#525252]">stake</span>
          </div>
          <div className="w-px h-7 bg-[#262626]" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-gaming text-sm font-black text-[#fbbf24] flex items-center gap-1">+<CoinDot />{TOSS_COINS}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-[#525252]">win</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5">

        {/* Not signed in */}
        {!googleId && !isLocked && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#525252]">
              Sign in to predict the toss
            </p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="border border-white bg-white px-4 py-2 font-gaming text-[9px] font-black uppercase tracking-[0.2em] text-black hover:bg-[#e5e5e5] transition-colors shrink-0"
            >
              Sign in
            </button>
          </div>
        )}

        {/* Not signed in + locked */}
        {!googleId && isLocked && (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#525252]">
            Toss prediction closed
          </p>
        )}

        {/* Loading */}
        {googleId && phase === "loading" && (
          <div className="h-8 w-32 animate-pulse bg-[#111111]" />
        )}

        {/* Locked — toss time passed, no pick was made */}
        {googleId && phase === "pick" && isLocked && (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#525252]">
            Toss prediction closed
          </p>
        )}

        {/* Pick / Submitting */}
        {googleId && (phase === "pick" || phase === "submitting") && !isLocked && (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#525252]">Pick your team</p>
            <div className="grid grid-cols-2 gap-2">
              {[team1, team2].map((t) => {
                const sel = picked === t;
                const hex = teamHex(t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={phase === "submitting"}
                    onClick={() => setPicked(t)}
                    className={`border px-4 py-4 text-left transition-colors disabled:cursor-not-allowed ${
                      sel
                        ? "border-white bg-[#111111]"
                        : "border-[#262626] bg-[#000000] hover:border-[#404040]"
                    }`}
                  >
                    <p
                      className="font-gaming text-2xl font-black tracking-widest"
                      style={{ color: hex, opacity: sel ? 1 : 0.92 }}
                    >
                      {teamShortCode(t)}
                    </p>
                    <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${sel ? "text-[#a3a3a3]" : "text-[#525252]"}`}>
                      {sel ? "Selected" : "Pick"}
                    </p>
                    <div
                      className="mt-3 h-[2px] w-full transition-opacity"
                      style={{ backgroundColor: hex, opacity: sel ? 1 : 0.15 }}
                    />
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="text-[9px] font-bold uppercase tracking-wider text-red-400">{error}</p>
            )}

            <button
              type="button"
              disabled={!picked || phase === "submitting"}
              onClick={submitPick}
              className="w-full border border-[#f59e0b] bg-[#f59e0b]/10 py-3 font-gaming text-[10px] font-black uppercase tracking-[0.3em] text-[#f59e0b] transition-colors enabled:hover:bg-[#f59e0b]/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {phase === "submitting" ? "Locking..." : "Lock Toss Pick"}
            </button>
          </div>
        )}

        {/* Pending — pick locked, awaiting toss */}
        {googleId && phase === "pending" && result?.picked_team && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Your pick</p>
              <p
                className="font-gaming text-3xl font-black tracking-widest mt-1"
                style={{ color: teamHex(result.picked_team) }}
              >
                {teamShortCode(result.picked_team)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Awaiting toss result</p>
              <p className="font-gaming text-sm font-black text-[#fbbf24] tracking-wider mt-1 flex items-center gap-1 justify-end">
                +<CoinDot />{TOSS_COINS} if correct
              </p>
            </div>
          </div>
        )}

        {/* Done — settled */}
        {googleId && phase === "done" && result?.settled && result.winning_team && result.picked_team && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Toss won by</p>
                <p
                  className="font-gaming text-3xl font-black tracking-widest mt-1"
                  style={{ color: teamHex(result.winning_team) }}
                >
                  {teamShortCode(result.winning_team)}
                </p>
              </div>
              <div className="w-px h-10 bg-[#262626]" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Your pick</p>
                <p
                  className="font-gaming text-3xl font-black tracking-widest mt-1"
                  style={{ color: teamHex(result.picked_team) }}
                >
                  {teamShortCode(result.picked_team)}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              {result.coins_won > 0 ? (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Earned</p>
                  <p className="font-gaming text-2xl font-black text-[#fbbf24] mt-1 flex items-center gap-1">+<CoinDot />{result.coins_won}</p>
                </>
              ) : (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Lost</p>
                  <p className="font-gaming text-2xl font-black text-red-500 mt-1 flex items-center gap-1">-<CoinDot />{TOSS_COINS}</p>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
