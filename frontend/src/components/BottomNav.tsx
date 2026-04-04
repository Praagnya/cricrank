"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Handshake, User, LogIn } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function BottomNav() {
  const { user, loading, signInWithGoogle } = useUser();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.challenges.pendingCount(user.id)
      .then((r) => setPendingCount(r.count))
      .catch(() => {});
  }, [user?.id]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const tabCls = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
      active ? "text-white" : "text-[#525252] hover:text-[#a3a3a3]"
    }`;

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#000000] border-t border-[#262626] h-16 flex items-stretch safe-area-pb">
        <Link href="/" className={tabCls(isActive("/"))}>
          <Home className="w-5 h-5" strokeWidth={isActive("/") ? 2.5 : 1.5} />
          <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
        </Link>

        <Link href="/leaderboard" className={tabCls(isActive("/leaderboard"))}>
          <Trophy className="w-5 h-5" strokeWidth={isActive("/leaderboard") ? 2.5 : 1.5} />
          <span className="text-[9px] font-black uppercase tracking-widest">Ranks</span>
        </Link>

        <Link href="/challenge" className={tabCls(isActive("/challenge"))}>
          <div className="relative">
            <Handshake className="w-5 h-5" strokeWidth={isActive("/challenge") ? 2.5 : 1.5} />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] text-[8px] font-black text-white flex items-center justify-center">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Challenge</span>
        </Link>

        {!loading && user ? (
          <Link href="/profile" className={tabCls(isActive("/profile"))}>
            {user.user_metadata?.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                width={24} height={24}
                referrerPolicy="no-referrer"
                className={`rounded-full shrink-0 ${isActive("/profile") ? "ring-2 ring-white" : ""}`}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <User className="w-5 h-5" strokeWidth={isActive("/profile") ? 2.5 : 1.5} />
            )}
            <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
          </Link>
        ) : !loading && !user ? (
          <button onClick={signInWithGoogle} className={tabCls(false)}>
            <LogIn className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[9px] font-black uppercase tracking-widest">Sign In</span>
          </button>
        ) : (
          <div className={`${tabCls(false)} pointer-events-none opacity-30`}>
            <User className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
          </div>
        )}
      </nav>

    </>
  );
}
