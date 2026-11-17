# AI Front Door

A demo of a self-service front door to an AI Centre of Excellence. Business units bring an AI idea (with Confluence exports, decks, PDFs and screenshots), get instant feedback and a live readiness score from Claude, and submit a standardised **Use Case Brief** once it clears the triage threshold. The AI CoE gets a portfolio view: funnel, pattern clusters, a prioritisation matrix, and a Claude copilot for questions about one use case or across all of them.

## Run it

```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm install
npm run dev
```

Open http://localhost:3000. The SQLite database (`data/frontdoor.db`) is created and seeded with 16 synthetic use cases on first run. **Reset demo data** on the CoE dashboard restores the seed.

Requires Node 22.5+ (uses the built-in `node:sqlite`; no native modules).

## The two views

**Business unit** (`/`, `/use-cases/[id]`)
- Chat with the intake agent. Drop in PDF, DOCX, PPTX (including speaker notes), XLSX, HTML/Confluence exports, Markdown or images (described by Claude at upload).
- After every reply the **canvas** re-scores the use case on 8 weighted dimensions, lists the gaps, suggests the next questions (click one to work on it), proposes an indicative pathway and flags similar use cases already in the portfolio.
- At ≥70% readiness with no dimension below 2/5, **Submit to AI CoE** generates the Use Case Brief (exportable as Markdown or printable to PDF).

**AI CoE** (`/coe`, `/coe/use-cases/[id]`)
- KPIs, opportunity funnel, AI-pattern / business-unit / pathway breakdowns (click to filter), value-vs-readiness matrix, full table.
- **Portfolio insights**: Claude clusters use cases that share logic (the build-once, reuse-many opportunities) and recommends where to focus.
- **Ask the portfolio** and per-use-case **Interrogate** copilots, with persistent threads.
- Status workflow with decision notes and a timeline: Draft → Submitted → In triage → Approved → In delivery → Live (or Parked / Declined).

## How it's built

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, Tailwind 4 |
| Intelligence | Claude (`claude-opus-5-5`) via `@anthropic-ai/sdk`: streaming chat, structured outputs (Zod) for assessment / brief / insights, prompt caching, server-side refusal fallback |
| Storage | SQLite via `node:sqlite` (`src/lib/db.ts`) |
| Docs | `unpdf`, `mammoth`, `jszip` text extraction (`src/lib/extract.ts`) |

Key files:
- `src/lib/rubric.ts`: dimensions, weights, threshold, pathways, AI patterns, statuses. **Tune the CoE's criteria here**; prompts and UI both read from it.
- `src/lib/prompts.ts`: intake agent, assessor, brief writer and CoE copilot prompts.
- `src/lib/schemas.ts`: the Assessment, Use Case Brief and Insights schemas (the standard artefacts).
- `src/lib/seed.ts`: the demo portfolio.

## Demo notes and limits

- No authentication: anyone can switch views. The business-unit list is remembered per browser.
- The whole portfolio is placed in the copilot's context, which is fine for dozens to low hundreds of use cases; beyond that, switch to retrieval or tool-based queries.
- Scanned PDFs without a text layer aren't OCR'd; upload page images instead.
