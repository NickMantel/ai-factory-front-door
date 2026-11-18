"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Download, Printer, Users, X } from "lucide-react";
import type { Access } from "@/lib/access";
import type { Collaborator, DocumentMeta, Message, UseCase } from "@/lib/db";
import type { User } from "@/lib/session";
import { VISIBILITIES, type Visibility } from "@/lib/rubric";
import { Chat, type ChatMessage } from "@/components/Chat";
import { Canvas, type SubmitMode } from "@/components/Canvas";
import { BriefView, briefToMarkdown, downloadMarkdown } from "@/components/BriefView";
import { Button, CaseId, PageSpinner, SectionLabel, Spinner, StatusPill, VisibilityLabel } from "@/components/ui";

type Similar = { id: string; title: string; business_unit: string };
type Data = {
  useCase: UseCase;
  access: Access;
  me: User;
  messages: Message[];
  documents: DocumentMeta[];
  similar: Similar[];
  similarHidden: number;
  collaborators: Collaborator[];
};

/** Set by the landing page so the workspace opens by sending the person's first message. */
export const firstMessageKey = (id: string) => `frontdoor:first:${id}`;

// Colleagues on the same use case see each other's turns within a few seconds.
const POLL_MS = 5000;

const sameMessages = (a: Message[] | undefined, b: Message[]) =>
  !!a && a.length === b.length && a[a.length - 1]?.id === b[b.length - 1]?.id;

export function Workspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const openBrief = useSearchParams().get("brief") === "1";
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [firstMessage, setFirstMessage] = useState<string | undefined>();
  const [assessing, setAssessing] = useState(false);
  const [scored, setScored] = useState<{ from: number | null; to: number } | null>(null);
  const [submitting, setSubmitting] = useState<SubmitMode | null>(null);
  const [confirming, setConfirming] = useState<SubmitMode | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(openBrief);
  const [shareOpen, setShareOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "canvas">("chat");
  const sendRef = useRef<((text: string) => void) | null>(null);

  const load = useCallback(
    () =>
      fetch(`/api/use-cases/${id}`).then(async (r) => {
        const d = await r.json();
        // A colleague submitted this draft, so it now lives under its case number.
        if (d.movedTo) return router.replace(`/use-cases/${d.movedTo}`);
        if (!r.ok) return setMissing(d.error ?? "Use case not found.");
        if (d.access === "coe") return router.replace(`/coe/use-cases/${id}`);
        try {
          const pending = sessionStorage.getItem(firstMessageKey(id));
          if (pending) {
            sessionStorage.removeItem(firstMessageKey(id));
            setFirstMessage(pending);
          }
        } catch {}
        // Keep the same messages array while nothing changed, so the chat isn't disturbed.
        setData((prev) => ({ ...d, messages: sameMessages(prev?.messages, d.messages) ? prev!.messages : d.messages }));
      }),
    [id, router],
  );

  useEffect(() => {
    void load().catch(() => {});
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const chatMessages = useMemo<ChatMessage[] | undefined>(
    () => data?.messages.map((m) => ({ role: m.role, content: m.content, author: m.author })),
    [data?.messages],
  );

  // The score before this update, so the chat can say how it moved.
  const lastScore = useRef<number | null>(null);
  useEffect(() => {
    lastScore.current = data?.useCase.assessment ? data.useCase.readiness : null;
  }, [data?.useCase]);

  const assess = useCallback(async () => {
    const from = lastScore.current;
    setScored(null);
    setAssessing(true);
    try {
      const res = await fetch(`/api/use-cases/${id}/assess`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData((d) => (d ? { ...d, useCase: body.useCase } : d));
      setScored({ from, to: body.useCase.readiness });
      // Refresh the server-resolved list of similar use cases for the new assessment.
      void load().catch(() => {});
    } catch (e) {
      setNotice(`Couldn't update the assessment: ${(e as Error).message}`);
    } finally {
      setAssessing(false);
    }
  }, [id, load]);

  async function upload(files: File[]) {
    setUploading(true);
    setNotice(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await fetch(`/api/use-cases/${id}/documents`, { method: "POST", body: form });
      const body = await res.json();
      setData((d) => (d ? { ...d, documents: body.documents } : d));
      if (body.errors?.length) setNotice(body.errors.join(" "));
      if (body.added?.length) {
        sendRef.current?.(
          `I've uploaded ${body.added.map((n: string) => `"${n}"`).join(", ")}. Please review ${body.added.length > 1 ? "them" : "it"} and tell me how my use case stacks up.`,
        );
      }
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc(docId: number) {
    const res = await fetch(`/api/use-cases/${id}/documents?docId=${docId}`, { method: "DELETE" });
    const body = await res.json();
    setData((d) => (d ? { ...d, documents: body.documents } : d));
  }

  async function submit(mode: SubmitMode, visibility: Visibility) {
    setConfirming(null);
    setSubmitting(mode);
    setNotice(null);
    try {
      const res = await fetch(`/api/use-cases/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, visibility }),
      });
      const body = await res.json();
      if (!res.ok) setNotice(body.error);
      const uc: UseCase | undefined = body.useCase;
      if (!uc) return;
      // A draft gets its case number on submission, so the address changes.
      if (uc.id !== id) {
        router.replace(`/use-cases/${uc.id}${res.ok && mode === "triage" ? "?brief=1" : ""}`);
        return;
      }
      setData((d) => (d ? { ...d, useCase: uc } : d));
      if (res.ok && mode === "triage") setBriefOpen(true);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  if (missing) {
    return (
      <div className="p-10 text-center text-sm text-muted">
        {missing} It may be private to another team.{" "}
        <Link href="/" className="text-foreground underline underline-offset-2">
          Back to your use cases
        </Link>
      </div>
    );
  }
  if (!data) return <PageSpinner />;

  const uc = data.useCase;
  const brief = briefOpen && uc.brief && <BriefDrawer useCase={uc} onClose={() => setBriefOpen(false)} />;

  if (data.access === "viewer") return <SharedView data={data}>{brief}</SharedView>;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
        <BackLink />
        <CaseId id={uc.id} className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium">{uc.title}</h1>
          <div className="truncate text-xs text-subtle">
            {uc.business_unit} · {uc.submitter}
          </div>
        </div>
        <div className="hidden md:block">
          <StatusPill status={uc.status} />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)} title="People and visibility">
          <Users className="size-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Share</span>
          <span className="font-mono text-xs text-subtle tabular-nums">{data.collaborators.length}</span>
        </Button>
        <div className="flex gap-1 rounded-lg bg-raised p-1 text-xs font-medium lg:hidden">
          {(["chat", "canvas"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx("h-6 rounded-md px-2", tab === t ? "bg-surface text-foreground ring-1 ring-line" : "text-muted")}
            >
              {t === "chat" ? "Chat" : assessing ? <Spinner className="size-3" /> : `${uc.readiness}%`}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 border-b border-line bg-warn-soft px-4 py-2 text-xs text-warn sm:px-6">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <section className={clsx("min-w-0 flex-1 flex-col bg-background", tab === "chat" ? "flex" : "hidden lg:flex")}>
          <Chat
            endpoint={`/api/use-cases/${id}/chat`}
            initialMessages={chatMessages ?? []}
            syncMessages={chatMessages}
            me={data.me.name}
            draftKey={`frontdoor:unsent:${id}`}
            onAssistantDone={assess}
            onSend={() => setScored(null)}
            status={
              assessing ? (
                <AssessingStatus />
              ) : scored ? (
                <ScoredStatus {...scored} ready={uc.ready} onShow={() => setTab("canvas")} />
              ) : null
            }
            onFiles={upload}
            uploading={uploading}
            sendRef={sendRef}
            autoSend={firstMessage}
            assistantLabel="AI Factory Front Door"
            placeholder={
              uc.status === "draft" || uc.status === "shaping"
                ? "Describe your idea, answer a question, or drop in documents…"
                : "Ask a follow-up question…"
            }
            suggestions={[
              "We spend hours manually checking photos for damage",
              "Our team answers the same policy questions every day",
              "We want to use AI to forecast demand",
            ]}
            emptyState={<WelcomeState businessUnit={uc.business_unit} />}
          />
        </section>
        <aside
          className={clsx(
            "w-full shrink-0 overflow-y-auto border-l border-line bg-background lg:block lg:w-[400px] xl:w-[440px]",
            tab === "canvas" ? "block" : "hidden",
          )}
        >
          <Canvas
            useCase={uc}
            documents={data.documents}
            similar={data.similar ?? []}
            similarHidden={data.similarHidden}
            assessing={assessing}
            submitting={submitting}
            coeLink={data.me.role === "coe"}
            onSubmit={setConfirming}
            onViewBrief={() => setBriefOpen(true)}
            onAsk={(q) => {
              setTab("chat");
              sendRef.current?.(`Help me with this: ${q}`);
            }}
            onRemoveDoc={removeDoc}
          />
        </aside>
      </div>

      {confirming && (
        <SubmitDialog
          mode={confirming}
          useCase={uc}
          isOwner={data.access === "owner"}
          onCancel={() => setConfirming(null)}
          onConfirm={(v) => submit(confirming, v)}
        />
      )}
      {shareOpen && (
        <SharePanel
          data={data}
          onClose={() => setShareOpen(false)}
          onChange={(patch) => setData((d) => (d ? { ...d, ...patch } : d))}
        />
      )}
      {brief}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors duration-150 hover:bg-raised hover:text-foreground"
      aria-label="Back"
    >
      <ArrowLeft className="size-4" strokeWidth={1.5} />
    </Link>
  );
}

function Drawer({
  title,
  subtitle,
  actions,
  onClose,
  width = "max-w-3xl",
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  onClose: () => void;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className={clsx("enter flex h-full w-full flex-col bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.06)]", width)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="no-print flex h-16 shrink-0 items-center gap-2 border-b border-line px-6">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{title}</div>
            <div className="truncate text-xs text-subtle">{subtitle}</div>
          </div>
          {actions}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" strokeWidth={1.5} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BriefDrawer({ useCase: uc, onClose }: { useCase: UseCase; onClose: () => void }) {
  return (
    <Drawer
      title="Use case brief"
      subtitle="The standard artefact the AI CoE reviews at triage"
      onClose={onClose}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadMarkdown(
                `${uc.id}-use-case-brief.md`,
                briefToMarkdown(uc.brief!, { id: uc.id, bu: uc.business_unit, submitter: uc.submitter }),
              )
            }
          >
            <Download className="size-4" strokeWidth={1.5} /> Markdown
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" strokeWidth={1.5} /> Print
          </Button>
        </>
      }
    >
      <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-12">
        <BriefView
          brief={uc.brief!}
          meta={{ id: uc.id, bu: uc.business_unit, submitter: uc.submitter, date: uc.submitted_at }}
        />
      </div>
    </Drawer>
  );
}

function VisibilityChoice({
  value,
  onChange,
  disabled,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Who can see it">
      {VISIBILITIES.map((v) => (
        <label
          key={v.key}
          className={clsx(
            "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150",
            value === v.key ? "border-accent bg-accent-soft" : "border-line-strong",
            disabled ? "opacity-60" : "cursor-pointer hover:bg-raised",
          )}
        >
          <input
            type="radio"
            name="visibility"
            className="mt-0.5 accent-[var(--accent)]"
            checked={value === v.key}
            disabled={disabled}
            onChange={() => onChange(v.key)}
          />
          <span>
            <span className="block text-sm">{v.label}</span>
            <span className="block text-xs text-muted">{v.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function SubmitDialog({
  mode,
  useCase: uc,
  isOwner,
  onCancel,
  onConfirm,
}: {
  mode: SubmitMode;
  useCase: UseCase;
  isOwner: boolean;
  onCancel: () => void;
  onConfirm: (v: Visibility) => void;
}) {
  const [visibility, setVisibility] = useState<Visibility>(uc.visibility);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4" onClick={onCancel}>
      <div
        className="enter w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={mode === "triage" ? "Submit for triage" : "Save as work in progress"}
      >
        <h2 className="text-[15px] font-medium">{mode === "triage" ? "Submit for triage" : "Save as work in progress"}</h2>
        <p className="mt-2 text-sm leading-[22px] text-muted">
          {mode === "triage"
            ? "The AI Factory Front Door writes the standard use case brief from your conversation and documents, which takes about a minute, and sends it to the AI CoE for triage."
            : "This registers the use case with the AI CoE as work in progress and gives it a case number. You and your collaborators keep refining it here, and submit it for triage when it's ready."}
        </p>
        <SectionLabel className="mt-6 mb-2">Who can see it</SectionLabel>
        <VisibilityChoice value={visibility} onChange={setVisibility} disabled={!isOwner} />
        <p className="mt-2 text-xs leading-[18px] text-subtle">
          {isOwner ? "" : `Only the owner, ${uc.submitter}, can change this. `}The AI CoE sees every submitted use case
          either way.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(visibility)}>{mode === "triage" ? "Submit for triage" : "Save and register"}</Button>
        </div>
      </div>
    </div>
  );
}

function SharePanel({
  data,
  onClose,
  onChange,
}: {
  data: Data;
  onClose: () => void;
  onChange: (patch: Partial<Data>) => void;
}) {
  const router = useRouter();
  const uc = data.useCase;
  const isOwner = data.access === "owner";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      return body;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const body = await call(`/api/use-cases/${uc.id}/collaborators`, { method: "POST", body: JSON.stringify({ email }) });
    if (body) {
      onChange({ collaborators: body.collaborators });
      setEmail("");
    }
  }

  async function remove(who: string) {
    const body = await call(`/api/use-cases/${uc.id}/collaborators?email=${encodeURIComponent(who)}`, { method: "DELETE" });
    if (!body) return;
    if (who === data.me.email) router.push("/");
    else onChange({ collaborators: body.collaborators });
  }

  async function changeVisibility(visibility: Visibility) {
    const body = await call(`/api/use-cases/${uc.id}`, { method: "PATCH", body: JSON.stringify({ visibility }) });
    if (body) onChange({ useCase: body.useCase });
  }

  return (
    <Drawer title="Share" subtitle={uc.title} onClose={onClose} width="max-w-md">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <SectionLabel className="mb-2">People on this use case</SectionLabel>
        <p className="mb-3 text-xs leading-[18px] text-subtle">
          They can see the draft, chat with the AI Factory Front Door, add documents and submit it.
        </p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {data.collaborators.map((c) => (
            <li key={c.email} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">
                  {c.name ?? c.email}
                  {c.email === data.me.email && <span className="text-subtle"> (you)</span>}
                </div>
                <div className="truncate text-xs text-subtle">
                  {c.name ? c.email : "Hasn't signed in yet"}
                </div>
              </div>
              {c.role === "owner" ? (
                <span className="text-xs text-subtle">Owner</span>
              ) : isOwner || c.email === data.me.email ? (
                <Button variant="ghost" size="sm" onClick={() => remove(c.email)} disabled={busy}>
                  {c.email === data.me.email ? "Leave" : "Remove"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {isOwner && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) void add();
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Colleague's work email"
              aria-label="Colleague's work email"
              className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none placeholder:text-subtle focus:border-foreground/40"
            />
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy ? <Spinner /> : "Add"}
            </Button>
          </form>
        )}
        {isOwner && (
          <p className="mt-2 text-xs leading-[18px] text-subtle">
            They&apos;ll find it under their use cases when they sign in with that email.
          </p>
        )}

        <SectionLabel className="mt-8 mb-2">Who can see it</SectionLabel>
        <VisibilityChoice value={uc.visibility} onChange={changeVisibility} disabled={!isOwner || busy} />
        <p className="mt-2 text-xs leading-[18px] text-subtle">
          {uc.status === "draft"
            ? "Applies once it's submitted. Until then only the people above can see this draft. "
            : ""}
          {isOwner ? "" : `Only the owner, ${uc.submitter}, can change this. `}The AI CoE sees every submitted use case
          either way.
        </p>
        {error && <p className="mt-4 text-xs text-bad">{error}</p>}
      </div>
    </Drawer>
  );
}

/** Read-only view of a use case another team opened to the organisation. */
function SharedView({ data, children }: { data: Data; children?: React.ReactNode }) {
  const uc = data.useCase;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
        <BackLink />
        <CaseId id={uc.id} className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium">{uc.title}</h1>
          <div className="truncate text-xs text-subtle">
            {uc.business_unit} · {uc.submitter}
          </div>
        </div>
        <VisibilityLabel visibility={uc.visibility} />
        <span className="hidden text-xs text-subtle sm:inline">View only</span>
      </div>
      <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 rounded-xl border border-line bg-surface p-6 sm:p-10">
          {uc.brief ? (
            <BriefView
              brief={uc.brief}
              meta={{ id: uc.id, bu: uc.business_unit, submitter: uc.submitter, date: uc.submitted_at }}
            />
          ) : (
            <div>
              <h2 className="text-[22px] leading-7 font-medium">{uc.title}</h2>
              <p className="mt-3 max-w-[65ch] text-[15px] leading-6 text-muted">{uc.one_liner}</p>
              <p className="mt-6 text-sm text-subtle">
                {uc.business_unit} is still shaping this use case. The brief is written when they submit it for triage.
              </p>
            </div>
          )}
          <p className="mt-10 border-t border-line pt-4 text-xs text-subtle">
            Working on something similar? Contact {uc.submitter} in {uc.business_unit}, or mention {uc.id} when you
            describe your own use case.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-background lg:self-start">
          <Canvas
            useCase={uc}
            documents={[]}
            similar={data.similar}
            similarHidden={data.similarHidden}
            assessing={false}
            submitting={null}
            readOnly
            onSubmit={() => {}}
            onViewBrief={() => {}}
            onAsk={() => {}}
            onRemoveDoc={() => {}}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

function WelcomeState({ businessUnit }: { businessUnit: string }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-[15px] leading-6">
      <div className="mb-2 text-xs text-subtle">AI Factory Front Door</div>
      <p>
        Describe the problem {businessUnit} is trying to solve, in your own words, or attach what you already have:
        a Confluence page, slide deck, PDF or screenshot.
      </p>
      <p className="mt-4 text-muted">
        This draft is private to you and anyone you add with Share. The readiness sheet updates as we talk. Save it as
        work in progress whenever you like, or once it clears the {"70%"} line with every criterion at 2 or more, submit
        it for triage and the CoE receives a standard brief.
      </p>
    </div>
  );
}

/** Scoring takes a little while after each reply; say so where the person is looking. */
function AssessingStatus() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      role="status"
      className="enter flex items-center gap-3 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-accent"
    >
      <Spinner />
      <span className="flex-1">Updating your triage readiness score against the CoE criteria…</span>
      <span className="font-mono text-xs tabular-nums opacity-70">{seconds}s</span>
    </div>
  );
}

function ScoredStatus({ from, to, ready, onShow }: { from: number | null; to: number; ready: boolean; onShow: () => void }) {
  const change =
    from === null ? (
      <>Readiness scored at {to}%</>
    ) : from === to ? (
      <>Readiness unchanged at {to}%</>
    ) : (
      <>
        Readiness {from}% → {to}%
      </>
    );
  return (
    <div role="status" className="enter flex items-center gap-3 px-1 text-xs text-subtle">
      <span className={clsx("size-1.5 rounded-full", ready ? "bg-good" : "bg-[var(--progress)]")} aria-hidden />
      <span className="font-mono tabular-nums">{change}</span>
      {ready && <span className="text-good">Ready to submit for triage</span>}
      <button onClick={onShow} className="ml-auto text-accent hover:underline lg:hidden">
        See breakdown
      </button>
    </div>
  );
}
