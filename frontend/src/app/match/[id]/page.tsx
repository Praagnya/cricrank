"use client";

import { useEffect, useState, use, useCallback } from "react";
import { api } from "@/lib/api";
import { Match, MatchLive, MatchScorecard, ScoreEntry } from "@/types";
import Header from "@/components/Header";
import TeamCrest from "@/components/TeamCrest";
import Scorecard from "@/components/Scorecard";
import { teamShortCode, teamHex } from "@/lib/utils";
import { MapPin, ArrowLeft } from "lucide-react";
import Link from "next/link";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [match, setMatch] = useState<Match | null>(null);
  const [scorecard, setScorecard] = useState<MatchScorecard | null>(null);
  const [live, setLive] = useState<MatchLive | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchScorecard = useCallback(async () => {
    const sc = await api.matches.scorecard(id).catch(() => null);
    setScorecard(sc);
  }, [id]);

  const fetchLive = useCallback(async () => {
    const l = await api.matches.live(id).catch(() => null);
    setLive(l);
  }, [id]);

  useEffect(() => {
    Promise.all([
      api.matches.get(id).catch(() => null),
      api.matches.scorecard(id).catch(() => null),
      api.matches.live(id).catch(() => null),
    ]).then(([m, sc, lv]) => {
      setMatch(m);
      setScorecard(sc);
      setLive(lv);
      setLoading(false);
    });
  }, [id]);

  // Poll /live often for innings totals; /scorecard less often for detailed tables
  useEffect(() => {
    if (!match || match.status !== "live") return;
    const liveIv = setInterval(fetchLive, 30000);
    const scIv = setInterval(fetchScorecard, 60000);
    return () => {
      clearInterval(liveIv);
      clearInterval(scIv);
    };
  }, [match, fetchLive, fetchScorecard]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="flex flex-col gap-4">
            <div className="h-8 w-48 bg-[#111111] animate-pulse" />
            <div className="h-48 bg-[#111111] animate-pulse" />
            <div className="h-96 bg-[#111111] animate-pulse" />
          </div>
        </main>
      </>
    );
  }

  if (!match) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-[#525252]">Match not found</p>
        </main>
      </>
    );
  }

  const t1hex = teamHex(match.team1);
  const t2hex = teamHex(match.team2);

  /** Innings totals: prefer /live (works when match_scorecard is empty). */
  const summaryScore: ScoreEntry[] =
    live?.score?.length ? live.score : (scorecard?.score ?? []);
  const vsSummary =
    match.result_summary ??
    live?.result_summary ??
    live?.status_text ??
    null;

  function scoreForTeam(teamName: string): ScoreEntry | undefined {
    const lower = teamName.toLowerCase();
    return summaryScore.find((s) => s.inning.toLowerCase().startsWith(lower));
  }

  const team1Line = scoreForTeam(match.team1);
  const team2Line = scoreForTeam(match.team2);

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-20 flex flex-col gap-4">

        {/* Back */}
        <Link href="/" className="flex items-center gap-2 text-[#525252] hover:text-white transition-colors text-xs font-bold tracking-widest uppercase w-fit">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>

        {/* Match header card */}
        <div className="border border-[#262626] bg-[#000000] overflow-hidden">
          {/* Team color bar */}
          <div className="flex h-1">
            <div className="flex-1" style={{ backgroundColor: t1hex }} />
            <div className="flex-1" style={{ backgroundColor: t2hex }} />
          </div>

          <div className="px-5 py-6">
            {/* League + status */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black tracking-[0.3em] uppercase text-[#737373]">{match.league} · {match.season}</span>
              {match.status === "live" && (
                <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-[#10b981] uppercase border border-[#10b981] px-2.5 py-1">
                  <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />
                  Live
                </span>
              )}
              {match.status === "completed" && (
                <span className="text-[10px] font-black tracking-widest uppercase text-[#a3a3a3] border border-[#262626] px-2.5 py-1">Full Time</span>
              )}
            </div>

            {/* Teams + score */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              {/* Team 1 */}
              <div className="flex flex-col items-center gap-3">
                <TeamCrest team={match.team1} size="lg" />
                <div className="text-center">
                  <p className="font-gaming text-2xl sm:text-3xl font-black text-white tracking-widest">{teamShortCode(match.team1)}</p>
                  {team1Line && (
                    <p className="font-gaming text-lg font-black text-white mt-1 tabular-nums">
                      {team1Line.r}/{team1Line.w}{" "}
                      <span className="text-xs text-[#525252]">({team1Line.o})</span>
                    </p>
                  )}
                </div>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center gap-2">
                <span className="font-gaming text-xl font-black text-[#525252] tracking-[0.3em]">VS</span>
                {vsSummary && (
                  <span className="text-[10px] font-black text-black bg-white px-2.5 py-1 uppercase tracking-widest text-center max-w-[120px] leading-tight">
                    {vsSummary}
                  </span>
                )}
              </div>

              {/* Team 2 */}
              <div className="flex flex-col items-center gap-3">
                <TeamCrest team={match.team2} size="lg" />
                <div className="text-center">
                  <p className="font-gaming text-2xl sm:text-3xl font-black text-white tracking-widest">{teamShortCode(match.team2)}</p>
                  {team2Line && (
                    <p className="font-gaming text-lg font-black text-white mt-1 tabular-nums">
                      {team2Line.r}/{team2Line.w}{" "}
                      <span className="text-xs text-[#525252]">({team2Line.o})</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Venue + date */}
            <div className="mt-5 pt-4 border-t border-[#262626] flex flex-wrap items-center gap-4 text-xs text-[#525252]">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {match.venue.split(",")[0]}
              </span>
              <span>{formatDate(match.start_time)}</span>
            </div>
          </div>
        </div>

        {/* Scorecard: detailed tables from /scorecard; innings bar uses live totals when present */}
        {match.status === "upcoming" ? (
          <div className="border border-[#262626] bg-[#000000] px-6 py-10 text-center">
            <p className="text-sm text-[#525252]">Match hasn&apos;t started yet</p>
          </div>
        ) : scorecard?.scorecard?.length || summaryScore.length > 0 ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-[3px] h-5 bg-white" />
              <span className="text-[#a3a3a3] tracking-[0.25em] text-[13px] font-gaming uppercase">Scorecard</span>
              <div className="h-px flex-1 bg-[#262626]" />
            </div>
            <Scorecard
              scorecard={scorecard?.scorecard ?? []}
              score={summaryScore}
              isLive={match.status === "live"}
            />
          </div>
        ) : (
          <div className="border border-[#262626] bg-[#000000] px-6 py-10 text-center">
            <p className="text-sm text-[#525252]">Scorecard not available</p>
          </div>
        )}
      </main>
    </>
  );
}
