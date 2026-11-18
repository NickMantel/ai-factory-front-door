import { connection } from "next/server";
import { guardUseCase, visibleTo } from "@/lib/access";
import {
  getUseCase,
  listCollaborators,
  listDocuments,
  listEvents,
  listMessages,
  setVisibility,
  updateStatus,
} from "@/lib/db";
import { STATUSES, VISIBILITIES, type StatusKey, type Visibility } from "@/lib/rubric";

export async function GET(_req: Request, ctx: RouteContext<"/api/use-cases/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const g = await guardUseCase(id, "view");
  if (g instanceof Response) return g;
  const { user, uc, access } = g;

  // Similar use cases are only named when this person could open them anyway.
  const similarAll = (uc.assessment?.similar_use_case_ids ?? []).map(getUseCase).filter((u) => u !== null);
  const similar = similarAll
    .filter((u) => visibleTo(user, u))
    .map((u) => ({ id: u.id, title: u.title, business_unit: u.business_unit, status: u.status }));
  const team = access !== "viewer";
  return Response.json({
    useCase: uc,
    access,
    me: user,
    similar,
    similarHidden: similarAll.length - similar.length,
    collaborators: team ? listCollaborators(id) : [],
    messages: team ? listMessages(id, "intake") : [],
    documents: team ? listDocuments(id) : [],
    events: team ? listEvents(id) : [],
  });
}

/** { visibility } from the owner, or { status, note } from the AI CoE. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/use-cases/[id]">) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: StatusKey; note?: string; visibility?: Visibility };

  if (body.visibility) {
    const g = await guardUseCase(id, "owner");
    if (g instanceof Response) return g;
    if (!VISIBILITIES.some((v) => v.key === body.visibility)) {
      return Response.json({ error: "Invalid visibility" }, { status: 400 });
    }
    setVisibility(id, body.visibility);
    return Response.json({ useCase: getUseCase(id) });
  }

  const g = await guardUseCase(id, "view");
  if (g instanceof Response) return g;
  if (g.user.role !== "coe") return Response.json({ error: "Only the AI CoE can change the status." }, { status: 403 });
  if (!body.status || body.status === "draft" || !STATUSES.some((s) => s.key === body.status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }
  updateStatus(id, body.status, body.note?.trim() || null, g.user.name);
  return Response.json({ useCase: getUseCase(id), events: listEvents(id) });
}
