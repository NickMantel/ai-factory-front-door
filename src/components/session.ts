"use client";

import { useEffect, useState } from "react";
import type { User } from "@/lib/session";

export type SessionState = { user: User | null; coeOpen: boolean };

let cached: Promise<SessionState> | null = null;

export function fetchSession() {
  cached ??= fetch("/api/session").then((r) => r.json());
  return cached;
}

export function useSession() {
  const [state, setState] = useState<SessionState | null>(null);
  useEffect(() => {
    fetchSession()
      .then(setState)
      .catch(() => {});
  }, []);
  return state;
}

export async function signOut(to = "/sign-in") {
  await fetch("/api/session", { method: "DELETE" });
  window.location.assign(to);
}

// People who signed in on this browser, so a demo can switch between them in one click.
const PEOPLE_KEY = "frontdoor:people";

export function recentPeople(): User[] {
  try {
    return JSON.parse(localStorage.getItem(PEOPLE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function rememberPerson(u: User) {
  try {
    const rest = recentPeople().filter((p) => p.email !== u.email);
    localStorage.setItem(PEOPLE_KEY, JSON.stringify([u, ...rest].slice(0, 6)));
  } catch {}
}

export function forgetPerson(email: string) {
  try {
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(recentPeople().filter((p) => p.email !== email)));
  } catch {}
}
