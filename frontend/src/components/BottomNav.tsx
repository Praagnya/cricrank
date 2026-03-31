"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Search, User, LogIn } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useState } from "react";
import FindPlayers from "./FindPlayers";

export default function BottomNav() {
  const { user, loading, signInWithGoogle } = useUser();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

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

        <button onClick={() => setSearchOpen(true)} className={tabCls(false)}>
          <Search className="w-5 h-5" strokeWidth={1.5} />
          <span className="text-[9px] font-black uppercase tracking-widest">Find</span>
        </button>

        {!loading && user ? (
          <Link href="/profile" className={tabCls(isActive("/profile"))}>
            {user.user_metadata?.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                width={24} height={24}
                referrerPolicy="no-referrer"
                className={`rounded-full shrink-0 ${isActive("/profile") ? "ring-2 ring-white" : "opacity-60"}`}
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

      {searchOpen && <FindPlayers onClose={() => setSearchOpen(false)} />}
    </>
  );
}
