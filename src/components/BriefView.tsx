import clsx from "clsx";
import type { Brief } from "@/lib/schemas";
import { labelOf } from "@/lib/rubric";
import { SectionLabel, Tag, formatAUD } from "./ui";

const READINESS_TONE: Record<string, string> = {
  available: "text-good",
  partial: "text-warn",
  unknown: "text-subtle",
  not_available: "text-bad",
};
const SEVERITY_TONE: Record<string, string> = {
  high: "bg-bad-soft text-bad",
  medium: "bg-warn-soft text-[#8a5a00]",
  low: "bg-[#f1f0ec] text-muted",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <SectionLabel className="mb-2">{title}</SectionLabel>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

export function BriefView({ brief, meta }: { brief: Brief; meta: { id: string; bu: string; submitter: string; date?: string | null } }) {
  return (
    <article>
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-mono">{meta.id}</span>
          <span>·</span>
          <span>{meta.bu}</span>
          <span>·</span>
          <span>{meta.submitter}</span>
          {meta.date && (
            <>
              <span>·</span>
              <span>{new Date(meta.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
            </>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{brief.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">{brief.executive_summary}</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-background/60 p-3">
          <SectionLabel>Recommended pathway</SectionLabel>
          <div className="mt-1 text-sm font-semibold">{labelOf.pathway(brief.recommended_pathway)}</div>
        </div>
        <div className="rounded-lg border border-line bg-background/60 p-3">
          <SectionLabel>Est. annual value</SectionLabel>
          <div className="mt-1 text-sm font-semibold">
            {formatAUD(brief.value.estimated_annual_value_aud)}
            <span className="ml-1.5 text-xs font-normal text-muted">{brief.value.confidence} confidence</span>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-background/60 p-3">
          <SectionLabel>AI patterns</SectionLabel>
          <div className="mt-1.5 flex flex-wrap gap-1">
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
        <p className="mt-2 text-foreground/75">
          <span className="font-medium text-foreground">How AI helps: </span>
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
                    <td className="py-2 pr-3 font-medium">{d.source}</td>
                    <td className="py-2 pr-3 text-foreground/80">{d.description}</td>
                    <td className={clsx("py-2 pr-3 whitespace-nowrap", READINESS_TONE[d.readiness])}>{d.readiness.replace(/_/g, " ")}</td>
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
                    <td className="py-2 pr-3 tabular-nums text-muted">{m.baseline}</td>
                    <td className="py-2 tabular-nums font-medium">{m.target}</td>
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
              <li key={i} className="flex gap-2.5">
                <span className={clsx("mt-0.5 h-5 shrink-0 rounded px-1.5 text-[11px] leading-5 font-medium", SEVERITY_TONE[r.severity])}>
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
          <ul className="mt-2 space-y-1 text-foreground/75">
            {brief.alternative_pathways.map((a, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">Not {labelOf.pathway(a.pathway)}:</span> {a.why_not}
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
