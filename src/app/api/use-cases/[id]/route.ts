import { connection } from "next/server";
import { getUseCase, listDocuments, listUseCases, listEvents, listMessages, updateStatus } from "@/lib/db";
import { STATUSES, type StatusKey } from "@/lib/rubric";

export async function GET(_req: Request, ctx: RouteContext<"/api/use-cases/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const useCase = getUseCase(id);
  if (!useCase) return Response.json({ error: "Not found" }, { status: 404 });
  const similarIds = new Set(useCase.assessment?.similar_use_case_ids ?? []);
  const similar = listUseCases()
    .filter((u) => similarIds.has(u.id))
    .map((u) => ({ id: u.id, title: u.title, business_unit: u.business_unit, status: u.status }));
  return Response.json({
    useCase,
    similar,
    messages: listMessages(id, "intake"),
    documents: listDocuments(id),
    events: listEvents(id),
  });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/use-cases/[id]">) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: StatusKey; note?: string };
  if (!body.status || !STATUSES.some((s) => s.key === body.status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }
  updateStatus(id, body.status, body.note?.trim() || null, "AI CoE");
  return Response.json({ useCase: getUseCase(id), events: listEvents(id) });
}
