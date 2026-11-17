"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Layers, RefreshCw, Search, Sparkles, X } from "lucide-react";
import type { UseCase } from "@/lib/db";
import type { Insights } from "@/lib/schemas";
import { AI_PATTERNS, BUSINESS_UNITS, FUNNEL, PATHWAYS, STATUSES, labelOf } from "@/lib/rubric";
import { BarList, Funnel, PriorityMatrix } from "@/components/charts";
import { Copilot } from "@/components/Copilot";
import {
  Button,
  Card,
  ReadinessRing,
  SectionLabel,
  Spinner,
  StatusPill,
  Tag,
  formatAUD,
  timeAgo,
} from "@/components/ui";

const STAGE: Record<string, number> = {
  draft: 0,
  submitted: 2,
  triage: 3,
  approved: 4,
  in_delivery: 5,
  live: 6,
  parked: 3,
  declined: 3,
};

function funnelStages(useCases: UseCase[]) {
  const reached = (u: UseCase) => {
    const s = STAGE[u.status] ?? 0;
    return Math.max(s, u.ready ? 1 : 0);
  };
  return FUNNEL.map((f, i) => ({
    label: f.label,
    count: useCases.filter((u) => reached(u) >= i).length,
  }));
}

type Filter = {
  kind: "pattern" | "bu" | "pathway" | "status";
  key: string;
} | null;

export default function CoEDashboard() {
  const [useCases, setUseCases] = useState<UseCase[] | null>(null);
  const [insights, setInsights] = useState<{
    insights: Insights;
    generated_at: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(null);
  const [q, setQ] = useState("");
  const [copilot, setCopilot] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([
        fetch("/api/use-cases").then((r) => r.json()),
        fetch("/api/coe/insights").then((r) => r.json()),
      ]).then(([l, i]) => {
        setUseCases(l.useCases);
        setInsights(i);
      }),
    [],
  );
  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  async function generate() {
    setGenerating(true);
    setInsightError(null);
    const res = await fetch("/api/coe/insights", { method: "POST" });
    const body = await res.json();
    if (res.ok) setInsights(body);
    else setInsightError(body.error);
    setGenerating(false);
  }

  async function reset() {
    if (!confirm("Reset to the demo portfolio? This deletes any use cases and chats created in the demo.")) return;
    await fetch("/api/reset", { method: "POST" });
    load();
  }

  const stats = useMemo(() => {
    if (!useCases) return null;
    const active = useCases.filter((u) => !["parked", "declined"].includes(u.status));
    const patternRows = AI_PATTERNS.map((p) => {
      const items = useCases.filter((u) => u.patterns.includes(p.key));
      return { key: p.key, label: p.label, count: items.length, items };
    })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    const buRows = BUSINESS_UNITS.map((b) => {
      const items = useCases.filter((u) => u.business_unit === b);
      return { key: b, label: b, count: items.length, items };
    })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    const pathwayRows = PATHWAYS.map((p) => {
      const items = useCases.filter((u) => u.pathway === p.key);
      return { key: p.key, label: p.label, count: items.length, items };
    })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    return {
      total: useCases.length,
      awaiting: useCases.filter((u) => u.status === "submitted").length,
      shaping: useCases.filter((u) => u.status === "draft").length,
      value: active.reduce((s, u) => s + (u.est_value ?? 0), 0),
      clusters: patternRows.filter((r) => r.count >= 2).length,
      patternRows,
      buRows,
      pathwayRows,
      funnel: funnelStages(useCases),
    };
  }, [useCases]);

  const table = useMemo(() => {
    if (!useCases) return [];
    const needle = q.trim().toLowerCase();
    return useCases.filter((u) => {
      if (filter?.kind === "pattern" && !u.patterns.includes(filter.key)) return false;
      if (filter?.kind === "bu" && u.business_unit !== filter.key) return false;
      if (filter?.kind === "pathway" && u.pathway !== filter.key) return false;
      if (filter?.kind === "status" && u.status !== filter.key) return false;
      if (
        needle &&
        !`${u.id} ${u.title} ${u.business_unit} ${u.submitter} ${u.one_liner}`.toLowerCase().includes(needle)
      )
        return false;
      return true;
    });
  }, [useCases, filter, q]);

  const toggle = (kind: NonNullable<Filter>["kind"], key: string) =>
    setFilter((f) => (f?.kind === kind && f.key === key ? null : { kind, key }));

  if (!useCases || !stats) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }

  const filterLabel =
    filter &&
    (filter.kind === "pattern"
      ? labelOf.pattern(filter.key)
      : filter.kind === "pathway"
        ? labelOf.pathway(filter.key)
        : filter.kind === "status"
          ? labelOf.status(filter.key)
          : filter.key);

  return (
    <div className="flex flex-1 items-start">
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <SectionLabel>AI CoE · Portfolio</SectionLabel>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">AI use case landscape</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RefreshCw className="size-3.5" /> Reset demo data
            </Button>
            <Button variant={copilot ? "secondary" : "primary"} onClick={() => setCopilot((o) => !o)}>
              <Sparkles className="size-4" /> {copilot ? "Hide copilot" : "Ask the portfolio"}
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Use cases captured",
                value: stats.total,
                sub: `${stats.shaping} being shaped by business units`,
              },
              {
                label: "Awaiting CoE triage",
                value: stats.awaiting,
                sub: "Submitted with a standard brief",
                action: () => toggle("status", "submitted"),
              },
              {
                label: "Pipeline value (est.)",
                value: formatAUD(stats.value),
                sub: "Annual, excl. parked and declined",
              },
              {
                label: "Shared-capability clusters",
                value: stats.clusters,
                sub: "AI patterns appearing in 2+ use cases",
              },
            ].map((k) => (
              <Card key={k.label} className={clsx("p-4", k.action && "cursor-pointer hover:border-line-strong")}>
                <div onClick={k.action}>
                  <div className="text-xs text-muted">{k.label}</div>
                  <div className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums">{k.value}</div>
                  <div className="mt-1 text-[11px] text-subtle">{k.sub}</div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <Card className="p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <div className="text-sm font-semibold">Opportunity funnel</div>
                <div className="text-[11px] text-subtle">Conversion vs previous stage</div>
              </div>
              <Funnel stages={stats.funnel} />
            </Card>

            <Card className="flex flex-col p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-accent" />
                <div className="flex-1 text-sm font-semibold">Portfolio insights</div>
                {insights && (
                  <span className="text-[11px] text-subtle">Generated {timeAgo(insights.generated_at)}</span>
                )}
                <Button variant="secondary" size="sm" onClick={generate} disabled={generating}>
                  {generating ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                  {insights ? "Refresh" : "Generate"}
                </Button>
              </div>
              {insightError && (
                <div className="mb-2 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{insightError}</div>
              )}
              {generating && !insights ? (
                <div className="flex flex-1 items-center justify-center gap-2 py-10 text-sm text-muted">
                  <Spinner /> Claude is reading the portfolio…
                </div>
              ) : insights ? (
                <div
                  className={clsx("flex-1 space-y-4 overflow-y-auto text-sm", generating && "opacity-50")}
                  style={{ maxHeight: 340 }}
                >
                  <p className="leading-relaxed font-medium">{insights.insights.headline}</p>
                  {insights.insights.clusters.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Build once, reuse many times</SectionLabel>
                      {insights.insights.clusters.map((c) => (
                        <div key={c.name} className="rounded-lg border border-line bg-background/60 p-3">
                          <div className="flex items-center gap-2">
                            <Layers className="size-3.5 text-accent" />
                            <span className="text-[13px] font-semibold">{c.name}</span>
                            <span className="text-[11px] text-subtle">{c.use_case_ids.length} use cases</span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted">{c.shared_logic}</p>
                          <p className="mt-1 text-xs leading-relaxed">{c.opportunity}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {c.use_case_ids.map((id) => (
                              <Link key={id} href={`/coe/use-cases/${id}`}>
                                <Tag className="font-mono hover:border-accent hover:text-accent">{id}</Tag>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <SectionLabel className="mb-1.5">Observations</SectionLabel>
                    <ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-foreground/85">
                      {insights.insights.observations.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <SectionLabel className="mb-1.5">Recommended focus</SectionLabel>
                    <ol className="list-decimal space-y-1 pl-4 text-[13px] leading-relaxed text-foreground/85">
                      {insights.insights.recommended_focus.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted">
                  <p className="max-w-sm">
                    Have Claude read every use case to find shared logic, economies of scale, gaps and where to focus.
                  </p>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <Card className="p-5">
              <div className="mb-3 text-sm font-semibold">AI patterns</div>
              <BarList
                rows={stats.patternRows}
                onSelect={(k) => toggle("pattern", k)}
                selected={filter?.kind === "pattern" ? filter.key : null}
              />
            </Card>
            <Card className="p-5">
              <div className="mb-3 text-sm font-semibold">By business unit</div>
              <BarList
                rows={stats.buRows}
                onSelect={(k) => toggle("bu", k)}
                selected={filter?.kind === "bu" ? filter.key : null}
              />
            </Card>
            <Card className="p-5">
              <div className="mb-3 text-sm font-semibold">Recommended pathway</div>
              <BarList
                rows={stats.pathwayRows}
                onSelect={(k) => toggle("pathway", k)}
                selected={filter?.kind === "pathway" ? filter.key : null}
              />
            </Card>
          </div>

          <Card className="mt-3 p-5">
            <div className="mb-1 flex items-baseline justify-between">
              <div className="text-sm font-semibold">Prioritisation matrix</div>
              <div className="text-[11px] text-subtle">Value vs readiness · click a point to open it</div>
            </div>
            <PriorityMatrix useCases={useCases} />
          </Card>

          {/* Table */}
          <Card className="mt-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
              <div className="text-sm font-semibold">All use cases</div>
              {filter && (
                <button
                  onClick={() => setFilter(null)}
                  className="flex h-6 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-[11px] font-medium text-[#1c5cab]"
                >
                  {filterLabel} <X className="size-3" />
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={filter?.kind === "status" ? filter.key : ""}
                  onChange={(e) => setFilter(e.target.value ? { kind: "status", key: e.target.value } : null)}
                  className="h-8 rounded-lg border border-line bg-surface px-2 text-xs"
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search"
                    className="h-8 w-44 rounded-lg border border-line bg-surface pr-2 pl-8 text-xs outline-none focus:border-foreground/30"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-[13px]">
                <thead className="text-[11px] text-subtle">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2 font-medium">Use case</th>
                    <th className="px-3 py-2 font-medium">Business unit</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Readiness</th>
                    <th className="px-3 py-2 font-medium">Pathway</th>
                    <th className="px-3 py-2 font-medium">Patterns</th>
                    <th className="px-3 py-2 text-right font-medium">Est. value</th>
                    <th className="px-5 py-2 text-right font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((u) => (
                    <tr key={u.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                      <td className="px-5 py-2.5">
                        <Link href={`/coe/use-cases/${u.id}`} className="block">
                          <div className="font-medium hover:text-accent">{u.title}</div>
                          <div className="font-mono text-[11px] text-subtle">{u.id}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-muted">{u.business_unit}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={u.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <ReadinessRing value={u.readiness} size={22} label={false} />
                          <span className="tabular-nums">{u.readiness}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{labelOf.pathwayShort(u.pathway)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {u.patterns.slice(0, 2).map((p) => (
                            <Tag key={p}>{labelOf.pattern(p)}</Tag>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatAUD(u.est_value)}</td>
                      <td className="px-5 py-2.5 text-right text-xs whitespace-nowrap text-subtle">
                        {timeAgo(u.updated_at)}
                      </td>
                    </tr>
                  ))}
                  {table.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-muted">
                        No use cases match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
      <Copilot
        open={copilot}
        onClose={() => setCopilot(false)}
        title="Portfolio copilot"
        suggestions={[
          "Which use cases share computer-vision logic, and what could we build once?",
          "What's awaiting triage, and how would you prioritise it?",
          "Where are the biggest data readiness gaps?",
          "Draft a 5-line portfolio update for the exec team",
        ]}
      />
    </div>
  );
}
