"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { api } from "@/lib/api";
import type { FirstInningsPickItem } from "@/types";
import { teamHex, teamShortCode } from "@/lib/utils";

type Phase = "loading" | "team" | "score" | "submitting" | "pending" | "done";

const PRIZE = 10_000;
const DEFAULT_SCORE = 175;
const MIN_SCORE = 50;
const MAX_SCORE = 350;

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
  const [picks, setPicks] = useState<FirstInningsPickItem[]>([]);
  const [nextStake, setNextStake] = useState<number | null>(10);
  const [pickedTeam, setPickedTeam] = useState<string | null>(null);
  const [score, setScore] = useState(DEFAULT_SCORE);
  const [inputVal, setInputVal] = useState(String(DEFAULT_SCORE));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!googleId) { setPhase("team"); return; }
      setPhase("loading");
      try {
        const s = await api.matches.firstInningsStatus(matchId, googleId);
        if (cancelled) return;
        setPicks(s.picks);
        setNextStake(s.next_stake);
        if (!s.played) {
          setPhase("team");
        } else if (s.next_stake !== null && !isLocked) {
          setPhase("team");
        } else {
          const allSettled = s.picks.length > 0 && s.picks.every((p) => p.settled);
          setPhase(allSettled ? "done" : "pending");
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
      setPicks(res.picks);
      setNextStake(res.next_stake);
      // Reset entry state
      setPickedTeam(null);
      setScore(DEFAULT_SCORE);
      setInputVal(String(DEFAULT_SCORE));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cricrank-coins-refresh"));
      }
      if (res.next_stake !== null && !isLocked) {
        setPhase("team");
      } else {
        const allSettled = res.picks.every((p) => p.settled);
        setPhase(allSettled ? "done" : "pending");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "insufficient_coins") setError("Not enough coins to stake");
      else if (msg === "max_guesses_reached") setError("All 3 guesses used");
      else if (msg === "duplicate_pick") setError("You already guessed that score");
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

  const stakeLabel = nextStake ?? 0;
  const isDuplicate = !!pickedTeam && picks.some(
    (p) => p.predicted_team === pickedTeam && p.predicted_score === score
  );

  return (
    <div className="border border-[#262626] bg-[#000000]">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-[3px] h-5 bg-[#6366f1] shrink-0" />
          <div className="min-w-0">
            <p className="font-gaming text-[11px] font-black uppercase tracking-[0.25em] text-white whitespace-nowrap">
              1st Innings Score
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#525252] mt-0.5 whitespace-nowrap">
              Exact match · 10 / 50 / 100 coins
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0 ml-4">
          <span className="font-gaming text-sm font-black text-[#6366f1]">+{PRIZE.toLocaleString()}</span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-[#525252]">if exact</span>
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

        {/* Locked with no picks */}
        {((!googleId && isLocked) || (googleId && isLocked && picks.length === 0 && (phase === "team" || phase === "score" || phase === "submitting"))) && (
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
                Right-click −/+ to jump by 10
              </p>
            </div>

            {isDuplicate && (
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#f59e0b]">
                You already picked {teamShortCode(pickedTeam)} {score} — try a different score
              </p>
            )}
            {!isDuplicate && error && <p className="text-[9px] font-bold uppercase tracking-wider text-red-400">{error}</p>}

            <button
              type="button"
              disabled={phase === "submitting" || isDuplicate}
              onClick={submit}
              className="w-full border border-[#6366f1] bg-[#6366f1]/10 py-3 font-gaming text-[10px] font-black uppercase tracking-[0.3em] text-[#6366f1] transition-colors hover:bg-[#6366f1]/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {phase === "submitting"
                ? "Locking..."
                : `Lock — ${teamShortCode(pickedTeam)} ${score} · ${stakeLabel} coins`}
            </button>
          </div>
        )}

        {/* Pending */}
        {googleId && phase === "pending" && picks.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Your guesses</p>
            {picks.map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[8px] font-black uppercase tracking-wider text-[#525252] w-12">Guess {i + 1}</span>
                  <p className="font-gaming text-xl font-black text-white tracking-widest">
                    <span style={{ color: teamHex(p.predicted_team) }}>{teamShortCode(p.predicted_team)}</span>
                    <span className="text-[#525252] mx-1.5 text-base">·</span>
                    {p.predicted_score}
                  </p>
                </div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#525252]">{p.stake} staked</p>
              </div>
            ))}
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6366f1] mt-1">
              +{PRIZE.toLocaleString()} if exact
            </p>
          </div>
        )}

        {/* Done */}
        {googleId && phase === "done" && picks.length > 0 && picks[0].actual_score != null && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#525252]">Actual</p>
              <p className="font-gaming text-xl font-black text-white tracking-widest">
                {picks[0].actual_team && (
                  <span style={{ color: teamHex(picks[0].actual_team) }}>{teamShortCode(picks[0].actual_team)} </span>
                )}
                {picks[0].actual_score}
              </p>
            </div>
            <div className="w-full h-px bg-[#262626]" />
            {picks.map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[8px] font-black uppercase tracking-wider text-[#525252] w-12">Guess {i + 1}</span>
                  <p className="font-gaming text-lg font-black tracking-widest" style={{ color: teamHex(p.predicted_team) }}>
                    {teamShortCode(p.predicted_team)} <span className="text-white">{p.predicted_score}</span>
                  </p>
                </div>
                <p className={`font-gaming text-lg font-black ${p.coins_won > 0 ? "text-[#6366f1]" : "text-red-500"}`}>
                  {p.coins_won > 0 ? `+${p.coins_won.toLocaleString()}` : `-${p.stake}`}
                </p>
              </div>
            ))}
            {picks.length > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-[#262626]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#525252]">Net</span>
                {(() => {
                  const net = picks.reduce((sum, p) => sum + (p.coins_won > 0 ? p.coins_won : -p.stake), 0);
                  return (
                    <p className={`font-gaming text-lg font-black ${net >= 0 ? "text-[#6366f1]" : "text-red-500"}`}>
                      {net >= 0 ? `+${net.toLocaleString()}` : net.toLocaleString()}
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Previous guesses strip — shown during entry when picks exist */}
      {picks.length > 0 && (phase === "team" || phase === "score" || phase === "submitting") && (
        <div className="flex items-center gap-4 px-5 py-3 border-t border-[#262626] bg-[#0a0a0a]">
          {picks.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="w-px h-3 bg-[#262626]" />}
              <span className="text-[8px] font-black uppercase tracking-wider text-[#525252]">G{i + 1}</span>
              <span className="font-gaming text-sm font-black" style={{ color: teamHex(p.predicted_team) }}>
                {teamShortCode(p.predicted_team)}
              </span>
              <span className="font-gaming text-sm font-black text-white">{p.predicted_score}</span>
              <span className="text-[8px] text-[#525252]">· {p.stake}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
