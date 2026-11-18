// Checks an evaluation framework and prints what the app will use.
// Usage: npm run framework:check [name]   (name defaults to $FRAMEWORK, then "default")
import { readFileSync } from "node:fs";
import { FrameworkError, parseFramework } from "../src/lib/framework.ts";

const name = process.argv[2] || process.env.FRAMEWORK || "default";
const file = `frameworks/${name}.md`;

try {
  const f = parseFramework(readFileSync(file, "utf8"), file);
  const total = f.criteria.reduce((sum, c) => sum + c.weight, 0);
  console.log(`${file} is valid: "${f.name}"${f.version ? ` v${f.version}` : ""}\n`);
  console.log(`Submit for triage at ${f.threshold}% readiness, with every criterion at ${f.minScore}/5 or more.\n`);
  console.log("Criteria (share of the readiness score):");
  for (const c of f.criteria) console.log(`  ${((c.weight / total) * 100).toFixed(0).padStart(3)}%  ${c.label}`);
  console.log(`\nPathways: ${f.pathways.map((p) => p.label).join(", ")}`);
  console.log(`AI patterns: ${f.patterns.length}   Business units: ${f.businessUnits.length}`);
  console.log(`Guidance for the assistant: ${f.guidance ? "yes" : "none"}`);
} catch (e) {
  console.error(e instanceof FrameworkError ? e.message : `Couldn't read ${file}: ${(e as Error).message}`);
  process.exit(1);
}
