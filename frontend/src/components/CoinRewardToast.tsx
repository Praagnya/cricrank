"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Coins, Sparkles, X } from "lucide-react";

type Props = {
  amount: number;
  onDismiss: () => void;
};

/**
 * Celebration when daily login coins are awarded — motion + count-up so it’s hard to miss.
 */
export default function CoinRewardToast({ amount, onDismiss }: Props) {
  const [mounted, setMounted] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || amount <= 0) return;
    const duration = 700;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplayAmount(Math.round(eased * amount));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mounted, amount]);

  useEffect(() => {
    const auto = window.setTimeout(() => {
      onDismiss();
    }, 5800);
    return () => clearTimeout(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => onDismiss();

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className="coin-reward-backdrop fixed inset-0 z-[10000] cursor-default bg-black/55 backdrop-blur-[2px]"
        aria-hidden
        onClick={close}
      />
      <div
        className="fixed inset-x-4 bottom-24 z-[10001] md:left-auto md:right-6 md:max-w-md md:mx-0 mx-auto"
        role="status"
        aria-live="polite"
      >
        <div className="coin-reward-pop relative overflow-hidden rounded-sm border-2 border-[#fbbf24] bg-[#0a0a0a] px-5 py-4">
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden
          >
            <div
              className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              style={{
                animation: "coin-shine-sweep 1.1s ease-out 0.15s forwards",
              }}
            />
          </div>

          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#fbbf24]/15 blur-2xl" />
          <div className="pointer-events-none absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-[#fbbf24]/8 blur-xl" />

          <button
            type="button"
            onClick={close}
            className="absolute right-2 top-2 z-10 p-1.5 text-[#525252] hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative flex items-start gap-4 pr-6">
            <div
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border border-[#fbbf24]/40 bg-[#fbbf24]/10"
              style={{ animation: "coin-icon-bounce 0.9s ease-out 0.1s both" }}
            >
              <Coins className="h-7 w-7 text-[#fbbf24]" strokeWidth={1.5} />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-[#fde68a]" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[10px] font-black tracking-[0.35em] text-[#fbbf24] uppercase mb-1">
                Daily bonus
              </p>
              <p className="font-gaming text-3xl sm:text-4xl font-black tabular-nums tracking-tight">
                <span className="text-white">+</span>
                <span className="text-white inline-block min-w-[2ch]">
                  {displayAmount.toLocaleString()}
                </span>
                <span className="text-lg sm:text-xl font-bold text-[#fbbf24] ml-1.5">coins</span>
              </p>
              <p className="text-xs text-[#737373] mt-2 leading-snug">
                Come back tomorrow for another shot at bonus coins.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
