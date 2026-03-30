"use client";

import { use } from "react";
import Header from "@/components/Header";
import ProfileView from "@/components/ProfileView";

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <Header />
      <ProfileView userId={unwrappedParams.id} />
    </div>
  );
}
