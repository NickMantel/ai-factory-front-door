# AI CoE use case evaluation framework

<!--
HOW TO EDIT THIS FILE

This file is the single source of truth for how the AI Factory Front Door assesses use cases.
The intake assistant, the readiness score, the canvas, the brief and the AI CoE views all read it.

- Write in plain English. Everything under a criterion or pathway is given to the assessor as written,
  so say what you'd say to a new analyst: what you're looking for and what good looks like.
- Keep the section headings (## ...) as they are. Add, remove or reorder the ### entries freely.
- Renaming a criterion, pathway or pattern starts it afresh: existing use cases pick up a score
  for it the next time someone chats on them.
- Check your changes with:  npm run framework:check
- Text inside these comment markers is for editors only; the app ignores it.
-->

## Settings

- Organisation: the organisation
- Version: 1.0
- Triage threshold: 70%
- Minimum score per criterion: 2

<!--
Triage threshold: the weighted readiness (0-100%) a use case needs before it can be submitted for triage.
Minimum score per criterion: no single criterion may score below this (0-5) for submission.
-->

## Business units

- Parcel & Logistics Operations
- Customer Contact
- Retail Network
- Fleet & Network Planning
- Finance
- People & Culture
- Marketing & Growth
- Legal, Risk & Compliance
- Technology
- Enterprise & Government

## Scoring scale

<!-- Every criterion is scored 0 to 5. Describe what each score means. -->

- 0: Not addressed
- 1: Mentioned only
- 2: Partly described, with key specifics missing
- 3: Clearly described
- 4: Described with supporting evidence
- 5: Evidenced, quantified and owned

## Criteria

<!--
Weight is how much a criterion counts towards readiness: low, medium, high, or a number (medium = 1).
-->

### Problem clarity
Weight: high

A specific, evidenced pain point: who is affected, how often, and what it costs today.

Good looks like: "About 40,000 parcels a day fail OCR, costing around 120 FTE in manual keying."

### Value & outcomes
Weight: high

A quantified value hypothesis (time, cost, revenue, risk or customer experience) with measurable success metrics and a baseline to compare against.

### Process & users
Weight: medium

The as-is process, volumes, the people involved and where the proposed solution fits in their workflow.

### Data readiness
Weight: 1.25

Known data sources, who owns them, whether the team can get access, and their quality, volume and sensitivity (personal information, commercial-in-confidence).

### AI fit & concept
Weight: 1.25

Why AI rather than rules, reporting or conventional automation; which AI pattern applies; and where humans stay in the loop.

### Feasibility & integration
Weight: low

Systems to integrate with, technical constraints, timeframes, and existing platforms or vendors that could be used.

### Risk & responsible AI
Weight: medium

Privacy, security, customer and workforce impact, regulatory obligations, and how errors would be caught and corrected.

### Ownership & adoption
Weight: low

An accountable sponsor and a day-to-day product owner, signs of funding, and a plan for change and adoption.

## Pathways

<!--
The routes the AI CoE can recommend. A short name in brackets is used on charts.
-->

### Reuse / extend existing capability (Reuse)
A similar AI capability exists or is in flight; extend it rather than build new.

### Buy / leverage SaaS (Buy / SaaS)
A commercial product, or a feature of an existing platform, covers the need.

### Low-code agent (Low-code)
A business-built assistant or agent on an approved low-code platform.

### Proof of concept (PoC)
Value or feasibility is unproven; run a time-boxed proof of concept with clear exit criteria.

### Productionise / scale (Productionise)
Value is proven (for example, a successful pilot); harden, integrate and scale.

### Data foundations first (Data first)
The data isn't ready; ingest, model or govern it before any AI build.

### Non-AI solution (Non-AI)
Better solved with process change, reporting, rules or conventional automation.

### Further discovery (Discovery)
Too early to call; needs a structured discovery session.

## AI patterns

<!-- The kinds of AI solution the CoE tracks, used to spot overlap between use cases. -->

- Computer vision
- Document understanding & extraction
- Knowledge retrieval (RAG)
- Conversational assistant
- Classification & routing
- Forecasting & optimisation
- Anomaly & fraud detection
- Content generation
- Agentic workflow automation
- Speech & conversation analytics
- Recommendation & personalisation

## Guidance for the assistant

<!-- Anything else the intake assistant and assessor should know about how your CoE works. -->

- Ask for figures the business already tracks before asking for new estimates.
- If a use case involves customer personal information, say early that a privacy impact assessment will be needed.
