import { connection } from "next/server";
import { getInsights } from "@/lib/db";
import { friendlyError } from "@/lib/claude";
import { generateInsights } from "@/lib/service";

export async function GET() {
  await connection();
  return Response.json(getInsights());
}

export async function POST() {
  try {
    await generateInsights();
    return Response.json(getInsights());
  } catch (err) {
    console.error(err);
    return Response.json({ error: friendlyError(err) }, { status: 500 });
  }
}
