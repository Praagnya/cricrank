"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api";
import type { FirstInningsPickResponse } from "@/types";
import { teamHex, teamShortCode } from "@/lib/utils";

type Phase = "loading" | "team" | "score" | "submitting" | "pending" | "done";

const STAKE = 10;
const PRIZE = 10_000;
const DEFAULT_SCORE = 175;
const MIN_SCORE = 50;
const MAX_SCORE = 350;

type View = Pick<
  FirstInningsPickResponse,
  "predicted_team" | "predicted_score" | "actual_team" | "actual_score" | "coins_won" | "pending" | "settled"
>;

export default function FirstInningsScore({
  matchId,
  team1,
  team2,
  startTime,
}: {
  matchId: string;
  team1: string;
  team2: string;
  startTime?: string;
}) {
  const { user, loading: authLoading, signInWithGoogle } = useUser();
  const googleId = user?.id ?? null;
  const isLocked = startTime ? Date.now() >= new Date(startTime).getTime() : false;

  const [phase, setPhase] = useState<Phase>("loading");
  const [pickedTeam, setPickedTeam] = useState<string | null>(null);
  const [score, setScore] = useState(DEFAULT_SCORE);
  const [inputVal, setInputVal] = useState(String(DEFAULT_SCORE));
  const [result, setResult] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!googleId) { setPhase("team"); return; }
      setPhase("loading");
      try {
        const s = await api.matches.firstInningsStatus(matchId, googleId);
        if (cancelled) return;
        if (s.played && s.predicted_team) {
          setPickedTeam(s.predicted_team);
          setScore(s.predicted_score ?? DEFAULT_SCORE);
          setResult({
            predicted_team: s.predicted_team,
            predicted_score: s.predicted_score ?? DEFAULT_SCORE,
            actual_team: s.actual_team,
            actual_score: s.actual_score,
            coins_won: s.coins_won,
            pending: s.pending ?? !s.settled,
            settled: s.settled ?? false,
          });
          setPhase(s.settled ? "done" : "pending");
        } else {
          setPhase("team");
        }
      } catch {
        if (!cancelled) setPhase("team");
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
    const n = parseInt(inputVal, 10);
    const clamped = isNaN(n) ? DEFAULT_SCORE : clamp(n);
    setScore(clamped);
    setInputVal(String(clamped));
  }

  async function submit() {
    if (!googleId || !pickedTeam) return;
    setError(null);
    setPhase("submitting");
    try {
      const res = await api.matches.firstInningsPick(matchId, googleId, pickedTeam, score);
      setResult({
        predicted_team: res.predicted_team,
        predicted_score: res.predicted_score,
        actual_team: res.actual_team,
        actual_score: res.actual_score,
        coins_won: res.coins_won,
        pending: res.pending ?? !res.settled,
        settled: res.settled ?? false,
      });
      setPhase(res.settled ? "done" : "pending");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cricrank-coins-refresh"));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg === "insufficient_coins" ? "Not enough coins to stake" : "Could not save pick");
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
              First Innings Score
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#525252] mt-0.5">
              Exact match · one entry per match
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5 border border-[#6366f1]/30 bg-[#6366f1]/5 px-2.5 py-1.5">
            <span className="font-gaming text-sm font-black text-[#6366f1]">+{PRIZE.toLocaleString()}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#737373]">coins</span>
          </div>
          <p className="text-[8px] font-bold uppercase tracking-wider text-[#525252]">{STAKE} coin stake</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5">

        {/* Not signed in */}
        {!googleId && !isLocked && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#525252]">
              Sign in to predict
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

        {(!googleId || phase === "team" || phase === "score" || phase === "submitting") && isLocked && (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#525252]">
            Prediction closed
          </p>
        )}

        {/* Loading */}
        {googleId && phase === "loading" && (
          <div className="h-8 w-32 animate-pulse bg-[#111111]" />
        )}

        {/* Step 1: Pick team */}
        {googleId && phase === "team" && !isLocked && (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#525252]">Who bats first?</p>
            <div className="grid grid-cols-2 gap-2">
              {[team1, team2].map((t) => {
                const hex = teamHex(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setPickedTeam(t); setPhase("score"); }}
                    className="border border-[#262626] bg-[#000000] hover:border-[#404040] px-4 py-4 text-left transition-colors"
                  >
                    <p className="font-gaming text-2xl font-black text-white tracking-widest">{teamShortCode(t)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest mt-1 text-[#525252]">Select</p>
                    <div className="mt-3 h-[2px] w-full" style={{ backgroundColor: hex, opacity: 0.2 }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Enter score */}
        {googleId && (phase === "score" || phase === "submitting") && !isLocked && pickedTeam && (
          <div className="flex flex-col gap-4">
            {/* Selected team + change */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Batting first</p>
                <p className="font-gaming text-sm font-black tracking-widest" style={{ color: teamHex(pickedTeam) }}>
                  {teamShortCode(pickedTeam)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhase("team")}
                disabled={phase === "submitting"}
                className="text-[9px] font-bold uppercase tracking-wider text-[#525252] hover:text-white transition-colors disabled:opacity-40"
              >
                Change
              </button>
            </div>

            {/* Score input */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#525252] mb-3">Predicted score</p>
              <div className="flex items-center gap-0">
                <button
                  type="button"
                  disabled={phase === "submitting" || score <= MIN_SCORE}
                  onClick={() => adjust(-1)}
                  onContextMenu={(e) => { e.preventDefault(); adjust(-10); }}
                  className="w-12 h-14 border border-[#262626] bg-[#000000] font-gaming text-xl font-black text-white hover:bg-[#111111] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <input
                  type="number"
                  min={MIN_SCORE}
                  max={MAX_SCORE}
                  value={inputVal}
                  disabled={phase === "submitting"}
                  onChange={(e) => handleInput(e.target.value)}
                  onBlur={handleInputBlur}
                  className="flex-1 h-14 border-y border-[#262626] bg-[#000000] font-gaming text-3xl font-black text-white text-center tracking-widest tabular-nums focus:outline-none focus:border-[#404040] disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  disabled={phase === "submitting" || score >= MAX_SCORE}
                  onClick={() => adjust(1)}
                  onContextMenu={(e) => { e.preventDefault(); adjust(10); }}
                  className="w-12 h-14 border border-[#262626] bg-[#000000] font-gaming text-xl font-black text-white hover:bg-[#111111] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-[#525252] mt-1.5 text-center">
                Right-click ±/+ to jump by 10
              </p>
            </div>

            {error && <p className="text-[9px] font-bold uppercase tracking-wider text-red-400">{error}</p>}

            <button
              type="button"
              disabled={phase === "submitting"}
              onClick={submit}
              className="w-full border border-[#6366f1] bg-[#6366f1]/10 py-3 font-gaming text-[10px] font-black uppercase tracking-[0.3em] text-[#6366f1] transition-colors hover:bg-[#6366f1]/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {phase === "submitting" ? "Locking..." : `Lock — ${teamShortCode(pickedTeam)} ${score}`}
            </button>
          </div>
        )}

        {/* Pending */}
        {googleId && phase === "pending" && result && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Your pick</p>
              <p className="font-gaming text-2xl font-black text-white tracking-widest mt-1">
                <span style={{ color: teamHex(result.predicted_team) }}>{teamShortCode(result.predicted_team)}</span>
                <span className="text-[#525252] mx-2 text-lg">·</span>
                {result.predicted_score}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Awaiting result</p>
              <p className="font-gaming text-sm font-black text-[#6366f1] tracking-wider mt-1">
                +{PRIZE.toLocaleString()} if exact
              </p>
            </div>
          </div>
        )}

        {/* Done */}
        {googleId && phase === "done" && result?.settled && result.actual_score != null && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Actual</p>
                <p className="font-gaming text-2xl font-black text-white tracking-widest mt-1">
                  {result.actual_team && (
                    <span style={{ color: teamHex(result.actual_team) }}>{teamShortCode(result.actual_team)} </span>
                  )}
                  {result.actual_score}
                </p>
              </div>
              <div className="w-px h-10 bg-[#262626]" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Your pick</p>
                <p className="font-gaming text-2xl font-black text-white tracking-widest mt-1">
                  <span style={{ color: teamHex(result.predicted_team) }}>{teamShortCode(result.predicted_team)} </span>
                  {result.predicted_score}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              {result.coins_won > 0 ? (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Earned</p>
                  <p className="font-gaming text-2xl font-black text-[#6366f1] mt-1">+{result.coins_won.toLocaleString()}</p>
                </>
              ) : (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Lost</p>
                  <p className="font-gaming text-2xl font-black text-red-500 mt-1">-{STAKE}</p>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
