"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ToastItem = { id: number; amount: number; type: "credit" | "debit" };

const CoinDot = () => (
  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#fbbf24] border border-[#92400e] align-middle mb-[1px] shrink-0" />
);

export default function CoinToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { amount, type } = (e as CustomEvent<{ amount: number; type: "credit" | "debit" }>).detail;
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, amount, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2400);
    };
    window.addEventListener("cricrank-coin-toast", handler);
    return () => window.removeEventListener("cricrank-coin-toast", handler);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed top-[64px] left-1/2 -translate-x-1/2 z-[9990] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="coin-toast flex items-center gap-1.5 px-4 py-2 border bg-[#0a0a0a] font-gaming text-base font-black tracking-wider"
          style={t.type === "credit"
            ? { borderColor: "#fbbf24", color: "#fbbf24" }
            : { borderColor: "#525252", color: "#737373" }
          }
        >
          {t.type === "credit" ? "+" : "−"}
          <CoinDot />
          {t.amount.toLocaleString()}
        </div>
      ))}
    </div>,
    document.body
  );
}
