// Reads an evaluation framework written in plain Markdown (see frameworks/default.md) into the
// structure the app uses. No dependencies, so the check script can run it with plain Node.

export type Criterion = {
  key: string;
  label: string;
  weight: number;
  /** First paragraph, for tooltips. */
  summary: string;
  /** Everything written under the criterion, for the model. */
  description: string;
};
export type Pathway = { key: string; label: string; short: string; description: string };
export type Pattern = { key: string; label: string; description: string };

export type Framework = {
  name: string;
  version: string;
  organisation: string;
  threshold: number;
  minScore: number;
  /** What each score from 0 to 5 means. */
  scale: string[];
  businessUnits: string[];
  criteria: Criterion[];
  pathways: Pathway[];
  patterns: Pattern[];
  guidance: string;
};

export class FrameworkError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(`The evaluation framework has ${problems.length === 1 ? "a problem" : `${problems.length} problems`}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "FrameworkError";
    this.problems = problems;
  }
}

const WEIGHTS: Record<string, number> = { low: 0.75, medium: 1, high: 1.5 };

const DEFAULT_SCALE = [
  "Not addressed",
  "Mentioned only",
  "Partly described",
  "Clearly described",
  "Described with evidence",
  "Evidenced, quantified and owned",
];

const SECTIONS = {
  settings: ["settings"],
  businessUnits: ["business units"],
  scale: ["scoring scale"],
  criteria: ["criteria", "assessment criteria", "evaluation criteria"],
  pathways: ["pathways", "recommended pathways"],
  patterns: ["ai patterns", "patterns"],
  guidance: ["guidance", "guidance for the assistant"],
} as const;
type SectionName = keyof typeof SECTIONS;

/** "Value & outcomes" -> "value_outcomes". Keys are stored with assessments, so names should stay stable. */
export const keyFor = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const clean = (s: string) => s.replace(/\n{3,}/g, "\n\n").trim();
const bullets = (body: string) =>
  body
    .split("\n")
    .map((l) => l.match(/^\s*[-*+]\s+(.+)$/)?.[1].trim())
    .filter((l): l is string => !!l);

/** Splits text on headings of the given level, keeping any text before the first one. */
function splitHeadings(text: string, level: number) {
  const marker = new RegExp(`^${"#".repeat(level)}\\s+(.+?)\\s*#*\\s*$`);
  const parts: { title: string; body: string }[] = [];
  let preamble = "";
  for (const line of text.split("\n")) {
    const m = line.match(marker);
    if (m) parts.push({ title: m[1].trim(), body: "" });
    else if (parts.length) parts[parts.length - 1].body += line + "\n";
    else preamble += line + "\n";
  }
  return { preamble, parts };
}

/** Pulls "Name: value" lines out of a block of text, returning the remaining text. */
function takeFields(body: string, names: string[]) {
  const fields: Record<string, string> = {};
  const rest: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(?:[-*+]\s+)?\**([A-Za-z][A-Za-z ]*?)\**\s*:\s*(.+)$/);
    const name = m?.[1].trim().toLowerCase();
    if (m && name && names.includes(name) && !(name in fields)) fields[name] = m[2].trim();
    else rest.push(line);
  }
  return { fields, rest: clean(rest.join("\n")) };
}

export function parseFramework(markdown: string, source = "the framework file"): Framework {
  const problems: string[] = [];
  const text = markdown.replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "");

  const { preamble: top, parts: titled } = splitHeadings(text, 1);
  const name = titled[0]?.title ?? "Evaluation framework";
  const { parts } = splitHeadings(titled.length ? titled.map((t) => t.body).join("\n") : top, 2);

  const found: Partial<Record<SectionName, string>> = {};
  for (const p of parts) {
    const title = p.title.toLowerCase();
    const section = (Object.keys(SECTIONS) as SectionName[]).find((k) =>
      (SECTIONS[k] as readonly string[]).includes(title),
    );
    if (!section) {
      problems.push(
        `"## ${p.title}" isn't a section the app understands. Use: ${Object.values(SECTIONS).map((v) => `"${v[0]}"`).join(", ")}. Put notes for editors in <!-- comments -->.`,
      );
    } else if (found[section] !== undefined) {
      problems.push(`"## ${p.title}" appears more than once.`);
    } else {
      found[section] = p.body;
    }
  }

  // Settings
  const settings = takeFields(found.settings ?? "", [
    "organisation",
    "organization",
    "version",
    "triage threshold",
    "minimum score per criterion",
  ]).fields;
  const number = (field: string, fallback: number, min: number, max: number) => {
    const raw = settings[field];
    if (raw === undefined) return fallback;
    const n = Number(raw.match(/-?\d+(\.\d+)?/)?.[0]);
    if (!Number.isFinite(n) || n < min || n > max) {
      problems.push(`Settings: "${field}: ${raw}" should be a number from ${min} to ${max}.`);
      return fallback;
    }
    return n;
  };
  const threshold = number("triage threshold", 70, 1, 100);
  const minScore = number("minimum score per criterion", 2, 0, 5);

  // Scoring scale
  let scale = DEFAULT_SCALE;
  if (found.scale !== undefined) {
    const levels: string[] = [];
    for (const line of found.scale.split("\n")) {
      const m = line.match(/^\s*(?:[-*+]\s+)?([0-5])\s*[:.)\-–—]\s*(.+)$/);
      if (m) levels[Number(m[1])] = m[2].trim();
    }
    const missing = [0, 1, 2, 3, 4, 5].filter((i) => !levels[i]);
    if (missing.length) problems.push(`Scoring scale: describe every score from 0 to 5 (missing ${missing.join(", ")}).`);
    else scale = levels;
  }

  // Business units
  const businessUnits = bullets(found.businessUnits ?? "");
  if (!businessUnits.length) problems.push(`Business units: list at least one, one per line starting with "-".`);

  // Criteria
  const criteria: Criterion[] = [];
  const criteriaParts = splitHeadings(found.criteria ?? "", 3).parts;
  if (!criteriaParts.length) problems.push(`Criteria: add at least one criterion as a "### Name" heading.`);
  for (const p of criteriaParts) {
    const { fields, rest } = takeFields(p.body, ["weight"]);
    const raw = fields.weight?.toLowerCase();
    let weight = 1;
    if (raw !== undefined) {
      const n = WEIGHTS[raw] ?? Number(raw);
      if (Number.isFinite(n) && n > 0) weight = n;
      else problems.push(`Criteria › "${p.title}": weight "${fields.weight}" isn't recognised. Use low, medium, high, or a number such as 1.25.`);
    }
    if (!rest) problems.push(`Criteria › "${p.title}": describe what the assessor should look for.`);
    criteria.push({ key: keyFor(p.title), label: p.title, weight, summary: rest.split(/\n\s*\n/)[0].replace(/\s+/g, " "), description: rest });
  }

  // Pathways: "### Proof of concept (PoC)" gives a short label for charts.
  const pathways: Pathway[] = [];
  const pathwayParts = splitHeadings(found.pathways ?? "", 3).parts;
  if (!pathwayParts.length) problems.push(`Pathways: add at least one pathway as a "### Name" heading.`);
  for (const p of pathwayParts) {
    const m = p.title.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const label = m ? m[1] : p.title;
    const description = clean(p.body);
    if (!description) problems.push(`Pathways › "${label}": describe when this pathway applies.`);
    pathways.push({ key: keyFor(label), label, short: m ? m[2] : label, description });
  }

  // AI patterns: "- Name" or "- Name: what it covers"
  const patterns: Pattern[] = bullets(found.patterns ?? "").map((line) => {
    const m = line.match(/^(.+?)\s*:\s+(.+)$/);
    const label = m ? m[1] : line;
    return { key: keyFor(label), label, description: m ? m[2] : "" };
  });
  if (!patterns.length) problems.push(`AI patterns: list at least one, one per line starting with "-".`);

  for (const [what, list] of [
    ["Criteria", criteria],
    ["Pathways", pathways],
    ["AI patterns", patterns],
  ] as const) {
    const seen = new Set<string>();
    for (const item of list) {
      if (!item.key) problems.push(`${what}: "${item.label}" needs letters or numbers in its name.`);
      else if (seen.has(item.key)) problems.push(`${what}: "${item.label}" is listed twice.`);
      seen.add(item.key);
    }
  }
  if (new Set(businessUnits).size !== businessUnits.length) problems.push("Business units: a business unit is listed twice.");

  if (problems.length) throw new FrameworkError(problems.map((p) => `${source}: ${p}`));

  return {
    name,
    version: settings.version ?? "",
    organisation: settings.organisation ?? settings.organization ?? "the organisation",
    threshold,
    minScore,
    scale,
    businessUnits,
    criteria,
    pathways,
    patterns,
    guidance: clean(found.guidance ?? ""),
  };
}
