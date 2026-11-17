"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, CheckCircle2, ChevronDown, FileText, Sparkles, X } from "lucide-react";
import type { DocumentMeta, UseCase } from "@/lib/db";
import { DIMENSIONS, MIN_DIMENSION_SCORE, READINESS_THRESHOLD, labelOf } from "@/lib/rubric";
import { Button, ReadinessRing, ScoreBar, SectionLabel, Spinner, Tag, formatAUD } from "./ui";

const CAPTURED_LABELS: Record<string, string> = {
  problem: "Problem",
  users_and_volumes: "Users & volumes",
  current_process: "Current process",
  desired_outcome: "Desired outcome",
  data_sources: "Data sources",
  proposed_solution: "Proposed solution",
  value_hypothesis: "Value hypothesis",
  risks: "Risks",
  sponsor: "Sponsor / owner",
};

export function Canvas({
  useCase,
  documents,
  similar,
  assessing,
  submitting,
  onSubmit,
  onViewBrief,
  onAsk,
  onRemoveDoc,
}: {
  useCase: UseCase;
  documents: DocumentMeta[];
  similar: { id: string; title: string; business_unit: string }[];
  assessing: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onViewBrief: () => void;
  onAsk: (q: string) => void;
  onRemoveDoc: (id: number) => void;
}) {
  const a = useCase.assessment;
  const [showCaptured, setShowCaptured] = useState(false);
  const submitted = useCase.status !== "draft";
  const weakest = a ? Math.min(...a.dimensions.map((d) => d.score)) : 0;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {/* Readiness */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-4">
          <ReadinessRing value={useCase.readiness} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <SectionLabel>Triage readiness</SectionLabel>
              {assessing && (
                <span className="flex items-center gap-1 text-[11px] text-accent">
                  <Spinner className="size-3" /> Updating
                </span>
              )}
            </div>
            <div className="mt-1 text-sm leading-snug">
              {submitted ? (
                <span className="flex items-center gap-1.5 font-medium text-good">
                  <CheckCircle2 className="size-4" /> Submitted to the AI CoE
                </span>
              ) : useCase.ready ? (
                <span className="font-medium text-good">Ready to submit to the AI CoE</span>
              ) : !a ? (
                <span className="text-muted">Describe your idea or drop in documents to get your first read-out.</span>
              ) : useCase.readiness < READINESS_THRESHOLD ? (
                <span className="text-muted">
                  <span className="font-medium text-foreground">{READINESS_THRESHOLD - useCase.readiness} points</span> to the
                  triage threshold
                </span>
              ) : (
                <span className="text-muted">
                  Lift every area to at least {MIN_DIMENSION_SCORE}/5 to submit (lowest is {weakest}/5)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4">
          {submitted ? (
            <Button variant="secondary" className="w-full" onClick={onViewBrief} disabled={!useCase.brief}>
              <FileText className="size-4" /> View Use Case Brief
            </Button>
          ) : (
            <Button className="w-full" onClick={onSubmit} disabled={!useCase.ready || submitting || assessing}>
              {submitting ? (
                <>
                  <Spinner /> Writing your Use Case Brief…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Submit to AI CoE
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {a && (
        <>
          <div>
            <div className="text-[15px] font-semibold leading-snug tracking-tight">{useCase.title}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{a.one_liner}</p>
          </div>

          {/* Dimensions */}
          <div className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-2.5">
              <SectionLabel>Assessment</SectionLabel>
            </div>
            <ul className="divide-y divide-line">
              {DIMENSIONS.map((d) => {
                const s = a.dimensions.find((x) => x.key === d.key);
                const score = s?.score ?? 0;
                return (
                  <li key={d.key} className="px-4 py-2.5" title={d.description}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium">{d.label}</span>
                      <ScoreBar score={score} />
                    </div>
                    {s?.gap && <p className="mt-1 text-xs leading-relaxed text-muted">{s.gap}</p>}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Next questions */}
          {!submitted && a.next_questions.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Sharpen it next</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {a.next_questions.map((q) => (
                  <button
                    key={q}
                    onClick={() => onAsk(q)}
                    className="group flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-[13px] leading-snug transition-colors hover:border-accent/50 hover:bg-accent-soft/40"
                  >
                    <span className="flex-1">{q}</span>
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-subtle group-hover:text-accent" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pathway & patterns */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-line bg-surface p-3">
              <SectionLabel>Indicative pathway</SectionLabel>
              <div className="mt-1 text-[13px] font-semibold leading-snug">{labelOf.pathway(a.indicative_pathway)}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <SectionLabel>Est. annual value</SectionLabel>
              <div className="mt-1 text-[13px] font-semibold">{formatAUD(a.estimated_annual_value_aud)}</div>
            </div>
          </div>
          <p className="-mt-2 text-xs leading-relaxed text-muted">{a.pathway_rationale}</p>

          <div>
            <SectionLabel className="mb-1.5">AI patterns</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {a.ai_patterns.map((p) => (
                <Tag key={p}>{labelOf.pattern(p)}</Tag>
              ))}
            </div>
          </div>

          {similar.length > 0 && (
            <div className="rounded-xl border border-accent/25 bg-accent-soft/50 p-3">
              <SectionLabel className="mb-1.5 text-[#1c5cab]">Similar use cases in the portfolio</SectionLabel>
              <ul className="space-y-1 text-[13px]">
                {similar.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted"> · {s.business_unit}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted">Shared logic can mean faster delivery through reuse.</p>
            </div>
          )}

          {/* Captured */}
          <div className="rounded-xl border border-line bg-surface">
            <button
              onClick={() => setShowCaptured((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5"
            >
              <SectionLabel>What we&apos;ve captured</SectionLabel>
              <ChevronDown className={clsx("size-4 text-subtle transition-transform", showCaptured && "rotate-180")} />
            </button>
            {showCaptured && (
              <dl className="space-y-2.5 border-t border-line px-4 py-3">
                {Object.entries(a.captured).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-medium text-subtle">{CAPTURED_LABELS[k] ?? k}</dt>
                    <dd className={clsx("text-[13px] leading-relaxed", !v && "italic text-subtle")}>{v || "Not yet covered"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </>
      )}

      {documents.length > 0 && (
        <div>
          <SectionLabel className="mb-1.5">Documents</SectionLabel>
          <ul className="space-y-1">
            {documents.map((d) => (
              <li key={d.id} className="group flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px]">
                <FileText className="size-3.5 shrink-0 text-subtle" />
                <span className="min-w-0 flex-1 truncate">{d.filename}</span>
                <span className="shrink-0 text-[11px] text-subtle">
                  {Math.max(1, Math.round(d.chars / 1000))}k chars{d.truncated ? " · truncated" : ""}
                </span>
                {!submitted && (
                  <button
                    onClick={() => onRemoveDoc(d.id)}
                    className="text-subtle opacity-0 group-hover:opacity-100 hover:text-bad"
                    aria-label={`Remove ${d.filename}`}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {submitted && (
        <Link href={`/coe/use-cases/${useCase.id}`} className="text-center text-xs text-muted underline-offset-2 hover:underline">
          See how the AI CoE views this use case →
        </Link>
      )}
    </div>
  );
}
