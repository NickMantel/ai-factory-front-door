import { requireCoE } from "@/lib/access";
import { resetDatabase } from "@/lib/db";

export async function POST() {
  const user = await requireCoE();
  if (user instanceof Response) return user;
  resetDatabase();
  return Response.json({ ok: true });
}
