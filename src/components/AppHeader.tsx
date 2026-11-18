"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import type { User } from "@/lib/session";
import { MantelLogo } from "./MantelLogo";
import { signOut, useSession } from "./session";

export function AppHeader() {
  const [health, setHealth] = useState<{ claude: boolean; model: string } | null>(null);
  const user = useSession()?.user;

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background">
      {health && !health.claude && (
        <div className="border-b border-line bg-warn-soft px-4 py-2 text-center text-xs text-warn">
          No Claude credentials found. Add <code className="font-mono">ANTHROPIC_API_KEY</code> to{" "}
          <code className="font-mono">.env</code> and restart. Seeded data works; AI features won&apos;t
        </div>
      )}
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-medium">
          <MantelLogo className="h-5 w-auto" />
          AI Factory Front Door
        </Link>
        <span className="hidden text-[13px] text-subtle sm:inline">AI Centre of Excellence</span>

        <div className="ml-auto flex items-center gap-4">
          {health?.claude && (
            <span className="hidden items-center gap-2 font-mono text-xs text-subtle md:flex">
              <span className="size-1.5 rounded-full bg-good" aria-hidden />
              {health.model}
            </span>
          )}
          {/* Only the AI CoE moves between views; business units only ever see their own. */}
          {user?.role === "coe" && (
            <Suspense fallback={<ModeToggle coe={false} />}>
              <RoutedModeToggle />
            </Suspense>
          )}
          {user && <PersonMenu user={user} />}
        </div>
      </div>
    </header>
  );
}

function RoutedModeToggle() {
  return <ModeToggle coe={usePathname().startsWith("/coe")} />;
}

function ModeToggle({ coe }: { coe: boolean }) {
  const item = (active: boolean) =>
    clsx(
      "flex h-7 items-center rounded-md px-3 transition-colors duration-150",
      active ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-line" : "text-muted hover:text-foreground",
    );
  return (
    <nav aria-label="Switch view" className="flex gap-1 rounded-lg bg-raised p-1 text-[13px] font-medium">
      <Link href="/" className={item(!coe)} aria-current={!coe ? "page" : undefined}>
        Business unit
      </Link>
      <Link href="/coe" className={item(coe)} aria-current={coe ? "page" : undefined}>
        AI CoE
      </Link>
    </nav>
  );
}

function PersonMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-muted transition-colors duration-150 hover:bg-raised hover:text-foreground"
      >
        <span className="max-w-40 truncate">{user.name}</span>
        <ChevronDown className="size-4" strokeWidth={1.5} />
      </button>
      {open && (
        <div className="enter absolute right-0 z-40 mt-1 w-64 rounded-xl border border-line bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="px-3 py-2">
            <div className="truncate text-sm">{user.name}</div>
            <div className="truncate text-xs text-subtle">{user.email}</div>
            <div className="mt-1 truncate text-xs text-subtle">{user.role === "coe" ? "AI CoE team" : user.bu}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <button
            onClick={() => signOut()}
            className="flex h-8 w-full items-center rounded-lg px-3 text-left text-[13px] transition-colors duration-150 hover:bg-raised"
          >
            Switch person
          </button>
        </div>
      )}
    </div>
  );
}
