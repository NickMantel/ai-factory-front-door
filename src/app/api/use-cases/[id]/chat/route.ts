import { addMessage, documentTexts, getUseCase, listMessages, listUseCases } from "@/lib/db";
import { streamChat } from "@/lib/claude";
import { intakeSystem } from "@/lib/prompts";
import { textStreamResponse } from "@/lib/stream";

export async function POST(req: Request, ctx: RouteContext<"/api/use-cases/[id]/chat">) {
  const { id } = await ctx.params;
  const uc = getUseCase(id);
  if (!uc) return Response.json({ error: "Not found" }, { status: 404 });
  const { message } = (await req.json()) as { message: string };
  if (!message?.trim()) return Response.json({ error: "Empty message" }, { status: 400 });

  addMessage(id, "intake", "user", message.trim());
  const history = listMessages(id, "intake").map((m) => ({ role: m.role, content: m.content }));
  return textStreamResponse(
    () => streamChat({ system: intakeSystem(uc, listUseCases(), documentTexts(id)), messages: history }),
    (text) => addMessage(id, "intake", "assistant", text),
  );
}
