import { friendlyError } from "@/lib/claude";
import { getUseCase } from "@/lib/db";
import { submitUseCase } from "@/lib/service";

export async function POST(_req: Request, ctx: RouteContext<"/api/use-cases/[id]/submit">) {
  const { id } = await ctx.params;
  const uc = getUseCase(id);
  if (!uc) return Response.json({ error: "Not found" }, { status: 404 });
  if (!uc.ready) return Response.json({ error: "This use case hasn't reached the triage threshold yet." }, { status: 400 });
  try {
    return Response.json({ useCase: await submitUseCase(id) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: friendlyError(err) }, { status: 500 });
  }
}
