"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import clsx from "clsx";
import { ArrowUp, Paperclip } from "lucide-react";
import { Markdown } from "./Markdown";
import { Spinner } from "./ui";

export type ChatMessage = { role: "user" | "assistant"; content: string; error?: boolean };

const STREAM_ERROR = "\u0000ERROR:";

export function Chat({
  endpoint,
  extraBody,
  initialMessages,
  placeholder = "Type a message…",
  emptyState,
  suggestions,
  onAssistantDone,
  onFiles,
  uploading,
  sendRef,
  autoSend,
  disabled,
  assistantLabel = "Assistant",
}: {
  endpoint: string;
  extraBody?: Record<string, unknown>;
  initialMessages: ChatMessage[];
  placeholder?: string;
  emptyState?: ReactNode;
  suggestions?: string[];
  onAssistantDone?: () => void;
  onFiles?: (files: File[]) => void;
  uploading?: boolean;
  sendRef?: RefObject<((text: string) => void) | null>;
  /** Sent once, as soon as the chat mounts (e.g. the first message typed on the landing page). */
  autoSend?: string;
  disabled?: boolean;
  assistantLabel?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, ...extraBody }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "Request failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const errAt = acc.indexOf(STREAM_ERROR);
        const visible = errAt >= 0 ? acc.slice(0, errAt) : acc;
        const error = errAt >= 0 ? acc.slice(errAt + STREAM_ERROR.length) : null;
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = error
            ? { role: "assistant", content: visible ? `${visible}\n\n${error}` : error, error: true }
            : { role: "assistant", content: visible };
          return next;
        });
      }
      if (!acc.includes(STREAM_ERROR)) onAssistantDone?.();
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: (e as Error).message, error: true };
        return next;
      });
    } finally {
      setBusy(false);
      textarea.current?.focus();
    }
  }

  useEffect(() => {
    if (sendRef) sendRef.current = send;
  });

  const autoSent = useRef(false);
  useEffect(() => {
    if (!autoSend) return;
    // Deferred, and marked sent inside the timer, so Strict Mode's mount/unmount/mount sends once.
    const t = setTimeout(() => {
      if (autoSent.current) return;
      autoSent.current = true;
      void send(autoSend);
    }, 0);
    return () => clearTimeout(t);
    // Fire once per mount; `send` is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  function handleFiles(list: FileList | null) {
    if (!list?.length || !onFiles) return;
    onFiles(Array.from(list));
  }

  const last = messages[messages.length - 1];
  const waiting = busy && last?.role === "assistant" && !last.content;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        if (!onFiles) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        if (!onFiles) return;
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent-soft/80 text-sm font-medium text-[#1c5cab]">
          Drop files to add them to this use case
        </div>
      )}

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 && emptyState}
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white">
                {m.content}
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[10px] font-semibold text-[#1c5cab]">
                  AI
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-[11px] font-medium text-subtle">{assistantLabel}</div>
                  {waiting && i === messages.length - 1 ? (
                    <div className="typing flex gap-1 py-2 text-subtle" aria-label="Thinking">
                      <span className="size-1.5 rounded-full bg-current" />
                      <span className="size-1.5 rounded-full bg-current" />
                      <span className="size-1.5 rounded-full bg-current" />
                    </div>
                  ) : m.error ? (
                    <div className="rounded-lg border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad">{m.content}</div>
                  ) : (
                    <Markdown>{m.content}</Markdown>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="border-t border-line bg-surface px-4 pt-3 pb-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {suggestions && messages.length === 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={busy || disabled}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-1.5 focus-within:border-foreground/40">
            {onFiles && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.docx,.pptx,.xlsx,.md,.txt,.csv,.html,.htm,.json,image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  title="Attach documents (PDF, Word, PowerPoint, Confluence export, images)"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-black/[0.04] hover:text-foreground disabled:opacity-50"
                >
                  {uploading ? <Spinner /> : <Paperclip className="size-4" />}
                </button>
              </>
            )}
            <textarea
              ref={textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={placeholder}
              disabled={disabled}
              className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm outline-none placeholder:text-subtle field-sizing-content"
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim() || disabled}
              aria-label="Send"
              className={clsx(
                "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                input.trim() && !busy ? "bg-foreground text-white" : "bg-line text-subtle",
              )}
            >
              {busy ? <Spinner /> : <ArrowUp className="size-4" />}
            </button>
          </div>
          {onFiles && (
            <div className="mt-1.5 px-1 text-[11px] text-subtle">
              Drop in PDFs, slide decks, Word docs, Confluence exports or screenshots. Enter to send, Shift+Enter for a new line.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
