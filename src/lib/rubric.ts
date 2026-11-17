// Single source of truth for how use cases are assessed, routed and tracked.
// Edit this file to tune the front door to your CoE's own triage criteria.

export const DIMENSIONS = [
  {
    key: "problem_clarity",
    label: "Problem clarity",
    weight: 1.5,
    description:
      "A specific, evidenced pain point: who is affected, how often, and what it costs today.",
  },
  {
    key: "value",
    label: "Value & outcomes",
    weight: 1.5,
    description:
      "A quantified value hypothesis (time, cost, revenue, risk, CX) with measurable success metrics.",
  },
  {
    key: "process_users",
    label: "Process & users",
    weight: 1,
    description:
      "The as-is process, volumes, the people involved and where the proposed solution fits in their workflow.",
  },
  {
    key: "data_readiness",
    label: "Data readiness",
    weight: 1.25,
    description:
      "Known data sources, ownership, access, quality, volume and sensitivity (PII, commercial-in-confidence).",
  },
  {
    key: "ai_fit",
    label: "AI fit & concept",
    weight: 1.25,
    description:
      "Why AI (vs rules/BI/automation), which AI pattern applies, and where humans stay in the loop.",
  },
  {
    key: "feasibility",
    label: "Feasibility & integration",
    weight: 0.75,
    description:
      "Systems to integrate with, technical constraints, timeframes and existing platforms or vendors.",
  },
  {
    key: "risk",
    label: "Risk & responsible AI",
    weight: 1,
    description:
      "Privacy, security, customer and workforce impact, regulatory obligations and how errors are caught.",
  },
  {
    key: "ownership",
    label: "Ownership & adoption",
    weight: 0.75,
    description:
      "An accountable sponsor and product owner, funding signals, and a plan for change and adoption.",
  },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];
export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key) as [DimensionKey, ...DimensionKey[]];

/** Readiness (0-100) at which a use case may be submitted to the CoE. */
export const READINESS_THRESHOLD = 70;
/** No single dimension may score below this (0-5) for submission. */
export const MIN_DIMENSION_SCORE = 2;

export const PATHWAYS = [
  { key: "reuse_extend", label: "Reuse / extend existing capability", short: "Reuse", description: "A similar AI capability exists or is in flight; extend it rather than build new." },
  { key: "buy_saas", label: "Buy / leverage SaaS", short: "Buy / SaaS", description: "A commercial product or a feature of an existing platform covers the need." },
  { key: "low_code_agent", label: "Low-code agent", short: "Low-code", description: "A business-built assistant or agent on an approved low-code platform." },
  { key: "poc", label: "Proof of concept", short: "PoC", description: "Value or feasibility is unproven; run a time-boxed PoC with clear exit criteria." },
  { key: "productionise", label: "Productionise / scale", short: "Productionise", description: "Value is proven (e.g. a successful pilot); harden, integrate and scale." },
  { key: "data_foundation", label: "Data foundations first", short: "Data first", description: "The data isn't ready; ingest, model or govern it before any AI build." },
  { key: "not_ai", label: "Non-AI solution", short: "Non-AI", description: "Better solved with process change, BI, rules or conventional automation." },
  { key: "needs_discovery", label: "Further discovery", short: "Discovery", description: "Too early to call; needs a structured discovery session." },
] as const;

export type PathwayKey = (typeof PATHWAYS)[number]["key"];
export const PATHWAY_KEYS = PATHWAYS.map((p) => p.key) as [PathwayKey, ...PathwayKey[]];

export const AI_PATTERNS = [
  { key: "computer_vision", label: "Computer vision" },
  { key: "document_understanding", label: "Document understanding & extraction" },
  { key: "knowledge_retrieval", label: "Knowledge retrieval (RAG)" },
  { key: "conversational_assistant", label: "Conversational assistant" },
  { key: "classification_routing", label: "Classification & routing" },
  { key: "forecasting_optimisation", label: "Forecasting & optimisation" },
  { key: "anomaly_detection", label: "Anomaly & fraud detection" },
  { key: "generative_content", label: "Content generation" },
  { key: "agentic_workflow", label: "Agentic workflow automation" },
  { key: "speech_analytics", label: "Speech & conversation analytics" },
  { key: "recommendation", label: "Recommendation & personalisation" },
] as const;

export type AIPatternKey = (typeof AI_PATTERNS)[number]["key"];
export const AI_PATTERN_KEYS = AI_PATTERNS.map((p) => p.key) as [AIPatternKey, ...AIPatternKey[]];

export const STATUSES = [
  { key: "draft", label: "Draft", stage: 0 },
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
  { key: "ideas", label: "Ideas captured" },
  { key: "ready", label: "Triage-ready" },
  { key: "submitted", label: "Submitted" },
  { key: "triage", label: "Triaged" },
  { key: "approved", label: "Approved" },
  { key: "in_delivery", label: "In delivery" },
  { key: "live", label: "Live" },
] as const;

export const BUSINESS_UNITS = [
  "Parcel & Logistics Operations",
  "Customer Contact",
  "Retail Network",
  "Fleet & Network Planning",
  "Finance",
  "People & Culture",
  "Marketing & Growth",
  "Legal, Risk & Compliance",
  "Technology",
  "Enterprise & Government",
];

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

/** Rubric rendered for prompts, so the model and the UI never disagree. */
export function rubricForPrompt() {
  const dims = DIMENSIONS.map(
    (d) => `- ${d.key} ("${d.label}", weight ${d.weight}): ${d.description}`,
  ).join("\n");
  const paths = PATHWAYS.map((p) => `- ${p.key} ("${p.label}"): ${p.description}`).join("\n");
  const patterns = AI_PATTERNS.map((p) => `- ${p.key}: ${p.label}`).join("\n");
  return `## Assessment dimensions (each scored 0-5)
0 = absent, 1 = mentioned only, 2 = partly described, 3 = clearly described, 4 = described with evidence, 5 = evidenced, quantified and owned.
${dims}

Triage threshold: weighted readiness of ${READINESS_THRESHOLD}% or more AND no dimension below ${MIN_DIMENSION_SCORE}.

## Recommended pathways
${paths}

## AI patterns
${patterns}`;
}
