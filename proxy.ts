import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, COOKIE, verify } from "@/lib/auth";

// Optimistic page gate. /api/* is excluded: /api/ask checks the cookie in Python; the rest is public cached data.
export function proxy(req: NextRequest) {
  if (!authEnabled() || verify(req.cookies.get(COOKIE)?.value)) return;
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!api|login|_next/static|_next/image|.*\\.[\\w]+$).*)"] };
