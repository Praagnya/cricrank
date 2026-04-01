"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Coins, Sparkles, X } from "lucide-react";

type Props = {
  amount: number;
  onDismiss: () => void;
};

/**
 * Full-screen-adjacent celebration when daily login coins are awarded.
 */
export default function CoinRewardToast({ amount, onDismiss }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = requestAnimationFrame(() => setVisible(true));
    const auto = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(onDismiss, 400);
    }, 5200);
    return () => {
      cancelAnimationFrame(t);
      clearTimeout(auto);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss once on mount
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-x-4 bottom-24 z-[10001] md:left-auto md:right-6 md:max-w-md md:mx-0 mx-auto transition-all duration-500 ease-out ${
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className="relative overflow-hidden rounded-sm border-2 border-[#fbbf24] bg-[#0a0a0a] px-5 py-4 shadow-[0_0_40px_rgba(251,191,36,0.25)]"
        style={{ boxShadow: "0 0 0 1px rgba(251,191,36,0.3), 0 12px 48px rgba(0,0,0,0.8)" }}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#fbbf24]/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-[#fbbf24]/5 blur-xl" />

        <button
          type="button"
          onClick={() => {
            setVisible(false);
            window.setTimeout(onDismiss, 400);
          }}
          className="absolute right-2 top-2 p-1.5 text-[#525252] hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 pr-6">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border border-[#fbbf24]/40 bg-[#fbbf24]/10">
            <Coins className="h-7 w-7 text-[#fbbf24]" strokeWidth={1.5} />
            <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-[#fde68a] animate-pulse" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[10px] font-black tracking-[0.35em] text-[#fbbf24] uppercase mb-1">Daily bonus</p>
            <p className="font-gaming text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight">
              +{amount.toLocaleString()}
              <span className="text-lg sm:text-xl font-bold text-[#fbbf24] ml-1.5">coins</span>
            </p>
            <p className="text-xs text-[#737373] mt-2 leading-snug">
              Come back tomorrow for another shot at bonus coins.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
