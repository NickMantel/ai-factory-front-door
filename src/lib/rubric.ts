// How use cases are assessed comes from the evaluation framework in frameworks/*.md (chosen by
// the FRAMEWORK environment variable at build time). This module turns it into the shapes the
// app uses; the lifecycle below is part of the app itself.
import source from "@framework";
import { parseFramework } from "./framework";

export const FRAMEWORK = parseFramework(source);

export const DIMENSIONS = FRAMEWORK.criteria.map((c) => ({
  key: c.key,
  label: c.label,
  weight: c.weight,
  description: c.summary,
}));

export type DimensionKey = string;
export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key) as [DimensionKey, ...DimensionKey[]];

/** Readiness (0-100) at which a use case may be submitted to the CoE. */
export const READINESS_THRESHOLD = FRAMEWORK.threshold;
/** No single dimension may score below this (0-5) for submission. */
export const MIN_DIMENSION_SCORE = FRAMEWORK.minScore;

export const PATHWAYS = FRAMEWORK.pathways;
export type PathwayKey = string;
export const PATHWAY_KEYS = PATHWAYS.map((p) => p.key) as [PathwayKey, ...PathwayKey[]];

export const AI_PATTERNS = FRAMEWORK.patterns;
export type AIPatternKey = string;
export const AI_PATTERN_KEYS = AI_PATTERNS.map((p) => p.key) as [AIPatternKey, ...AIPatternKey[]];

export const BUSINESS_UNITS = FRAMEWORK.businessUnits;

export const STATUSES = [
  // Drafts are private workspaces; a use case becomes a record the CoE sees once it is
  // submitted, either as work in progress or for triage.
  { key: "draft", label: "Draft", stage: -2 },
  { key: "shaping", label: "Work in progress", stage: 0 },
  { key: "submitted", label: "Submitted", stage: 2 },
  { key: "triage", label: "In triage", stage: 3 },
  { key: "approved", label: "Approved", stage: 4 },
  { key: "in_delivery", label: "In delivery", stage: 5 },
  { key: "live", label: "Live", stage: 6 },
  { key: "parked", label: "Parked", stage: -1 },
  { key: "declined", label: "Declined", stage: -1 },
] as const;

export type StatusKey = (typeof STATUSES)[number]["key"];

/** Funnel stages; a use case counts toward every stage up to its furthest. */
export const FUNNEL = [
  { key: "registered", label: "Registered" },
  { key: "ready", label: "Triage-ready" },
  { key: "submitted", label: "Submitted" },
  { key: "triage", label: "Triaged" },
  { key: "approved", label: "Approved" },
  { key: "in_delivery", label: "In delivery" },
  { key: "live", label: "Live" },
] as const;

export const VISIBILITIES = [
  { key: "private", label: "Private", description: "Only you and the people you add can see it" },
  { key: "public", label: "Organisation", description: "Anyone in the organisation can view it once submitted" },
] as const;

export type Visibility = (typeof VISIBILITIES)[number]["key"];

export const labelOf = {
  dimension: (k: string) => DIMENSIONS.find((d) => d.key === k)?.label ?? k,
  pathway: (k: string | null | undefined) => PATHWAYS.find((p) => p.key === k)?.label ?? "—",
  pathwayShort: (k: string | null | undefined) => PATHWAYS.find((p) => p.key === k)?.short ?? "—",
  pattern: (k: string) => AI_PATTERNS.find((p) => p.key === k)?.label ?? k,
  status: (k: string) => STATUSES.find((s) => s.key === k)?.label ?? k,
};

export function computeReadiness(scores: { key: string; score: number }[]): number {
  let total = 0;
  let max = 0;
  for (const d of DIMENSIONS) {
    const s = scores.find((x) => x.key === d.key)?.score ?? 0;
    total += Math.max(0, Math.min(5, s)) * d.weight;
    max += 5 * d.weight;
  }
  return Math.round((total / max) * 100);
}

export function meetsThreshold(readiness: number, scores: { key: string; score: number }[]) {
  const weakest = DIMENSIONS.map((d) => scores.find((x) => x.key === d.key)?.score ?? 0);
  return readiness >= READINESS_THRESHOLD && Math.min(...weakest) >= MIN_DIMENSION_SCORE;
}

const indent = (text: string) => text.replace(/\n/g, "\n  ");

/** The framework rendered for prompts, so the model and the UI never disagree. */
export function rubricForPrompt() {
  const scale = FRAMEWORK.scale.map((s, i) => `${i} = ${s}`).join(", ");
  const dims = FRAMEWORK.criteria
    .map((c) => `- ${c.key} ("${c.label}", weight ${c.weight}):\n  ${indent(c.description)}`)
    .join("\n");
  const paths = PATHWAYS.map((p) => `- ${p.key} ("${p.label}"): ${p.description}`).join("\n");
  const patterns = AI_PATTERNS.map((p) => `- ${p.key}: ${p.label}${p.description ? `: ${p.description}` : ""}`).join("\n");
  return `## Assessment dimensions (each scored 0-5)
${scale}.
${dims}

Triage threshold: weighted readiness of ${READINESS_THRESHOLD}% or more AND no dimension below ${MIN_DIMENSION_SCORE}.

## Recommended pathways
${paths}

## AI patterns
${patterns}${FRAMEWORK.guidance ? `\n\n## Guidance from the AI CoE\n${FRAMEWORK.guidance}` : ""}`;
}
