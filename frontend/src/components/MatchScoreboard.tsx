"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { MatchLiveResponse, MatchScorecardResponse, MatchStatus } from "@/types";

type Props = {
  matchId: string;
  matchStatus: MatchStatus;
  cricapiId: string | null;
};

function formatOvers(o: unknown): string {
  if (o === null || o === undefined) return "—";
  const n = typeof o === "number" ? o : parseFloat(String(o));
  if (Number.isNaN(n)) return String(o);
  return `${n}`;
}

function formatInningsLine(row: Record<string, unknown>): string {
  const label = String(row.inning ?? "Innings");
  const r = row.r ?? row.runs ?? "—";
  const w = row.w ?? row.wickets ?? "—";
  const ov = formatOvers(row.o ?? row.overs);
  return `${label}  ${r}/${w} (${ov} ov)`;
}

function playerName(node: unknown): string {
  if (node && typeof node === "object" && "name" in node && typeof (node as { name: unknown }).name === "string") {
    return (node as { name: string }).name;
  }
  return "—";
}

export default function MatchScoreboard({ matchId, matchStatus, cricapiId }: Props) {
  const [live, setLive] = useState<MatchLiveResponse | null>(null);
  const [liveErr, setLiveErr] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<MatchScorecardResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState(false);

  const loadLive = useCallback(() => {
    if (!cricapiId) return;
    api.matches
      .live(matchId)
      .then((d) => {
        setLive(d);
        setLiveErr(false);
      })
      .catch(() => setLiveErr(true));
  }, [matchId, cricapiId]);

  useEffect(() => {
    if (!cricapiId) return;
    loadLive();
    const intervalMs = matchStatus === "live" ? 60_000 : matchStatus === "upcoming" ? 120_000 : 0;
    if (!intervalMs) return;
    const id = setInterval(loadLive, intervalMs);
    return () => clearInterval(id);
  }, [matchId, matchStatus, cricapiId, loadLive]);

  const loadDetail = useCallback(() => {
    if (!cricapiId) return;
    setDetailLoading(true);
    setDetailErr(false);
    api.matches
      .scorecard(matchId)
      .then((d) => {
        setDetail(d);
      })
      .catch(() => setDetailErr(true))
      .finally(() => setDetailLoading(false));
  }, [matchId, cricapiId]);

  useEffect(() => {
    if (!expanded || detail || detailLoading) return;
    if (detailErr) return;
    loadDetail();
  }, [expanded, detail, detailLoading, detailErr, loadDetail]);

  if (!cricapiId) return null;

  const loadingLive = !live && !liveErr;
  const scores = live?.score ?? [];
  const statusLine = live?.status_text?.trim();
  const hasSummary = scores.length > 0 || Boolean(statusLine);

  if (loadingLive) {
    return (
      <div className="border border-[#262626] bg-[#0a0a0a] px-6 py-4">
        <div className="h-3 w-40 bg-[#262626] rounded animate-pulse" aria-hidden />
        <span className="sr-only">Loading match score</span>
      </div>
    );
  }

  if (liveErr || (!hasSummary && matchStatus === "upcoming")) {
    return null;
  }

  const scorecardRows = detail?.scorecard ?? [];
  const hasBattingTables = scorecardRows.some((inn) => {
    const batting = (inn as { batting?: unknown[] }).batting;
    return Array.isArray(batting) && batting.length > 0;
  });

  return (
    <div className="border border-[#262626] bg-[#0a0a0a]">
      <div className="px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-5 bg-white shrink-0" />
          <span className="text-[#a3a3a3] tracking-[0.25em] text-[11px] font-gaming uppercase">Score</span>
          {matchStatus === "live" && !live?.match_ended && (
            <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-500/90 uppercase">Live</span>
          )}
        </div>
        {statusLine ? (
          <p className="text-sm text-[#e5e5e5] font-gaming tracking-wide leading-snug">{statusLine}</p>
        ) : null}
        {scores.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {scores.map((row, i) => (
              <li key={i} className="font-gaming text-sm text-white tracking-wide">
                {formatInningsLine(row as Record<string, unknown>)}
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setExpanded((prev) => {
              const next = !prev;
              if (next && detailErr) {
                setDetailErr(false);
                setDetail(null);
              }
              return next;
            });
          }}
          className="flex items-center gap-2 text-left text-[11px] font-bold tracking-[0.2em] uppercase text-[#737373] hover:text-[#a3a3a3] transition-colors mt-1 cursor-pointer"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Full scorecard
        </button>

        {expanded && (
          <div className="pt-2 border-t border-[#262626] space-y-4">
            {detailLoading && <p className="text-[11px] text-[#737373] tracking-widest uppercase">Loading…</p>}
            {detailErr && (
              <p className="text-[11px] text-[#737373] tracking-wide">
                Batting details are not available for this match yet.
              </p>
            )}
            {!detailLoading && !detailErr && !hasBattingTables && (
              <p className="text-[11px] text-[#737373] tracking-wide">
                No detailed batting card yet — line scores above are updated from the feed.
              </p>
            )}
            {scorecardRows.map((inn, idx) => {
              const batting = (inn as { batting?: Record<string, unknown>[] }).batting ?? [];
              if (!batting.length) return null;
              return (
                <div key={idx}>
                  <p className="text-[10px] font-black tracking-[0.2em] text-[#525252] uppercase mb-2">
                    Innings {idx + 1}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px] font-gaming border-collapse">
                      <thead>
                        <tr className="text-[#737373] border-b border-[#262626]">
                          <th className="py-2 pr-3 font-bold tracking-wide">Batter</th>
                          <th className="py-2 pr-2 font-bold text-right">R</th>
                          <th className="py-2 pr-2 font-bold text-right">B</th>
                          <th className="py-2 font-bold">How out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batting.map((b, j) => (
                          <tr key={j} className="border-b border-[#1a1a1a] text-[#d4d4d4]">
                            <td className="py-2 pr-3">{playerName(b.batsman)}</td>
                            <td className="py-2 pr-2 text-right tabular-nums">{String(b.r ?? "—")}</td>
                            <td className="py-2 pr-2 text-right tabular-nums">{String(b.b ?? "—")}</td>
                            <td className="py-2 text-[#a3a3a3] max-w-[200px] truncate" title={String(b.dismissal ?? "")}>
                              {String(b.dismissal ?? "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
