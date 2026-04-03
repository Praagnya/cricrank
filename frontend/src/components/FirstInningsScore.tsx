"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api";
import type { FirstInningsPickItem } from "@/types";
import { teamHex, teamShortCode } from "@/lib/utils";

type Phase = "loading" | "score" | "submitting" | "pending" | "done";

const ENTRY_COINS = 100;
const MAX_REWARD  = 5_000;
const WINDOW      = 20;
const DEFAULT_SCORE = 175;
const MIN_SCORE = 50;
const MAX_SCORE = 350;

function calcReward(predicted: number, actual: number): number {
  const diff = Math.abs(predicted - actual);
  if (diff >= WINDOW) return 0;
  return Math.max(0, Math.round((MAX_REWARD - (MAX_REWARD / WINDOW) * diff) / 100) * 100);
}

const CoinDot = () => (
  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#fbbf24] border border-[#92400e] align-middle mb-[1px] shrink-0" />
);

export default function FirstInningsScore({
  matchId,
  startTime,
}: {
  matchId: string;
  startTime?: string;
}) {
  const { user, loading: authLoading, signInWithGoogle } = useUser();
  const googleId = user?.id ?? null;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const isLocked = startTime ? nowMs >= new Date(startTime).getTime() : false;

  const [phase, setPhase] = useState<Phase>("loading");
  const [pick, setPick] = useState<FirstInningsPickItem | null>(null);
  const [score, setScore] = useState(DEFAULT_SCORE);
  const [inputVal, setInputVal] = useState(String(DEFAULT_SCORE));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!googleId) { setPhase("score"); return; }
      setPhase("loading");
      try {
        const s = await api.matches.firstInningsStatus(matchId, googleId);
        if (cancelled) return;
        const p = s.picks[0] ?? null;
        setPick(p);
        if (!p) {
          setPhase("score");
        } else if (p.settled) {
          setPhase("done");
        } else {
          setPhase("pending");
        }
      } catch {
        if (!cancelled) setPhase("score");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [googleId, matchId]);

  function clamp(v: number) { return Math.max(MIN_SCORE, Math.min(MAX_SCORE, v)); }
  function adjust(delta: number) {
    const next = clamp(score + delta);
    setScore(next);
    setInputVal(String(next));
  }
  function handleInput(v: string) {
    setInputVal(v);
    const n = parseInt(v, 10);
    if (!isNaN(n)) setScore(clamp(n));
  }
  function handleInputBlur() {
    const clamped = isNaN(parseInt(inputVal, 10)) ? DEFAULT_SCORE : clamp(parseInt(inputVal, 10));
    setScore(clamped);
    setInputVal(String(clamped));
  }

  async function submit() {
    if (!googleId) return;
    setError(null);
    setPhase("submitting");
    try {
      const res = await api.matches.firstInningsPick(matchId, googleId, score);
      const p = res.picks[0] ?? null;
      setPick(p);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cricrank-coins-refresh"));
        window.dispatchEvent(new CustomEvent("cricrank-coin-toast", { detail: { amount: ENTRY_COINS, type: "debit" } }));
      }
      setPhase(p?.settled ? "done" : "pending");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "insufficient_coins") setError("Not enough coins");
      else if (msg === "max_guesses_reached") setError("Already submitted");
      else setError("Could not save pick");
      setPhase("score");
    }
  }

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
          <div className="w-[3px] h-5 bg-[#6366f1]" />
          <div>
            <p className="font-gaming text-[11px] font-black uppercase tracking-[0.25em] text-white">
              1st Innings Score
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#525252] mt-0.5">
              Within 20 runs wins
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-gaming text-sm font-black text-[#737373] flex items-center gap-1"><CoinDot />{ENTRY_COINS}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-[#525252]">entry</span>
          </div>
          <div className="w-px h-7 bg-[#262626]" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-gaming text-sm font-black text-[#fbbf24] flex items-center gap-1">+<CoinDot />{MAX_REWARD.toLocaleString()}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-[#525252]">max win</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5">

        {/* Not signed in */}
        {!googleId && !isLocked && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#525252]">Sign in to predict</p>
            <button type="button" onClick={signInWithGoogle}
              className="border border-white bg-white px-4 py-2 font-gaming text-[9px] font-black uppercase tracking-[0.2em] text-black hover:bg-[#e5e5e5] transition-colors shrink-0">
              Sign in
            </button>
          </div>
        )}

        {/* Locked with no pick */}
        {((!googleId && isLocked) || (googleId && isLocked && !pick && (phase === "score" || phase === "submitting"))) && (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#525252]">Prediction closed</p>
        )}

        {/* Loading */}
        {googleId && phase === "loading" && (
          <div className="h-8 w-32 animate-pulse bg-[#111111]" />
        )}

        {/* Score entry */}
        {googleId && (phase === "score" || phase === "submitting") && !isLocked && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#525252] mb-3">Predicted 1st innings score</p>
              <div className="flex items-center gap-0">
                <button type="button" disabled={phase === "submitting" || score <= MIN_SCORE}
                  onClick={() => adjust(-1)} onContextMenu={(e) => { e.preventDefault(); adjust(-10); }}
                  className="w-12 h-14 border border-[#262626] bg-[#000000] font-gaming text-xl font-black text-white hover:bg-[#111111] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  −
                </button>
                <input type="number" min={MIN_SCORE} max={MAX_SCORE} value={inputVal}
                  disabled={phase === "submitting"}
                  onChange={(e) => handleInput(e.target.value)}
                  onBlur={handleInputBlur}
                  className="flex-1 h-14 border-y border-[#262626] bg-[#000000] font-gaming text-3xl font-black text-white text-center tracking-widest tabular-nums focus:outline-none focus:border-[#404040] disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button type="button" disabled={phase === "submitting" || score >= MAX_SCORE}
                  onClick={() => adjust(1)} onContextMenu={(e) => { e.preventDefault(); adjust(10); }}
                  className="w-12 h-14 border border-[#262626] bg-[#000000] font-gaming text-xl font-black text-white hover:bg-[#111111] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  +
                </button>
              </div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-[#525252] mt-1.5 text-center">
                Right-click −/+ to jump by 10
              </p>
            </div>

            {/* Reward scale hint */}
            <div className="grid grid-cols-4 gap-1">
              {[0, 5, 10, 15].map((off) => (
                <div key={off} className="border border-[#1a1a1a] bg-[#0a0a0a] px-1.5 py-1.5 text-center">
                  <p className="text-[8px] text-[#525252] mb-0.5">±{off === 0 ? "0" : off}</p>
                  <p className="text-[10px] font-black text-[#fbbf24]">◈{calcReward(score, score - off).toLocaleString()}</p>
                </div>
              ))}
            </div>

            {error && <p className="text-[9px] font-bold uppercase tracking-wider text-red-400">{error}</p>}

            <button type="button" disabled={phase === "submitting"} onClick={submit}
              className="w-full border border-[#6366f1] bg-[#6366f1]/10 py-3 font-gaming text-[10px] font-black uppercase tracking-[0.3em] text-[#6366f1] transition-colors hover:bg-[#6366f1]/20 disabled:cursor-not-allowed disabled:opacity-30">
              {phase === "submitting" ? "Locking..." : (
                <span className="flex items-center justify-center gap-1.5">
                  Lock {score} runs · <CoinDot />{ENTRY_COINS}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Pending */}
        {googleId && phase === "pending" && pick && (
          <div className="flex flex-col gap-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Your prediction</p>
            <p className="font-gaming text-2xl font-black text-white tabular-nums tracking-widest">
              {pick.predicted_score} runs
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252] flex items-center gap-1">
              Win up to +<CoinDot />{MAX_REWARD.toLocaleString()} within {WINDOW} runs
            </p>
          </div>
        )}

        {/* Done */}
        {googleId && phase === "done" && pick && pick.actual_score != null && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Actual</p>
              <p className="font-gaming text-xl font-black text-white tracking-widest">
                {pick.actual_team && (
                  <span style={{ color: teamHex(pick.actual_team) }}>{teamShortCode(pick.actual_team)} </span>
                )}
                {pick.actual_score}
              </p>
            </div>
            <div className="w-full h-px bg-[#262626]" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="font-gaming text-lg font-black text-white tabular-nums">
                  {pick.predicted_score} <span className="text-[#525252] text-sm">predicted</span>
                </p>
                <span className="text-[9px] text-[#525252]">
                  {Math.abs(pick.predicted_score - pick.actual_score)} runs off
                </span>
              </div>
              <p className={`font-gaming text-lg font-black flex items-center gap-1 ${pick.coins_won > 0 ? "text-[#fbbf24]" : "text-red-500"}`}>
                {pick.coins_won > 0
                  ? <><span>+</span><CoinDot />{pick.coins_won.toLocaleString()}</>
                  : <><span>−</span><CoinDot />{ENTRY_COINS}</>}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
