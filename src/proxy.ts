import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

// Pages accessibles sans être connecté
const PUBLIC_PATHS = ["/connexion", "/installer", "/configuration", "/api/cron", "/api/holidays"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isSupabaseConfigured()) {
    // App pas encore paramétrée : on affiche la page d'aide.
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/configuration", request.url));
  }

  let response = NextResponse.next({ request });
  const sb = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    }
    const url = new URL("/connexion", request.url);
    if (pathname !== "/") url.searchParams.set("suite", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/connexion") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, le service worker, le manifeste et les icônes
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|apple-touch-icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)",
  ],
};
