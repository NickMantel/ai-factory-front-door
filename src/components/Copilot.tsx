"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { RotateCcw, Sparkles, X } from "lucide-react";
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
        "fixed inset-0 z-40 overflow-hidden transition-[width] duration-300 ease-out",
        "lg:sticky lg:top-14 lg:z-auto lg:h-[calc(100dvh-3.5rem)] lg:shrink-0 lg:self-start",
        open ? "w-full lg:w-[440px] xl:w-[480px]" : "hidden w-0 lg:block",
      )}
    >
      <div className="flex h-full w-full flex-col border-l border-line bg-background lg:w-[440px] xl:w-[480px]">
        <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
          <Sparkles className="size-4 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="truncate text-xs text-muted">Grounded in the stored portfolio · cites use case IDs</div>
          </div>
          <Button variant="ghost" size="sm" onClick={clear} title="Start a new thread">
            <RotateCcw className="size-3.5" /> New
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close copilot">
            <X className="size-4" />
          </Button>
        </div>
        {history === null ? (
          <div className="flex flex-1 items-center justify-center text-muted">
            <Spinner />
          </div>
        ) : (
          <Chat
            key={version}
            endpoint="/api/coe/chat"
            extraBody={useCaseId ? { useCaseId } : undefined}
            initialMessages={history}
            assistantLabel="CoE Copilot"
            placeholder="Ask about this use case or the portfolio…"
            suggestions={suggestions}
            emptyState={
              <div className="pt-2 pb-5 text-sm text-muted">
                Ask anything: comparisons, overlaps, risks, what to prioritise, or a draft update for leadership.
              </div>
            }
          />
        )}
      </div>
    </aside>
  );
}
