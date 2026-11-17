import clsx from "clsx";
import type { ReactNode } from "react";
import { labelOf } from "@/lib/rubric";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("text-[11px] font-medium uppercase tracking-[0.08em] text-subtle", className)}>{children}</div>
  );
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
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
        variant === "primary" && "bg-foreground text-white hover:bg-black/85",
        variant === "secondary" && "border border-line-strong bg-surface text-foreground hover:bg-black/[0.03]",
        variant === "ghost" && "text-muted hover:bg-black/[0.04] hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-[#f1f0ec] text-muted",
  submitted: "bg-accent-soft text-[#1c5cab]",
  triage: "bg-[#efecfb] text-[#4a3aa7]",
  approved: "bg-good-soft text-[#006300]",
  in_delivery: "bg-good-soft text-[#006300]",
  live: "bg-[#006300] text-white",
  parked: "bg-warn-soft text-[#8a5a00]",
  declined: "bg-bad-soft text-bad",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-medium",
        STATUS_TONE[status] ?? STATUS_TONE.draft,
      )}
    >
      {labelOf.status(status)}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-5 items-center whitespace-nowrap rounded-md border border-line bg-surface px-1.5 text-[11px] text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function readinessTone(r: number) {
  return r >= 70 ? "good" : r >= 45 ? "warn" : "bad";
}

const TONE_TEXT = { good: "text-good", warn: "text-warn", bad: "text-bad" } as const;
const TONE_STROKE = { good: "var(--good)", warn: "#d99400", bad: "var(--bad)" } as const;

export function ReadinessRing({ value, size = 64, label = true }: { value: number; size?: number; label?: boolean }) {
  const stroke = size >= 80 ? 7 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = readinessTone(value);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={clsx("font-semibold tabular-nums", size >= 80 ? "text-xl" : "text-sm", TONE_TEXT[tone])}>
            {value}
            <span className="text-[0.6em] font-medium">%</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex gap-[3px]" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={clsx(
            "h-1.5 w-4 rounded-full",
            i <= score ? (score >= 4 ? "bg-good" : score >= 2 ? "bg-[#d99400]" : "bg-bad") : "bg-line",
          )}
        />
      ))}
    </div>
  );
}

export function formatAUD(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `A$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `A$${Math.round(v / 1_000)}k`;
  return `A$${Math.round(v)}`;
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
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-20 text-muted">
      <Spinner />
    </div>
  );
}
