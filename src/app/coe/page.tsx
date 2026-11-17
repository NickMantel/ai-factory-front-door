"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Search, X } from "lucide-react";
import type { UseCase } from "@/lib/db";
import type { Insights } from "@/lib/schemas";
import { AI_PATTERNS, BUSINESS_UNITS, FUNNEL, PATHWAYS, STATUSES, labelOf } from "@/lib/rubric";
import { BarList, Funnel, PriorityMatrix } from "@/components/charts";
import { Copilot } from "@/components/Copilot";
import {
  Button,
  Card,
  CaseId,
  PageSpinner,
  Percent,
  ReadinessMeter,
  SectionLabel,
  Spinner,
  StatusPill,
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

  if (!useCases || !stats) return <PageSpinner />;

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
        <div className="enter mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-8">
          <div className="mb-8 flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <h1 className="text-[28px] leading-[1.15] font-medium">Use case portfolio</h1>
              <p className="mt-2 text-sm text-muted">
                {stats.total} use cases from {stats.buRows.length} business units
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset demo data
            </Button>
            <Button variant={copilot ? "secondary" : "primary"} onClick={() => setCopilot((o) => !o)}>
              {copilot ? "Hide copilot" : "Ask the portfolio"}
            </Button>
          </div>

          {/* Stats: numbers only */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Use cases captured", value: String(stats.total), sub: `${stats.shaping} still being shaped` },
              {
                label: "Awaiting triage",
                value: String(stats.awaiting),
                sub: "Submitted with a standard brief",
                action: () => toggle("status", "submitted"),
              },
              { label: "Pipeline value, est.", value: formatAUD(stats.value), sub: "Annual, excluding parked and declined" },
              { label: "Shared-capability clusters", value: String(stats.clusters), sub: "AI patterns in two or more use cases" },
            ].map((k) =>
              k.action ? (
                <button
                  key={k.label}
                  onClick={k.action}
                  className="rounded-xl border border-line bg-surface p-5 text-left transition-colors duration-150 hover:border-line-strong"
                >
                  <Stat {...k} accent />
                </button>
              ) : (
                <Card key={k.label} className="p-5">
                  <Stat {...k} />
                </Card>
              ),
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="p-6">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 className="text-[15px] font-medium">Pipeline</h2>
                <span className="text-xs text-subtle">Each stage counts every case that has reached it</span>
              </div>
              <Funnel stages={stats.funnel} highlight="Submitted" />
            </Card>

            <Card className="flex max-h-[452px] flex-col">
              <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5">
                <h2 className="flex-1 text-[15px] font-medium">Portfolio insights</h2>
                {insights && <span className="text-xs text-subtle">{timeAgo(insights.generated_at)}</span>}
                <Button variant="secondary" size="sm" onClick={generate} disabled={generating}>
                  {generating && <Spinner className="size-3" />}
                  {insights ? "Refresh" : "Generate"}
                </Button>
              </div>
              {insightError && <div className="mx-5 mt-4 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{insightError}</div>}
              {generating && !insights ? (
                <div className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-muted">
                  <Spinner /> Reading every use case, about a minute
                </div>
              ) : insights ? (
                <div className={clsx("flex-1 overflow-y-auto px-5 py-4 text-[13px] leading-5", generating && "opacity-50")}>
                  <p className="text-sm leading-[22px]">{insights.insights.headline}</p>
                  {insights.insights.clusters.length > 0 && (
                    <div className="mt-6">
                      <SectionLabel className="mb-2">Build once, reuse many times</SectionLabel>
                      <ol className="divide-y divide-line border-y border-line">
                        {insights.insights.clusters.map((c) => (
                          <li key={c.name} className="py-3">
                            <div className="flex items-baseline gap-2">
                              <span className="font-medium">{c.name}</span>
                              <span className="font-mono text-xs text-subtle">{c.use_case_ids.length}</span>
                            </div>
                            <p className="mt-1 text-muted">{c.shared_logic}</p>
                            <p className="mt-1">{c.opportunity}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {c.use_case_ids.map((id) => (
                                <Link key={id} href={`/coe/use-cases/${id}`} className="rounded-[4px]">
                                  <CaseId id={id} className="transition-colors duration-150 hover:border-accent hover:text-accent" />
                                </Link>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div className="mt-6">
                    <SectionLabel className="mb-2">Observations</SectionLabel>
                    <ul className="list-disc space-y-2 pl-4 text-muted">
                      {insights.insights.observations.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-6">
                    <SectionLabel className="mb-2">Recommended focus</SectionLabel>
                    <ol className="list-decimal space-y-2 pl-4 text-muted">
                      {insights.insights.recommended_focus.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ) : (
                <p className="flex flex-1 items-center p-5 text-sm leading-[22px] text-muted">
                  Have Claude read every use case to find shared logic, economies of scale, gaps and where to focus.
                </p>
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="p-6">
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <h2 className="text-[15px] font-medium">AI patterns</h2>
                <span className="text-xs text-subtle">Select a pattern to filter the table</span>
              </div>
              <BarList
                rows={stats.patternRows}
                onSelect={(k) => toggle("pattern", k)}
                selected={filter?.kind === "pattern" ? filter.key : null}
                showIds
              />
            </Card>
            <Card className="p-6">
              <h2 className="mb-2 text-[15px] font-medium">By business unit</h2>
              <BarList rows={stats.buRows} onSelect={(k) => toggle("bu", k)} selected={filter?.kind === "bu" ? filter.key : null} />
              <h2 className="mt-6 mb-2 text-[15px] font-medium">Recommended pathway</h2>
              <BarList
                rows={stats.pathwayRows}
                onSelect={(k) => toggle("pathway", k)}
                selected={filter?.kind === "pathway" ? filter.key : null}
              />
            </Card>
          </div>

          <Card className="mt-4 p-6">
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <h2 className="text-[15px] font-medium">Value against readiness</h2>
              <span className="text-xs text-subtle">Select a point to open the use case</span>
            </div>
            <PriorityMatrix useCases={useCases} />
          </Card>

          <Card className="mt-4 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
              <h2 className="text-[15px] font-medium">All use cases</h2>
              <span className="font-mono text-xs text-subtle">{table.length}</span>
              {filter && (
                <button
                  onClick={() => setFilter(null)}
                  className="flex h-6 items-center gap-1 rounded-md bg-accent-soft px-2 text-xs text-accent transition-colors duration-150 hover:bg-[#dde6fa]"
                >
                  {filterLabel} <X className="size-3" strokeWidth={1.5} />
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={filter?.kind === "status" ? filter.key : ""}
                  onChange={(e) => setFilter(e.target.value ? { kind: "status", key: e.target.value } : null)}
                  aria-label="Filter by status"
                  className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-[13px]"
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" strokeWidth={1.5} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search"
                    aria-label="Search use cases"
                    className="h-8 w-48 rounded-lg border border-line-strong bg-surface pr-2 pl-9 text-[13px] outline-none focus:border-foreground/30"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-[13px]">
                <thead className="text-xs text-subtle">
                  <tr className="h-9 border-b border-line whitespace-nowrap">
                    <th className="px-5 font-normal">Use case</th>
                    <th className="px-3 font-normal">Business unit</th>
                    <th className="px-3 font-normal">Status</th>
                    <th className="px-3 font-normal">Readiness</th>
                    <th className="px-3 font-normal">Pathway</th>
                    <th className="px-3 font-normal">Pattern</th>
                    <th className="px-3 text-right font-normal">Est. value</th>
                    <th className="px-5 text-right font-normal">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((u) => (
                    <tr key={u.id} className="h-12 border-b border-line transition-colors duration-150 last:border-0 hover:bg-raised">
                      <td className="px-5">
                        <Link href={`/coe/use-cases/${u.id}`} className="flex items-center gap-3">
                          <CaseId id={u.id} />
                          <span className="truncate">{u.title}</span>
                        </Link>
                      </td>
                      <td className="px-3 text-muted">{u.business_unit}</td>
                      <td className="px-3">
                        <StatusPill status={u.status} />
                      </td>
                      <td className="px-3">
                        <div className="flex items-center gap-3">
                          <Percent value={u.readiness} className="w-9 text-right" />
                          <ReadinessMeter value={u.readiness} compact />
                        </div>
                      </td>
                      <td className="px-3 whitespace-nowrap text-muted">{labelOf.pathwayShort(u.pathway)}</td>
                      <td className="px-3 whitespace-nowrap text-muted">
                        {u.patterns[0] ? labelOf.pattern(u.patterns[0]) : "—"}
                        {u.patterns.length > 1 && <span className="ml-1 font-mono text-xs text-subtle">+{u.patterns.length - 1}</span>}
                      </td>
                      <td className="px-3 text-right font-mono tabular-nums">{formatAUD(u.est_value)}</td>
                      <td className="px-5 text-right text-xs whitespace-nowrap text-subtle">{timeAgo(u.updated_at)}</td>
                    </tr>
                  ))}
                  {table.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-muted">
                        No use cases match
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

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <>
      <div className="text-[13px] text-muted">{label}</div>
      <div className={clsx("mt-3 font-mono text-[28px] leading-none font-medium tabular-nums", accent && "text-accent")}>
        {value}
      </div>
      <div className="mt-3 text-xs text-subtle">{sub}</div>
    </>
  );
}
