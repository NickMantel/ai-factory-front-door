import { connection } from "next/server";
import { addMessage, clearMessages, documentTexts, getUseCase, listMessages, listUseCases } from "@/lib/db";
import { streamChat } from "@/lib/claude";
import { coePortfolioSystem, coeUseCaseSystem } from "@/lib/prompts";
import { textStreamResponse } from "@/lib/stream";

// CoE threads are stored per use case, or under PORTFOLIO for cross-portfolio questions.
const PORTFOLIO = "PORTFOLIO";

export async function GET(req: Request) {
  await connection();
  const scope = new URL(req.url).searchParams.get("useCaseId") || PORTFOLIO;
  return Response.json({ messages: listMessages(scope, "coe") });
}

export async function DELETE(req: Request) {
  const scope = new URL(req.url).searchParams.get("useCaseId") || PORTFOLIO;
  clearMessages(scope, "coe");
  return Response.json({ messages: [] });
}

export async function POST(req: Request) {
  const { message, useCaseId } = (await req.json()) as { message: string; useCaseId?: string };
  if (!message?.trim()) return Response.json({ error: "Empty message" }, { status: 400 });
  const all = listUseCases();
  const uc = useCaseId ? getUseCase(useCaseId) : null;
  if (useCaseId && !uc) return Response.json({ error: "Not found" }, { status: 404 });
  const scope = uc?.id ?? PORTFOLIO;

  addMessage(scope, "coe", "user", message.trim());
  const history = listMessages(scope, "coe").map((m) => ({ role: m.role, content: m.content }));
  const system = uc
    ? coeUseCaseSystem(uc, all, listMessages(uc.id, "intake"), documentTexts(uc.id))
    : coePortfolioSystem(all);
  return textStreamResponse(
    () => streamChat({ system, messages: history }),
    (text) => addMessage(scope, "coe", "assistant", text),
  );
}
