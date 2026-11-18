---
name: evaluation-framework
description: Change how the AI Factory Front Door assesses use cases - criteria, weights, the triage threshold, the scoring scale, business units, pathways, AI patterns or guidance for the intake assistant - or set up a framework for a new business. Use when someone asks to add, remove, reword or reweight a criterion, change the threshold, add a business unit, or adapt the app to another organisation.
---

# Editing the evaluation framework

How use cases are assessed is defined in plain English in `frameworks/<name>.md`. The app uses
`frameworks/default.md` unless the `FRAMEWORK` environment variable names another file. The intake
assistant, readiness score, canvas, brief and CoE dashboard all read it, so edit only that file:
never hard-code criteria, weights or business units in `src/`.

## Steps

1. Read the framework file in full, including the `<!-- -->` notes, before changing it.
2. Make the change the person asked for, in their words where possible. Follow the format already
   in the file:
   - Sections are `## Settings`, `## Business units`, `## Scoring scale`, `## Criteria`,
     `## Pathways`, `## AI patterns`, `## Guidance for the assistant`. Don't rename or add sections.
   - Each criterion is a `### Name` with a `Weight:` line (low, medium, high or a number; medium = 1)
     and a plain description of what the assessor should look for. A "Good looks like:" example
     helps the assistant coach people.
   - Each pathway is a `### Name (Short name)`; the short name is used on charts.
   - Business units and AI patterns are `- ` lists. A pattern may add `: what it covers`.
3. Run `npm run framework:check` (or `npm run framework:check <name>` for another file) and fix
   anything it reports.
4. Tell the person what changed, using the check's output: each criterion's share of the readiness
   score, the threshold and the minimum score.

## Things to point out

- **Names are identities.** Renaming a criterion, pathway or pattern counts as removing it and adding
  a new one: existing use cases lose that score until someone next chats on them. If they only want
  better wording, change the description, not the `###` name, unless they confirm the rename.
- Weight and threshold changes re-score every existing use case at once, which can move use cases
  across the triage line. Say so when that's likely.
- A framework for a new business goes in a new file (copy `frameworks/example-bank.md` as a
  starting point) and is chosen per deployment with `FRAMEWORK=<file name without .md>`.
- In `npm run dev`, saved changes apply straight away. The deployed site picks them up when they
  are committed, pushed and deployed. A file that fails the check also fails the build, so the live
  site keeps the previous version.
