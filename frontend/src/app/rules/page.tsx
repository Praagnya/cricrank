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

        <section className="mt-4 border border-[#262626] bg-[#000000] p-5 sm:p-7">
          <h2 className="text-[11px] font-black tracking-[0.28em] uppercase text-[#737373] mb-4">Winner Prediction</h2>
          <ul className="space-y-2 text-sm text-[#d4d4d4]">
            <li>Pick Team 1 or Team 2 before toss lock time.</li>
            <li>Correct pick gives base points multiplied by your current streak tier.</li>
            <li>If the pick was after toss, points are halved (post-toss multiplier: x0.5).</li>
            <li>Wrong pick breaks streak; no-result/abandoned/tie does not score either side.</li>
          </ul>
        </section>

        <section className="mt-4 border border-[#262626] bg-[#000000] p-5 sm:p-7">
          <h2 className="text-[11px] font-black tracking-[0.28em] uppercase text-[#737373] mb-4">Streak Tiers</h2>
          <div className="grid gap-2">
            {TIERS.map((tier) => (
              <div key={tier.name} className="flex items-center justify-between border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2">
                <span className="font-gaming text-sm tracking-wide">{tier.name}</span>
                <span className="text-xs font-black tracking-[0.2em] uppercase text-[#a3a3a3]">
                  {tier.streak} streak · {tier.multiplier}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 border border-[#262626] bg-[#000000] p-5 sm:p-7">
          <h2 className="text-[11px] font-black tracking-[0.28em] uppercase text-[#737373] mb-4">Coin Games</h2>
          <ul className="space-y-2 text-sm text-[#d4d4d4]">
            <li><strong>Toss Pick:</strong> one pick per match, minimum stake 50 coins.</li>
            <li>If toss pick is correct, you receive stake return + same amount as win; else stake is lost.</li>
            <li><strong>First Innings Score:</strong> one entry per match, entry cost 100 coins.</li>
            <li>Reward slides by closeness to actual score (within 20 runs), up to +5000 net gain for exact match.</li>
          </ul>
        </section>

        <section className="mt-4 border border-[#262626] bg-[#000000] p-5 sm:p-7">
          <h2 className="text-[11px] font-black tracking-[0.28em] uppercase text-[#737373] mb-4">Daily & Referral</h2>
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
