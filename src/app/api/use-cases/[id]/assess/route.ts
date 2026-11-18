import { guardUseCase } from "@/lib/access";
import { friendlyError } from "@/lib/claude";
import { runAssessment } from "@/lib/service";

export async function POST(_req: Request, ctx: RouteContext<"/api/use-cases/[id]/assess">) {
  const { id } = await ctx.params;
  const g = await guardUseCase(id, "edit");
  if (g instanceof Response) return g;
  try {
    return Response.json({ useCase: await runAssessment(id) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: friendlyError(err) }, { status: 500 });
  }
}
