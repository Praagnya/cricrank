"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Bug, X } from "lucide-react";
import { useUser } from "@/hooks/useUser";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_BUG_REPORT_EMAIL?.trim() || "n.praagnya@gmail.com";

function BugReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user } = useUser();
  const [message, setMessage] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  function sendMail() {
    const trimmed = message.trim() || "(no details)";
    const lines = [
      trimmed,
      "",
      "---",
      `Page: ${typeof window !== "undefined" ? window.location.origin : ""}${pathname}`,
      user?.email ? `Account: ${user.email}` : "Account: not signed in",
      typeof navigator !== "undefined" ? `UA: ${navigator.userAgent}` : "",
    ];
    const subject = encodeURIComponent("CricRank — Bug / feedback");
    const body = encodeURIComponent(lines.filter(Boolean).join("\n"));
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    onClose();
    setMessage("");
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector("textarea")?.focus();
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md border border-[#262626] bg-[#0a0a0a] shadow-2xl sm:rounded-sm"
      >
        <div className="flex items-center justify-between border-b border-[#262626] px-4 py-3">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-[#737373]" strokeWidth={1.5} />
            <h2 id={titleId} className="font-gaming text-xs font-black uppercase tracking-[0.2em] text-white">
              Report a bug
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border border-[#262626] text-[#737373] hover:text-white hover:border-[#404040]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#525252]">
            What went wrong? We&apos;ll open your email app with this note prefilled.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="e.g. Toss result didn’t update, button froze on…"
            className="w-full resize-y border border-[#262626] bg-black px-3 py-2 text-sm text-white placeholder:text-[#404040] focus:border-[#404040] focus:outline-none"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="border border-[#262626] px-4 py-2.5 font-gaming text-[10px] font-black uppercase tracking-widest text-[#a3a3a3] hover:border-[#404040] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={sendMail}
              className="border border-white bg-white px-4 py-2.5 font-gaming text-[10px] font-black uppercase tracking-widest text-black hover:bg-[#e5e5e5]"
            >
              Open email
            </button>
          </div>
          <p className="text-[9px] text-[#404040] font-bold uppercase tracking-wider">
            To: {SUPPORT_EMAIL}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Floating action — mobile only, sits above bottom nav */
export function BugReportFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-[4.75rem] right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[#262626] bg-[#050505] text-[#737373] shadow-[0_4px_24px_rgba(0,0,0,0.6)] hover:border-[#404040] hover:text-white active:scale-95 transition-transform"
        aria-label="Report a bug"
      >
        <Bug className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <BugReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Inline control for desktop footer */
export function BugReportFooterLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-bold tracking-widest uppercase text-[#737373] hover:text-white transition-colors underline-offset-4 hover:underline"
      >
        Report a bug
      </button>
      <BugReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
