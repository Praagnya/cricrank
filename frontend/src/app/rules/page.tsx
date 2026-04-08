"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const TIERS = [
  { name: "God Mode", streak: "14+", multiplier: "x10" },
  { name: "Immortal", streak: "7+", multiplier: "x5" },
  { name: "Five-fer", streak: "5+", multiplier: "x3" },
  { name: "Hat-trick", streak: "3+", multiplier: "x2" },
  { name: "In Form", streak: "2+", multiplier: "x1.5" },
  { name: "Debutant", streak: "0+", multiplier: "x1" },
];

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#737373] hover:text-white transition-colors mb-6 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Back</span>
        </Link>

        <section className="border border-[#262626] bg-[#000000] p-5 sm:p-7">
          <h1 className="font-gaming text-xl sm:text-2xl tracking-[0.2em] uppercase mb-2">Game Rules</h1>
          <p className="text-[#a3a3a3] text-sm">
            Predict match winners, build streaks, and use coins in side games. Scoring settles only after official result.
          </p>
        </section>

        <section className="mt-4 border border-[#7f1d1d] bg-[#200808] p-5 sm:p-7">
          <h2 className="text-[11px] font-black tracking-[0.28em] uppercase text-[#fca5a5] mb-3">Fair Play Policy</h2>
          <p className="text-sm text-[#fecaca] leading-relaxed">
            This is a skill-based prediction game. <span className="font-black">No real money is involved</span> and CricRank does not promote gambling.
            Coins are in-app points only and cannot be withdrawn as cash.
          </p>
        </section>

        <section className="mt-4 border border-[#262626] bg-[#000000] p-5 sm:p-7">
          <h2 className="text-[10px] font-black tracking-[0.3em] text-[#737373] uppercase flex items-center gap-2 mb-4">
            Scoring Rules
          </h2>
          <div className="flex flex-col gap-0 border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="flex items-center justify-between py-2.5 px-3 border-b border-[#111111]">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-[#e5e5e5]">Correct Pick (Pre-Toss)</span>
              <span className="text-[13px] font-black text-white bg-[#111111] px-2 py-0.5 border border-[#2a2a2a]">x1</span>
            </div>
            <div className="flex items-center justify-between py-2.5 px-3 border-b border-[#111111]">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-[#f59e0b]">Correct Pick (Post-Toss)</span>
              <span className="text-[13px] font-black text-[#f59e0b] bg-[#111111] px-2 py-0.5 border border-[#2a2a2a]">x0.5</span>
            </div>
            <div className="flex items-center justify-between py-2.5 px-3 border-b border-[#111111]">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-[#d4d4d4]">Wrong Pick</span>
              <span className="text-[13px] font-black text-[#ef4444] bg-[#111111] px-2 py-0.5 border border-[#2a2a2a]">0 pts</span>
            </div>
            <div className="flex items-center justify-between py-2.5 px-3">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-[#d4d4d4]">No Result / Abandoned / Tie</span>
              <span className="text-[13px] font-black text-[#a3a3a3] bg-[#111111] px-2 py-0.5 border border-[#2a2a2a]">Not Scored</span>
            </div>
          </div>
          <p className="text-[11px] text-[#737373] mt-3">Winner picks lock at toss time.</p>
        </section>

        <section className="mt-4 border border-[#262626] bg-[#000000] p-5 sm:p-7">
          <h2 className="text-[10px] font-black tracking-[0.3em] text-[#737373] uppercase flex items-center gap-2 mb-4">
            Streak Tiers
          </h2>
          <div className="flex flex-col gap-1.5">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="grid grid-cols-[135px_1fr_55px] sm:grid-cols-[180px_1fr_55px] items-center gap-3 py-1.5 border-b border-[#111111] last:border-0 hover:bg-[#111111] transition-colors -mx-3 px-3 rounded-md"
              >
                <span className="text-xs font-black uppercase tracking-[0.15em] text-[#e5e5e5] truncate">{tier.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#c8c8c8] text-right w-6">{tier.streak}</span>
                  <span className="text-[9px] uppercase font-bold text-[#525252] tracking-widest mt-0.5">streak</span>
                </div>
                <span className="text-[13px] font-black text-[#ffffff] text-center bg-[#111111] px-1.5 py-0.5 border border-[#2a2a2a] rounded">
                  {tier.multiplier}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 border border-[#262626] bg-[#000000] p-5 sm:p-7">
          <h2 className="text-[10px] font-black tracking-[0.3em] text-[#737373] uppercase flex items-center gap-2 mb-4">
            Coin Games
          </h2>
          <div className="flex flex-col gap-0 border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="py-2.5 px-3 border-b border-[#111111]">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#e5e5e5]">Toss Pick</p>
              <p className="text-[11px] text-[#a3a3a3] mt-1">One pick per match. Minimum stake is 50 coins.</p>
              <p className="text-[11px] text-[#a3a3a3]">Correct = stake back + equal win. Wrong = stake lost.</p>
            </div>
            <div className="py-2.5 px-3">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#e5e5e5]">First Innings Score</p>
              <p className="text-[11px] text-[#a3a3a3] mt-1">One entry per match. Entry cost is 100 coins.</p>
              <p className="text-[11px] text-[#a3a3a3]">Closer to actual score gives higher reward (within 20 runs), up to +5000 net gain for exact score.</p>
            </div>
          </div>
        </section>

        <section className="mt-4 border border-[#262626] bg-[#000000] p-5 sm:p-7">
          <h2 className="text-[10px] font-black tracking-[0.3em] text-[#737373] uppercase flex items-center gap-2 mb-4">
            Daily & Referral
          </h2>
          <ul className="space-y-2 text-sm text-[#d4d4d4]">
            <li>Daily login bonus is awarded once per day (IST).</li>
            <li>Referral bonus is awarded to inviter when a new user signs up with their code.</li>
            <li>All coin credits/debits are tracked by an idempotent ledger for consistency.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
