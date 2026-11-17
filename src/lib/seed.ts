import type { DatabaseSync } from "node:sqlite";
import type { Assessment, Brief } from "./schemas";
import {
  DIMENSIONS,
  computeReadiness,
  meetsThreshold,
  type AIPatternKey,
  type PathwayKey,
  type StatusKey,
} from "./rubric";

// Synthetic demo portfolio. Deliberately includes clusters (several computer-vision
// and knowledge-retrieval cases) so the CoE view has economies of scale to find.

type Spec = {
  title: string;
  bu: string;
  submitter: string;
  status: StatusKey;
  daysAgo: number;
  scores: [number, number, number, number, number, number, number, number];
  patterns: AIPatternKey[];
  pathway: PathwayKey;
  value: number | null;
  one_liner: string;
  problem: string;
  users: string;
  current: string;
  outcome: string;
  data: { source: string; description: string; readiness: Brief["data"][number]["readiness"]; sensitivity: Brief["data"][number]["sensitivity"] }[];
  solution: string;
  value_hypothesis: string;
  metrics: { metric: string; baseline: string; target: string }[];
  risks: { risk: string; severity: "low" | "medium" | "high"; mitigation: string }[];
  sponsor: string;
  transcript?: [string, string][];
};

const SPECS: Spec[] = [
  {
    title: "Damaged parcel detection at sortation",
    bu: "Parcel & Logistics Operations",
    submitter: "Priya Raman",
    status: "triage",
    daysAgo: 41,
    scores: [5, 4, 4, 4, 4, 3, 3, 4],
    patterns: ["computer_vision", "classification_routing"],
    pathway: "poc",
    value: 2_400_000,
    one_liner: "Use existing sorter cameras to flag damaged parcels before they leave the facility, cutting claims and rework.",
    problem: "Damaged parcels are only identified at delivery or by the customer, triggering claims, redelivery and complaints. ~0.6% of parcels arrive damaged.",
    users: "Sortation supervisors and exception-handling teams across 6 major facilities; ~1.8M parcels/day.",
    current: "Manual visual spotting by sorter staff; no systematic capture. Claims are processed weeks later with little evidence.",
    outcome: "Flag likely-damaged parcels in-line, divert to repack, and store image evidence for claims.",
    data: [
      { source: "Sorter overhead cameras", description: "Existing 5MP images of every parcel at induction, retained 14 days.", readiness: "available", sensitivity: "internal" },
      { source: "Claims system", description: "Damage claims with parcel IDs for labelling.", readiness: "partial", sensitivity: "personal_information" },
    ],
    solution: "A vision model scores each induction image for damage; high-confidence hits divert to a repack chute and attach evidence to the parcel record.",
    value_hypothesis: "Reduce damage claims by 25% and repack before dispatch rather than redeliver.",
    metrics: [
      { metric: "Damage claims per 10k parcels", baseline: "6.1", target: "4.6" },
      { metric: "Claims with image evidence", baseline: "<5%", target: "90%" },
    ],
    risks: [
      { risk: "False positives slow the sorter", severity: "medium", mitigation: "Confidence threshold tuned in shadow mode first; divert only above threshold." },
      { risk: "Labels visible in images carry personal information", severity: "medium", mitigation: "Crop/blur address panels before storage." },
    ],
    sponsor: "GM Network Operations (sponsor), Facility Excellence lead (product owner)",
  },
  {
    title: "Proof-of-delivery photo quality checks",
    bu: "Parcel & Logistics Operations",
    submitter: "Tom Nguyen",
    status: "submitted",
    daysAgo: 12,
    scores: [4, 4, 4, 4, 4, 3, 3, 3],
    patterns: ["computer_vision"],
    pathway: "reuse_extend",
    value: 900_000,
    one_liner: "Check delivery photos in real time so drivers retake unusable ones before leaving the address.",
    problem: "~9% of proof-of-delivery photos are blurry, dark or don't show the parcel, so 'where is my parcel' disputes can't be resolved.",
    users: "Delivery drivers (~7,000) and customer contact agents resolving disputes.",
    current: "Photos are taken on the driver handheld with no quality check; agents discover bad photos days later.",
    outcome: "Prompt drivers on-device to retake a poor photo; agents get usable evidence.",
    data: [
      { source: "POD photo store", description: "~1.2M photos/day with delivery scan metadata.", readiness: "available", sensitivity: "personal_information" },
      { source: "Dispute outcomes", description: "Case outcomes linked to consignment IDs.", readiness: "partial", sensitivity: "personal_information" },
    ],
    solution: "A lightweight image-quality and parcel-presence model runs on or near the handheld and prompts a retake.",
    value_hypothesis: "Halve unresolvable delivery disputes and reduce redelivery/refund cost.",
    metrics: [{ metric: "Unusable POD photos", baseline: "9%", target: "3%" }],
    risks: [{ risk: "Photos capture residents or homes", severity: "medium", mitigation: "Guidance to frame parcel only; retention limits." }],
    sponsor: "Head of Last Mile (sponsor)",
  },
  {
    title: "Unreadable address label resolution",
    bu: "Parcel & Logistics Operations",
    submitter: "Grace Liu",
    status: "approved",
    daysAgo: 88,
    scores: [5, 4, 5, 4, 5, 4, 4, 4],
    patterns: ["computer_vision", "document_understanding"],
    pathway: "poc",
    value: 3_100_000,
    one_liner: "Read damaged or handwritten labels with vision AI to auto-resolve parcels that currently go to manual keying.",
    problem: "~40k parcels/day fail OCR at sortation and go to manual video-coding teams, adding up to 24h delay.",
    users: "Video-coding teams (120 FTE across shifts) and sortation planners.",
    current: "Legacy OCR fails on handwriting, damage and non-standard labels; humans key addresses from images.",
    outcome: "Resolve 60%+ of failed labels automatically against the address file.",
    data: [
      { source: "Sorter label images", description: "Images of OCR-failed labels with eventual keyed address.", readiness: "available", sensitivity: "personal_information" },
      { source: "National address file", description: "Validated delivery points.", readiness: "available", sensitivity: "internal" },
    ],
    solution: "Multimodal model extracts address candidates, matches against the address file, and auto-resolves above confidence; rest stays with humans.",
    value_hypothesis: "Reduce manual keying effort by 60% and next-day delays for affected parcels.",
    metrics: [
      { metric: "Auto-resolution of OCR failures", baseline: "0%", target: "60%" },
      { metric: "Video-coding FTE", baseline: "120", target: "60" },
    ],
    risks: [{ risk: "Mis-sorts from wrong match", severity: "high", mitigation: "Address-file validation and confidence gating; audit sampling." }],
    sponsor: "GM Network Operations (sponsor)",
  },
  {
    title: "Store merchandising compliance from photos",
    bu: "Retail Network",
    submitter: "Hannah Walsh",
    status: "draft",
    daysAgo: 5,
    scores: [3, 2, 3, 2, 3, 2, 2, 2],
    patterns: ["computer_vision"],
    pathway: "reuse_extend",
    value: null,
    one_liner: "Check store shelf photos against planograms so area managers see compliance without store visits.",
    problem: "Area managers visit stores to check merchandising and promotional setup; visits are infrequent and inconsistent.",
    users: "Area managers (~60) and store managers (~800 stores).",
    current: "Store visits plus emailed photos; no systematic tracking.",
    outcome: "Weekly compliance score per store from photos.",
    data: [{ source: "Store photos", description: "Ad-hoc emailed photos; no central store.", readiness: "not_available", sensitivity: "internal" }],
    solution: "Store staff upload shelf photos; a vision model compares against the planogram.",
    value_hypothesis: "Fewer compliance visits and better promotion execution (not yet quantified).",
    metrics: [],
    risks: [{ risk: "Customers visible in photos", severity: "medium", mitigation: "Capture guidance and blurring." }],
    sponsor: "",
    transcript: [
      ["user", "We want to use AI to check that stores have set up promotions properly. Area managers spend a lot of time visiting stores just to check shelves."],
      ["assistant", "That's a solid, observable problem, and a good fit for a computer-vision pattern the CoE is already seeing elsewhere (sortation damage detection and delivery photo checks both use image inspection, so there may be reuse here).\n\nTo sharpen it, two things would help most:\n\n1. **How much time is spent today?** Roughly how many compliance visits do area managers make per month, and how long is each one?\n2. **Where would the photos come from?** Is there an existing way stores capture and send photos, or would that be new?"],
    ],
  },
  {
    title: "Fleet vehicle damage inspection",
    bu: "Fleet & Network Planning",
    submitter: "Marcus Bell",
    status: "draft",
    daysAgo: 2,
    scores: [3, 2, 3, 3, 3, 2, 2, 3],
    patterns: ["computer_vision"],
    pathway: "reuse_extend",
    value: 450_000,
    one_liner: "Detect new vehicle damage from driver walk-around photos to speed up repairs and recover costs.",
    problem: "Vehicle damage is reported late or not at all, so repair costs can't be attributed and vehicles are off-road longer.",
    users: "Fleet coordinators and ~4,000 vans/trucks.",
    current: "Paper or app checklists; photos taken inconsistently.",
    outcome: "Automatic detection of new damage vs the last inspection.",
    data: [{ source: "Fleet app photos", description: "Walk-around photos in the fleet app; coverage ~40%.", readiness: "partial", sensitivity: "internal" }],
    solution: "Compare daily walk-around photos to detect new damage and open a repair job.",
    value_hypothesis: "Recover third-party costs and reduce off-road days.",
    metrics: [{ metric: "Damage events with attributed cost", baseline: "~30%", target: "70%" }],
    risks: [{ risk: "Driver surveillance perception", severity: "medium", mitigation: "Co-design with drivers and unions." }],
    sponsor: "Fleet Manager (interested, not confirmed)",
  },
  {
    title: "Contact centre knowledge assistant",
    bu: "Customer Contact",
    submitter: "Olivia Chen",
    status: "live",
    daysAgo: 210,
    scores: [5, 5, 5, 4, 5, 4, 4, 5],
    patterns: ["knowledge_retrieval", "conversational_assistant"],
    pathway: "productionise",
    value: 4_200_000,
    one_liner: "Give agents instant, cited answers from 3,000+ knowledge articles during live calls and chats.",
    problem: "Agents search a fragmented knowledge base mid-call; average handle time and repeat contacts are high.",
    users: "1,400 contact centre agents handling ~45k contacts/day.",
    current: "Keyword search across intranet and PDFs; frequent escalations to team leaders.",
    outcome: "Cut handle time and escalations with grounded answers.",
    data: [{ source: "Knowledge base", description: "3,200 articles, procedures and policy PDFs.", readiness: "available", sensitivity: "internal" }],
    solution: "A retrieval-augmented assistant in the agent desktop, returning cited answers with links to source articles.",
    value_hypothesis: "45 seconds lower average handle time and 15% fewer escalations.",
    metrics: [
      { metric: "Average handle time", baseline: "6m 40s", target: "5m 55s" },
      { metric: "Escalations to team leaders", baseline: "11%", target: "9.4%" },
    ],
    risks: [{ risk: "Out-of-date articles produce wrong answers", severity: "medium", mitigation: "Content ownership and freshness SLAs; citations shown." }],
    sponsor: "Chief Customer Officer (sponsor)",
  },
  {
    title: "HR policy Q&A assistant",
    bu: "People & Culture",
    submitter: "Sam Patel",
    status: "submitted",
    daysAgo: 9,
    scores: [4, 3, 4, 4, 4, 4, 3, 3],
    patterns: ["knowledge_retrieval", "conversational_assistant"],
    pathway: "reuse_extend",
    value: 600_000,
    one_liner: "Answer employee questions on leave, pay and policies from approved HR content, deflecting tickets.",
    problem: "HR service desk handles ~6,000 tickets/month; 55% are answerable from existing policy documents.",
    users: "~30,000 employees; HR service desk team of 25.",
    current: "Employees raise tickets or email HR; average resolution 2.5 days.",
    outcome: "Instant answers for common questions and fewer tickets.",
    data: [{ source: "HR policy library", description: "~400 policies, EBAs and procedures.", readiness: "available", sensitivity: "internal" }],
    solution: "Reuse the contact-centre retrieval platform with an HR content index and an employee-facing chat.",
    value_hypothesis: "Deflect 40% of tier-1 HR tickets.",
    metrics: [{ metric: "Tier-1 HR tickets/month", baseline: "6,000", target: "3,600" }],
    risks: [{ risk: "Answers about individual entitlements could be wrong", severity: "medium", mitigation: "General policy only; route personal cases to HR." }],
    sponsor: "Chief People Officer (sponsor)",
  },
  {
    title: "Retail counter procedures assistant",
    bu: "Retail Network",
    submitter: "Daniel Okafor",
    status: "triage",
    daysAgo: 27,
    scores: [4, 3, 4, 4, 4, 3, 3, 4],
    patterns: ["knowledge_retrieval", "conversational_assistant"],
    pathway: "reuse_extend",
    value: 1_100_000,
    one_liner: "Help counter staff handle complex transactions (identity, international, financial services) with step-by-step guidance.",
    problem: "Counter staff handle 300+ product types; complex transactions cause queues, errors and calls to the retail helpdesk.",
    users: "~8,000 retail counter staff.",
    current: "Printed manuals and helpdesk phone line (~20k calls/month).",
    outcome: "Fewer helpdesk calls and transaction errors.",
    data: [{ source: "Retail procedures library", description: "Product procedures and compliance guides.", readiness: "available", sensitivity: "internal" }],
    solution: "Assistant on counter terminals answering procedure questions with cited steps.",
    value_hypothesis: "Reduce helpdesk calls by 30% and rework from errors.",
    metrics: [{ metric: "Retail helpdesk calls/month", baseline: "20,000", target: "14,000" }],
    risks: [{ risk: "Financial services compliance", severity: "high", mitigation: "Compliance-approved content only; human sign-off on regulated steps." }],
    sponsor: "GM Retail Operations (sponsor)",
  },
  {
    title: "Supplier invoice exception handling",
    bu: "Finance",
    submitter: "Rebecca Moore",
    status: "in_delivery",
    daysAgo: 130,
    scores: [5, 5, 4, 4, 4, 4, 4, 4],
    patterns: ["document_understanding", "agentic_workflow"],
    pathway: "poc",
    value: 1_800_000,
    one_liner: "Triage and resolve invoice mismatches automatically, drafting supplier queries for the remainder.",
    problem: "18% of ~50k monthly supplier invoices fail three-way match and wait in an exceptions queue; late-payment penalties and supplier friction.",
    users: "Accounts payable team (35 FTE).",
    current: "Manual investigation across ERP, emails and PDFs.",
    outcome: "Auto-resolve simple exceptions; draft supplier queries for the rest.",
    data: [
      { source: "ERP (PO, GRN, invoice)", description: "Structured records.", readiness: "available", sensitivity: "confidential" },
      { source: "Invoice PDFs", description: "Supplier invoices from AP mailbox.", readiness: "available", sensitivity: "confidential" },
    ],
    solution: "Agent reads the invoice, compares PO/GRN, classifies the exception and resolves or drafts a query for approval.",
    value_hypothesis: "Halve exception handling effort and reduce late-payment penalties.",
    metrics: [{ metric: "Exceptions resolved without touch", baseline: "0%", target: "45%" }],
    risks: [{ risk: "Incorrect payment release", severity: "high", mitigation: "Human approval for any payment action." }],
    sponsor: "CFO (sponsor), AP Manager (product owner)",
  },
  {
    title: "Contract clause risk review",
    bu: "Legal, Risk & Compliance",
    submitter: "James Hartley",
    status: "parked",
    daysAgo: 70,
    scores: [3, 2, 3, 3, 3, 3, 3, 2],
    patterns: ["document_understanding"],
    pathway: "buy_saas",
    value: 250_000,
    one_liner: "First-pass review of supplier contracts against the legal playbook.",
    problem: "Lawyers spend time on low-risk supplier contract reviews.",
    users: "In-house legal team (18 lawyers).",
    current: "Manual review against a Word playbook.",
    outcome: "Faster turnaround on standard contracts.",
    data: [{ source: "Contract repository", description: "Executed contracts and playbook.", readiness: "partial", sensitivity: "confidential" }],
    solution: "Clause extraction and deviation flagging against the playbook.",
    value_hypothesis: "Save ~30% of review time on standard contracts.",
    metrics: [],
    risks: [{ risk: "Missed non-standard clause", severity: "high", mitigation: "Lawyer remains reviewer of record." }],
    sponsor: "General Counsel (interested)",
  },
  {
    title: "Complaint classification and routing",
    bu: "Customer Contact",
    submitter: "Aisha Rahman",
    status: "approved",
    daysAgo: 60,
    scores: [5, 4, 4, 5, 4, 4, 4, 4],
    patterns: ["classification_routing", "generative_content"],
    pathway: "productionise",
    value: 1_300_000,
    one_liner: "Classify inbound complaints by issue and urgency, route to the right team and draft a first response.",
    problem: "~15k written complaints/month are manually triaged; 20% are misrouted, adding 2 days to resolution.",
    users: "Complaints triage team (12 FTE) and resolution teams.",
    current: "Manual reading and routing in the CRM.",
    outcome: "Accurate routing in minutes; regulator-reportable complaints flagged.",
    data: [{ source: "CRM complaints", description: "3 years of labelled complaints with outcomes.", readiness: "available", sensitivity: "personal_information" }],
    solution: "Classifier plus drafted response, with human approval; pilot reached 91% routing accuracy.",
    value_hypothesis: "Reduce misrouting to <5% and redeploy 6 FTE.",
    metrics: [{ metric: "Misrouted complaints", baseline: "20%", target: "<5%" }],
    risks: [{ risk: "Vulnerable customer cases deprioritised", severity: "high", mitigation: "Vulnerability flags always routed to specialists." }],
    sponsor: "Head of Customer Resolution (sponsor)",
  },
  {
    title: "Peak-season parcel volume forecasting",
    bu: "Fleet & Network Planning",
    submitter: "Lachlan Ford",
    status: "triage",
    daysAgo: 33,
    scores: [4, 4, 4, 3, 3, 3, 4, 4],
    patterns: ["forecasting_optimisation"],
    pathway: "data_foundation",
    value: 2_000_000,
    one_liner: "Forecast daily parcel volumes by facility to plan labour and linehaul for peak.",
    problem: "Peak forecasts are spreadsheet-based and miss by ±15%, causing overtime blowouts or idle capacity.",
    users: "Network planners and facility managers.",
    current: "Excel models using last year plus growth factor.",
    outcome: "Facility-level forecasts within ±5%, 6 weeks out.",
    data: [
      { source: "Scan events", description: "Parcel scans, 5 years, in the data lake (partially modelled).", readiness: "partial", sensitivity: "internal" },
      { source: "Customer volume commitments", description: "Held by account managers in spreadsheets.", readiness: "not_available", sensitivity: "confidential" },
    ],
    solution: "ML forecasting with retailer promotional signals; first needs a curated volume data product.",
    value_hypothesis: "Reduce peak overtime and contractor spend by 10%.",
    metrics: [{ metric: "Forecast error (MAPE)", baseline: "15%", target: "5%" }],
    risks: [{ risk: "Data gaps for new customers", severity: "medium", mitigation: "Blend with planner judgement." }],
    sponsor: "GM Network Planning (sponsor)",
  },
  {
    title: "Call summarisation and quality assurance",
    bu: "Customer Contact",
    submitter: "Olivia Chen",
    status: "submitted",
    daysAgo: 6,
    scores: [4, 4, 4, 4, 4, 3, 3, 4],
    patterns: ["speech_analytics", "generative_content"],
    pathway: "buy_saas",
    value: 1_500_000,
    one_liner: "Auto-summarise calls into the CRM and score 100% of calls for quality instead of a 2% sample.",
    problem: "Agents spend ~60s per call on wrap-up notes; QA samples only 2% of calls.",
    users: "1,400 agents and 40 QA analysts.",
    current: "Manual notes; manual QA sampling.",
    outcome: "Lower after-call work and full QA coverage.",
    data: [{ source: "Call recordings", description: "Recorded calls in the telephony platform.", readiness: "available", sensitivity: "personal_information" }],
    solution: "Use the telephony vendor's AI summarisation module plus a custom QA rubric.",
    value_hypothesis: "Save 45s after-call work per contact.",
    metrics: [{ metric: "After-call work", baseline: "60s", target: "15s" }],
    risks: [{ risk: "Recording consent and retention", severity: "medium", mitigation: "Privacy impact assessment." }],
    sponsor: "Chief Customer Officer (sponsor)",
  },
  {
    title: "Small business campaign copy generator",
    bu: "Marketing & Growth",
    submitter: "Chloe Martin",
    status: "draft",
    daysAgo: 1,
    scores: [2, 1, 2, 2, 2, 1, 1, 1],
    patterns: ["generative_content"],
    pathway: "needs_discovery",
    value: null,
    one_liner: "Generate on-brand email and social copy variants for small business campaigns.",
    problem: "Campaign copy takes too long to write.",
    users: "Marketing team.",
    current: "",
    outcome: "",
    data: [],
    solution: "Use generative AI to write copy.",
    value_hypothesis: "",
    metrics: [],
    risks: [],
    sponsor: "",
  },
  {
    title: "Fraudulent compensation claims detection",
    bu: "Finance",
    submitter: "Ethan Brooks",
    status: "declined",
    daysAgo: 95,
    scores: [3, 3, 2, 2, 3, 2, 2, 2],
    patterns: ["anomaly_detection"],
    pathway: "data_foundation",
    value: 700_000,
    one_liner: "Flag suspicious lost/damaged parcel claims for investigation.",
    problem: "Suspected repeat fraudulent claims, scale unknown.",
    users: "Claims assessors.",
    current: "Rule-based flags on claim value.",
    outcome: "Better targeting of investigations.",
    data: [{ source: "Claims history", description: "Limited labelled fraud outcomes.", readiness: "partial", sensitivity: "personal_information" }],
    solution: "Anomaly detection on claim patterns.",
    value_hypothesis: "Reduce fraudulent payouts (not quantified).",
    metrics: [],
    risks: [{ risk: "Unfair targeting of customers", severity: "high", mitigation: "Human investigation only; fairness testing." }],
    sponsor: "",
  },
  {
    title: "Government tender response drafting",
    bu: "Enterprise & Government",
    submitter: "Natalie Ross",
    status: "submitted",
    daysAgo: 3,
    scores: [4, 4, 4, 3, 4, 3, 3, 4],
    patterns: ["knowledge_retrieval", "generative_content"],
    pathway: "low_code_agent",
    value: 800_000,
    one_liner: "Draft first-pass tender responses from past winning bids and capability statements.",
    problem: "Bid team responds to ~70 tenders/year; each takes 3-6 weeks, with 60% of content reused from past bids.",
    users: "Bid team (9) and subject-matter experts.",
    current: "Copy-paste from a shared drive of past bids.",
    outcome: "Cut first-draft time by half; respond to more tenders.",
    data: [{ source: "Past bids library", description: "~250 past responses and capability statements.", readiness: "available", sensitivity: "confidential" }],
    solution: "Low-code agent over the bid library that drafts responses to each tender question with sources.",
    value_hypothesis: "Halve first-draft effort and lift win capacity by 20%.",
    metrics: [{ metric: "Days to first draft", baseline: "12", target: "5" }],
    risks: [{ risk: "Confidential client info reused inappropriately", severity: "medium", mitigation: "Library curation and SME review." }],
    sponsor: "Director Enterprise Sales (sponsor)",
  },
];

const RATIONALE: Record<number, string> = {
  0: "Not yet addressed.",
  1: "Mentioned but not described.",
  2: "Partly described; key specifics missing.",
  3: "Clearly described.",
  4: "Described with supporting evidence.",
  5: "Evidenced, quantified and owned.",
};

const GAP: Record<string, string> = {
  problem_clarity: "Quantify how often the problem occurs and what it costs today.",
  value: "Put a number on the benefit and name the metric you'd track.",
  process_users: "Describe the current process step by step, with volumes.",
  data_readiness: "Confirm which systems hold the data, who owns it and whether it can be accessed.",
  ai_fit: "Explain why AI is needed over rules or reporting, and where a human reviews outputs.",
  feasibility: "List the systems this must integrate with and any platform constraints.",
  risk: "Identify personal information involved and how errors would be caught.",
  ownership: "Name an accountable sponsor and a day-to-day product owner.",
};

function iso(daysAgo: number, hourOffset = 0) {
  return new Date(Date.now() - daysAgo * 86_400_000 + hourOffset * 3_600_000).toISOString();
}

function buildAssessment(s: Spec, id: string, similar: string[]): Assessment {
  return {
    working_title: s.title,
    one_liner: s.one_liner,
    dimensions: DIMENSIONS.map((d, i) => ({
      key: d.key,
      score: s.scores[i],
      rationale: RATIONALE[s.scores[i]],
      gap: s.scores[i] >= 4 ? "" : GAP[d.key],
    })),
    captured: {
      problem: s.problem,
      users_and_volumes: s.users,
      current_process: s.current,
      desired_outcome: s.outcome,
      data_sources: s.data.map((d) => `${d.source}: ${d.description}`).join(" "),
      proposed_solution: s.solution,
      value_hypothesis: s.value_hypothesis,
      risks: s.risks.map((r) => r.risk).join("; "),
      sponsor: s.sponsor,
    },
    ai_patterns: s.patterns,
    strengths: s.scores[0] >= 4 ? ["Specific, evidenced problem", "Clear users and volumes"] : ["Observable problem"],
    next_questions: DIMENSIONS.filter((_, i) => s.scores[i] < 3).slice(0, 3).map((d) => GAP[d.key]),
    indicative_pathway: s.pathway,
    pathway_rationale: `Indicative: ${s.pathway.replace(/_/g, " ")} based on maturity of value, data and solution concept.`,
    estimated_annual_value_aud: s.value,
    similar_use_case_ids: similar.filter((x) => x !== id),
  };
}

function buildBrief(s: Spec, similarTitles: string[]): Brief {
  return {
    title: s.title,
    executive_summary: `${s.one_liner} ${s.problem} ${s.value_hypothesis}`,
    problem_statement: s.problem,
    current_state: s.current,
    target_users: s.users,
    proposed_solution: s.solution,
    how_ai_helps: `${s.solution} Humans review low-confidence or high-impact outputs.`,
    ai_patterns: s.patterns,
    data: s.data,
    value: {
      hypothesis: s.value_hypothesis,
      metrics: s.metrics,
      estimated_annual_value_aud: s.value,
      confidence: s.scores[1] >= 4 ? "medium" : "low",
    },
    feasibility: "Integrates with existing platforms; no blocking constraints identified at intake.",
    risks: s.risks,
    dependencies: s.data.filter((d) => d.readiness !== "available").map((d) => `Access to ${d.source}`),
    stakeholders: [{ role: "Sponsor", who: s.sponsor || "TBC" }, { role: "Submitter", who: `${s.submitter}, ${s.bu}` }],
    recommended_pathway: s.pathway,
    pathway_rationale: `Recommended ${s.pathway.replace(/_/g, " ")} given the maturity of the value case, data and solution concept.`,
    alternative_pathways: [],
    reuse_opportunities: similarTitles.length ? `Shares core logic with: ${similarTitles.join(", ")}.` : "",
    open_questions_for_coe: ["Confirm platform and hosting pattern.", "Confirm privacy impact assessment requirements."],
    suggested_next_steps: ["CoE triage session with sponsor (30 min).", "Confirm data access with data owner."],
  };
}

const LIFECYCLE: StatusKey[] = ["draft", "submitted", "triage", "approved", "in_delivery", "live"];

export function seedDatabase(conn: DatabaseSync) {
  const ids = SPECS.map((_, i) => `UC-${1001 + i}`);
  const insertUC = conn.prepare(`INSERT INTO use_cases
    (id, title, business_unit, submitter, status, readiness, ready, pathway, patterns, est_value, one_liner,
     assessment, brief, created_at, updated_at, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertEvent = conn.prepare(
    "INSERT INTO events (use_case_id, kind, from_status, to_status, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertMsg = conn.prepare(
    "INSERT INTO messages (use_case_id, channel, role, content, created_at) VALUES (?, 'intake', ?, ?, ?)",
  );

  SPECS.forEach((s, i) => {
    const id = ids[i];
    const similar = ids.filter((other, j) => other !== id && SPECS[j].patterns[0] === s.patterns[0]);
    const assessment = buildAssessment(s, id, similar);
    const scores = assessment.dimensions.map((d) => ({ key: d.key, score: d.score }));
    const readiness = computeReadiness(scores);
    const ready = meetsThreshold(readiness, scores);
    const submitted = s.status !== "draft";
    const brief = submitted
      ? buildBrief(s, similar.map((sid) => SPECS[ids.indexOf(sid)].title))
      : null;
    const created = iso(s.daysAgo);
    const submittedAt = submitted ? iso(Math.max(0, s.daysAgo - 2)) : null;

    insertUC.run(
      id, s.title, s.bu, s.submitter, s.status, readiness, ready ? 1 : 0, s.pathway,
      JSON.stringify(s.patterns), s.value, s.one_liner, JSON.stringify(assessment),
      brief ? JSON.stringify(brief) : null, created, iso(Math.max(0, s.daysAgo - 3)), submittedAt,
    );

    insertEvent.run(id, "created", null, "draft", null, s.submitter, created);
    // Walk the lifecycle up to the current status so the timeline and funnel are consistent.
    const terminal = s.status === "parked" || s.status === "declined";
    const target = terminal ? "triage" : s.status;
    const upto = LIFECYCLE.indexOf(target);
    for (let k = 1; k <= upto; k++) {
      const at = iso(Math.max(0, s.daysAgo - 2 - (k - 1) * 7));
      insertEvent.run(id, "status", LIFECYCLE[k - 1], LIFECYCLE[k], k === 1 ? "Submitted via AI Front Door" : null, k === 1 ? s.submitter : "AI CoE", at);
    }
    if (terminal) {
      insertEvent.run(id, "status", "triage", s.status,
        s.status === "parked" ? "Parked pending enterprise legal-tech procurement." : "Declined: insufficient labelled data; revisit after claims data uplift.",
        "AI CoE", iso(Math.max(0, s.daysAgo - 20)));
    }
    s.transcript?.forEach(([role, content], k) => insertMsg.run(id, role, content, iso(s.daysAgo, k * 0.05)));
  });
}
