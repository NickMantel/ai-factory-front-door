import { connection } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/access";
import { recordSignIn } from "@/lib/db";
import { BUSINESS_UNITS } from "@/lib/rubric";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  coeAllowlist,
  encodeSession,
  mayBeCoE,
  normaliseEmail,
  type User,
} from "@/lib/session";

export async function GET() {
  await connection();
  return Response.json({ user: await currentUser(), coeOpen: !coeAllowlist() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<User>;
  const email = normaliseEmail(body.email ?? "");
  const name = body.name?.trim() ?? "";
  const role = body.role === "coe" ? "coe" : "bu";
  const bu = role === "coe" ? "AI Centre of Excellence" : (body.bu ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
    return Response.json({ error: "Enter your name and a valid email address." }, { status: 400 });
  }
  if (role === "bu" && !BUSINESS_UNITS.includes(bu)) {
    return Response.json({ error: "Choose your business unit." }, { status: 400 });
  }
  if (role === "coe" && !mayBeCoE(email)) {
    return Response.json({ error: "That email isn't on the AI CoE team list." }, { status: 403 });
  }
  const user: User = { email, name, bu, role };
  recordSignIn(user);
  (await cookies()).set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return Response.json({ user });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
