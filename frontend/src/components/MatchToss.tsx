"use client";

import { useEffect, useState } from "react";
import { Coins, LogIn } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api";
import type { TossPickResponse } from "@/types";
import { teamHex, teamShortCode } from "@/lib/utils";

type Phase = "loading" | "pick" | "submitting" | "pending" | "done";

const TOSS_COINS = 100;

/** Merged shape for display (from status or pick API). */
type TossView = Pick<
  TossPickResponse,
  "picked_team" | "winning_team" | "coins_won" | "coins_balance" | "already_played" | "pending" | "settled"
>;

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
    return () => {
      cancelled = true;
    };
  }, [googleId, matchId]);

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
      if (res.coins_won > 0 && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cricrank-coins-refresh"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save pick");
      setPhase("pick");
    }
  };

  if (authLoading) {
    return (
      <div className="rounded-sm border border-[#262626] bg-[#050505] px-3 py-2">
        <div className="h-4 w-32 animate-pulse rounded bg-[#141414]" />
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-[#333] bg-[#080808]">
      <div className="flex items-center justify-between gap-2 border-b border-[#262626] px-3 py-2">
        <div className="min-w-0">
          <p className="truncate font-gaming text-[10px] font-black uppercase tracking-[0.2em] text-[#a3a3a3]">
            Toss winner
          </p>
          <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[#525252]">
            Predict · {TOSS_COINS} coins if correct (validated vs match feed)
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded border border-amber-500/20 bg-black/50 px-2 py-0.5">
          <Coins className="h-3 w-3 text-amber-500/80" />
          <span className="font-gaming text-[11px] font-black text-amber-200/90">{TOSS_COINS}</span>
        </div>
      </div>

      <div className="px-3 py-3">
        {!googleId && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#525252]">
              Sign in to predict the toss · one entry per match
            </p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-2 border border-[#404040] bg-white px-3 py-1.5 font-gaming text-[9px] font-black uppercase tracking-widest text-black hover:bg-[#e5e5e5]"
            >
              <LogIn className="h-3 w-3" />
              Sign in
            </button>
          </div>
        )}

        {googleId && phase === "loading" && (
          <div className="h-4 w-24 animate-pulse rounded bg-[#141414]" />
        )}

        {googleId && phase === "pick" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {[team1, team2].map((t) => {
                const sel = picked === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPicked(t)}
                    className={`min-w-0 flex-1 border px-2 py-2 text-left transition ${
                      sel ? "border-white bg-white/[0.06]" : "border-[#333] bg-[#0a0a0a] hover:border-[#444]"
                    }`}
                  >
                    <span className="font-gaming text-sm font-black tracking-widest text-white">
                      {teamShortCode(t)}
                    </span>
                    <span className="ml-2 text-[8px] font-bold uppercase tracking-wider text-[#525252]">
                      {sel ? "Selected" : "Pick"}
                    </span>
                  </button>
                );
              })}
            </div>
            {error && <p className="text-[9px] font-bold uppercase tracking-wider text-red-400">{error}</p>}
            <button
              type="button"
              disabled={!picked}
              onClick={submitPick}
              className="w-full border border-amber-500/40 bg-amber-500/15 py-2 font-gaming text-[9px] font-black uppercase tracking-[0.25em] text-amber-100 transition enabled:hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Lock pick
            </button>
          </div>
        )}

        {googleId && phase === "submitting" && (
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#737373]">Saving…</p>
        )}

        {googleId && phase === "pending" && result?.picked_team && (
          <div className="space-y-1 text-[9px]">
            <p className="font-bold uppercase tracking-wider text-[#737373]">
              Your pick:{" "}
              <span style={{ color: teamHex(result.picked_team) }} className="font-gaming">
                {teamShortCode(result.picked_team)}
              </span>
            </p>
            <p className="font-bold uppercase tracking-wider text-amber-600/90">
              Awaiting official toss — +{TOSS_COINS} coins if your pick matches the feed
            </p>
          </div>
        )}

        {googleId && phase === "done" && result?.settled && result.winning_team && result.picked_team && (
          <div className="space-y-1 text-[9px]">
            <p className="font-bold uppercase tracking-wider text-[#737373]">
              Toss:{" "}
              <span style={{ color: teamHex(result.winning_team) }} className="font-gaming">
                {teamShortCode(result.winning_team)}
              </span>
              {" · "}
              You:{" "}
              <span style={{ color: teamHex(result.picked_team) }}>{teamShortCode(result.picked_team)}</span>
            </p>
            {result.coins_won > 0 ? (
              <p className="flex items-center gap-1 font-gaming text-xs font-black text-amber-200">
                <Coins className="h-3.5 w-3.5" />+{result.coins_won} coins
                {result.coins_balance > 0 && (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#525252]">
                    · wallet {result.coins_balance.toLocaleString()}
                  </span>
                )}
              </p>
            ) : (
              <p className="font-bold uppercase tracking-wider text-[#737373]">No coins — pick did not match toss</p>
            )}
            {result.already_played && (
              <p className="text-[8px] uppercase tracking-wider text-[#404040]">Entry locked for this match</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
