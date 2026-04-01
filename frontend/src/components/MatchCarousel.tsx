"use client";

import { useState, useEffect } from "react";
import { Match, MatchLive } from "@/types";
import { teamFullName, teamShortCode, formatRelativeDate, teamHex } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MapPin, Clock } from "lucide-react";
import TeamCrest from "@/components/TeamCrest";
import MatchInteraction from "@/components/MatchInteraction";
import CrowdPredictionCard from "@/components/CrowdPredictionCard";
import CountdownTimer from "@/components/CountdownTimer";
import { api } from "@/lib/api";

interface MatchData {
  aiPrediction: unknown | null;
  crowd: unknown | null;
}

// Mock live data for development
const MOCK_LIVE: MatchLive = {
  match_id: "",
  cricapi_id: "",
  status: "live" as const,
  match_started: true,
  match_ended: false,
  status_text: "Lucknow Super Giants - 142/6 (16.2 ov)",
  match_winner: null,
  result_summary: null,
  score: [
    { r: 142, w: 6, o: 16.2, inning: "Lucknow Super Giants Inning 1" },
  ] as Record<string, unknown>[],
  bbb: [
    // previous balls by KL Rahul off Kuldeep
    { n: 80, inning: 0, over: 13, ball: 1, batsman: { id: "1", name: "KL Rahul" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 4, penalty: null, extras: 0 },
    { n: 81, inning: 0, over: 13, ball: 2, batsman: { id: "1", name: "KL Rahul" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 0, penalty: null, extras: 0 },
    { n: 82, inning: 0, over: 13, ball: 3, batsman: { id: "1", name: "KL Rahul" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 1, penalty: null, extras: 0 },
    { n: 83, inning: 0, over: 13, ball: 4, batsman: { id: "3", name: "N Pooran" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 6, penalty: null, extras: 0 },
    { n: 84, inning: 0, over: 13, ball: 5, batsman: { id: "3", name: "N Pooran" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 0, penalty: null, extras: 0 },
    { n: 85, inning: 0, over: 13, ball: 6, batsman: { id: "3", name: "N Pooran" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 2, penalty: null, extras: 0 },
    // current over 16 - Kuldeep bowling
    { n: 96, inning: 0, over: 16, ball: 1, batsman: { id: "1", name: "KL Rahul" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 1, penalty: null, extras: 0 },
    { n: 97, inning: 0, over: 16, ball: 2, batsman: { id: "1", name: "KL Rahul" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 4, penalty: null, extras: 0 },
    { n: 98, inning: 0, over: 16, ball: 3, batsman: { id: "1", name: "KL Rahul" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 6, penalty: null, extras: 0 },
    { n: 99, inning: 0, over: 16, ball: 4, batsman: { id: "1", name: "KL Rahul" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 0, penalty: null, extras: 0 },
    { n: 100, inning: 0, over: 16, ball: 5, batsman: { id: "1", name: "KL Rahul" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 0, penalty: "wide", extras: 1 },
    { n: 101, inning: 0, over: 16, ball: 5, batsman: { id: "1", name: "KL Rahul" }, bowler: { id: "2", name: "Kuldeep Yadav" }, runs: 2, penalty: null, extras: 0 },
  ] as Record<string, unknown>[],
};

type ScoreEntry = { r: number; w: number; o: number; inning: string };
type BbbEntry = { n: number; inning: number; over: number; ball: number; batsman: { name: string }; bowler: { name: string }; runs: number; penalty: string | null; extras: number };

function ballLabel(b: BbbEntry): { text: string; cls: string } {
  if (b.penalty === "wide") return { text: "wd", cls: "text-[#f59e0b] border-[#f59e0b]" };
  if (b.penalty === "noball") return { text: "nb", cls: "text-[#f59e0b] border-[#f59e0b]" };
  if (b.runs === 0) return { text: "·", cls: "text-[#525252] border-[#262626]" };
  if (b.runs === 4) return { text: "4", cls: "text-[#3b82f6] border-[#3b82f6]" };
  if (b.runs === 6) return { text: "6", cls: "text-[#10b981] border-[#10b981]" };
  return { text: String(b.runs), cls: "text-white border-[#444]" };
}

function LiveScoreRow({ live, team1, team2 }: { live: MatchLive; team1: string; team2: string }) {
  const scores = live.score as ScoreEntry[];
  const bbb = live.bbb as BbbEntry[];

  const t1Score = scores.find(s => s.inning.includes(team1));
  const t2Score = scores.find(s => s.inning.includes(team2));

  const current = bbb.length > 0 ? bbb[bbb.length - 1] : null;

  // Batsman stats from bbb
  const batsmanBalls = current ? bbb.filter(b => b.batsman.name === current.batsman.name && b.penalty !== "wide" && b.penalty !== "noball") : [];
  const batsmanRuns = batsmanBalls.reduce((s, b) => s + b.runs, 0);

  // Bowler stats from bbb
  const bowlerLegal = current ? bbb.filter(b => b.bowler.name === current.bowler.name && b.penalty !== "wide" && b.penalty !== "noball") : [];
  const bowlerRuns = current ? bbb.filter(b => b.bowler.name === current.bowler.name).reduce((s, b) => s + b.runs + b.extras, 0) : 0;
  const bowlerOvers = `${Math.floor(bowlerLegal.length / 6)}.${bowlerLegal.length % 6}`;

  // Current over balls
  const currentOver = current?.over ?? 0;
  const currentInning = current?.inning ?? 0;
  const overBalls = bbb.filter(b => b.over === currentOver && b.inning === currentInning);

  return (
    <div className="pt-6 border-t border-[#262626] flex flex-col gap-5">

      {/* Score row */}
      <div className="flex items-center justify-between gap-4">
        {/* Team 1 */}
        <div className="flex items-center gap-3 min-w-0">
          <TeamCrest team={team1} size="sm" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: teamHex(team1) }}>{teamShortCode(team1)}</span>
            {t1Score ? (
              <span className="font-gaming text-xl font-black text-white tracking-tight leading-none">
                {t1Score.r}/{t1Score.w} <span className="text-xs text-[#737373] font-bold">({t1Score.o})</span>
              </span>
            ) : (
              <span className="text-xs font-black text-[#525252] uppercase tracking-wider">Yet to bat</span>
            )}
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#10b981]">Live</span>
        </div>

        {/* Team 2 */}
        <div className="flex items-center gap-3 justify-end min-w-0">
          <div className="flex flex-col items-end min-w-0">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: teamHex(team2) }}>{teamShortCode(team2)}</span>
            {t2Score ? (
              <span className="font-gaming text-xl font-black text-white tracking-tight leading-none">
                {t2Score.r}/{t2Score.w} <span className="text-xs text-[#737373] font-bold">({t2Score.o})</span>
              </span>
            ) : (
              <span className="text-xs font-black text-[#525252] uppercase tracking-wider">Yet to bat</span>
            )}
          </div>
          <TeamCrest team={team2} size="sm" />
        </div>
      </div>

      {current && (
        <div className="flex flex-col gap-3 border-t border-[#1a1a1a] pt-4">
          {/* Batsman + Bowler */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#525252]">Batsman</span>
              <span className="text-xs font-black text-white uppercase tracking-wide leading-none">{current.batsman.name}</span>
              <span className="text-[11px] font-black text-[#a3a3a3] tabular-nums">{batsmanRuns} <span className="text-[#525252]">({batsmanBalls.length}b)</span></span>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#525252]">Bowler</span>
              <span className="text-xs font-black text-white uppercase tracking-wide leading-none text-right">{current.bowler.name}</span>
              <span className="text-[11px] font-black text-[#a3a3a3] tabular-nums">{bowlerOvers} ov · {bowlerRuns} runs</span>
            </div>
          </div>

          {/* Current over */}
          {overBalls.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#525252] shrink-0">This over</span>
              <div className="flex items-center gap-1.5">
                {overBalls.map((b, i) => {
                  const { text, cls } = ballLabel(b);
                  return (
                    <span key={i} className={`w-7 h-7 flex items-center justify-center text-[11px] font-black border ${cls}`}>
                      {text}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  matches: Match[];
}

function MatchStatusBadge({ status }: { status: string }) {
  if (status === "live") {
    return (
      <span className="text-[10px] inline-flex items-center gap-2 px-3 py-1.5 font-black uppercase tracking-widest bg-[#000000] text-[#10b981] border border-[#10b981]">
        <span className="w-1.5 h-1.5 bg-[#10b981] animate-pulse" />
        Live
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="text-[10px] inline-block px-3 py-1.5 font-black uppercase tracking-widest bg-[#111111] text-[#a3a3a3] border border-[#262626]">
        Full Time
      </span>
    );
  }
  return null;
}

export default function MatchCarousel({ matches }: Props) {
  const [idx, setIdx] = useState(0);
  const [data, setData] = useState<Record<string, MatchData>>({});
  const [liveData, setLiveData] = useState<Record<string, MatchLive>>({});
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [animating, setAnimating] = useState(false);

  const match = matches[idx];
  const total = matches.length;

  // Poll live score every 10s when match is live
  useEffect(() => {
    if (!match || match.status !== "live") return;
    const poll = async () => {
      const live = await api.matches.live(match.id).catch(() => null);
      if (live) setLiveData(prev => ({ ...prev, [match.id]: live }));
    };
    poll();
    const interval = setInterval(poll, 10_000);
    return () => clearInterval(interval);
  }, [match?.id, match?.status]);

  // Fetch analysis data for the current match
  useEffect(() => {
    if (!match || data[match.id]) return;
    Promise.all([
      api.matches.crowd(match.id).catch(() => null),
    ]).then(([crowd]) => {
      setData(prev => ({ ...prev, [match.id]: { aiPrediction: null, crowd } }));
    });
  }, [match?.id]);

  function navigate(dir: "left" | "right") {
    if (animating || total <= 1) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setIdx(prev => dir === "right" ? (prev + 1) % total : (prev - 1 + total) % total);
      setAnimating(false);
    }, 200);
  }

  const matchData = data[match.id];
  const crowd = matchData?.crowd ?? null;

  const slideClass = animating
    ? direction === "right"
      ? "opacity-0 translate-x-4"
      : "opacity-0 -translate-x-4"
    : "opacity-100 translate-x-0";

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Card */}
      <div className="border border-[#262626] bg-[#000000]">
        <div className="px-6 pt-8 pb-7">

          {/* Header row with league + status + arrows */}
          <div className="flex items-center justify-between mb-10 pb-4 border-b border-[#262626]">
            <span className="text-xs font-black tracking-[0.3em] text-[#a3a3a3] uppercase">
              {match.league}
            </span>

            <div className="flex items-center gap-3">
              <MatchStatusBadge status={match.status} />

              {/* Nav arrows + counter */}
              {total > 1 && (
                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={() => navigate("left")}
                    className="w-9 h-9 bg-white flex items-center justify-center text-black hover:bg-[#e5e5e5] transition-colors duration-150 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                  <span className="text-[11px] font-black tracking-[0.2em] text-[#a3a3a3] min-w-[36px] text-center">
                    {idx + 1}/{total}
                  </span>
                  <button
                    onClick={() => navigate("right")}
                    className="w-9 h-9 bg-white flex items-center justify-center text-black hover:bg-[#e5e5e5] transition-colors duration-150 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Teams */}
          <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8 mb-10 transition-all duration-200 ${slideClass}`}>
            {/* Team 1 */}
            <div className="flex flex-col items-center gap-4">
              <TeamCrest team={match.team1} size="lg" />
              <div className="text-center">
                <p className="leading-none tracking-widest text-shadow-sm" style={{ fontSize: "clamp(40px, 6vw, 80px)", fontFamily: "var(--font-heading)", color: '#ffffff', textShadow: '0 2px 20px rgba(255,255,255,0.05)' }}>
                  {teamShortCode(match.team1)}
                </p>
                <p className="text-[10px] font-bold tracking-[0.25em] text-[#737373] uppercase mt-2">{teamFullName(match.team1)}</p>
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full" fill="none">
                  <line x1="0" y1="60" x2="60" y2="0" stroke="#262626" strokeWidth="1.5" />
                  <line x1="6" y1="60" x2="60" y2="6" stroke="#262626" strokeWidth="0.5" opacity="0.4" />
                  <line x1="0" y1="54" x2="54" y2="0" stroke="#262626" strokeWidth="0.5" opacity="0.4" />
                </svg>
                <span className="relative z-10 font-gaming text-3xl sm:text-4xl font-black text-[#525252] tracking-[0.3em]">VS</span>
              </div>
              {match.winner && (
                <span className="mt-3 text-[10px] font-bold text-[#000000] bg-white px-3 py-1 uppercase tracking-widest">
                  {match.result_summary ?? `${teamShortCode(match.winner)} won`}
                </span>
              )}
            </div>

            {/* Team 2 */}
            <div className="flex flex-col items-center gap-4">
              <TeamCrest team={match.team2} size="lg" />
              <div className="text-center">
                <p className="leading-none tracking-widest text-shadow-sm" style={{ fontSize: "clamp(40px, 6vw, 80px)", fontFamily: "var(--font-heading)", color: '#ffffff', textShadow: '0 2px 20px rgba(255,255,255,0.05)' }}>
                  {teamShortCode(match.team2)}
                </p>
                <p className="text-[10px] font-bold tracking-[0.25em] text-[#737373] uppercase mt-2">{teamFullName(match.team2)}</p>
              </div>
            </div>
          </div>

          {/* Bottom metadata — live score when live, venue/schedule otherwise */}
          {(match.status === "live" || true) ? (
            <div className={`transition-all duration-200 ${slideClass}`}>
              <LiveScoreRow
                live={liveData[match.id] ?? MOCK_LIVE}
                team1={match.team1}
                team2={match.team2}
              />
            </div>
          ) : (
            <div className={`flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-center pt-6 border-t border-[#262626] transition-all duration-200 ${slideClass}`}>
              <div className="flex items-center gap-3 lg:block">
                <MapPin className="w-4 h-4 text-[#c8c8c8] shrink-0 lg:hidden" />
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[#737373] font-bold">Venue</span>
                  <div className="flex items-center gap-2 text-white">
                    <MapPin className="w-4 h-4 text-[#c8c8c8] hidden lg:block" />
                    <span className="font-gaming text-sm lg:text-base font-bold tracking-wide">{match.venue.split(",")[0]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 lg:block">
                <Clock className="w-4 h-4 text-[#c8c8c8] shrink-0 lg:hidden" />
                <div className="flex flex-col gap-1 lg:items-center">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[#737373] font-bold">Schedule</span>
                  <div className="flex items-center gap-2 text-white">
                    <Clock className="w-4 h-4 text-[#c8c8c8] hidden lg:block" />
                    <span className="font-gaming text-sm lg:text-base font-bold tracking-wide">{formatRelativeDate(match.start_time)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 lg:block lg:flex lg:justify-end">
                {match.status === "upcoming" && <CountdownTimer tossTime={match.toss_time} variant="hero" />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prediction */}
      <MatchInteraction
        matchId={match.id}
        team1={match.team1}
        team2={match.team2}
        tossTime={match.toss_time}
        startTime={match.start_time}
        matchStatus={match.status}
      />

      {/* Analysis */}
      {crowd && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-[3px] h-5 bg-white" />
            <span className="text-[#a3a3a3] tracking-[0.25em] text-[13px] font-gaming uppercase">Analysis</span>
            <div className="h-px flex-1 bg-[#262626]" />
          </div>
          <div className="grid grid-cols-1 gap-4">
            {/* AI prediction temporarily hidden */}
            {/* {aiPrediction && <AIPredictionCard prediction={aiPrediction as Parameters<typeof AIPredictionCard>[0]["prediction"]} team1={match.team1} team2={match.team2} />} */}
            {crowd && <CrowdPredictionCard crowd={crowd as Parameters<typeof CrowdPredictionCard>[0]["crowd"]} team1={match.team1} team2={match.team2} />}
          </div>
        </div>
      )}
    </div>
  );
}
