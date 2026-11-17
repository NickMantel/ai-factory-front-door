import { resetDatabase } from "@/lib/db";

export async function POST() {
  resetDatabase();
  return Response.json({ ok: true });
}
