import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Assessment, Brief, Insights } from "./schemas";
import type { StatusKey } from "./rubric";
import { seedDatabase } from "./seed";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "frontdoor.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS use_cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  business_unit TEXT NOT NULL,
  submitter TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  readiness INTEGER NOT NULL DEFAULT 0,
  ready INTEGER NOT NULL DEFAULT 0,
  pathway TEXT,
  patterns TEXT NOT NULL DEFAULT '[]',
  est_value REAL,
  one_liner TEXT NOT NULL DEFAULT '',
  assessment TEXT,
  brief TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  use_case_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  use_case_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  chars INTEGER NOT NULL,
  truncated INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  use_case_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  actor TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

const g = globalThis as unknown as { __frontdoorDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__frontdoorDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    conn.exec("PRAGMA journal_mode = WAL;");
    conn.exec(SCHEMA);
    g.__frontdoorDb = conn;
    const { n } = conn.prepare("SELECT COUNT(*) AS n FROM use_cases").get() as { n: number };
    if (n === 0) seedDatabase(conn);
  }
  return g.__frontdoorDb;
}

export function resetDatabase() {
  const conn = db();
  conn.exec("DELETE FROM use_cases; DELETE FROM messages; DELETE FROM documents; DELETE FROM events; DELETE FROM kv;");
  seedDatabase(conn);
}

// ---------- Types ----------

export type UseCaseRow = {
  id: string;
  title: string;
  business_unit: string;
  submitter: string;
  status: StatusKey;
  readiness: number;
  ready: number;
  pathway: string | null;
  patterns: string;
  est_value: number | null;
  one_liner: string;
  assessment: string | null;
  brief: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

export type UseCase = Omit<UseCaseRow, "patterns" | "assessment" | "brief" | "ready"> & {
  ready: boolean;
  patterns: string[];
  assessment: Assessment | null;
  brief: Brief | null;
};

export type Message = { id: number; role: "user" | "assistant"; content: string; created_at: string };
export type DocumentMeta = {
  id: number;
  filename: string;
  mime: string;
  size: number;
  chars: number;
  truncated: boolean;
  created_at: string;
};
export type Event = {
  id: number;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  actor: string | null;
  created_at: string;
};
export type Channel = "intake" | "coe";

const now = () => new Date().toISOString();

function hydrate(row: UseCaseRow): UseCase {
  return {
    ...row,
    ready: !!row.ready,
    patterns: JSON.parse(row.patterns),
    assessment: row.assessment ? JSON.parse(row.assessment) : null,
    brief: row.brief ? JSON.parse(row.brief) : null,
  };
}

// ---------- Use cases ----------

export function listUseCases(): UseCase[] {
  const rows = db().prepare("SELECT * FROM use_cases ORDER BY updated_at DESC").all() as UseCaseRow[];
  return rows.map(hydrate);
}

export function getUseCase(id: string): UseCase | null {
  const row = db().prepare("SELECT * FROM use_cases WHERE id = ?").get(id) as UseCaseRow | undefined;
  return row ? hydrate(row) : null;
}

export function nextUseCaseId(conn: DatabaseSync = db()): string {
  const row = conn
    .prepare("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) AS n FROM use_cases")
    .get() as { n: number | null };
  return `UC-${(row.n ?? 1000) + 1}`;
}

export function createUseCase(input: { title: string; business_unit: string; submitter: string }): UseCase {
  const id = nextUseCaseId();
  const ts = now();
  db()
    .prepare(
      `INSERT INTO use_cases (id, title, business_unit, submitter, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
    )
    .run(id, input.title, input.business_unit, input.submitter, ts, ts);
  addEvent(id, { kind: "created", to_status: "draft", actor: input.submitter });
  return getUseCase(id)!;
}

export function saveAssessment(
  id: string,
  a: Assessment,
  readiness: number,
  ready: boolean,
  opts: { keepTitle?: boolean } = {},
) {
  const uc = getUseCase(id);
  if (!uc) return;
  const title = opts.keepTitle || !a.working_title ? uc.title : a.working_title;
  db()
    .prepare(
      `UPDATE use_cases SET assessment = ?, readiness = ?, ready = ?, pathway = ?, patterns = ?,
       est_value = ?, one_liner = ?, title = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      JSON.stringify(a),
      readiness,
      ready ? 1 : 0,
      a.indicative_pathway,
      JSON.stringify(a.ai_patterns),
      a.estimated_annual_value_aud,
      a.one_liner,
      title,
      now(),
      id,
    );
}

export function saveBrief(id: string, b: Brief, actor: string) {
  const uc = getUseCase(id);
  if (!uc) return;
  const ts = now();
  db()
    .prepare(
      `UPDATE use_cases SET brief = ?, status = 'submitted', submitted_at = ?, pathway = ?, patterns = ?,
       est_value = COALESCE(?, est_value), title = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      JSON.stringify(b),
      ts,
      b.recommended_pathway,
      JSON.stringify(b.ai_patterns),
      b.value.estimated_annual_value_aud,
      b.title,
      ts,
      id,
    );
  addEvent(id, { kind: "status", from_status: uc.status, to_status: "submitted", actor, note: "Submitted via AI Front Door" });
}

export function updateStatus(id: string, status: StatusKey, note: string | null, actor: string) {
  const uc = getUseCase(id);
  if (!uc || uc.status === status) return;
  db().prepare("UPDATE use_cases SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
  addEvent(id, { kind: "status", from_status: uc.status, to_status: status, note, actor });
}

// ---------- Messages, documents, events ----------

export function listMessages(useCaseId: string, channel: Channel): Message[] {
  return db()
    .prepare(
      "SELECT id, role, content, created_at FROM messages WHERE use_case_id = ? AND channel = ? ORDER BY id",
    )
    .all(useCaseId, channel) as Message[];
}

export function addMessage(useCaseId: string, channel: Channel, role: "user" | "assistant", content: string) {
  db()
    .prepare("INSERT INTO messages (use_case_id, channel, role, content, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(useCaseId, channel, role, content, now());
  if (channel === "intake") {
    db().prepare("UPDATE use_cases SET updated_at = ? WHERE id = ?").run(now(), useCaseId);
  }
}

export function clearMessages(useCaseId: string, channel: Channel) {
  db().prepare("DELETE FROM messages WHERE use_case_id = ? AND channel = ?").run(useCaseId, channel);
}

export function listDocuments(useCaseId: string): DocumentMeta[] {
  const rows = db()
    .prepare(
      "SELECT id, filename, mime, size, chars, truncated, created_at FROM documents WHERE use_case_id = ? ORDER BY id",
    )
    .all(useCaseId) as (Omit<DocumentMeta, "truncated"> & { truncated: number })[];
  return rows.map((r) => ({ ...r, truncated: !!r.truncated }));
}

export function documentTexts(useCaseId: string): { filename: string; text: string }[] {
  return db()
    .prepare("SELECT filename, text FROM documents WHERE use_case_id = ? ORDER BY id")
    .all(useCaseId) as { filename: string; text: string }[];
}

export function addDocument(
  useCaseId: string,
  d: { filename: string; mime: string; size: number; text: string; truncated: boolean },
) {
  db()
    .prepare(
      `INSERT INTO documents (use_case_id, filename, mime, size, chars, truncated, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(useCaseId, d.filename, d.mime, d.size, d.text.length, d.truncated ? 1 : 0, d.text, now());
}

export function deleteDocument(useCaseId: string, docId: number) {
  db().prepare("DELETE FROM documents WHERE use_case_id = ? AND id = ?").run(useCaseId, docId);
}

export function addEvent(
  useCaseId: string,
  e: { kind: string; from_status?: string | null; to_status?: string | null; note?: string | null; actor?: string | null },
  at: string = now(),
) {
  db()
    .prepare(
      "INSERT INTO events (use_case_id, kind, from_status, to_status, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(useCaseId, e.kind, e.from_status ?? null, e.to_status ?? null, e.note ?? null, e.actor ?? null, at);
}

export function listEvents(useCaseId: string): Event[] {
  return db()
    .prepare("SELECT id, kind, from_status, to_status, note, actor, created_at FROM events WHERE use_case_id = ? ORDER BY id")
    .all(useCaseId) as Event[];
}

// ---------- Portfolio insights ----------

export function getInsights(): { insights: Insights; generated_at: string } | null {
  const row = db().prepare("SELECT value FROM kv WHERE key = 'insights'").get() as { value: string } | undefined;
  return row ? JSON.parse(row.value) : null;
}

export function saveInsights(insights: Insights) {
  db()
    .prepare("INSERT INTO kv (key, value) VALUES ('insights', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify({ insights, generated_at: now() }));
}
