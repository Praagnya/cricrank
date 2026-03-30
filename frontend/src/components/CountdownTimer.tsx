"use client";

import { useEffect, useState } from "react";

import { Timer } from "lucide-react";

function getTimeLeft(target: string, now = Date.now()) {
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { h, m, s, total: diff };
}

export default function CountdownTimer({ tossTime, variant = "pill" }: { tossTime: string, variant?: "pill" | "hero" }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeLeft = getTimeLeft(tossTime, now);

  if (!timeLeft) return null;
  if (timeLeft.total > 24 * 3600000) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (variant === "hero") {
    return (
      <div className="flex items-center gap-3 lg:block">
        <Timer className="w-4 h-4 text-[#c8c8c8] shrink-0 lg:hidden" />
        <div className="flex flex-col gap-1 lg:items-end">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#737373] font-bold">Toss In</span>
          <div className="flex items-center gap-2 text-white">
            <span className="font-gaming text-sm lg:text-base font-bold tracking-wide tabular-nums">
              {timeLeft.h > 0 && `${pad(timeLeft.h)}:`}{pad(timeLeft.m)}:{pad(timeLeft.s)}
            </span>
            <Timer className="w-4 h-4 text-[#c8c8c8] hidden lg:block" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-[#333] bg-[#111]">
      <span className="text-[#737373] tracking-widest text-[8px] sm:text-[10px] font-black uppercase hidden sm:inline">
        Toss In
      </span>
      <span className="text-white tabular-nums font-gaming text-xs sm:text-base tracking-wide">
        {timeLeft.h > 0 && `${pad(timeLeft.h)}:`}{pad(timeLeft.m)}:{pad(timeLeft.s)}
      </span>
    </div>
  );
}
