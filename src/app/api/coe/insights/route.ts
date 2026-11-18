import { connection } from "next/server";
import { requireCoE } from "@/lib/access";
import { getInsights } from "@/lib/db";
import { friendlyError } from "@/lib/claude";
import { generateInsights } from "@/lib/service";

export async function GET() {
  await connection();
  const user = await requireCoE();
  if (user instanceof Response) return user;
  return Response.json(getInsights());
}

export async function POST() {
  const user = await requireCoE();
  if (user instanceof Response) return user;
  try {
    await generateInsights();
    return Response.json(getInsights());
  } catch (err) {
    console.error(err);
    return Response.json({ error: friendlyError(err) }, { status: 500 });
  }
}
