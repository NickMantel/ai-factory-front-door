import "server-only";
import {
  documentTexts,
  getUseCase,
  listMessages,
  listUseCases,
  saveAssessment,
  saveBrief,
  saveInsights,
} from "./db";
import { generateObject } from "./claude";
import { AssessmentSchema, BriefSchema, InsightsSchema } from "./schemas";
import { assessPrompt, assessSystem, briefPrompt, briefSystem, coePortfolioSystem, insightsPrompt } from "./prompts";
import { DIMENSIONS, computeReadiness, meetsThreshold } from "./rubric";

export async function runAssessment(id: string) {
  const uc = getUseCase(id);
  if (!uc) throw new Error("Use case not found");
  const all = listUseCases();
  const a = await generateObject({
    schema: AssessmentSchema,
    system: assessSystem(all, id),
    prompt: assessPrompt(uc, listMessages(id, "intake"), documentTexts(id)),
  });
  // Normalise to exactly one entry per rubric dimension, in order.
  a.dimensions = DIMENSIONS.map(
    (d) =>
      a.dimensions.find((x) => x.key === d.key) ?? { key: d.key, score: 0, rationale: "Not yet addressed.", gap: "" },
  ).map((d) => ({ ...d, score: Math.max(0, Math.min(5, Math.round(d.score))) }));
  const known = new Set(all.map((u) => u.id));
  a.similar_use_case_ids = a.similar_use_case_ids.filter((x) => known.has(x) && x !== id);

  const scores = a.dimensions.map((d) => ({ key: d.key, score: d.score }));
  const readiness = computeReadiness(scores);
  // Keep a title the submitter chose themselves; adopt the model's once the BU has said enough.
  saveAssessment(id, a, readiness, meetsThreshold(readiness, scores), { keepTitle: uc.status !== "draft" });
  return getUseCase(id)!;
}

export async function submitUseCase(id: string) {
  const uc = getUseCase(id);
  if (!uc) throw new Error("Use case not found");
  const brief = await generateObject({
    schema: BriefSchema,
    system: briefSystem(listUseCases(), id),
    prompt: briefPrompt(uc, listMessages(id, "intake"), documentTexts(id)),
  });
  saveBrief(id, brief, uc.submitter);
  return getUseCase(id)!;
}

export async function generateInsights() {
  const insights = await generateObject({
    schema: InsightsSchema,
    system: coePortfolioSystem(listUseCases()),
    prompt: insightsPrompt(),
  });
  saveInsights(insights);
  return insights;
}
