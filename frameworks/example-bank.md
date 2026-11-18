# Retail bank AI investment framework

<!--
An example of a second business's framework: different business units, criteria, weights,
threshold and pathways. Build with FRAMEWORK=example-bank to use it. See frameworks/default.md
for notes on each section.
-->

## Settings

- Organisation: Example Bank
- Version: 0.3
- Triage threshold: 75%
- Minimum score per criterion: 3

## Business units

- Retail Banking
- Business Banking
- Wealth
- Operations
- Financial Crime
- Group Technology

## Scoring scale

- 0: No information
- 1: An assertion with nothing behind it
- 2: Some detail, but not enough to act on
- 3: Enough detail for an investment committee to discuss
- 4: Backed by data or a named source
- 5: Backed by data, signed off by the accountable executive

## Criteria

### Customer outcome
Weight: high

How the change improves a customer's financial wellbeing or experience, and how we'd know.
Customers must never be worse off; ask how vulnerable customers are protected.

### Financial benefit
Weight: high

Annual benefit in dollars (cost out, revenue, or losses avoided), with the assumptions behind it.
Good looks like: "Cuts manual review of 9,000 alerts a month by 60%, saving about $1.1m a year."

### Data & model risk
Weight: high

The data used, its lineage and quality, and how the model would be validated, monitored and explained under the bank's model risk policy.

### Regulatory & conduct
Weight: medium

Obligations that apply (privacy, responsible lending, AML/CTF, consumer protection) and how decisions affecting customers can be explained and challenged.

### Delivery path
Weight: low

Systems involved, the team that would build and run it, and a realistic first release.

### Executive sponsorship
Weight: medium

A named accountable executive who will fund it and own the benefit.

## Pathways

### Use an existing platform capability (Existing)
The bank's current platforms already offer this; configure rather than build.

### Vendor solution (Vendor)
A regulated, assessed vendor product fits the need.

### Experiment (Experiment)
Run a ring-fenced, eight-week experiment with synthetic or de-identified data.

### Full business case (Business case)
Ready for an investment committee business case.

### Not now (Not now)
Doesn't meet the bar today; the gaps are named for a later resubmission.

## AI patterns

- Document understanding: statements, applications, contracts
- Conversational assistant
- Fraud & financial crime detection
- Credit & risk modelling
- Knowledge retrieval (RAG)
- Next best action

## Guidance for the assistant

- Never suggest using customer data outside the purpose it was collected for.
- Use Australian dollars, and ask for annual figures.
- If a use case would make or influence a credit decision, say that the model risk and responsible lending teams must review it.
