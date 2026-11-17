"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { UseCase } from "@/lib/db";
import { formatAUD } from "./ui";

// Palette: single-hue blue for magnitude, an ordinal blue ramp for funnel stages,
// and the first three categorical slots for the matrix (validated all-pairs).
export const BLUE = "#2a78d6";
const FUNNEL_RAMP = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab"];
export const SERIES = { draft: "#2a78d6", coe: "#eb6834", approved: "#1baf7a" } as const;

type Tip = { x: number; y: number; content: React.ReactNode } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 max-w-72 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left: tip.x + 14, top: tip.y + 14 }}
    >
      {tip.content}
    </div>
  );
}

export function Funnel({ stages }: { stages: { label: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const [tip, setTip] = useState<Tip>(null);
  return (
    <div className="flex flex-col gap-1.5">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].count : null;
        const conv = prev ? Math.round((s.count / prev) * 100) : null;
        return (
          <div
            key={s.label}
            className="grid grid-cols-[110px_1fr_64px] items-center gap-3"
            onMouseMove={(e) =>
              setTip({
                x: e.clientX,
                y: e.clientY,
                content: (
                  <>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-muted">
                      {s.count} use case{s.count === 1 ? "" : "s"}
                      {conv != null && ` · ${conv}% of previous stage`}
                    </div>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTip(null)}
          >
            <div className="truncate text-xs text-muted">{s.label}</div>
            <div className="h-7 rounded-[4px] bg-[#f1f0ec]">
              <div
                className="h-full rounded-[4px] transition-[width] duration-500"
                style={{ width: `${Math.max(2, (s.count / max) * 100)}%`, background: FUNNEL_RAMP[i] ?? BLUE }}
              />
            </div>
            <div className="text-right text-xs tabular-nums">
              <span className="font-semibold">{s.count}</span>
              {conv != null && <span className="ml-1.5 text-subtle">{conv}%</span>}
            </div>
          </div>
        );
      })}
      <Tooltip tip={tip} />
    </div>
  );
}

export function BarList({
  rows,
  onSelect,
  selected,
}: {
  rows: { key: string; label: string; count: number; items: UseCase[] }[];
  onSelect?: (key: string) => void;
  selected?: string | null;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const [tip, setTip] = useState<Tip>(null);
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <button
          key={r.key}
          onClick={() => onSelect?.(r.key)}
          onMouseMove={(e) =>
            setTip({
              x: e.clientX,
              y: e.clientY,
              content: (
                <>
                  <div className="mb-1 font-medium">
                    {r.label} · {r.count}
                  </div>
                  <ul className="space-y-0.5 text-muted">
                    {r.items.slice(0, 6).map((u) => (
                      <li key={u.id} className="truncate">
                        <span className="font-mono text-[10px]">{u.id}</span> {u.title}
                      </li>
                    ))}
                    {r.items.length > 6 && <li>+{r.items.length - 6} more</li>}
                  </ul>
                </>
              ),
            })
          }
          onMouseLeave={() => setTip(null)}
          className={clsx(
            "grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_24px] items-center gap-3 rounded-md px-1.5 py-1 text-left transition-colors",
            onSelect && "hover:bg-black/[0.03]",
            selected === r.key && "bg-accent-soft/60",
          )}
        >
          <span className="truncate text-xs text-foreground/80">{r.label}</span>
          <span className="h-3.5 rounded-[3px] bg-[#f1f0ec]">
            <span
              className="block h-full rounded-[3px] transition-[width] duration-500"
              style={{ width: `${(r.count / max) * 100}%`, background: BLUE }}
            />
          </span>
          <span className="text-right text-xs font-semibold tabular-nums">{r.count}</span>
        </button>
      ))}
      <Tooltip tip={tip} />
    </div>
  );
}

function group(u: UseCase): keyof typeof SERIES {
  if (u.status === "draft") return "draft";
  if (["submitted", "triage"].includes(u.status)) return "coe";
  return "approved";
}

export function PriorityMatrix({ useCases }: { useCases: UseCase[] }) {
  const points = useCases.filter((u) => u.est_value && !["parked", "declined"].includes(u.status));
  const W = 1100;
  const H = 300;
  const pad = { l: 44, r: 16, t: 12, b: 30 };
  const maxV = Math.max(1_000_000, ...points.map((p) => p.est_value!));
  const yMax = Math.ceil(maxV / 1_000_000) * 1_000_000;
  const x = (r: number) => pad.l + (r / 100) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const [tip, setTip] = useState<Tip>(null);
  const yTicks = [0, yMax / 2, yMax];

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-muted">
        {(
          [
            ["draft", "Shaping (draft)"],
            ["coe", "With the CoE"],
            ["approved", "Approved & beyond"],
          ] as const
        ).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: SERIES[k] }} />
            {l}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Readiness versus estimated value">
        {/* quadrant shading: high readiness, high value */}
        <rect x={x(70)} y={pad.t} width={x(100) - x(70)} height={y(yMax / 2) - pad.t} fill="#eaf2fc" opacity={0.6} />
        <text x={x(100) - 6} y={pad.t + 14} textAnchor="end" className="fill-[#1c5cab] text-[10px] font-medium">
          Prioritise
        </text>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-[var(--subtle)] text-[10px]">
              {formatAUD(t)}
            </text>
          </g>
        ))}
        {[0, 25, 50, 70, 100].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={pad.t} y2={H - pad.b} stroke={t === 70 ? "var(--line-strong)" : "transparent"} strokeDasharray="3 3" />
            <text x={x(t)} y={H - pad.b + 16} textAnchor="middle" className="fill-[var(--subtle)] text-[10px]">
              {t}%
            </text>
          </g>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 2} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
          Triage readiness
        </text>
        {points.map((p) => (
          <Link key={p.id} href={`/coe/use-cases/${p.id}`}>
            <circle cx={x(p.readiness)} cy={y(p.est_value!)} r={14} fill="transparent"
              onMouseMove={(e) =>
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  content: (
                    <>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-muted">
                        {p.business_unit} · {p.readiness}% ready · {formatAUD(p.est_value)}
                      </div>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTip(null)}
              className="cursor-pointer"
            />
            <circle
              cx={x(p.readiness)}
              cy={y(p.est_value!)}
              r={6}
              fill={SERIES[group(p)]}
              stroke="var(--surface)"
              strokeWidth={2}
              pointerEvents="none"
            />
          </Link>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
