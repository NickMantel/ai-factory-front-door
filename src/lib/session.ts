import { createHmac, timingSafeEqual } from "node:crypto";

// Demo identity: a signed cookie holding who the person says they are. In production this
// would come from the organisation's single sign-on; everything downstream only reads `User`.

export type Role = "bu" | "coe";
export type User = { email: string; name: string; bu: string; role: Role };

export const SESSION_COOKIE = "fd_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const secret = () => process.env.SESSION_SECRET || process.env.ACCESS_PASSWORD || "frontdoor-local-dev";

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function encodeSession(user: User): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined | null): User | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const u = JSON.parse(Buffer.from(payload, "base64url").toString()) as User;
    return u.email && u.name && (u.role === "bu" || u.role === "coe") ? u : null;
  } catch {
    return null;
  }
}

export const normaliseEmail = (e: string) => e.trim().toLowerCase();

/** COE_EMAILS limits the AI CoE role to named people; unset, anyone can pick it (demo mode). */
export function coeAllowlist(): string[] | null {
  const list = process.env.COE_EMAILS?.split(",").map(normaliseEmail).filter(Boolean);
  return list?.length ? list : null;
}

export function mayBeCoE(email: string) {
  const list = coeAllowlist();
  return !list || list.includes(normaliseEmail(email));
}
