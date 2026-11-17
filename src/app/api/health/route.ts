import { connection } from "next/server";
import { hasCredentials, MODEL } from "@/lib/claude";

export async function GET() {
  await connection();
  return Response.json({ claude: hasCredentials(), model: MODEL });
}
