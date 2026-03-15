import { NextRequest, NextResponse } from "next/server";

import { Profile, UserRole } from "@/lib/types";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_ROUTES = ["/login", "/doctor-review", "/doctor-storyboard-review"];

const HOME_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  ops: "/dashboard",
  supervisor: "/supervisor/dashboard",
};

function homeFor(role: UserRole) {
  return HOME_BY_ROLE[role] ?? "/login";
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { supabase, response } = await updateSession(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const home = homeFor(profile.role);

  if (pathname === "/" || pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (profile.role === "ops") {
    if (pathname.startsWith("/admin") || pathname.startsWith("/supervisor")) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  if (profile.role === "supervisor") {
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/requests")
    ) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  if (profile.role === "admin") {
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/requests") ||
      pathname.startsWith("/supervisor")
    ) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
