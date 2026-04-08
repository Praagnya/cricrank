import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getApiBaseUrl } from "@/lib/api-base";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && authData?.session?.user) {
      const user = authData.session.user;
      const metadata = user.user_metadata;
      const pendingRef = cookieStore.get("cricrank_pending_ref")?.value || null;
      
      // Sync the user to our fastAPI backend
      try {
        await fetch(`${getApiBaseUrl()}/users/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            google_id: user.id,
            name: metadata?.full_name ?? user.email?.split("@")[0] ?? "Anonymous",
            email: user.email ?? "unknown@example.com",
            avatar_url: metadata?.avatar_url ?? null,
            ref_code: pendingRef,
          }),
        });
      } catch (err) {
        console.error("Failed to sync user to backend", err);
      }
      const response = NextResponse.redirect(`${origin}${next}`);
      if (pendingRef) {
        response.cookies.set("cricrank_pending_ref", "", {
          path: "/",
          maxAge: 0,
          sameSite: "lax",
        });
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
