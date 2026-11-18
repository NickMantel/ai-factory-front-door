import { guardUseCase } from "@/lib/access";
import { friendlyError } from "@/lib/claude";
import { getUseCase, registerUseCase } from "@/lib/db";
import { VISIBILITIES, type Visibility } from "@/lib/rubric";
import { submitUseCase } from "@/lib/service";

// mode "progress": register the use case with the AI CoE as work in progress, at any readiness.
// mode "triage": the use case has cleared the threshold; write the brief and submit it for triage.
// Either way a private draft becomes a record with a case number at this point, and not before.
export async function POST(req: Request, ctx: RouteContext<"/api/use-cases/[id]/submit">) {
  const { id } = await ctx.params;
  const g = await guardUseCase(id, "edit");
  if (g instanceof Response) return g;
  const { user, uc } = g;
  const body = (await req.json().catch(() => ({}))) as { mode?: "progress" | "triage"; visibility?: Visibility };
  const mode = body.mode === "progress" ? "progress" : "triage";
  const visibility = VISIBILITIES.some((v) => v.key === body.visibility) ? body.visibility! : uc.visibility;

  if (!["draft", "shaping"].includes(uc.status)) {
    return Response.json({ error: "This use case has already been submitted for triage." }, { status: 400 });
  }
  if (mode === "triage" && !uc.ready) {
    return Response.json({ error: "This use case hasn't reached the triage threshold yet." }, { status: 400 });
  }
  if (mode === "progress" && !uc.assessment) {
    return Response.json({ error: "Describe the idea first so there's something to register." }, { status: 400 });
  }
  if (visibility !== uc.visibility && g.access !== "owner") {
    return Response.json({ error: "Only the owner can change who can see this use case." }, { status: 403 });
  }

  const recordId = registerUseCase(id, user.name, visibility);
  if (mode === "progress") return Response.json({ useCase: getUseCase(recordId) });
  try {
    return Response.json({ useCase: await submitUseCase(recordId, user.name) });
  } catch (err) {
    console.error(err);
    // Registered but not yet submitted for triage: the person can retry from the record.
    return Response.json({ error: friendlyError(err), useCase: getUseCase(recordId) }, { status: 500 });
  }
}
