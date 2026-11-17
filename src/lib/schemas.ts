import { z } from "zod";
import { AI_PATTERN_KEYS, DIMENSION_KEYS, PATHWAY_KEYS } from "./rubric";

// Live assessment, refreshed after every intake turn. Drives the BU "canvas".
export const AssessmentSchema = z.object({
  working_title: z.string().describe("Short, specific title for the use case (max ~8 words)."),
  one_liner: z.string().describe("One sentence: who it helps, what it does, the outcome."),
  dimensions: z
    .array(
      z.object({
        key: z.enum(DIMENSION_KEYS),
        score: z.number().int().describe("0-5 per the rubric"),
        rationale: z.string().describe("One sentence on why this score."),
        gap: z.string().describe("The single most useful thing missing for this dimension; empty if none."),
      }),
    )
    .describe("Exactly one entry per rubric dimension, in rubric order."),
  captured: z.object({
    problem: z.string(),
    users_and_volumes: z.string(),
    current_process: z.string(),
    desired_outcome: z.string(),
    data_sources: z.string(),
    proposed_solution: z.string(),
    value_hypothesis: z.string(),
    risks: z.string(),
    sponsor: z.string(),
  }).describe("What is known so far for each field, in concise plain English. Empty string if unknown."),
  ai_patterns: z.array(z.enum(AI_PATTERN_KEYS)).describe("1-3 AI patterns that best describe the solution."),
  strengths: z.array(z.string()).describe("Up to 3 short strengths of the use case as articulated."),
  next_questions: z.array(z.string()).describe("Up to 3 highest-leverage questions to sharpen the use case."),
  indicative_pathway: z.enum(PATHWAY_KEYS),
  pathway_rationale: z.string(),
  estimated_annual_value_aud: z
    .number()
    .nullable()
    .describe("Order-of-magnitude annual value in AUD if inferable from what the BU said; null otherwise."),
  similar_use_case_ids: z
    .array(z.string())
    .describe("IDs of existing portfolio use cases with substantially the same AI pattern or logic."),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

// The standardised artefact the CoE receives on submission.
export const BriefSchema = z.object({
  title: z.string(),
  executive_summary: z.string().describe("3-4 sentences a CoE lead can read in 20 seconds."),
  problem_statement: z.string(),
  current_state: z.string().describe("As-is process, volumes and pain."),
  target_users: z.string(),
  proposed_solution: z.string(),
  how_ai_helps: z.string().describe("Why AI specifically, and where humans stay in the loop."),
  ai_patterns: z.array(z.enum(AI_PATTERN_KEYS)),
  data: z.array(
    z.object({
      source: z.string(),
      description: z.string(),
      readiness: z.enum(["available", "partial", "unknown", "not_available"]),
      sensitivity: z.enum(["public", "internal", "confidential", "personal_information"]),
    }),
  ),
  value: z.object({
    hypothesis: z.string(),
    metrics: z.array(z.object({ metric: z.string(), baseline: z.string(), target: z.string() })),
    estimated_annual_value_aud: z.number().nullable(),
    confidence: z.enum(["low", "medium", "high"]),
  }),
  feasibility: z.string(),
  risks: z.array(
    z.object({ risk: z.string(), severity: z.enum(["low", "medium", "high"]), mitigation: z.string() }),
  ),
  dependencies: z.array(z.string()),
  stakeholders: z.array(z.object({ role: z.string(), who: z.string() })),
  recommended_pathway: z.enum(PATHWAY_KEYS),
  pathway_rationale: z.string(),
  alternative_pathways: z.array(z.object({ pathway: z.enum(PATHWAY_KEYS), why_not: z.string() })),
  reuse_opportunities: z
    .string()
    .describe("Overlap with existing portfolio use cases (name them) and what could be shared; empty if none."),
  open_questions_for_coe: z.array(z.string()),
  suggested_next_steps: z.array(z.string()),
});
export type Brief = z.infer<typeof BriefSchema>;

export const InsightsSchema = z.object({
  headline: z.string().describe("One-sentence read of the portfolio right now."),
  clusters: z.array(
    z.object({
      name: z.string().describe("Name of the shared capability, e.g. 'Parcel image inspection'."),
      shared_logic: z.string().describe("What is fundamentally common across these use cases."),
      use_case_ids: z.array(z.string()),
      opportunity: z.string().describe("The economy-of-scale play: build once, reuse how?"),
    }),
  ),
  observations: z.array(z.string()).describe("3-5 sharp observations for the CoE (gaps, risks, hotspots)."),
  recommended_focus: z.array(z.string()).describe("Up to 3 prioritisation recommendations."),
});
export type Insights = z.infer<typeof InsightsSchema>;
