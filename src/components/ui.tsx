import clsx from "clsx";
import type { ReactNode } from "react";
import { READINESS_THRESHOLD, labelOf } from "@/lib/rubric";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

/** Section and field labels: sentence case, secondary ink. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("text-xs font-medium text-muted", className)}>{children}</div>;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
        variant === "primary" && "bg-accent text-white hover:bg-[var(--accent-hover)]",
        variant === "secondary" && "border border-line-strong bg-surface text-foreground hover:bg-raised",
        variant === "ghost" && "text-muted hover:bg-raised hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

// Status reads as text; the dot carries the state's meaning, never decoration.
const STATUS_DOT: Record<string, string> = {
  draft: "bg-[#b4bccb]",
  submitted: "bg-accent",
  triage: "bg-[#6250d6]",
  approved: "bg-good",
  in_delivery: "bg-good",
  live: "bg-good",
  parked: "bg-warn",
  declined: "bg-bad",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-muted">
      <span className={clsx("size-1.5 shrink-0 rounded-full", STATUS_DOT[status] ?? STATUS_DOT.draft)} />
      {labelOf.status(status)}
    </span>
  );
}

/** The signature: case numbers set as small mono docket tabs. */
export function CaseId({ id, className }: { id: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-5 shrink-0 items-center rounded-[4px] border border-line-strong bg-surface px-1.5 font-mono text-[11px] leading-none whitespace-nowrap text-muted tabular-nums",
        className,
      )}
    >
      {id}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center rounded-md bg-raised px-2 text-xs whitespace-nowrap text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Readiness as a figure and a single bar to the triage line. */
export function ReadinessMeter({ value, compact }: { value: number; compact?: boolean }) {
  const met = value >= READINESS_THRESHOLD;
  return (
    <div className={clsx("relative h-1 rounded-full bg-[var(--chart-track)]", compact ? "w-16" : "w-full")}>
      <div
        className={clsx("absolute inset-y-0 left-0 rounded-full", met ? "bg-good" : "bg-[var(--progress)]")}
        style={{ width: `${Math.max(2, value)}%` }}
      />
      <div
        className="absolute -top-1 -bottom-1 w-px bg-foreground/40"
        style={{ left: `${READINESS_THRESHOLD}%` }}
        aria-hidden
      />
    </div>
  );
}

export function Percent({ value, className }: { value: number; className?: string }) {
  return <span className={clsx("font-mono tabular-nums", className)}>{value}%</span>;
}

/** Five ruled ticks, filled to the score. */
export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={clsx("h-3 w-1 rounded-[1px]", i <= score ? "bg-accent" : "bg-[#dfe4ec]")} />
      ))}
    </div>
  );
}

export function formatAUD(v: number | null | undefined) {
  if (v == null) return "—";
  // One format across the app: millions to one decimal place.
  if (v >= 50_000) return `A$${(v / 1_000_000).toFixed(1)}M`;
  return `A$${Math.round(v / 1_000)}k`;
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-20 text-subtle">
      <Spinner />
    </div>
  );
}
