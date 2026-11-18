# AI Factory Front Door

A demo of a self-service front door to an AI Centre of Excellence. Business units bring an AI idea (with Confluence exports, decks, PDFs and screenshots), get instant feedback and a live readiness score from Claude, and submit a standardised **Use Case Brief** once it clears the triage threshold. The AI CoE gets a portfolio view: funnel, pattern clusters, a prioritisation matrix, and a Claude copilot for questions about one use case or across all of them.

## Run it

```bash
cp .env.example .env         # add ANTHROPIC_API_KEY
npm install
npm run dev
```

Open http://localhost:3000. The SQLite database (`data/frontdoor.db`) is created and seeded with 16 synthetic use cases on first run. **Reset demo data** on the CoE dashboard restores the seed.

Requires Node 22.5+ (uses the built-in `node:sqlite`; no native modules).

## Share it online (Render, free)

1. **Create the service.** In the Render dashboard choose **New → Blueprint** and pick this repository. Render reads `render.yaml`, which sets Node 24 and the build and start commands.
2. **Enter the two secrets** when Render asks:
   - `ANTHROPIC_API_KEY`: your Anthropic API key.
   - `ACCESS_PASSWORD`: a password to share with colleagues. Visitors are asked for a username and password; any username works.
3. **Deploy.** When it's live, Render shows a URL like `https://ai-front-door.onrender.com`. Every `git push` to `main` redeploys.

Free-plan limits: the service sleeps after about 15 minutes without visitors, and the first visit after that takes about 50 seconds. The SQLite file is on temporary disk, so **use cases created on Render reset to the demo portfolio whenever it sleeps or redeploys**. For data that persists, switch the service to the Starter plan, add a disk mounted at `/var/data`, and set `DATABASE_PATH=/var/data/frontdoor.db`.

`/api/health` stays open so Render can check the service; everything else needs the password. Behind it, each person signs in with their email, name and business unit (see below).

## Change how use cases are assessed

Everything about how use cases are judged lives in one plain-English file: [`frameworks/default.md`](frameworks/default.md). It sets:

- the **criteria** and how much each counts, with what the assessor should look for under each
- the **triage threshold** and the minimum score any one criterion needs
- what each **score from 0 to 5** means
- the **business units** people can sign in under
- the **pathways** the CoE can recommend and the **AI patterns** it tracks
- **guidance** for the intake assistant (house rules, things to always raise)

The intake assistant, the live readiness score, the canvas, the brief and the CoE dashboard all read from it, so a change shows up everywhere at once. It can't be edited from inside the app: change it in the repo, open a pull request, and the change deploys when it merges.

To change it:

1. Edit `frameworks/default.md`. Notes inside `<!-- -->` explain each section.
2. Run `npm run framework:check`, or watch it in `npm run dev`, which picks up each save. The check either summarises what the app will use (including each criterion's share of the score) or lists what to fix, in plain English.
3. Commit and push. If the file has a problem, the build fails and the live site keeps running the previous version.

Changes to weights and thresholds re-score every use case immediately. A new or renamed criterion is scored from the next time someone chats on a use case.

**More than one business.** Add another file, such as [`frameworks/example-bank.md`](frameworks/example-bank.md), and set `FRAMEWORK=example-bank` on that deployment (in Render: the `FRAMEWORK` environment variable). Each deployment assesses against its own framework. The demo portfolio is mapped onto whichever framework is active, but its use cases are still the postal-service examples.

If you use Claude Code, the `evaluation-framework` skill in `.claude/skills/` makes these edits from a plain request ("add a sustainability criterion worth about 10%") and runs the check.

## Who sees what

People sign in on `/sign-in` with their work email, name and business unit, or as the AI CoE team. This is a demo sign-in held in a signed cookie; in production it would be single sign-on, with the CoE role from a directory group. Set `COE_EMAILS` to a comma-separated list to restrict the CoE role to those people; left unset, anyone can choose it.

- **Private draft.** Starting a use case creates a draft that only its owner and the colleagues they add (by email, under **Share**) can see. Everyone on it can chat with the intake agent, add documents and submit; their messages are labelled with their names and open sessions pick up each other's turns within a few seconds. Conversations, documents, assessments and unsent text are all kept, so anyone can pick up where they left off.
- **Submitted record.** A draft becomes a record with a case number only when someone submits it: **Save as work in progress** registers it early at any readiness, and **Submit for triage** (≥70% readiness, no dimension below 2/5) writes the Use Case Brief. The AI CoE sees records, never drafts.
- **Visibility.** The owner chooses **Private** (only the people on it) or **Organisation** (anyone signed in can view it read-only once submitted). Business units never see other teams' private use cases: the intake agent only names use cases everyone on the conversation could open, and mentions the rest only as counts, and the brief follows the same rule.
- **AI CoE.** Only the CoE role can open `/coe`, the portfolio API and the copilot, and it sees every submitted use case across all business units.

## The two views

**Business unit** (`/`, `/use-cases/[id]`)
- Your use cases (drafts and records, owned or shared with you) and, separately, the use cases other teams opened to the organisation.
- Chat with the intake agent. Drop in PDF, DOCX, PPTX (including speaker notes), XLSX, HTML/Confluence exports, Markdown or images (described by Claude at upload).
- After every reply the **canvas** re-scores the use case on 8 weighted dimensions, lists the gaps, suggests the next questions (click one to work on it), proposes an indicative pathway and flags similar use cases already in the portfolio.
- **Save as work in progress** at any point, or at ≥70% readiness with no dimension below 2/5, **Submit for triage** to generate the Use Case Brief (exportable as Markdown or printable to PDF).

**AI CoE** (`/coe`, `/coe/use-cases/[id]`)
- KPIs, opportunity funnel, AI-pattern / business-unit / pathway breakdowns (click to filter), value-vs-readiness matrix, full table.
- **Portfolio insights**: Claude clusters use cases that share logic (the build-once, reuse-many opportunities) and recommends where to focus.
- **Ask the portfolio** and per-use-case **Interrogate** copilots, with persistent threads.
- Status workflow with decision notes and a timeline: Work in progress → Submitted → In triage → Approved → In delivery → Live (or Parked / Declined). Each case shows its business-unit team and visibility.

## How it's built

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, Tailwind 4 |
| Intelligence | Claude (`claude-opus-5-5`) via `@anthropic-ai/sdk`: streaming chat, structured outputs (Zod) for assessment / brief / insights, prompt caching, server-side refusal fallback |
| Storage | SQLite via `node:sqlite` (`src/lib/db.ts`); new columns are added in place, so existing databases keep their data |
| Access | Signed session cookie (`src/lib/session.ts`), page gates in `src/proxy.ts`, per-use-case rules in `src/lib/access.ts` |
| Docs | `unpdf`, `mammoth`, `jszip` text extraction (`src/lib/extract.ts`) |

Key files:
- `frameworks/*.md`: the evaluation framework (see above). `src/lib/framework.ts` reads it; `src/lib/rubric.ts` exposes it to prompts and UI, alongside the use case lifecycle (statuses and funnel).
- `src/lib/prompts.ts`: intake agent, assessor, brief writer and CoE copilot prompts.
- `src/lib/schemas.ts`: the Assessment, Use Case Brief and Insights schemas (the standard artefacts).
- `src/lib/seed.ts`: the demo portfolio.

## Demo notes and limits

- Sign-in is a demo: there is no password per person, so anyone past the site password can sign in as anyone. Swap `src/app/api/session/route.ts` for your SSO callback to make it real.
- Use cases created before sign-in existed are adopted by the first person who signs in with the same name as their submitter.
- Collaborators see each other's turns by polling every 5 seconds, not live streaming.
- The whole portfolio is placed in the copilot's context, which is fine for dozens to low hundreds of use cases; beyond that, switch to retrieval or tool-based queries.
- Scanned PDFs without a text layer aren't OCR'd; upload page images instead.
