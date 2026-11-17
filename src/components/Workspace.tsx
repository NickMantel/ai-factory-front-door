"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Download, Printer, X } from "lucide-react";
import type { DocumentMeta, Message, UseCase } from "@/lib/db";
import { Chat } from "@/components/Chat";
import { Canvas } from "@/components/Canvas";
import { BriefView, briefToMarkdown, downloadMarkdown } from "@/components/BriefView";
import { Button, Spinner, StatusPill } from "@/components/ui";

type Similar = { id: string; title: string; business_unit: string };
type Data = { useCase: UseCase; messages: Message[]; documents: DocumentMeta[]; similar: Similar[] };

/** Set by the landing page so the workspace opens by sending the person's first message. */
export const firstMessageKey = (id: string) => `frontdoor:first:${id}`;

export function Workspace() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [firstMessage, setFirstMessage] = useState<string | undefined>();
  const [assessing, setAssessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "canvas">("chat");
  const sendRef = useRef<((text: string) => void) | null>(null);

  const load = useCallback(
    () =>
      fetch(`/api/use-cases/${id}`)
        .then((r) => r.json())
        .then((d: Data) => {
          try {
            const pending = sessionStorage.getItem(firstMessageKey(id));
            if (pending) {
              sessionStorage.removeItem(firstMessageKey(id));
              setFirstMessage(pending);
            }
          } catch {}
          setData(d);
        }),
    [id],
  );

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  const assess = useCallback(async () => {
    setAssessing(true);
    try {
      const res = await fetch(`/api/use-cases/${id}/assess`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData((d) => (d ? { ...d, useCase: body.useCase } : d));
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

  async function submit() {
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/use-cases/${id}/submit`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData((d) => (d ? { ...d, useCase: body.useCase } : d));
      setBriefOpen(true);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }
  if (!data.useCase) {
    return <div className="p-10 text-center text-muted">Use case not found.</div>;
  }

  const uc = data.useCase;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-black/[0.04]" aria-label="Back">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{uc.title}</h1>
            <StatusPill status={uc.status} />
          </div>
          <div className="truncate text-xs text-muted">
            <span className="font-mono">{uc.id}</span> · {uc.business_unit} · {uc.submitter}
          </div>
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-xs font-medium lg:hidden">
          {(["chat", "canvas"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx("rounded-md px-2.5 py-1 capitalize", tab === t ? "bg-foreground text-white" : "text-muted")}
            >
              {t === "canvas" ? `Canvas · ${uc.readiness}%` : "Chat"}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 border-b border-warn/20 bg-warn-soft px-4 py-2 text-xs text-[#8a5a00] sm:px-6">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <section className={clsx("min-w-0 flex-1 flex-col bg-background", tab === "chat" ? "flex" : "hidden lg:flex")}>
          <Chat
            endpoint={`/api/use-cases/${id}/chat`}
            initialMessages={data.messages.map((m) => ({ role: m.role, content: m.content }))}
            onAssistantDone={assess}
            onFiles={upload}
            uploading={uploading}
            sendRef={sendRef}
            autoSend={firstMessage}
            assistantLabel="AI Front Door"
            placeholder={uc.status === "draft" ? "Describe your idea, answer a question, or drop in documents…" : "Ask a follow-up question…"}
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
            "w-full shrink-0 overflow-y-auto border-l border-line bg-[#fbfbfa] lg:block lg:w-[400px] xl:w-[440px]",
            tab === "canvas" ? "block" : "hidden",
          )}
        >
          <Canvas
            useCase={uc}
            documents={data.documents}
            similar={data.similar ?? []}
            assessing={assessing}
            submitting={submitting}
            onSubmit={submit}
            onViewBrief={() => setBriefOpen(true)}
            onAsk={(q) => {
              setTab("chat");
              sendRef.current?.(`Help me with this: ${q}`);
            }}
            onRemoveDoc={removeDoc}
          />
        </aside>
      </div>

      {briefOpen && uc.brief && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-[2px]" onClick={() => setBriefOpen(false)}>
          <div
            className="flex h-full w-full max-w-3xl flex-col bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print flex items-center gap-2 border-b border-line px-5 py-3">
              <div className="flex-1">
                <div className="text-sm font-semibold">Use Case Brief</div>
                <div className="text-xs text-muted">Submitted to the AI CoE. This is the standard artefact they&apos;ll review.</div>
              </div>
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
                <Download className="size-3.5" /> Markdown
              </Button>
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="size-3.5" /> Print
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBriefOpen(false)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10">
              <BriefView
                brief={uc.brief}
                meta={{ id: uc.id, bu: uc.business_unit, submitter: uc.submitter, date: uc.submitted_at }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomeState({ businessUnit }: { businessUnit: string }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl pt-6">
      <h2 className="text-xl font-semibold tracking-tight">Tell us about your AI idea</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Describe the problem {businessUnit} is trying to solve, in your own words, or drop in what you already have:
        a Confluence page, slide deck, PDF or screenshot. You&apos;ll get instant feedback and a live readiness score.
        Once it clears the threshold, submit it and the AI CoE gets a standardised brief, with no discovery meeting needed to get started.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {[
          ["1", "Share", "Your idea, in words or documents"],
          ["2", "Sharpen", "Answer targeted questions and close the gaps"],
          ["3", "Submit", "A triage-ready brief goes to the CoE"],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-xl border border-line bg-surface p-3">
            <div className="text-[11px] font-medium text-subtle">Step {n}</div>
            <div className="mt-0.5 text-sm font-semibold">{t}</div>
            <div className="mt-0.5 text-xs text-muted">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
