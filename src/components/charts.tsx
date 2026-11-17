"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { UseCase } from "@/lib/db";
import { formatAUD } from "./ui";

// Ranked bars use soft register ink, the pipeline deepens from light to dark ink as cases
// progress, and the value chart uses three validated series colours.
const NEUTRAL = "var(--chart)";
const ACCENT = "var(--accent)";
const PIPELINE_RAMP = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab"];
const SERIES = { draft: "var(--series-shaping)", coe: "var(--series-coe)", approved: "var(--series-approved)" } as const;

type Tip = { x: number; y: number; content: React.ReactNode } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 max-w-72 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      style={{ left: tip.x + 12, top: tip.y + 12 }}
    >
      {tip.content}
    </div>
  );
}

/** The main chart: stages of the pipeline, with the CoE's queue highlighted. */
export function Funnel({ stages, highlight }: { stages: { label: string; count: number }[]; highlight: string }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const [tip, setTip] = useState<Tip>(null);
  return (
    <div className="flex flex-col">
      <div className="mb-2 grid grid-cols-[112px_1fr_40px_48px] gap-3 text-xs text-subtle">
        <span>Stage</span>
        <span />
        <span className="text-right">Cases</span>
        <span className="text-right">Kept</span>
      </div>
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].count : null;
        const conv = prev ? Math.round((s.count / prev) * 100) : null;
        const lead = s.label === highlight;
        return (
          <div
            key={s.label}
            className="grid h-10 grid-cols-[112px_1fr_40px_48px] items-center gap-3 border-t border-line"
            onMouseMove={(e) =>
              setTip({
                x: e.clientX,
                y: e.clientY,
                content: (
                  <>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-muted">
                      {s.count} use case{s.count === 1 ? "" : "s"}
                      {conv != null && `, ${conv}% of the previous stage`}
                    </div>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTip(null)}
          >
            <span className={clsx("truncate text-[13px]", lead ? "font-medium text-accent" : "text-muted")}>{s.label}</span>
            <div className="h-4">
              <div
                className="h-full rounded-[3px]"
                style={{ width: `${Math.max(1.5, (s.count / max) * 100)}%`, background: PIPELINE_RAMP[i] ?? ACCENT }}
              />
            </div>
            <span className="text-right font-mono text-[13px] tabular-nums">{s.count}</span>
            <span className="text-right font-mono text-xs text-subtle tabular-nums">{conv != null ? `${conv}%` : ""}</span>
          </div>
        );
      })}
      <Tooltip tip={tip} />
    </div>
  );
}

/** A ranked list with thin bars, for the secondary breakdowns. */
export function BarList({
  rows,
  onSelect,
  selected,
  showIds,
}: {
  rows: { key: string; label: string; count: number; items: UseCase[] }[];
  onSelect?: (key: string) => void;
  selected?: string | null;
  showIds?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const [tip, setTip] = useState<Tip>(null);
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        <button
          key={r.key}
          onClick={() => onSelect?.(r.key)}
          onMouseMove={(e) =>
            showIds
              ? undefined
              : setTip({
                  x: e.clientX,
                  y: e.clientY,
                  content: (
                    <ul className="space-y-1 text-muted">
                      {r.items.slice(0, 6).map((u) => (
                        <li key={u.id} className="truncate">
                          <span className="font-mono text-[11px]">{u.id}</span> {u.title}
                        </li>
                      ))}
                      {r.items.length > 6 && <li>{r.items.length - 6} more</li>}
                    </ul>
                  ),
                })
          }
          onMouseLeave={() => setTip(null)}
          aria-pressed={selected === r.key}
          className={clsx(
            "-mx-2 flex flex-col gap-1 rounded-md px-2 py-2 text-left transition-colors duration-150",
            onSelect && "hover:bg-raised",
            selected === r.key && "bg-raised",
          )}
        >
          <div className="flex items-baseline gap-3">
            <span className={clsx("min-w-0 flex-1 truncate text-[13px]", selected === r.key && "text-accent")}>
              {r.label}
            </span>
            {showIds && (
              <span className="hidden truncate font-mono text-[11px] text-subtle md:inline">
                {r.items.map((u) => u.id).join("  ")}
              </span>
            )}
            <span className="w-6 text-right font-mono text-[13px] tabular-nums">{r.count}</span>
          </div>
          <div className="h-1 rounded-full bg-[var(--chart-track)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.count / max) * 100}%`, background: selected === r.key ? ACCENT : NEUTRAL }}
            />
          </div>
        </button>
      ))}
      <Tooltip tip={tip} />
    </div>
  );
}

type Group = "draft" | "coe" | "approved";
function group(u: UseCase): Group {
  if (u.status === "draft") return "draft";
  if (["submitted", "triage"].includes(u.status)) return "coe";
  return "approved";
}

function Mark({ g, size = 10 }: { g: Group; size?: number }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} aria-hidden>
      <circle
        cx={r}
        cy={r}
        r={r - 1}
        style={{ fill: g === "draft" ? "var(--surface)" : SERIES[g], stroke: g === "draft" ? SERIES.draft : "none" }}
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function PriorityMatrix({ useCases }: { useCases: UseCase[] }) {
  const points = useCases.filter((u) => u.est_value && !["parked", "declined"].includes(u.status));
  const W = 1100;
  const H = 260;
  const pad = { l: 56, r: 16, t: 16, b: 36 };
  const maxV = Math.max(1_000_000, ...points.map((p) => p.est_value!));
  const yMax = Math.ceil(maxV / 1_000_000) * 1_000_000;
  const x = (r: number) => pad.l + (r / 100) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const [tip, setTip] = useState<Tip>(null);
  const yTicks = [0, yMax / 2, yMax];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
        {(
          [
            ["coe", "With the CoE"],
            ["draft", "Being shaped"],
            ["approved", "Approved and beyond"],
          ] as const
        ).map(([k, l]) => (
          <span key={k} className="flex items-center gap-2">
            <Mark g={k} />
            {l}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Estimated value against triage readiness">
        <rect
          x={x(70)}
          y={pad.t}
          width={x(100) - x(70)}
          height={y(yMax / 2) - pad.t}
          style={{ fill: "var(--accent-soft)" }}
        />
        <text x={x(70) + 8} y={pad.t + 16} className="fill-[var(--accent)] text-[11px]">
          Ready and high value
        </text>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-[var(--subtle)] font-mono text-[11px]">
              {formatAUD(t)}
            </text>
          </g>
        ))}
        <line x1={x(70)} x2={x(70)} y1={pad.t} y2={H - pad.b} style={{ stroke: "var(--line-strong)" }} strokeDasharray="2 3" />
        {[0, 25, 50, 70, 100].map((t) => (
          <text key={t} x={x(t)} y={H - pad.b + 16} textAnchor="middle" className="fill-[var(--subtle)] font-mono text-[11px]">
            {t}%
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" className="fill-[var(--subtle)] text-[11px]">
          Triage readiness
        </text>
        {points.map((p) => {
          const g = group(p);
          return (
            <Link key={p.id} href={`/coe/use-cases/${p.id}`}>
              <circle
                cx={x(p.readiness)}
                cy={y(p.est_value!)}
                r={12}
                fill="transparent"
                className="cursor-pointer"
                onMouseMove={(e) =>
                  setTip({
                    x: e.clientX,
                    y: e.clientY,
                    content: (
                      <>
                        <div className="font-medium">
                          <span className="font-mono text-[11px] text-subtle">{p.id}</span> {p.title}
                        </div>
                        <div className="text-muted">
                          {p.business_unit}, {p.readiness}% ready, {formatAUD(p.est_value)}
                        </div>
                      </>
                    ),
                  })
                }
                onMouseLeave={() => setTip(null)}
              />
              <circle
                cx={x(p.readiness)}
                cy={y(p.est_value!)}
                r={5}
                style={{
                  fill: g === "draft" ? "var(--surface)" : SERIES[g],
                  stroke: g === "draft" ? SERIES.draft : "var(--surface)",
                }}
                strokeWidth={g === "draft" ? 1.5 : 2}
                pointerEvents="none"
              />
            </Link>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
