"use client";

import { use } from "react";
import Header from "@/components/Header";
import ProfileView from "@/components/ProfileView";
import { useUser } from "@/hooks/useUser";

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <Header />
      <ProfileView userId={unwrappedParams.id} currentUserId={user?.id ?? null} />
    </div>
  );
}
