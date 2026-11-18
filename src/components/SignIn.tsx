"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { X } from "lucide-react";
import type { Role, User } from "@/lib/session";
import { BUSINESS_UNITS } from "@/lib/rubric";
import { Button, SectionLabel, Spinner } from "./ui";
import { fetchSession, forgetPerson, recentPeople, rememberPerson } from "./session";

const field =
  "h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none placeholder:text-subtle focus:border-foreground/40";

export function SignIn() {
  const next = useSearchParams().get("next");
  const [role, setRole] = useState<Role>("bu");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [bu, setBu] = useState("");
  const [coeOpen, setCoeOpen] = useState(false);
  const [people, setPeople] = useState<User[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession()
      .then((s) => setCoeOpen(s.coeOpen))
      .catch(() => {});
    // Browser storage is only readable after hydration, so this sync is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeople(recentPeople());
  }, []);

  async function signIn(u: Omit<User, "bu"> & { bu?: string }) {
    setBusy(u.email);
    setError(null);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(u),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error);
      setBusy(null);
      return;
    }
    rememberPerson(body.user);
    // A full load, so the header and every view pick up the new person.
    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
    window.location.assign(safeNext ?? (body.user.role === "coe" ? "/coe" : "/"));
  }

  const ready = email.trim() && name.trim() && (role === "coe" || bu);

  return (
    <div className="flex flex-1 justify-center px-4 pb-16">
      <div className="enter w-full max-w-md pt-12 sm:pt-20">
        <div className="mb-2 text-xs text-subtle">AI Front Door</div>
        <h1 className="text-[22px] leading-7 font-medium">Sign in</h1>
        <p className="mt-2 text-sm leading-[22px] text-muted">
          Use cases you start are private to you and the people you add, until you submit them to the AI CoE.
        </p>

        {people.length > 0 && (
          <div className="mt-8">
            <SectionLabel className="mb-2">Continue as</SectionLabel>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {people.map((p) => (
                <li key={p.email} className="group flex items-center">
                  <button
                    onClick={() => signIn(p)}
                    disabled={!!busy}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-raised"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{p.name}</div>
                      <div className="truncate text-xs text-subtle">
                        {p.email} · {p.role === "coe" ? "AI CoE" : p.bu}
                      </div>
                    </div>
                    {busy === p.email && <Spinner />}
                  </button>
                  <button
                    onClick={() => {
                      forgetPerson(p.email);
                      setPeople(recentPeople());
                    }}
                    className="mr-2 rounded p-1 text-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                    aria-label={`Forget ${p.name}`}
                  >
                    <X className="size-4" strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void signIn({ email, name, bu, role });
          }}
        >
          {people.length > 0 && <SectionLabel>Someone else</SectionLabel>}
          {coeOpen && (
            <div className="flex gap-1 rounded-lg bg-raised p-1 text-[13px] font-medium" role="radiogroup" aria-label="Team">
              {(
                [
                  ["bu", "Business unit"],
                  ["coe", "AI CoE team"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={role === k}
                  onClick={() => setRole(k)}
                  className={clsx(
                    "flex h-7 flex-1 items-center justify-center rounded-md transition-colors duration-150",
                    role === k ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-line" : "text-muted hover:text-foreground",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Work email"
            aria-label="Work email"
            autoComplete="email"
            autoFocus
            className={field}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            autoComplete="name"
            className={field}
          />
          {role === "bu" && (
            <select
              value={bu}
              onChange={(e) => setBu(e.target.value)}
              aria-label="Business unit"
              className={clsx(field, "px-2", !bu && "text-subtle")}
            >
              <option value="" disabled>
                Your business unit
              </option>
              {BUSINESS_UNITS.map((b) => (
                <option key={b} className="text-foreground">
                  {b}
                </option>
              ))}
            </select>
          )}
          {error && <div className="text-xs text-bad">{error}</div>}
          <Button type="submit" disabled={!ready || !!busy} className="mt-1">
            {busy ? <Spinner /> : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-xs leading-[18px] text-subtle">
          Demo sign-in: no password beyond the site&apos;s own. In production this would be your organisation&apos;s
          single sign-on, and the AI CoE role would come from your directory group.
        </p>
      </div>
    </div>
  );
}
