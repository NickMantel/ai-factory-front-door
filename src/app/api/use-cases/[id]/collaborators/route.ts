import { guardUseCase } from "@/lib/access";
import { addCollaborator, listCollaborators, removeCollaborator } from "@/lib/db";
import { normaliseEmail } from "@/lib/session";

// The owner decides who works on a use case. Anyone on it can see the list and leave.

export async function GET(_req: Request, ctx: RouteContext<"/api/use-cases/[id]/collaborators">) {
  const { id } = await ctx.params;
  const g = await guardUseCase(id, "edit");
  if (g instanceof Response) return g;
  return Response.json({ collaborators: listCollaborators(id) });
}

export async function POST(req: Request, ctx: RouteContext<"/api/use-cases/[id]/collaborators">) {
  const { id } = await ctx.params;
  const g = await guardUseCase(id, "owner");
  if (g instanceof Response) return g;
  const body = (await req.json()) as { email?: string };
  const email = normaliseEmail(body.email ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  addCollaborator(id, { email, added_by: g.user.email });
  return Response.json({ collaborators: listCollaborators(id) });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/use-cases/[id]/collaborators">) {
  const { id } = await ctx.params;
  const email = normaliseEmail(new URL(req.url).searchParams.get("email") ?? "");
  const g = await guardUseCase(id, "edit");
  if (g instanceof Response) return g;
  if (g.access !== "owner" && email !== g.user.email) {
    return Response.json({ error: "Only the owner can remove other people." }, { status: 403 });
  }
  removeCollaborator(id, email);
  return Response.json({ collaborators: listCollaborators(id) });
}
