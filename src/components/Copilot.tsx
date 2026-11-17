"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { RotateCcw, X } from "lucide-react";
import { Chat, type ChatMessage } from "./Chat";
import { Button, Spinner } from "./ui";

/**
 * Docked CoE copilot, scoped to the whole portfolio or one use case. Place it as the
 * last child of a flex row: on large screens it pushes the page content left rather
 * than covering it; on small screens it takes over the screen.
 */
export function Copilot({
  open,
  onClose,
  useCaseId,
  title,
  suggestions,
}: {
  open: boolean;
  onClose: () => void;
  useCaseId?: string;
  title: string;
  suggestions: string[];
}) {
  const [history, setHistory] = useState<ChatMessage[] | null>(null);
  const [version, setVersion] = useState(0);
  const qs = useCaseId ? `?useCaseId=${useCaseId}` : "";

  useEffect(() => {
    if (!open || history) return;
    fetch(`/api/coe/chat${qs}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content }))));
  }, [open, qs, history]);

  async function clear() {
    await fetch(`/api/coe/chat${qs}`, { method: "DELETE" });
    setHistory([]);
    setVersion((v) => v + 1);
  }

  return (
    <aside
      aria-hidden={!open}
      inert={!open}
      className={clsx(
        "fixed inset-0 z-40 overflow-hidden",
        "lg:sticky lg:top-14 lg:z-auto lg:h-[calc(100dvh-3.5rem)] lg:shrink-0 lg:self-start",
        open ? "w-full lg:w-[440px] xl:w-[480px]" : "hidden w-0 lg:block",
      )}
    >
      <div
        className={clsx(
          "flex h-full w-full flex-col border-l border-line bg-background transition-[opacity,transform] duration-300 lg:w-[440px] xl:w-[480px]",
          open ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0",
        )}
        style={{ transitionTimingFunction: "var(--ease)" }}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="truncate text-xs text-subtle">Answers cite case numbers from the stored portfolio</div>
          </div>
          <Button variant="ghost" size="sm" onClick={clear} title="Start a new thread">
            <RotateCcw className="size-4" strokeWidth={1.5} /> New thread
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close copilot">
            <X className="size-4" strokeWidth={1.5} />
          </Button>
        </div>
        {history === null ? (
          <div className="flex flex-1 items-center justify-center text-subtle">
            <Spinner />
          </div>
        ) : (
          <Chat
            key={version}
            endpoint="/api/coe/chat"
            extraBody={useCaseId ? { useCaseId } : undefined}
            initialMessages={history}
            assistantLabel="CoE copilot"
            placeholder="Ask about this use case or the portfolio…"
            suggestions={suggestions}
            emptyState={
              <p className="pb-6 text-sm leading-[22px] text-muted">
                Ask about comparisons, overlaps, risks, what to prioritise, or a draft update for leadership.
              </p>
            }
          />
        )}
      </div>
    </aside>
  );
}
