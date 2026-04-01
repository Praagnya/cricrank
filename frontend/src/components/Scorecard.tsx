"use client";

import { useState } from "react";
import { ScorecardInnings, ScoreEntry } from "@/types";
import { teamShortCode } from "@/lib/utils";

function parseInningTeam(inning: string): string {
  return inning.replace(/ Inning \d+$/i, "").trim();
}

function formatOvers(o: number): string {
  return `${o} ov`;
}

function BattingTable({ innings }: { innings: ScorecardInnings }) {
  return (
    <div>
      <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#737373] mb-3">Batting</p>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[520px]">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 pr-3 w-[180px]">Batsman</th>
              <th className="text-left text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 pr-3">How Out</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 px-2 w-10">R</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 px-2 w-10">B</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 px-2 w-10">4s</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 px-2 w-10">6s</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 pl-2 w-16">SR</th>
            </tr>
          </thead>
          <tbody>
            {innings.batting.map((b, i) => {
              const isBatting = b["dismissal-text"] === "batting";
              const isNotOut = b["dismissal-text"] === "not out";
              return (
                <tr key={i} className="border-b border-[#111111] last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="font-bold text-white text-xs">
                      {b.batsman.name}
                      {(isBatting || isNotOut) && (
                        <span className="ml-1.5 text-[#10b981]">*</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    {isBatting ? (
                      <span className="text-[10px] font-black tracking-widest text-[#10b981] uppercase">batting</span>
                    ) : isNotOut ? (
                      <span className="text-[10px] text-[#10b981]">not out</span>
                    ) : (
                      <span className="text-[11px] text-[#525252] truncate max-w-[160px] block">{b["dismissal-text"]}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right font-gaming font-black text-white text-sm tabular-nums">{b.r}</td>
                  <td className="py-2.5 px-2 text-right font-gaming text-[#a3a3a3] text-xs tabular-nums">{b.b}</td>
                  <td className="py-2.5 px-2 text-right font-gaming text-[#a3a3a3] text-xs tabular-nums">{b["4s"]}</td>
                  <td className="py-2.5 px-2 text-right font-gaming text-[#a3a3a3] text-xs tabular-nums">{b["6s"]}</td>
                  <td className="py-2.5 pl-2 text-right font-gaming text-[#737373] text-xs tabular-nums">{b.sr.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BowlingTable({ innings }: { innings: ScorecardInnings }) {
  return (
    <div className="mt-6">
      <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#737373] mb-3">Bowling</p>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[420px]">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 pr-3">Bowler</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 px-2 w-10">O</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 px-2 w-10">M</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 px-2 w-10">R</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 px-2 w-10">W</th>
              <th className="text-right text-[10px] font-black tracking-[0.2em] uppercase text-[#525252] pb-2 pl-2 w-16">Eco</th>
            </tr>
          </thead>
          <tbody>
            {innings.bowling.map((b, i) => (
              <tr key={i} className="border-b border-[#111111] last:border-0">
                <td className="py-2.5 pr-3">
                  <span className="font-bold text-white text-xs">{b.bowler.name}</span>
                </td>
                <td className="py-2.5 px-2 text-right font-gaming text-[#a3a3a3] text-xs tabular-nums">{b.o}</td>
                <td className="py-2.5 px-2 text-right font-gaming text-[#a3a3a3] text-xs tabular-nums">{b.m}</td>
                <td className="py-2.5 px-2 text-right font-gaming text-[#a3a3a3] text-xs tabular-nums">{b.r}</td>
                <td className="py-2.5 px-2 text-right font-gaming font-black text-white text-sm tabular-nums">{b.w}</td>
                <td className="py-2.5 pl-2 text-right font-gaming text-[#737373] text-xs tabular-nums">{b.eco.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Props {
  scorecard: ScorecardInnings[];
  score: ScoreEntry[];
  isLive?: boolean;
}

export default function Scorecard({ scorecard, score, isLive }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!scorecard.length) {
    return (
      <div className="border border-[#262626] bg-[#000000] px-6 py-10 text-center">
        <p className="text-sm text-[#525252]">Scorecard not available yet</p>
      </div>
    );
  }

  const activeInnings = scorecard[activeIdx];

  return (
    <div className="border border-[#262626] bg-[#000000]">
      {/* Innings score summary bar */}
      <div className="flex border-b border-[#262626]">
        {score.map((s, i) => {
          const teamName = parseInningTeam(s.inning);
          const short = teamShortCode(teamName);
          const isActive = i === activeIdx;
          const hasInnings = i < scorecard.length;
          return (
            <button
              key={i}
              onClick={() => hasInnings && setActiveIdx(i)}
              className={`flex-1 px-4 py-3 text-left border-r last:border-r-0 border-[#262626] transition-colors ${
                isActive ? "bg-white" : "bg-[#000000] hover:bg-[#111111]"
              } ${hasInnings ? "cursor-pointer" : "cursor-default"}`}
            >
              <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${isActive ? "text-black" : "text-[#737373]"}`}>
                {short} — Inning {i + 1}
              </p>
              <p className={`font-gaming font-black text-lg mt-0.5 tabular-nums ${isActive ? "text-black" : "text-white"}`}>
                {s.r}/{s.w}
                <span className={`text-xs font-normal ml-2 ${isActive ? "text-[#444]" : "text-[#525252]"}`}>
                  ({formatOvers(s.o)})
                </span>
              </p>
            </button>
          );
        })}

        {/* Live pulse indicator */}
        {isLive && (
          <div className="flex items-center px-4 shrink-0">
            <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-[#10b981] uppercase">
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />
              Live
            </span>
          </div>
        )}
      </div>

      {/* Active innings content */}
      <div className="px-4 sm:px-6 py-5">
        <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#525252] mb-5">
          {activeInnings.inning}
        </p>
        <BattingTable innings={activeInnings} />
        <BowlingTable innings={activeInnings} />
      </div>
    </div>
  );
}
