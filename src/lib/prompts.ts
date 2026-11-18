import "server-only";
import type { Message, UseCase } from "./db";
import {
  DIMENSIONS,
  MIN_DIMENSION_SCORE,
  READINESS_THRESHOLD,
  labelOf,
  rubricForPrompt,
} from "./rubric";

const ORG = process.env.ORG_NAME ?? "the organisation";

export function portfolioIndex(useCases: UseCase[], excludeId?: string, showVisibility = false) {
  return useCases
    .filter((u) => u.id !== excludeId)
    .map(
      (u) =>
        `- ${u.id}${showVisibility ? ` [${u.visibility}]` : ""} | ${u.title} | ${u.business_unit} | status: ${labelOf.status(u.status)} | patterns: ${u.patterns.map(labelOf.pattern).join(", ") || "n/a"} | ${u.one_liner}`,
    )
    .join("\n");
}

/** Use cases the person can't open, reduced to counts by AI pattern so nothing identifying leaks. */
function patternCounts(useCases: UseCase[]) {
  const counts = new Map<string, number>();
  for (const u of useCases) for (const p of u.patterns) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts].map(([p, n]) => `- ${labelOf.pattern(p)}: ${n}`).join("\n");
}

export function documentsBlock(docs: { filename: string; text: string }[]) {
  if (!docs.length) return "";
  return (
    "## Documents the business unit has uploaded\n\n" +
    docs.map((d) => `<document filename="${d.filename}">\n${d.text}\n</document>`).join("\n\n")
  );
}

export function transcriptText(messages: Message[]) {
  return messages
    .map((m) => `${m.role === "user" ? `BUSINESS UNIT${m.author ? ` (${m.author})` : ""}` : "INTAKE ASSISTANT"}: ${m.content}`)
    .join("\n\n");
}

function assessmentSnapshot(uc: UseCase) {
  const a = uc.assessment;
  if (!a) return "No assessment yet: this is the start of the conversation.";
  const dims = a.dimensions
    .map((d) => `- ${labelOf.dimension(d.key)}: ${d.score}/5${d.gap ? ` (gap: ${d.gap})` : ""}`)
    .join("\n");
  return `Readiness ${uc.readiness}% (threshold ${READINESS_THRESHOLD}%, every dimension at least ${MIN_DIMENSION_SCORE}/5). ${uc.ready ? "THRESHOLD MET: the business unit can submit to the AI CoE now." : "Threshold not yet met."}
${dims}`;
}

export const INTAKE_INSTRUCTIONS = `You are the AI Front Door: the intake partner of ${ORG}'s AI Centre of Excellence (AI CoE). Business units come to you with ideas for using AI. Your job is to give them instant, expert feedback and help them shape a compelling, triage-ready use case, so the CoE can review it without several discovery meetings.

How to behave:
- Be a sharp, encouraging product partner, not a gatekeeper. Write in Australian English, plainly, with no jargon the business wouldn't use.
- Keep each reply short: usually under 180 words. Lead with a one-line reaction to what they shared (be specific about what is strong), then give at most 2-3 concrete pointers or questions, prioritising the weakest high-weight rubric dimensions. Never ask more than 3 questions in one turn.
- When documents are uploaded, read them closely and reference specifics (numbers, systems, names) so the business unit sees you understood. Point out contradictions or gaps in them.
- Challenge gently when AI may not be the right tool (a rules engine, a report, a process fix, or an existing product may do), and say why.
- If the portfolio already has use cases with substantially the same logic (for example, another image-inspection use case), say so: reuse is a big deal for the CoE and can speed things up for the business unit. You may name only the use cases listed as visible to this team. Others are private to their teams: never guess at or describe them; just say the AI CoE is seeing similar demand elsewhere and can connect the teams.
- Several people from the business unit may work on the same use case. Their messages are labelled with their name when more than one person has contributed; address the person who just spoke and build on what colleagues said.
- Offer illustrative examples of what a good answer looks like when the business unit seems unsure (e.g. "something like: 'about 40k parcels a day fail OCR, costing ~120 FTE in manual keying'").
- Never promise approval, funding or timelines; the AI CoE makes those decisions.
- Until it is submitted, the use case is a private draft that only the people on it can see. They can "Save as work in progress" at any time to register it with the AI CoE early, or "Submit for triage" once the readiness threshold is met (which writes the standard brief). When the threshold is met, tell them so and mention anything still worth adding.
- Use light markdown (bold, short lists) only where it helps scanning.`;

export function intakeSystem(
  uc: UseCase,
  visible: UseCase[],
  hidden: UseCase[],
  docs: { filename: string; text: string }[],
  speaker: string,
) {
  return [
    { text: `${INTAKE_INSTRUCTIONS}\n\n${rubricForPrompt()}`, cache: true },
    {
      text: `## Existing use cases visible to this team (you may name these)\n${portfolioIndex(visible, uc.id) || "None."}

## Private use cases elsewhere in the portfolio (counts only; never name or describe them)\n${patternCounts(hidden) || "None."}`,
    },
    { text: documentsBlock(docs), cache: docs.length > 0 },
    {
      text: `## This use case
ID: ${uc.id}
Business unit: ${uc.business_unit}
Owner: ${uc.submitter}
Status: ${labelOf.status(uc.status)}
Working title: ${uc.title}
Person you are talking with now: ${speaker}

## Current canvas assessment (updated after each turn)
${assessmentSnapshot(uc)}`,
    },
  ];
}

export function assessSystem(all: UseCase[], excludeId: string) {
  return [
    {
      text: `You are the assessment engine of an AI Centre of Excellence intake process. You score a business unit's AI use case against the rubric strictly on what has actually been stated in the conversation and documents: do not give credit for things that are merely plausible. Be calibrated: a vague one-paragraph idea should score mostly 1-2; a well-evidenced, owned proposal 4-5. Every rubric dimension must appear exactly once in dimensions, in rubric order (${DIMENSIONS.map((d) => d.key).join(", ")}). Gaps and next questions must be specific to this use case, not generic. The business unit reads everything except similar_use_case_ids, and some portfolio use cases are private to other teams, so never mention other use cases by title, ID or business unit in any text field; point to them only through similar_use_case_ids.

${rubricForPrompt()}`,
      cache: true,
    },
    { text: `## Existing portfolio (use these IDs for similar_use_case_ids; only include genuinely similar logic)\n${portfolioIndex(all, excludeId) || "Empty."}` },
  ];
}

export function assessPrompt(uc: UseCase, messages: Message[], docs: { filename: string; text: string }[]) {
  return `Assess this use case.

Business unit: ${uc.business_unit}
Submitter: ${uc.submitter}
Working title: ${uc.title}

${documentsBlock(docs)}

## Intake conversation
${transcriptText(messages) || "(no messages yet)"}`;
}

export function briefSystem(all: UseCase[], excludeId: string) {
  return [
    {
      text: `You are a senior AI Centre of Excellence analyst writing the standard Use Case Brief that the CoE reviews at triage. Write crisply, factually and in Australian English. Use only what the business unit has stated or uploaded; where something is unknown, say "Not yet confirmed" and add it to open_questions_for_coe rather than inventing it. Value estimates must be traceable to stated figures; otherwise null. Recommend the pathway the evidence supports, and list credible alternatives with why not. In reuse_opportunities, name overlapping portfolio use cases marked [public] by ID and title. Use cases marked [private] belong to other teams: never name or describe them; say only how many share the pattern and that the AI CoE can connect the teams. The brief is read by the business unit, so the same rule applies everywhere in it.

${rubricForPrompt()}`,
      cache: true,
    },
    { text: `## Existing portfolio\n${portfolioIndex(all, excludeId, true) || "Empty."}` },
  ];
}

export function briefPrompt(uc: UseCase, messages: Message[], docs: { filename: string; text: string }[]) {
  return `Write the Use Case Brief.

Business unit: ${uc.business_unit}
Submitter: ${uc.submitter}
Latest assessment (readiness ${uc.readiness}%): ${JSON.stringify(uc.assessment)}

${documentsBlock(docs)}

## Intake conversation
${transcriptText(messages)}`;
}

function dossier(uc: UseCase) {
  return `### ${uc.id}: ${uc.title}
Business unit: ${uc.business_unit} | Owner: ${uc.submitter} | Visibility: ${uc.visibility} | Status: ${labelOf.status(uc.status)} | Readiness: ${uc.readiness}% | Indicative pathway: ${labelOf.pathway(uc.pathway)} | Patterns: ${uc.patterns.map(labelOf.pattern).join(", ")} | Est. annual value: ${uc.est_value ? `A$${Math.round(uc.est_value).toLocaleString("en-AU")}` : "unknown"} | Created: ${uc.created_at.slice(0, 10)}${uc.submitted_at ? ` | Submitted: ${uc.submitted_at.slice(0, 10)}` : ""}
Summary: ${uc.one_liner}
${uc.assessment ? `Dimension scores (0-5): ${uc.assessment.dimensions.map((d) => `${d.key} ${d.score}`).join(", ")}` : ""}
${uc.brief ? `Brief: ${JSON.stringify(uc.brief)}` : uc.assessment ? `Captured: ${JSON.stringify(uc.assessment.captured)}` : ""}`;
}

const COE_INSTRUCTIONS = `You are the AI CoE analyst copilot. AI Centre of Excellence staff use you to interrogate business-unit AI use cases and the overall portfolio so they can prioritise and decide faster. Answer directly and analytically, citing use case IDs (e.g. UC-1003) for every claim about a use case. Surface overlaps and economies of scale (shared patterns, data or platforms), risks, missing evidence and sensible next steps. Use markdown tables when comparing several use cases. If the data doesn't support an answer, say so. Australian English.`;

export function coePortfolioSystem(all: UseCase[]) {
  return [
    { text: COE_INSTRUCTIONS, cache: true },
    {
      text: `## Rubric\n${rubricForPrompt()}\n\n## Portfolio (${all.length} use cases, as of ${new Date().toISOString().slice(0, 10)})\n\n${all.map(dossier).join("\n\n")}`,
      cache: true,
    },
  ];
}

export function coeUseCaseSystem(
  uc: UseCase,
  all: UseCase[],
  intake: Message[],
  docs: { filename: string; text: string }[],
) {
  return [
    { text: COE_INSTRUCTIONS, cache: true },
    {
      text: `## Rubric\n${rubricForPrompt()}\n\n## Portfolio index\n${portfolioIndex(all, uc.id)}`,
    },
    {
      text: `## Focus use case\n${dossier(uc)}\n\n${uc.assessment ? `Full assessment: ${JSON.stringify(uc.assessment)}` : ""}\n\n${documentsBlock(docs)}\n\n## Intake conversation with the business unit\n${transcriptText(intake) || "(none recorded)"}`,
      cache: true,
    },
  ];
}

export function insightsPrompt() {
  return `Analyse the whole portfolio. Identify clusters of use cases that share fundamentally the same AI logic, data or platform (only clusters of 2 or more), the economies-of-scale opportunity for each, and the most important observations and prioritisation recommendations for the AI CoE. Use exact use case IDs.`;
}
