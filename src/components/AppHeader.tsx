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
    <header className="sticky top-0 z-30 border-b border-line bg-background">
      {health && !health.claude && (
        <div className="border-b border-line bg-warn-soft px-4 py-2 text-center text-xs text-warn">
          No Claude credentials found. Add <code className="font-mono">ANTHROPIC_API_KEY</code> to{" "}
          <code className="font-mono">.env</code> and restart. Seeded data works; AI features won&apos;t
        </div>
      )}
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="text-base font-medium">
          AI Front Door
        </Link>
        <span className="hidden text-[13px] text-subtle sm:inline">AI Centre of Excellence</span>

        <div className="ml-auto flex items-center gap-4">
          {health?.claude && (
            <span className="hidden items-center gap-2 font-mono text-xs text-subtle md:flex">
              <span className="size-1.5 rounded-full bg-good" aria-hidden />
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
