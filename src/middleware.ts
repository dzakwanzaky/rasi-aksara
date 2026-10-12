import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configProblem, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// Refreshes the Supabase session cookie and sends signed-out visitors to /login.
export async function middleware(request: NextRequest) {
  const isPublic = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/setup");
  if (configProblem()) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  } catch (e) {
    console.error("Supabase session check failed", e);
    if (!isPublic) return NextResponse.redirect(new URL("/setup", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
