import "server-only";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Assessment, Brief, Insights } from "./schemas";
import { computeReadiness, meetsThreshold, type StatusKey, type Visibility } from "./rubric";
import { applySeedAccess, seedDatabase } from "./seed";

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
CREATE TABLE IF NOT EXISTS collaborators (
  use_case_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'editor',
  added_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (use_case_id, email)
);
CREATE TABLE IF NOT EXISTS renamed (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS people (email TEXT PRIMARY KEY, name TEXT NOT NULL, business_unit TEXT, last_seen TEXT NOT NULL);
`;

/** Columns added after the first release; added in place so existing databases keep their data. */
function migrate(conn: DatabaseSync) {
  const add = (table: string, column: string, def: string) => {
    const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  };
  add("use_cases", "owner_email", "TEXT");
  add("use_cases", "visibility", "TEXT NOT NULL DEFAULT 'private'");
  add("messages", "author", "TEXT");
  applySeedAccess(conn);
}

const g = globalThis as unknown as { __frontdoorDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__frontdoorDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    conn.exec("PRAGMA journal_mode = WAL;");
    conn.exec(SCHEMA);
    g.__frontdoorDb = conn;
    const { n } = conn.prepare("SELECT COUNT(*) AS n FROM use_cases").get() as { n: number };
    migrate(conn);
    if (n === 0) seedDatabase(conn);
  }
  return g.__frontdoorDb;
}

export function resetDatabase() {
  const conn = db();
  // People who have signed in are kept, so their sessions and names survive a reset.
  conn.exec(
    "DELETE FROM use_cases; DELETE FROM messages; DELETE FROM documents; DELETE FROM events; DELETE FROM kv; DELETE FROM collaborators; DELETE FROM renamed;",
  );
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
  owner_email: string | null;
  visibility: Visibility;
};

export type UseCase = Omit<UseCaseRow, "patterns" | "assessment" | "brief" | "ready"> & {
  ready: boolean;
  patterns: string[];
  assessment: Assessment | null;
  brief: Brief | null;
};

export type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  author: string | null;
  created_at: string;
};
export type Collaborator = { email: string; name: string | null; role: "owner" | "editor"; created_at: string };
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
  const assessment: Assessment | null = row.assessment ? JSON.parse(row.assessment) : null;
  // Score against the framework as it is now, so changes to weights or thresholds show at once.
  const scores = assessment?.dimensions.map((d) => ({ key: d.key, score: d.score }));
  const readiness = scores ? computeReadiness(scores) : row.readiness;
  return {
    ...row,
    readiness,
    ready: scores ? meetsThreshold(readiness, scores) : !!row.ready,
    patterns: JSON.parse(row.patterns),
    assessment,
    brief: row.brief ? JSON.parse(row.brief) : null,
  };
}

// ---------- Use cases ----------

export function listUseCases(): UseCase[] {
  const rows = db().prepare("SELECT * FROM use_cases ORDER BY updated_at DESC").all() as UseCaseRow[];
  return rows.map(hydrate);
}

/** Everything that has been submitted: what the AI CoE sees. Private drafts are excluded. */
export function listRecords(): UseCase[] {
  return listUseCases().filter((u) => u.status !== "draft");
}

/** Use cases the person owns or has been added to, drafts included. */
export function listForMember(email: string): UseCase[] {
  const rows = db()
    .prepare(
      `SELECT u.* FROM use_cases u JOIN collaborators c ON c.use_case_id = u.id
       WHERE c.email = ? ORDER BY u.updated_at DESC`,
    )
    .all(email) as UseCaseRow[];
  return rows.map(hydrate);
}

/** Submitted use cases their owners opened to the whole organisation. */
export function listPublic(): UseCase[] {
  return listRecords().filter((u) => u.visibility === "public");
}

export function getUseCase(id: string): UseCase | null {
  const row = db().prepare("SELECT * FROM use_cases WHERE id = ?").get(id) as UseCaseRow | undefined;
  return row ? hydrate(row) : null;
}

/** Drafts get a case number when submitted; old links follow the rename. */
export function renamedTo(id: string): string | null {
  const row = db().prepare("SELECT new_id FROM renamed WHERE old_id = ?").get(id) as { new_id: string } | undefined;
  return row?.new_id ?? null;
}

export function nextUseCaseId(conn: DatabaseSync = db()): string {
  const row = conn
    .prepare("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) AS n FROM use_cases WHERE id LIKE 'UC-%'")
    .get() as { n: number | null };
  return `UC-${(row.n ?? 1000) + 1}`;
}

const draftId = () => `D-${randomBytes(4).toString("hex").toUpperCase()}`;

export function createDraft(input: { business_unit: string; owner: { email: string; name: string } }): UseCase {
  const id = draftId();
  const ts = now();
  db()
    .prepare(
      `INSERT INTO use_cases (id, title, business_unit, submitter, owner_email, visibility, status, created_at, updated_at)
       VALUES (?, 'Untitled use case', ?, ?, ?, 'private', 'draft', ?, ?)`,
    )
    .run(id, input.business_unit, input.owner.name, input.owner.email, ts, ts);
  addCollaborator(id, { email: input.owner.email, name: input.owner.name, role: "owner", added_by: input.owner.email });
  addEvent(id, { kind: "created", to_status: "draft", actor: input.owner.name });
  return getUseCase(id)!;
}

/**
 * Turns a private draft into a record the AI CoE can see, with a case number. Returns the
 * (possibly new) id. Records already registered are left as they are.
 */
export function registerUseCase(id: string, actor: string, visibility: Visibility): string {
  const uc = getUseCase(id);
  if (!uc) throw new Error("Use case not found");
  const conn = db();
  conn.prepare("UPDATE use_cases SET visibility = ?, updated_at = ? WHERE id = ?").run(visibility, now(), id);
  if (uc.status !== "draft") return id;

  const newId = id.startsWith("D-") ? nextUseCaseId() : id;
  conn.exec("BEGIN");
  try {
    if (newId !== id) {
      conn.prepare("UPDATE use_cases SET id = ? WHERE id = ?").run(newId, id);
      for (const t of ["messages", "documents", "events", "collaborators"]) {
        conn.prepare(`UPDATE ${t} SET use_case_id = ? WHERE use_case_id = ?`).run(newId, id);
      }
      conn.prepare("INSERT OR REPLACE INTO renamed (old_id, new_id) VALUES (?, ?)").run(id, newId);
    }
    conn.prepare("UPDATE use_cases SET status = 'shaping', updated_at = ? WHERE id = ?").run(now(), newId);
    addEvent(newId, { kind: "status", from_status: "draft", to_status: "shaping", actor, note: "Registered with the AI CoE" });
    conn.exec("COMMIT");
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
  return newId;
}

export function setVisibility(id: string, visibility: Visibility) {
  db().prepare("UPDATE use_cases SET visibility = ?, updated_at = ? WHERE id = ?").run(visibility, now(), id);
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
  addEvent(id, { kind: "status", from_status: uc.status, to_status: "submitted", actor, note: "Submitted via AI Factory Front Door" });
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
      "SELECT id, role, content, author, created_at FROM messages WHERE use_case_id = ? AND channel = ? ORDER BY id",
    )
    .all(useCaseId, channel) as Message[];
}

export function addMessage(
  useCaseId: string,
  channel: Channel,
  role: "user" | "assistant",
  content: string,
  author: string | null = null,
) {
  db()
    .prepare("INSERT INTO messages (use_case_id, channel, role, content, author, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(useCaseId, channel, role, content, author, now());
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

// ---------- Collaborators ----------

export function listCollaborators(useCaseId: string): Collaborator[] {
  return db()
    .prepare(
      `SELECT c.email, COALESCE(p.name, c.name) AS name, c.role, c.created_at
       FROM collaborators c LEFT JOIN people p ON p.email = c.email
       WHERE c.use_case_id = ? ORDER BY c.role = 'owner' DESC, c.created_at`,
    )
    .all(useCaseId) as Collaborator[];
}

export function memberRole(useCaseId: string, email: string): Collaborator["role"] | null {
  const row = db()
    .prepare("SELECT role FROM collaborators WHERE use_case_id = ? AND email = ?")
    .get(useCaseId, email) as { role: Collaborator["role"] } | undefined;
  return row?.role ?? null;
}

export function addCollaborator(
  useCaseId: string,
  c: { email: string; name?: string | null; role?: Collaborator["role"]; added_by: string },
) {
  db()
    .prepare(
      `INSERT INTO collaborators (use_case_id, email, name, role, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(use_case_id, email) DO NOTHING`,
    )
    .run(useCaseId, c.email, c.name ?? null, c.role ?? "editor", c.added_by, now());
}

export function removeCollaborator(useCaseId: string, email: string) {
  db().prepare("DELETE FROM collaborators WHERE use_case_id = ? AND email = ? AND role != 'owner'").run(useCaseId, email);
}

/**
 * On sign-in: remember the person, fill in their name wherever they were added by email, and adopt
 * use cases created before sign-in existed that carry their name.
 */
export function recordSignIn(user: { email: string; name: string; bu: string }) {
  const conn = db();
  conn
    .prepare(
      `INSERT INTO people (email, name, business_unit, last_seen) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name, business_unit = excluded.business_unit, last_seen = excluded.last_seen`,
    )
    .run(user.email, user.name, user.bu, now());
  conn.prepare("UPDATE collaborators SET name = ? WHERE email = ?").run(user.name, user.email);
  const orphans = conn
    .prepare("SELECT id FROM use_cases WHERE owner_email IS NULL AND lower(submitter) = lower(?)")
    .all(user.name) as { id: string }[];
  for (const { id } of orphans) {
    conn.prepare("UPDATE use_cases SET owner_email = ? WHERE id = ?").run(user.email, id);
    addCollaborator(id, { email: user.email, name: user.name, role: "owner", added_by: user.email });
  }
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
