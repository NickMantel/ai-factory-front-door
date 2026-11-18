import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession } from "@/lib/session";

// Two gates. ACCESS_PASSWORD (optional) keeps the hosted demo private with one shared
// password. Then pages need a signed-in person, and the AI CoE pages need the CoE role.
// API routes check the person themselves, so they return JSON errors rather than redirects.
export function proxy(request: NextRequest) {
  const password = process.env.ACCESS_PASSWORD;
  if (password && !hasPassword(request, password)) {
    return new NextResponse("Password required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="AI Factory Front Door", charset="UTF-8"' },
    });
  }

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/") || pathname === "/sign-in") return NextResponse.next();

  const user = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/coe") && user.role !== "coe") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

function hasPassword(request: NextRequest, password: string) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    return decoded.slice(decoded.indexOf(":") + 1) === password;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
