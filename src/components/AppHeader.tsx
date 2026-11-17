"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import clsx from "clsx";

export function AppHeader() {
  const [health, setHealth] = useState<{ claude: boolean; model: string } | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/85 backdrop-blur">
      {health && !health.claude && (
        <div className="bg-warn-soft px-4 py-1.5 text-center text-xs text-[#8a5a00]">
          No Claude credentials found. Add <code className="font-mono">ANTHROPIC_API_KEY</code> to{" "}
          <code className="font-mono">.env.local</code> and restart. Seeded data still works; AI features won&apos;t.
        </div>
      )}
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">AI Front Door</div>
            <div className="hidden text-[11px] text-muted sm:block">AI Centre of Excellence</div>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {health?.claude && (
            <span className="hidden items-center gap-1.5 text-[11px] text-muted md:flex">
              <span className="size-1.5 rounded-full bg-good" />
              {health.model}
            </span>
          )}
          <Suspense fallback={<ModeToggle coe={false} />}>
            <RoutedModeToggle />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function RoutedModeToggle() {
  return <ModeToggle coe={usePathname().startsWith("/coe")} />;
}

function ModeToggle({ coe }: { coe: boolean }) {
  return (
    <nav aria-label="Switch view" className="flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium">
      <Link
        href="/"
        className={clsx(
          "rounded-md px-3 py-1.5 transition-colors",
          !coe ? "bg-foreground text-white" : "text-muted hover:text-foreground",
        )}
      >
        Business unit
      </Link>
      <Link
        href="/coe"
        className={clsx(
          "rounded-md px-3 py-1.5 transition-colors",
          coe ? "bg-foreground text-white" : "text-muted hover:text-foreground",
        )}
      >
        AI CoE
      </Link>
    </nav>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <rect width="28" height="28" rx="7" fill="#121212" />
      <path d="M9 21V9.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1V21" stroke="white" strokeWidth="1.6" fill="none" />
      <path d="M7 21h14" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="15" r="1.2" fill="#6da7ec" />
    </svg>
  );
}
