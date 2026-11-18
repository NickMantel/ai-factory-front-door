"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, ChevronDown, FileText, X } from "lucide-react";
import type { DocumentMeta, UseCase } from "@/lib/db";
import { DIMENSIONS, FRAMEWORK, MIN_DIMENSION_SCORE, READINESS_THRESHOLD, labelOf } from "@/lib/rubric";
import { Button, CaseId, ReadinessMeter, ScoreBar, SectionLabel, Spinner, Tag, formatAUD } from "./ui";

const CAPTURED_LABELS: Record<string, string> = {
  problem: "Problem",
  users_and_volumes: "Users and volumes",
  current_process: "Current process",
  desired_outcome: "Desired outcome",
  data_sources: "Data sources",
  proposed_solution: "Proposed solution",
  value_hypothesis: "Value hypothesis",
  risks: "Risks",
  sponsor: "Sponsor and owner",
};

export type SubmitMode = "progress" | "triage";

export function Canvas({
  useCase,
  documents,
  similar,
  similarHidden = 0,
  assessing,
  submitting,
  readOnly,
  coeLink,
  onSubmit,
  onViewBrief,
  onAsk,
  onRemoveDoc,
}: {
  useCase: UseCase;
  documents: DocumentMeta[];
  similar: { id: string; title: string; business_unit: string }[];
  /** Similar use cases this person can't open, shown only as a count. */
  similarHidden?: number;
  assessing: boolean;
  submitting: SubmitMode | null;
  /** For people viewing a use case another team opened to the organisation. */
  readOnly?: boolean;
  coeLink?: boolean;
  onSubmit: (mode: SubmitMode) => void;
  onViewBrief: () => void;
  onAsk: (q: string) => void;
  onRemoveDoc: (id: number) => void;
}) {
  const a = useCase.assessment;
  const [showCaptured, setShowCaptured] = useState(false);
  const draft = useCase.status === "draft";
  const submitted = !draft && useCase.status !== "shaping";
  const weakest = a ? Math.min(...a.dimensions.map((d) => d.score)) : 0;

  const statusLine = submitted
    ? "Submitted to the AI CoE for triage"
    : useCase.ready
      ? "Ready to submit for triage"
      : !a
        ? "Describe your idea or attach documents to get a first read"
        : useCase.readiness < READINESS_THRESHOLD
          ? `${READINESS_THRESHOLD - useCase.readiness} points to the triage line`
          : `Every criterion needs ${MIN_DIMENSION_SCORE}/5 or more to submit, lowest is ${weakest}/5`;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Readiness */}
      <section>
        <div className="flex items-baseline justify-between">
          <SectionLabel>Triage readiness</SectionLabel>
          {assessing && (
            <span className="flex items-center gap-2 text-xs text-subtle">
              <Spinner className="size-3" /> Updating
            </span>
          )}
        </div>
        <div className={clsx("mt-2 font-mono text-[32px] leading-none font-medium tabular-nums", assessing && "text-subtle")}>
          {useCase.readiness}%
        </div>
        <div className="mt-4">
          <div className={clsx(assessing && "animate-pulse")}>
            <ReadinessMeter value={useCase.readiness} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-subtle">
            <span className={clsx(useCase.ready && "text-good")}>{statusLine}</span>
            <span className="font-mono">{READINESS_THRESHOLD}% line</span>
          </div>
        </div>
        {!readOnly && (
          <div className="mt-4 flex flex-col gap-2">
            {submitted ? (
              <Button variant="secondary" className="w-full" onClick={onViewBrief} disabled={!useCase.brief}>
                View use case brief
              </Button>
            ) : (
              <>
                <Button
                  className="w-full"
                  onClick={() => onSubmit("triage")}
                  disabled={!useCase.ready || !!submitting || assessing}
                >
                  {submitting === "triage" ? (
                    <>
                      <Spinner /> Writing your use case brief
                    </>
                  ) : (
                    "Submit for triage"
                  )}
                </Button>
                {draft && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => onSubmit("progress")}
                    disabled={!a || !!submitting || assessing}
                  >
                    {submitting === "progress" ? <Spinner /> : "Save as work in progress"}
                  </Button>
                )}
                <p className="text-xs leading-[18px] text-subtle">
                  {draft
                    ? "Private draft: only you and the people you add can see it. Submitting creates the record the AI CoE sees."
                    : "Registered with the AI CoE as work in progress. Keep refining it here, then submit it for triage."}
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {a && (
        <>
          <section>
            <div className="text-[15px] leading-[22px] font-medium">{useCase.title}</div>
            <p className="mt-2 text-[13px] leading-5 text-muted">{a.one_liner}</p>
          </section>

          {/* The readiness sheet: one row per framework criterion, ruled like a form */}
          <section className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex h-10 items-center justify-between border-b border-line px-4">
              <SectionLabel>Assessment</SectionLabel>
              <span className="text-xs text-subtle">Score out of 5</span>
            </div>
            <ol className="divide-y divide-line">
              {DIMENSIONS.map((d, i) => {
                const s = a.dimensions.find((x) => x.key === d.key);
                const score = s?.score ?? 0;
                const low = score < MIN_DIMENSION_SCORE;
                return (
                  <li key={d.key} className="grid grid-cols-[20px_1fr_auto_20px] gap-x-3 px-4 py-3" title={d.description}>
                    <span className="font-mono text-xs leading-5 text-subtle">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[13px] leading-5">{d.label}</span>
                    <span className="flex h-5 items-center">
                      <ScoreBar score={score} />
                    </span>
                    <span className={clsx("text-right font-mono text-xs leading-5 tabular-nums", low ? "text-bad" : "text-muted")}>
                      {score}
                    </span>
                    {s?.gap && <p className="col-start-2 col-end-5 mt-1 text-xs leading-[18px] text-subtle">{s.gap}</p>}
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-line px-4 py-2 text-xs text-subtle">
              Scored against {FRAMEWORK.name}
              {FRAMEWORK.version && ` v${FRAMEWORK.version}`}
            </div>
          </section>

          {!submitted && !readOnly && a.next_questions.length > 0 && (
            <section>
              <SectionLabel className="mb-2">Sharpen it next</SectionLabel>
              <div className="flex flex-col gap-2">
                {a.next_questions.map((q) => (
                  <button
                    key={q}
                    onClick={() => onAsk(q)}
                    className="group flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-[13px] leading-5 transition-colors duration-150 hover:border-line-strong hover:bg-raised"
                  >
                    <span className="flex-1">{q}</span>
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-subtle group-hover:text-foreground" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 gap-x-4 gap-y-1">
            <SectionLabel>Indicative pathway</SectionLabel>
            <SectionLabel>Est. annual value</SectionLabel>
            <div className="text-[13px]">{labelOf.pathway(a.indicative_pathway)}</div>
            <div className="font-mono text-[13px] tabular-nums">{formatAUD(a.estimated_annual_value_aud)}</div>
            <p className="col-span-2 mt-2 text-xs leading-[18px] text-subtle">{a.pathway_rationale}</p>
          </section>

          <section>
            <SectionLabel className="mb-2">AI patterns</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {a.ai_patterns.map((p) => (
                <Tag key={p}>{labelOf.pattern(p)}</Tag>
              ))}
            </div>
          </section>

          {(similar.length > 0 || similarHidden > 0) && (
            <section>
              <SectionLabel className="mb-2">Similar use cases already in the portfolio</SectionLabel>
              <ul className="flex flex-col gap-2">
                {similar.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-[13px]">
                    <CaseId id={s.id} />
                    <span className="truncate">{s.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-subtle">{s.business_unit}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-[18px] text-subtle">
                {similarHidden > 0 &&
                  `${similarHidden}${similar.length ? " more" : ""} ${similarHidden === 1 ? "is" : "are"} private to other teams; the AI CoE can connect you. `}
                Shared logic can mean faster delivery through reuse
              </p>
            </section>
          )}

          <section className="rounded-xl border border-line bg-surface">
            <button
              onClick={() => setShowCaptured((v) => !v)}
              className="flex h-10 w-full items-center justify-between px-4"
              aria-expanded={showCaptured}
            >
              <SectionLabel>What we&apos;ve captured</SectionLabel>
              <ChevronDown
                className={clsx("size-4 text-subtle transition-transform duration-150", showCaptured && "rotate-180")}
                strokeWidth={1.5}
              />
            </button>
            {showCaptured && (
              <dl className="flex flex-col gap-3 border-t border-line px-4 py-4">
                {Object.entries(a.captured).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-subtle">{CAPTURED_LABELS[k] ?? k}</dt>
                    <dd className={clsx("mt-1 text-[13px] leading-5", !v && "text-subtle")}>{v || "Not yet covered"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </>
      )}

      {documents.length > 0 && (
        <section>
          <SectionLabel className="mb-2">Documents</SectionLabel>
          <ul className="flex flex-col gap-1">
            {documents.map((d) => (
              <li key={d.id} className="group flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px]">
                <FileText className="size-4 shrink-0 text-subtle" strokeWidth={1.5} />
                <span className="min-w-0 flex-1 truncate">{d.filename}</span>
                <span className="shrink-0 font-mono text-xs text-subtle">
                  {Math.max(1, Math.round(d.chars / 1000))}k chars{d.truncated ? ", truncated" : ""}
                </span>
                {!submitted && !readOnly && (
                  <button
                    onClick={() => onRemoveDoc(d.id)}
                    className="text-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-bad focus-visible:opacity-100"
                    aria-label={`Remove ${d.filename}`}
                  >
                    <X className="size-4" strokeWidth={1.5} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {submitted && coeLink && (
        <Link
          href={`/coe/use-cases/${useCase.id}`}
          className="text-center text-xs text-subtle underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
        >
          See how the AI CoE views this use case
        </Link>
      )}
    </div>
  );
}
