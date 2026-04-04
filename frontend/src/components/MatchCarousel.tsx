"use client";

import { useState, useEffect } from "react";
import { Match } from "@/types";
import { teamFullName, teamShortCode, formatRelativeDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MapPin, Clock } from "lucide-react";
import TeamCrest from "@/components/TeamCrest";
import MatchInteraction from "@/components/MatchInteraction";
import CrowdPredictionCard from "@/components/CrowdPredictionCard";
import MatchToss from "@/components/MatchToss";
import FirstInningsScore from "@/components/FirstInningsScore";
import CountdownTimer from "@/components/CountdownTimer";
import MatchScoreboard from "@/components/MatchScoreboard";
import { api } from "@/lib/api";

interface MatchData {
  aiPrediction: unknown | null;
  crowd: unknown | null;
}

interface Props {
  matches: Match[];
}

export default function MatchCarousel({ matches }: Props) {
  const [idx, setIdx] = useState(0);
  const [data, setData] = useState<Record<string, MatchData>>({});
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [animating, setAnimating] = useState(false);

  const total = matches.length;
  const match = total > 0 ? matches[Math.min(idx, total - 1)] : undefined;

  useEffect(() => {
    setIdx((i) => (total === 0 ? 0 : Math.min(i, total - 1)));
  }, [total]);

  useEffect(() => {
    if (total === 0) return;
    if (!match) return;
    if (data[match.id]) return;

    Promise.all([
      api.matches.aiPrediction(match.id).catch(() => null),
      api.matches.crowd(match.id).catch(() => null),
    ]).then(([aiPrediction, crowd]) => {
      setData((prev) => ({ ...prev, [match.id]: { aiPrediction, crowd } }));
    });
  }, [match?.id, total]);

  function navigate(dir: "left" | "right") {
    if (animating || total <= 1) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setIdx((prev) => (dir === "right" ? (prev + 1) % total : (prev - 1 + total) % total));
      setAnimating(false);
    }, 200);
  }

  if (!match || total === 0) {
    return null;
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
      <div className="border border-[#262626] bg-[#000000]">
        <div className="px-6 pt-8 pb-7">
          <div className="flex items-center justify-between mb-10 pb-4 border-b border-[#262626]">
            <span className="text-xs font-black tracking-[0.3em] text-[#a3a3a3] uppercase">{match.league}</span>

            <div className="flex items-center gap-3">
              {total > 1 && (
                <div className="flex items-center gap-2 ml-2">
                  <button
                    type="button"
                    onClick={() => navigate("left")}
                    className="w-9 h-9 bg-white flex items-center justify-center text-black hover:bg-[#e5e5e5] transition-colors duration-150 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                  <span className="text-[11px] font-black tracking-[0.2em] text-[#a3a3a3] min-w-[36px] text-center">
                    {idx + 1}/{total}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("right")}
                    className="w-9 h-9 bg-white flex items-center justify-center text-black hover:bg-[#e5e5e5] transition-colors duration-150 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8 mb-10 transition-all duration-200 ${slideClass}`}>
            <div className="flex flex-col items-center gap-4">
              <TeamCrest team={match.team1} size="lg" />
              <div className="text-center">
                <p
                  className="leading-none tracking-widest text-shadow-sm"
                  style={{
                    fontSize: "clamp(40px, 6vw, 80px)",
                    fontFamily: "var(--font-heading)",
                    color: "#ffffff",
                    textShadow: "0 2px 20px rgba(255,255,255,0.05)",
                  }}
                >
                  {teamShortCode(match.team1)}
                </p>
                <p className="text-[10px] font-bold tracking-[0.25em] text-[#737373] uppercase mt-2">{teamFullName(match.team1)}</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full" fill="none">
                  <line x1="0" y1="60" x2="60" y2="0" stroke="#262626" strokeWidth="1.5" />
                  <line x1="6" y1="60" x2="60" y2="6" stroke="#262626" strokeWidth="0.5" opacity="0.4" />
                  <line x1="0" y1="54" x2="54" y2="0" stroke="#262626" strokeWidth="0.5" opacity="0.4" />
                </svg>
                <span className="relative z-10 font-gaming text-3xl sm:text-4xl font-black text-[#525252] tracking-[0.3em]">VS</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <TeamCrest team={match.team2} size="lg" />
              <div className="text-center">
                <p
                  className="leading-none tracking-widest text-shadow-sm"
                  style={{
                    fontSize: "clamp(40px, 6vw, 80px)",
                    fontFamily: "var(--font-heading)",
                    color: "#ffffff",
                    textShadow: "0 2px 20px rgba(255,255,255,0.05)",
                  }}
                >
                  {teamShortCode(match.team2)}
                </p>
                <p className="text-[10px] font-bold tracking-[0.25em] text-[#737373] uppercase mt-2">{teamFullName(match.team2)}</p>
              </div>
            </div>
          </div>

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
            <div className="flex items-center gap-3 lg:flex lg:justify-end">
              {match.status === "upcoming" && <CountdownTimer tossTime={match.toss_time} variant="hero" />}
            </div>
          </div>
        </div>
      </div>

      {match.status !== "upcoming" && (
        <MatchScoreboard key={match.id} matchId={match.id} matchStatus={match.status} cricapiId={match.cricapi_id} />
      )}

      <MatchInteraction
        matchId={match.id}
        team1={match.team1}
        team2={match.team2}
        tossTime={match.toss_time}
        startTime={match.start_time}
        matchStatus={match.status}
      />

      <MatchToss matchId={match.id} team1={match.team1} team2={match.team2} tossTime={match.toss_time} />
      <FirstInningsScore matchId={match.id} startTime={match.start_time} />

      {crowd && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-[3px] h-5 bg-white" />
            <span className="text-[#a3a3a3] tracking-[0.25em] text-[13px] font-gaming uppercase">Analysis</span>
            <div className="h-px flex-1 bg-[#262626]" />
          </div>
          <CrowdPredictionCard
            crowd={crowd as Parameters<typeof CrowdPredictionCard>[0]["crowd"]}
            team1={match.team1}
            team2={match.team2}
          />
        </div>
      )}
    </div>
  );
}
