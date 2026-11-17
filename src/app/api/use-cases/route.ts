import { connection } from "next/server";
import { createUseCase, listUseCases } from "@/lib/db";
import { BUSINESS_UNITS } from "@/lib/rubric";

// Optional ?submitter=&business_unit= filters let the business-unit view list only
// the person's own use cases, without the rest of the portfolio reaching the browser.
export async function GET(req: Request) {
  await connection();
  const params = new URL(req.url).searchParams;
  const submitter = params.get("submitter")?.trim().toLowerCase();
  const bu = params.get("business_unit");
  const useCases = listUseCases().filter(
    (u) => (!submitter || u.submitter.toLowerCase() === submitter) && (!bu || u.business_unit === bu),
  );
  return Response.json({ useCases });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { title?: string; business_unit?: string; submitter?: string };
  const submitter = body.submitter?.trim();
  const business_unit = body.business_unit?.trim();
  if (!submitter || !business_unit || !BUSINESS_UNITS.includes(business_unit)) {
    return Response.json({ error: "Name and a valid business unit are required." }, { status: 400 });
  }
  const uc = createUseCase({ title: body.title?.trim() || "Untitled use case", business_unit, submitter });
  return Response.json({ useCase: uc });
}
