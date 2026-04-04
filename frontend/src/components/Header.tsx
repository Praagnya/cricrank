"use client";

import Link from "next/link";
import { LogOut, LogIn, Zap, Menu, X, Coins } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getApiBaseUrl } from "@/lib/api-base";
import CoinRewardToast from "@/components/CoinRewardToast";
import CoinToast from "@/components/CoinToast";
import { coinSyncStorageKey, istCalendarDateKey } from "@/lib/utils";

export default function Header() {
  const { user, loading, signInWithGoogle, signOut } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [coins, setCoins] = useState<number | null>(null);
  const [coinReward, setCoinReward] = useState<number | null>(null);
  const dismissReward = useCallback(() => setCoinReward(null), []);
  const syncBusy = useRef(false);

  useEffect(() => {
    if (!user) {
      setCoins(null);
      return;
    }

    const base = getApiBaseUrl();
    const body = JSON.stringify({
      google_id: user.id,
      name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Anonymous",
      email: user.email ?? "",
      avatar_url: user.user_metadata?.avatar_url ?? null,
    });

    // Capture ?ref= param from URL and persist to localStorage
    if (typeof window !== "undefined") {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) localStorage.setItem("cricrank_pending_ref", ref);
    }

    const syncCoins = async () => {
      if (syncBusy.current) return;
      syncBusy.current = true;
      try {
        const today = istCalendarDateKey();
        const syncKey = coinSyncStorageKey(user.id);
        const last = typeof window !== "undefined" ? localStorage.getItem(syncKey) : null;

        if (last !== today) {
          const pendingRef = typeof window !== "undefined" ? localStorage.getItem("cricrank_pending_ref") : null;
          const bodyWithRef = pendingRef
            ? JSON.stringify({ ...JSON.parse(body), ref_code: pendingRef })
            : body;
          const res = await fetch(`${base}/users/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyWithRef,
          });
          if (!res.ok) return;
          const data = await res.json();
          localStorage.setItem(syncKey, today);
          localStorage.removeItem("cricrank_pending_ref");
          if (typeof data.coins === "number") setCoins(data.coins);
          if (data.daily_login_coins_awarded > 0) {
            setCoinReward(data.daily_login_coins_awarded);
          }
        } else {
          const res = await fetch(`${base}/users/${user.id}`);
          if (res.ok) {
            const data = await res.json();
            if (typeof data.coins === "number") setCoins(data.coins);
          }
        }
      } catch {
        /* ignore */
      } finally {
        syncBusy.current = false;
      }
    };

    syncCoins();

    const onVis = () => {
      if (document.visibilityState !== "visible" || !user) return;
      const today = istCalendarDateKey();
      if (localStorage.getItem(coinSyncStorageKey(user.id)) !== today) {
        syncCoins();
      }
    };
    const onCoinsRefresh = () => {
      fetch(`${base}/users/${user.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { coins?: number } | null) => {
          if (data && typeof data.coins === "number") setCoins(data.coins);
        })
        .catch(() => {});
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("cricrank-coins-refresh", onCoinsRefresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("cricrank-coins-refresh", onCoinsRefresh);
    };
  }, [user?.id]);

  const btn = "flex items-center justify-center border border-[#262626] bg-[#0a0a0a] hover:bg-[#1a1a1a] transition-colors text-white";

  return (
    <>
      {coinReward !== null && coinReward > 0 && (
        <CoinRewardToast amount={coinReward} onDismiss={dismissReward} />
      )}
      <CoinToast />
      <header className="sticky top-0 z-50 bg-[#000000] border-b border-[#262626] select-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-[56px] grid grid-cols-3 items-center">

          {/* LEFT — hamburger */}
          <div className="flex items-center">
            <button className={`${btn} w-10 h-10`} onClick={() => setMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* CENTER — CricRank */}
          <div className="flex justify-center">
            <Link href="/" className="flex items-center gap-2 group">
              <Zap className="w-5 h-5 text-white group-hover:text-[#a3a3a3] transition-colors shrink-0" strokeWidth={1.5} />
              <span
                className="tracking-widest text-white group-hover:text-[#a3a3a3] transition-colors"
                style={{ fontFamily: "var(--font-heading)", fontSize: "32px", lineHeight: 1 }}
              >
                CricRank
              </span>
            </Link>
          </div>

          {/* RIGHT — coins (mobile) + coins + avatar (desktop) */}
          <div className="flex items-center justify-end gap-2">
            {!loading && user && coins !== null && (
              <Link href="/profile" className="flex items-center gap-2 px-1 group">
                <Coins className="w-5 h-5 text-[#fbbf24] shrink-0 group-hover:text-[#fde68a] transition-colors" strokeWidth={1.5} />
                <span className="font-gaming text-base font-black text-[#fbbf24] tabular-nums group-hover:text-[#fde68a] transition-colors">
                  {coins.toLocaleString()}
                </span>
              </Link>
            )}

            {/* Avatar dropdown — desktop only */}
            {!loading && user ? (
              <div className="relative hidden lg:block">
                <button onClick={() => setUserMenuOpen((v) => !v)} className={`${btn} w-10 h-10`}>
                  {user.user_metadata?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={user.user_metadata?.full_name ?? "User"}
                      width={28} height={28}
                      referrerPolicy="no-referrer"
                      className="rounded-full shrink-0"
                    />
                  ) : (
                    <span className="text-sm font-bold">
                      {user.user_metadata?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "U"}
                    </span>
                  )}
                </button>
                {userMenuOpen && createPortal(
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setUserMenuOpen(false)} />
                    <div className="fixed right-0 w-44 bg-[#0a0a0a] border border-[#262626] shadow-2xl z-[9999]" style={{ top: '56px' }}>
                      <Link href="/profile" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a] transition-colors">
                        <Zap className="w-3.5 h-3.5 shrink-0" />My Profile
                      </Link>
                      <div className="border-t border-[#1a1a1a]" />
                      <button onClick={() => { setUserMenuOpen(false); signOut(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#a3a3a3] hover:text-[#ef4444] hover:bg-[#1a1a1a] transition-colors">
                        <LogOut className="w-3.5 h-3.5 shrink-0" />Sign Out
                      </button>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            ) : !loading && !user ? (
              <button onClick={signInWithGoogle} className={`${btn} hidden lg:flex gap-2 h-10 px-3 text-xs font-bold uppercase tracking-widest`}>
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Navigation Drawer — all viewports */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative w-[280px] h-full bg-[#000000] border-r border-[#262626] flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="h-[56px] flex items-center justify-between px-6 border-b border-[#262626] bg-[#050505]">
              <span className="font-gaming text-xl tracking-widest uppercase text-white">Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-[#111] hover:bg-[#1a1a1a] border border-[#262626] text-[#a3a3a3] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex flex-col py-6 px-4 gap-3 flex-1 overflow-y-auto">
              {!loading && user && (
                <div className="flex items-center gap-3 p-4 mb-2 border border-[#262626] bg-[#0a0a0a]">
                  {user.user_metadata?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={user.user_metadata.avatar_url} alt="Profile" className="w-10 h-10 object-cover rounded-full grayscale border border-[#333]" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#1f1f1f] flex items-center justify-center text-lg font-bold text-white border border-[#333]">
                      {user.user_metadata?.full_name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-white truncate">{user.user_metadata?.full_name ?? "Player"}</span>
                    <span className="text-[10px] text-[#525252] tracking-widest uppercase font-black">Logged In</span>
                  </div>
                </div>
              )}

              {[
                { href: "/", label: "Home" },
                { href: "/leaderboard", label: "Leaderboard" },
                { href: "/challenge", label: "Challenge" },
                ...(user ? [{ href: "/profile", label: "My Profile" }] : []),
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-4 px-4 py-4 border border-[#262626] bg-[#050505] text-[#a3a3a3] hover:bg-[#111111] hover:text-white transition-all"
                >
                  <span className="font-gaming tracking-widest text-sm">{label}</span>
                </Link>
              ))}

              <div className="mt-auto pt-4">
                {!loading && !user ? (
                  <button onClick={() => { setMenuOpen(false); signInWithGoogle(); }} className="w-full flex justify-center items-center gap-3 px-4 py-4 border border-[#262626] bg-white text-black hover:bg-[#e6e6e6] transition-all">
                    <LogIn className="w-4 h-4" />
                    <span className="font-gaming tracking-widest text-xs">Sign In / Register</span>
                  </button>
                ) : !loading && user ? (
                  <button onClick={() => { setMenuOpen(false); signOut(); }} className="w-full flex justify-center items-center gap-3 px-4 py-4 border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-all">
                    <LogOut className="w-4 h-4" />
                    <span className="font-gaming tracking-widest text-xs">Sign Out</span>
                  </button>
                ) : null}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
