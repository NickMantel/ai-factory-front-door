import { NextResponse, type NextRequest } from "next/server";

// Optional shared-password gate for hosted demos. When ACCESS_PASSWORD is set, every request needs
// HTTP basic auth with that password (any username). /api/health stays open for the host's health check.
export function proxy(request: NextRequest) {
  const password = process.env.ACCESS_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
    } catch {}
  }
  return new NextResponse("Password required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="AI Front Door", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
