import clsx from "clsx";
import type { Brief } from "@/lib/schemas";
import { labelOf } from "@/lib/rubric";
import { CaseId, SectionLabel, Tag, formatAUD } from "./ui";

const READINESS_DOT: Record<string, string> = {
  available: "bg-good",
  partial: "bg-warn",
  unknown: "bg-[#b4bccb]",
  not_available: "bg-bad",
};
const SEVERITY_DOT: Record<string, string> = {
  high: "bg-bad",
  medium: "bg-warn",
  low: "bg-[#b4bccb]",
};

function Dot({ className }: { className: string }) {
  return <span className={clsx("inline-block size-1.5 shrink-0 rounded-full", className)} aria-hidden />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-line py-6 sm:grid-cols-[160px_1fr] sm:gap-8">
      <SectionLabel className="pt-0.5">{title}</SectionLabel>
      <div className="min-w-0 text-sm leading-[22px]">{children}</div>
    </section>
  );
}

export function BriefView({
  brief,
  meta,
  embedded,
}: {
  brief: Brief;
  meta: { id: string; bu: string; submitter: string; date?: string | null };
  /** The page around it already shows the case number and title. */
  embedded?: boolean;
}) {
  return (
    <article>
      <div className="mb-8">
        {!embedded && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-subtle">
              <CaseId id={meta.id} />
              <span>{meta.bu}</span>
              <span>·</span>
              <span>{meta.submitter}</span>
              {meta.date && (
                <>
                  <span>·</span>
                  <span>
                    {new Date(meta.date).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-[28px] leading-[1.15] font-medium">{brief.title}</h1>
          </>
        )}
        <p className={clsx(!embedded && "mt-4", "max-w-[65ch] text-[15px] leading-6 text-muted")}>
          {brief.executive_summary}
        </p>
      </div>

      <div className="mb-2 grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
        <div>
          <SectionLabel>Recommended pathway</SectionLabel>
          <div className="mt-2 text-sm">{labelOf.pathway(brief.recommended_pathway)}</div>
        </div>
        <div>
          <SectionLabel>Est. annual value</SectionLabel>
          <div className="mt-2 text-sm">
            <span className="font-mono tabular-nums">{formatAUD(brief.value.estimated_annual_value_aud)}</span>
            <span className="ml-2 text-xs text-subtle">{brief.value.confidence} confidence</span>
          </div>
        </div>
        <div>
          <SectionLabel>AI patterns</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-1">
            {brief.ai_patterns.map((p) => (
              <Tag key={p}>{labelOf.pattern(p)}</Tag>
            ))}
          </div>
        </div>
      </div>

      <Section title="Problem statement">{brief.problem_statement}</Section>
      <Section title="Current state">{brief.current_state}</Section>
      <Section title="Target users">{brief.target_users}</Section>
      <Section title="Proposed solution">
        <p>{brief.proposed_solution}</p>
        <p className="mt-2 text-muted">
          <span className="text-foreground">How AI helps: </span>
          {brief.how_ai_helps}
        </p>
      </Section>

      {brief.data.length > 0 && (
        <Section title="Data">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-1.5 pr-3 font-medium">Source</th>
                  <th className="py-1.5 pr-3 font-medium">Description</th>
                  <th className="py-1.5 pr-3 font-medium">Readiness</th>
                  <th className="py-1.5 font-medium">Sensitivity</th>
                </tr>
              </thead>
              <tbody>
                {brief.data.map((d, i) => (
                  <tr key={i} className="border-b border-line last:border-0 align-top">
                    <td className="py-2 pr-3">{d.source}</td>
                    <td className="py-2 pr-3 text-muted">{d.description}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted">
                      <span className="inline-flex items-center gap-2">
                        <Dot className={READINESS_DOT[d.readiness]} />
                        {d.readiness.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2 whitespace-nowrap text-muted">{d.sensitivity.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Value">
        <p>{brief.value.hypothesis}</p>
        {brief.value.metrics.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-1.5 pr-3 font-medium">Metric</th>
                  <th className="py-1.5 pr-3 font-medium">Baseline</th>
                  <th className="py-1.5 font-medium">Target</th>
                </tr>
              </thead>
              <tbody>
                {brief.value.metrics.map((m, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3">{m.metric}</td>
                    <td className="py-2 pr-3 font-mono text-[13px] tabular-nums text-muted">{m.baseline}</td>
                    <td className="py-2 font-mono text-[13px] tabular-nums">{m.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Feasibility">{brief.feasibility}</Section>

      {brief.risks.length > 0 && (
        <Section title="Risks & controls">
          <ul className="space-y-2">
            {brief.risks.map((r, i) => (
              <li key={i} className="grid grid-cols-[72px_1fr] gap-2">
                <span className="flex h-[22px] items-center gap-2 text-xs text-muted">
                  <Dot className={SEVERITY_DOT[r.severity]} />
                  {r.severity}
                </span>
                <span>
                  {r.risk}
                  <span className="text-muted"> — {r.mitigation}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Pathway rationale">
        <p>{brief.pathway_rationale}</p>
        {brief.alternative_pathways.length > 0 && (
          <ul className="mt-2 space-y-1 text-muted">
            {brief.alternative_pathways.map((a, i) => (
              <li key={i}>
                <span className="text-foreground">Not {labelOf.pathway(a.pathway)}:</span> {a.why_not}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {brief.reuse_opportunities && <Section title="Reuse opportunities">{brief.reuse_opportunities}</Section>}

      {(brief.stakeholders.length > 0 || brief.dependencies.length > 0) && (
        <Section title="Stakeholders & dependencies">
          <div className="grid gap-4 sm:grid-cols-2">
            <ul className="space-y-1">
              {brief.stakeholders.map((s, i) => (
                <li key={i}>
                  <span className="text-muted">{s.role}:</span> {s.who}
                </li>
              ))}
            </ul>
            <ul className="list-disc space-y-1 pl-4">
              {brief.dependencies.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <Section title="Open questions for the CoE">
        <ul className="list-disc space-y-1 pl-4">
          {brief.open_questions_for_coe.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </Section>
      <Section title="Suggested next steps">
        <ol className="list-decimal space-y-1 pl-4">
          {brief.suggested_next_steps.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      </Section>
    </article>
  );
}

export function briefToMarkdown(b: Brief, meta: { id: string; bu: string; submitter: string }) {
  const lines = [
    `# ${b.title}`,
    `**${meta.id}** · ${meta.bu} · ${meta.submitter}`,
    "",
    `> ${b.executive_summary}`,
    "",
    `| Recommended pathway | Est. annual value | AI patterns |`,
    `|---|---|---|`,
    `| ${labelOf.pathway(b.recommended_pathway)} | ${formatAUD(b.value.estimated_annual_value_aud)} (${b.value.confidence} confidence) | ${b.ai_patterns.map(labelOf.pattern).join(", ")} |`,
    "",
    `## Problem statement\n${b.problem_statement}`,
    `## Current state\n${b.current_state}`,
    `## Target users\n${b.target_users}`,
    `## Proposed solution\n${b.proposed_solution}\n\n**How AI helps:** ${b.how_ai_helps}`,
    `## Data\n| Source | Description | Readiness | Sensitivity |\n|---|---|---|---|\n${b.data.map((d) => `| ${d.source} | ${d.description} | ${d.readiness} | ${d.sensitivity} |`).join("\n")}`,
    `## Value\n${b.value.hypothesis}\n\n| Metric | Baseline | Target |\n|---|---|---|\n${b.value.metrics.map((m) => `| ${m.metric} | ${m.baseline} | ${m.target} |`).join("\n")}`,
    `## Feasibility\n${b.feasibility}`,
    `## Risks & controls\n${b.risks.map((r) => `- **${r.severity}** — ${r.risk}. _Mitigation:_ ${r.mitigation}`).join("\n")}`,
    `## Pathway rationale\n${b.pathway_rationale}\n${b.alternative_pathways.map((a) => `- Not ${labelOf.pathway(a.pathway)}: ${a.why_not}`).join("\n")}`,
    b.reuse_opportunities ? `## Reuse opportunities\n${b.reuse_opportunities}` : "",
    `## Stakeholders\n${b.stakeholders.map((s) => `- ${s.role}: ${s.who}`).join("\n")}`,
    `## Dependencies\n${b.dependencies.map((d) => `- ${d}`).join("\n")}`,
    `## Open questions for the CoE\n${b.open_questions_for_coe.map((q) => `- ${q}`).join("\n")}`,
    `## Suggested next steps\n${b.suggested_next_steps.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
  ];
  return lines.filter(Boolean).join("\n\n");
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
