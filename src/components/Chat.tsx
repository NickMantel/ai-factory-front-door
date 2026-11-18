"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import clsx from "clsx";
import { ArrowUp, Paperclip } from "lucide-react";
import { Markdown } from "./Markdown";
import { Spinner } from "./ui";

export type ChatMessage = { role: "user" | "assistant"; content: string; author?: string | null; error?: boolean };

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
  me,
  syncMessages,
  draftKey,
  status,
  onSend,
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
  /** The signed-in person's name: their messages carry it, and colleagues' messages are labelled. */
  me?: string;
  /** The conversation as last stored on the server, picked up when colleagues add to it. */
  syncMessages?: ChatMessage[];
  /** Keeps an unsent message across reloads. */
  draftKey?: string;
  /** Shown under the conversation, e.g. while the readiness score updates after a reply. */
  status?: ReactNode;
  onSend?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInputState] = useState(() => {
    try {
      return draftKey ? (localStorage.getItem(draftKey) ?? "") : "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(syncMessages);

  // Adopt newer server messages between turns. The stored conversation only grows, so a
  // shorter one is stale (fetched before this person's own turn landed) and is ignored.
  if (syncMessages !== synced && !busy) {
    setSynced(syncMessages);
    if (syncMessages && syncMessages.length >= messages.length) setMessages(syncMessages);
  }

  function setInput(v: string) {
    setInputState(v);
    try {
      if (draftKey) {
        if (v) localStorage.setItem(draftKey, v);
        else localStorage.removeItem(draftKey);
      }
    } catch {}
  }
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const hasStatus = status != null && status !== false;
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, hasStatus]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    onSend?.();
    setMessages((m) => [...m, { role: "user", content, author: me }, { role: "assistant", content: "" }]);
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
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-xl border border-dashed border-accent bg-surface/90 text-sm text-accent">
          Drop files to add them to this use case
        </div>
      )}

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 && emptyState}
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto flex max-w-[85%] flex-col items-end">
                {m.author && me && m.author !== me && <div className="mb-2 text-xs text-subtle">{m.author}</div>}
                <div className="rounded-xl bg-raised px-4 py-3 text-sm leading-[22px] whitespace-pre-wrap">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="min-w-0">
                <div className="mb-2 text-xs text-subtle">{assistantLabel}</div>
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
            ),
          )}
          {!busy && status}
        </div>
      </div>

      <div className="px-4 pt-2 pb-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {suggestions && messages.length === 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={busy || disabled}
                  className="h-8 rounded-lg border border-line bg-surface px-3 text-[13px] text-muted transition-colors duration-150 hover:border-line-strong hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 focus-within:border-foreground/30">
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
                  aria-label="Attach documents"
                  title="Attach PDF, Word, PowerPoint, Confluence export or images"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors duration-150 hover:bg-raised hover:text-foreground disabled:opacity-50"
                >
                  {uploading ? <Spinner /> : <Paperclip className="size-4" strokeWidth={1.5} />}
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
              className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-subtle field-sizing-content"
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim() || disabled}
              aria-label="Send"
              className={clsx(
                "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
                input.trim() && !busy ? "bg-accent text-white" : "bg-raised text-subtle",
              )}
            >
              {busy ? <Spinner /> : <ArrowUp className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
          <div className="mt-2 hidden items-center gap-1 px-1 text-xs text-subtle sm:flex">
            <Kbd>Enter</Kbd> to send, <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for a new line
            {onFiles && <span className="ml-auto hidden sm:inline">Drop files anywhere in the chat</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 items-center rounded-[4px] border border-line-strong bg-surface px-1 font-mono text-[11px] text-muted">
      {children}
    </kbd>
  );
}
