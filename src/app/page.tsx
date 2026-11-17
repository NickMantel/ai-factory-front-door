"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUp, FileText, Paperclip, X } from "lucide-react";
import type { UseCase } from "@/lib/db";
import { BUSINESS_UNITS } from "@/lib/rubric";
import { firstMessageKey } from "@/components/Workspace";
import { ReadinessRing, Spinner, StatusPill, timeAgo } from "@/components/ui";

const PROFILE_KEY = "frontdoor:profile";
type Profile = { name: string; bu: string };

const STARTERS = [
  "We spend hours manually checking photos for damage",
  "Our team answers the same policy questions every day",
  "We want to forecast demand more accurately",
];

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingProfile, setEditingProfile] = useState(true);
  const [name, setName] = useState("");
  const [bu, setBu] = useState("");
  const [idea, setIdea] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<UseCase[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let saved: Profile | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null");
    } catch {}
    if (!saved?.name || !saved.bu) return;
    // Browser storage is only readable after hydration, so this sync is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(saved);
    setName(saved.name);
    setBu(saved.bu);
    setEditingProfile(false);
    const qs = new URLSearchParams({ submitter: saved.name, business_unit: saved.bu });
    fetch(`/api/use-cases?${qs}`)
      .then((r) => r.json())
      .then((d) => setMine(d.useCases));
  }, []);

  const ready = name.trim() && bu && (idea.trim() || files.length);

  async function start() {
    if (!ready || starting) return;
    setStarting(true);
    setError(null);
    try {
      const me = { name: name.trim(), bu };
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(me));
      } catch {}

      const res = await fetch("/api/use-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submitter: me.name, business_unit: me.bu }),
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
      <div className="flex w-full max-w-2xl flex-1 flex-col justify-center pt-10 sm:pt-16">
        {/* Opening message from the front door */}
        <div className="flex gap-3">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-[11px] font-semibold text-[#1c5cab]">
            AI
          </div>
          <div className="min-w-0 flex-1 text-[15px] leading-relaxed">
            <div className="mb-1 text-[11px] font-medium text-subtle">AI Front Door</div>
            <p>
              Hi{profile ? ` ${profile.name.split(" ")[0]}` : ""}, I&apos;m the AI Centre of Excellence&apos;s front door.
              Tell me about a problem you think AI could help with: who&apos;s affected, what happens today, and what
              good would look like. Rough is fine.
            </p>
            <p className="mt-3 text-foreground/75">
              If you already have material, like a Confluence page, slide deck, PDF or screenshot, attach it and
              I&apos;ll read it. As we talk, I&apos;ll score how ready your use case is for triage and point out what
              to sharpen. When it&apos;s ready, you can submit it and the AI CoE receives a standard brief, so you can
              skip the early discovery meetings.
            </p>
          </div>
        </div>

        {/* Composer */}
        <div
          className={clsx(
            "relative mt-8 rounded-2xl border bg-surface shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_32px_-18px_rgba(0,0,0,0.18)] transition-colors",
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
          {editingProfile ? (
            <div className="flex flex-col gap-2 border-b border-line px-3 py-2.5 sm:flex-row sm:items-center">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                aria-label="Your name"
                className="h-8 flex-1 rounded-md bg-background px-2.5 text-sm outline-none placeholder:text-subtle focus:ring-1 focus:ring-foreground/20"
              />
              <select
                value={bu}
                onChange={(e) => setBu(e.target.value)}
                aria-label="Business unit"
                className={clsx(
                  "h-8 flex-1 rounded-md bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-foreground/20",
                  !bu && "text-subtle",
                )}
              >
                <option value="" disabled>
                  Your business unit
                </option>
                {BUSINESS_UNITS.map((b) => (
                  <option key={b} className="text-foreground">
                    {b}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs text-muted">
              <span>
                <span className="font-medium text-foreground">{name}</span> · {bu}
              </span>
              <button onClick={() => setEditingProfile(true)} className="ml-auto text-subtle underline-offset-2 hover:text-foreground hover:underline">
                Change
              </button>
            </div>
          )}

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
            className="block max-h-64 min-h-24 w-full resize-none bg-transparent px-4 pt-3 text-[15px] leading-relaxed outline-none placeholder:text-subtle field-sizing-content"
          />

          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-1">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="flex h-7 items-center gap-1.5 rounded-lg border border-line bg-background pr-1 pl-2 text-xs">
                  <FileText className="size-3.5 text-subtle" />
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

          <div className="flex items-center gap-2 px-2.5 pt-2 pb-2.5">
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
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted hover:bg-black/[0.04] hover:text-foreground"
            >
              <Paperclip className="size-4" /> Attach
            </button>
            <span className="hidden text-[11px] text-subtle sm:inline">PDF, Word, PowerPoint, Confluence export, images</span>
            <button
              onClick={start}
              disabled={!ready || starting}
              aria-label="Start"
              className={clsx(
                "ml-auto flex size-8 items-center justify-center rounded-lg transition-colors",
                ready && !starting ? "bg-foreground text-white" : "bg-line text-subtle",
              )}
            >
              {starting ? <Spinner /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>

        {error && <div className="mt-2 text-xs text-bad">{error}</div>}
        {!error && editingProfile && idea.trim() && (!name.trim() || !bu) && (
          <div className="mt-2 text-xs text-muted">Add your name and business unit so the AI CoE knows who to follow up with.</div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setIdea(s);
                textarea.current?.focus();
              }}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {mine.length > 0 && (
        <div className="mt-14 w-full max-w-2xl">
          <div className="mb-2 text-[11px] font-medium tracking-[0.08em] text-subtle uppercase">Pick up where you left off</div>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {mine.map((u) => (
              <Link
                key={u.id}
                href={`/use-cases/${u.id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-black/[0.015]"
              >
                <ReadinessRing value={u.readiness} size={32} label={false} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{u.title}</div>
                  <div className="text-xs text-subtle">
                    {u.readiness}% ready · updated {timeAgo(u.updated_at)}
                  </div>
                </div>
                <StatusPill status={u.status} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
