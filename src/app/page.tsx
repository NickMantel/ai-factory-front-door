"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUp, FileText, Paperclip, Users, X } from "lucide-react";
import type { UseCase } from "@/lib/db";
import { BUSINESS_UNITS } from "@/lib/rubric";
import { firstMessageKey } from "@/components/Workspace";
import { useSession } from "@/components/session";
import { CaseId, Percent, SectionLabel, Spinner, StatusPill, VisibilityLabel, timeAgo } from "@/components/ui";

type Mine = UseCase & { team: number; myRole: "owner" | "editor" | null };
type Shared = Pick<UseCase, "id" | "title" | "business_unit" | "submitter" | "status" | "readiness" | "one_liner" | "updated_at">;

const STARTERS = [
  "We spend hours manually checking photos for damage",
  "Our team answers the same policy questions every day",
  "We want to forecast demand more accurately",
];

export default function Home() {
  const router = useRouter();
  const user = useSession()?.user;
  const [coeBu, setCoeBu] = useState("");
  const [idea, setIdea] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);
  const [shared, setShared] = useState<Shared[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/use-cases")
      .then((r) => r.json())
      .then((d) => setMine(d.useCases ?? []))
      .catch(() => {});
    fetch("/api/use-cases?scope=shared")
      .then((r) => r.json())
      .then((d) => setShared(d.useCases ?? []))
      .catch(() => {});
  }, []);

  // The AI CoE can start a use case too, on behalf of a business unit.
  const needsBu = user?.role === "coe";
  const ready = user && (!needsBu || coeBu) && (idea.trim() || files.length);

  async function start() {
    if (!ready || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/use-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_unit: coeBu }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const id: string = body.useCase.id;

      let added: string[] = [];
      if (files.length) {
        const form = new FormData();
        files.forEach((f) => form.append("files", f));
        const up = await fetch(`/api/use-cases/${id}/documents`, { method: "POST", body: form });
        added = (await up.json()).added ?? [];
      }

      const attached = added.map((n) => `"${n}"`).join(", ");
      const first = idea.trim()
        ? added.length
          ? `${idea.trim()}\n\n(I've attached ${attached}.)`
          : idea.trim()
        : `I've uploaded ${attached}. Please review ${added.length > 1 ? "them" : "it"} and tell me how my use case stacks up.`;
      try {
        sessionStorage.setItem(firstMessageKey(id), first);
      } catch {}
      router.push(`/use-cases/${id}`);
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Try again.");
      setStarting(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (list?.length) setFiles((f) => [...f, ...Array.from(list)]);
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 pb-16">
      <div className="enter flex w-full max-w-2xl flex-1 flex-col justify-center pt-12 sm:pt-16">
        {/* Opening message from the front door */}
        <div className="text-[15px] leading-6">
          <div className="mb-2 text-xs text-subtle">AI Front Door</div>
          <p>
            This is the AI Centre of Excellence front door. Describe a problem you think AI could help with: who&apos;s
            affected, what happens today, and what good would look like. Rough is fine.
          </p>
          <p className="mt-4 text-muted">
            Attach anything you already have, like a Confluence page, slide deck, PDF or screenshot. As we talk,
            I&apos;ll score how ready the use case is for triage and point out what to sharpen. It stays a private
            draft for you and anyone you add until you submit it: as work in progress, or for triage with a standard
            brief.
          </p>
        </div>

        {/* Composer */}
        <div
          className={clsx(
            "relative mt-8 rounded-xl border bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-colors duration-150",
            dragging ? "border-accent" : "border-line-strong focus-within:border-foreground/35",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <div className="flex h-10 items-center gap-2 border-b border-line px-4 text-[13px] text-muted">
            {needsBu ? (
              <select
                value={coeBu}
                onChange={(e) => setCoeBu(e.target.value)}
                aria-label="Business unit"
                className={clsx("-ml-1 h-7 rounded-md bg-transparent px-1 outline-none hover:bg-raised", !coeBu && "text-subtle")}
              >
                <option value="" disabled>
                  On behalf of which business unit?
                </option>
                {BUSINESS_UNITS.map((b) => (
                  <option key={b} className="text-foreground">
                    {b}
                  </option>
                ))}
              </select>
            ) : (
              <span className="truncate">
                <span className="text-foreground">{user?.name}</span> · {user?.bu}
              </span>
            )}
            <span className="ml-auto shrink-0">
              <VisibilityLabel visibility="private" />
            </span>
          </div>

          <textarea
            ref={textarea}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                start();
              }
            }}
            rows={3}
            autoFocus
            placeholder="Describe the problem you're trying to solve…"
            className="block max-h-64 min-h-24 w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-6 outline-none placeholder:text-subtle field-sizing-content"
          />

          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-1">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="flex h-7 items-center gap-2 rounded-md bg-raised pr-1 pl-2 text-xs">
                  <FileText className="size-4 text-subtle" strokeWidth={1.5} />
                  <span className="max-w-48 truncate">{f.name}</span>
                  <button
                    onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                    className="rounded p-0.5 text-subtle hover:bg-black/5 hover:text-foreground"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 p-2">
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.pptx,.xlsx,.md,.txt,.csv,.html,.htm,.json,image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-muted transition-colors duration-150 hover:bg-raised hover:text-foreground"
            >
              <Paperclip className="size-4" strokeWidth={1.5} /> Attach
            </button>
            <span className="hidden text-xs text-subtle sm:inline">PDF, Word, PowerPoint, Confluence export, images</span>
            <button
              onClick={start}
              disabled={!ready || starting}
              aria-label="Start"
              className={clsx(
                "ml-auto flex size-8 items-center justify-center rounded-lg transition-colors duration-150",
                ready && !starting ? "bg-accent text-white" : "bg-raised text-subtle",
              )}
            >
              {starting ? <Spinner /> : <ArrowUp className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {error && <div className="mt-2 text-xs text-bad">{error}</div>}
        {!error && needsBu && idea.trim() && !coeBu && (
          <div className="mt-2 text-xs text-muted">Choose the business unit this use case belongs to</div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setIdea(s);
                textarea.current?.focus();
              }}
              className="h-8 rounded-lg border border-line bg-surface px-3 text-[13px] text-muted transition-colors duration-150 hover:border-line-strong hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {mine.length > 0 && (
        <div className="mt-16 w-full max-w-2xl">
          <SectionLabel className="mb-3">Your use cases</SectionLabel>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {mine.map((u) => (
              <Link
                key={u.id}
                href={`/use-cases/${u.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors duration-150 hover:bg-raised"
              >
                <CaseId id={u.id} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{u.title}</div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-subtle">
                    <VisibilityLabel visibility={u.status === "draft" ? "private" : u.visibility} />
                    {u.team > 1 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" strokeWidth={1.5} aria-hidden />
                        {u.team}
                      </span>
                    )}
                    {u.myRole === "editor" && <span>Shared with you by {u.submitter}</span>}
                    <span className="hidden sm:inline">{timeAgo(u.updated_at)}</span>
                  </div>
                </div>
                <Percent value={u.readiness} className="w-10 text-right text-[13px] text-muted" />
                <div className="hidden w-32 sm:block">
                  <StatusPill status={u.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {shared.length > 0 && (
        <div className="mt-10 w-full max-w-2xl">
          <SectionLabel>Shared across the organisation</SectionLabel>
          <p className="mt-1 mb-3 text-xs text-subtle">Submitted use cases other teams have opened to everyone. Read-only</p>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {shared.map((u) => (
              <Link
                key={u.id}
                href={`/use-cases/${u.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors duration-150 hover:bg-raised"
              >
                <CaseId id={u.id} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{u.title}</div>
                  <div className="mt-0.5 truncate text-xs text-subtle">{u.business_unit}</div>
                </div>
                <div className="hidden w-32 sm:block">
                  <StatusPill status={u.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
