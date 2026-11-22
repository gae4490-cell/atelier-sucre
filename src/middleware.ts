import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rafraîchit la session Supabase et protège l'espace pâtissier.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Important : getUser() valide le jeton auprès de Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const protege = pathname.startsWith("/espace") || pathname.startsWith("/bienvenue");

  if (protege && !user) {
    const redirection = request.nextUrl.clone();
    redirection.pathname = "/connexion";
    redirection.search = `?suivant=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(redirection);
  }

  return response;
}

export const config = {
  matcher: ["/espace/:path*", "/bienvenue/:path*", "/connexion", "/inscription", "/reinitialiser-mot-de-passe"],
};
