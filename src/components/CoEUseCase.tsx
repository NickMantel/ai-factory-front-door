"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Download, FileText, Printer, Sparkles } from "lucide-react";
import type { DocumentMeta, Event, Message, UseCase } from "@/lib/db";
import { DIMENSIONS, STATUSES, labelOf, type StatusKey } from "@/lib/rubric";
import { BriefView, briefToMarkdown, downloadMarkdown } from "@/components/BriefView";
import { Copilot } from "@/components/Copilot";
import { Markdown } from "@/components/Markdown";
import {
  Button,
  Card,
  ReadinessRing,
  ScoreBar,
  SectionLabel,
  Spinner,
  StatusPill,
  Tag,
  formatAUD,
} from "@/components/ui";

type Data = {
  useCase: UseCase;
  messages: Message[];
  documents: DocumentMeta[];
  events: Event[];
};

export function CoEUseCase() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [all, setAll] = useState<UseCase[]>([]);
  const [tab, setTab] = useState<"brief" | "assessment" | "transcript">("brief");
  const [status, setStatus] = useState<StatusKey>("draft");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [copilot, setCopilot] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([
        fetch(`/api/use-cases/${id}`).then((r) => r.json()),
        fetch("/api/use-cases").then((r) => r.json()),
      ]).then(([d, l]) => {
        setData(d);
        setAll(l.useCases);
        if (d.useCase) {
          setStatus(d.useCase.status);
          if (!d.useCase.brief) setTab("assessment");
        }
      }),
    [id],
  );

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  async function saveStatus() {
    setSaving(true);
    const res = await fetch(`/api/use-cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    });
    const body = await res.json();
    setData((d) => (d ? { ...d, useCase: body.useCase, events: body.events } : d));
    setNote("");
    setSaving(false);
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }
  if (!data.useCase) return <div className="p-10 text-center text-muted">Use case not found.</div>;

  const uc = data.useCase;
  const a = uc.assessment;
  const similar = (a?.similar_use_case_ids ?? [])
    .map((sid) => all.find((u) => u.id === sid))
    .filter((u): u is UseCase => !!u);

  return (
    <div className="flex flex-1 items-start">
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6">
          <Link
            href="/coe"
            className="no-print mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Portfolio
          </Link>

          <div className="mb-5 flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-mono">{uc.id}</span>
                <span>·</span>
                <span>{uc.business_unit}</span>
                <span>·</span>
                <span>{uc.submitter}</span>
                <StatusPill status={uc.status} />
              </div>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{uc.title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted">{uc.one_liner}</p>
            </div>
            <div className="no-print flex gap-2">
              {uc.brief && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      downloadMarkdown(
                        `${uc.id}-use-case-brief.md`,
                        briefToMarkdown(uc.brief!, {
                          id: uc.id,
                          bu: uc.business_unit,
                          submitter: uc.submitter,
                        }),
                      )
                    }
                  >
                    <Download className="size-3.5" /> Markdown
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => window.print()}>
                    <Printer className="size-3.5" /> Print
                  </Button>
                </>
              )}
              <Button size="sm" variant={copilot ? "secondary" : "primary"} onClick={() => setCopilot((o) => !o)}>
                <Sparkles className="size-3.5" /> {copilot ? "Hide copilot" : "Interrogate"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="min-w-0">
              <div className="no-print flex gap-1 border-b border-line px-3 pt-2">
                {(
                  [
                    ["brief", "Use Case Brief"],
                    ["assessment", "Assessment"],
                    ["transcript", `Intake conversation (${data.messages.length})`],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={clsx(
                      "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                      tab === k
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted hover:text-foreground",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="p-6 sm:p-8">
                {tab === "brief" &&
                  (uc.brief ? (
                    <BriefView
                      brief={uc.brief}
                      meta={{
                        id: uc.id,
                        bu: uc.business_unit,
                        submitter: uc.submitter,
                        date: uc.submitted_at,
                      }}
                    />
                  ) : (
                    <div className="py-12 text-center text-sm text-muted">
                      No brief yet. The business unit is still shaping this use case ({uc.readiness}% ready).
                    </div>
                  ))}
                {tab === "assessment" &&
                  (a ? (
                    <div className="space-y-6">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(a.captured).map(([k, v]) => (
                          <div key={k}>
                            <SectionLabel>{k.replace(/_/g, " ")}</SectionLabel>
                            <p className={clsx("mt-1 text-sm leading-relaxed", !v && "italic text-subtle")}>
                              {v || "Not yet covered"}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <SectionLabel className="mb-2">Dimension detail</SectionLabel>
                        <div className="divide-y divide-line rounded-lg border border-line">
                          {DIMENSIONS.map((d) => {
                            const s = a.dimensions.find((x) => x.key === d.key);
                            return (
                              <div key={d.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_90px_1fr] sm:gap-4">
                                <div className="text-sm font-medium">{d.label}</div>
                                <ScoreBar score={s?.score ?? 0} />
                                <div className="text-[13px] text-muted">
                                  {s?.rationale}
                                  {s?.gap && <span className="text-foreground/80"> Gap: {s.gap}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {a.next_questions.length > 0 && (
                        <div>
                          <SectionLabel className="mb-2">Questions still open</SectionLabel>
                          <ul className="list-disc space-y-1 pl-4 text-sm">
                            {a.next_questions.map((q) => (
                              <li key={q}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-muted">Not assessed yet.</div>
                  ))}
                {tab === "transcript" &&
                  (data.messages.length ? (
                    <div className="mx-auto max-w-2xl space-y-5">
                      {data.messages.map((m) => (
                        <div key={m.id}>
                          <div className="mb-1 text-[11px] font-medium text-subtle">
                            {m.role === "user" ? uc.submitter : "AI Front Door"}
                          </div>
                          {m.role === "user" ? (
                            <div className="rounded-xl bg-background px-4 py-2.5 text-sm whitespace-pre-wrap">
                              {m.content}
                            </div>
                          ) : (
                            <Markdown>{m.content}</Markdown>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-muted">No intake conversation recorded.</div>
                  ))}
              </div>
            </Card>

            <div className="no-print flex flex-col gap-4">
              <Card className="p-4">
                <SectionLabel className="mb-2">CoE decision</SectionLabel>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusKey)}
                  className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Decision note (optional)"
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-sm outline-none focus:border-foreground/40"
                />
                <Button
                  className="mt-2 w-full"
                  size="sm"
                  onClick={saveStatus}
                  disabled={saving || status === uc.status}
                >
                  {saving ? <Spinner className="size-3.5" /> : "Update status"}
                </Button>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <ReadinessRing value={uc.readiness} size={56} />
                  <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-subtle">Pathway</div>
                      <div className="font-medium">{labelOf.pathwayShort(uc.pathway)}</div>
                    </div>
                    <div>
                      <div className="text-subtle">Est. value</div>
                      <div className="font-medium">{formatAUD(uc.est_value)}</div>
                    </div>
                  </div>
                </div>
                {a && (
                  <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {DIMENSIONS.map((d) => (
                      <li key={d.key} className="flex items-center justify-between text-xs">
                        <span className="text-muted">{d.label}</span>
                        <ScoreBar score={a.dimensions.find((x) => x.key === d.key)?.score ?? 0} />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
                  {uc.patterns.map((p) => (
                    <Tag key={p}>{labelOf.pattern(p)}</Tag>
                  ))}
                </div>
              </Card>

              {similar.length > 0 && (
                <Card className="p-4">
                  <SectionLabel className="mb-2">Shares logic with</SectionLabel>
                  <ul className="space-y-2">
                    {similar.map((s) => (
                      <li key={s.id}>
                        <Link href={`/coe/use-cases/${s.id}`} className="group block">
                          <div className="text-[13px] font-medium group-hover:text-accent">{s.title}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted">
                            <span className="font-mono">{s.id}</span> · {s.business_unit} ·{" "}
                            <StatusPill status={s.status} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {data.documents.length > 0 && (
                <Card className="p-4">
                  <SectionLabel className="mb-2">Source documents</SectionLabel>
                  <ul className="space-y-1">
                    {data.documents.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 text-[13px]">
                        <FileText className="size-3.5 text-subtle" />
                        <span className="truncate">{d.filename}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="p-4">
                <SectionLabel className="mb-3">Timeline</SectionLabel>
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {data.events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute top-1.5 -left-[20.5px] size-2 rounded-full border-2 border-surface bg-line-strong" />
                      <div className="text-[13px]">
                        {e.kind === "created" ? (
                          "Created"
                        ) : (
                          <>
                            Moved to <span className="font-medium">{labelOf.status(e.to_status ?? "")}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-subtle">
                        {new Date(e.created_at).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {e.actor}
                      </div>
                      {e.note && <div className="mt-0.5 text-xs text-muted">{e.note}</div>}
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Copilot
        open={copilot}
        onClose={() => setCopilot(false)}
        useCaseId={uc.id}
        title={`Interrogate ${uc.id}`}
        suggestions={[
          "What are the weakest parts of this case, and what should we ask the sponsor?",
          "Is the recommended pathway right? Argue the alternative.",
          "What could this reuse from the rest of the portfolio?",
          "Draft the triage decision note",
        ]}
      />
    </div>
  );
}
