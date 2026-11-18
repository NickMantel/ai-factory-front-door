import { connection } from "next/server";
import { requireUser } from "@/lib/access";
import { createDraft, listCollaborators, listForMember, listPublic, listRecords } from "@/lib/db";
import { BUSINESS_UNITS } from "@/lib/rubric";

// ?scope=mine (default): the person's own and shared-with-them use cases, drafts included.
// ?scope=shared: submitted use cases other teams opened to the organisation.
// ?scope=portfolio: every submitted use case, for the AI CoE only.
export async function GET(req: Request) {
  await connection();
  const user = await requireUser();
  if (user instanceof Response) return user;
  const scope = new URL(req.url).searchParams.get("scope") ?? "mine";

  if (scope === "portfolio") {
    if (user.role !== "coe") return Response.json({ error: "Only the AI CoE can see this." }, { status: 403 });
    return Response.json({ useCases: listRecords() });
  }
  const mine = listForMember(user.email);
  if (scope === "shared") {
    const ids = new Set(mine.map((u) => u.id));
    const useCases = listPublic()
      .filter((u) => !ids.has(u.id))
      .map(({ id, title, business_unit, submitter, status, readiness, one_liner, patterns, updated_at }) => ({
        id, title, business_unit, submitter, status, readiness, one_liner, patterns, updated_at,
      }));
    return Response.json({ useCases });
  }
  return Response.json({
    useCases: mine.map((u) => {
      const team = listCollaborators(u.id);
      return { ...u, team: team.length, myRole: team.find((c) => c.email === user.email)?.role ?? null };
    }),
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => ({}))) as { business_unit?: string };
  const business_unit = user.role === "bu" ? user.bu : body.business_unit;
  if (!business_unit || !BUSINESS_UNITS.includes(business_unit)) {
    return Response.json({ error: "Choose the business unit this use case belongs to." }, { status: 400 });
  }
  return Response.json({ useCase: createDraft({ business_unit, owner: { email: user.email, name: user.name } }) });
}
