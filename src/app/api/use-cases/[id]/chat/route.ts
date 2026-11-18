import { guardUseCase } from "@/lib/access";
import { addMessage, documentTexts, listCollaborators, listMessages, listRecords, memberRole, type UseCase } from "@/lib/db";
import { streamChat } from "@/lib/claude";
import { intakeSystem } from "@/lib/prompts";
import { textStreamResponse } from "@/lib/stream";

export async function POST(req: Request, ctx: RouteContext<"/api/use-cases/[id]/chat">) {
  const { id } = await ctx.params;
  const g = await guardUseCase(id, "edit");
  if (g instanceof Response) return g;
  const { user, uc } = g;
  const { message } = (await req.json()) as { message: string };
  if (!message?.trim()) return Response.json({ error: "Empty message" }, { status: 400 });

  addMessage(id, "intake", "user", message.trim(), user.name);
  const messages = listMessages(id, "intake");
  // With several people in the conversation, the agent needs to know who said what.
  const several = new Set(messages.filter((m) => m.role === "user").map((m) => m.author)).size > 1;
  const history = messages.map((m) => ({
    role: m.role,
    content: several && m.role === "user" && m.author ? `[${m.author}] ${m.content}` : m.content,
  }));

  // Everyone on this use case reads the conversation, so the agent may name only use cases
  // all of them could open: ones opened to the organisation, or ones they all work on.
  // The rest it knows only as counts by AI pattern.
  const team = listCollaborators(id);
  const nameable = (u: UseCase) => u.visibility === "public" || team.every((c) => memberRole(u.id, c.email));
  const others = listRecords().filter((u) => u.id !== id);
  const named = others.filter(nameable);
  const unnamed = others.filter((u) => !nameable(u));
  return textStreamResponse(
    () => streamChat({ system: intakeSystem(uc, named, unnamed, documentTexts(id), user.name), messages: history }),
    (text) => addMessage(id, "intake", "assistant", text),
  );
}
