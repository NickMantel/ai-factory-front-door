import { addDocument, deleteDocument, getUseCase, listDocuments } from "@/lib/db";
import { friendlyError } from "@/lib/claude";
import { extractDocument } from "@/lib/extract";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request, ctx: RouteContext<"/api/use-cases/[id]/documents">) {
  const { id } = await ctx.params;
  if (!getUseCase(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const errors: string[] = [];
  const added: string[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      errors.push(`${file.name} is larger than 25 MB.`);
      continue;
    }
    try {
      const { text, truncated } = await extractDocument(file);
      addDocument(id, { filename: file.name, mime: file.type || "application/octet-stream", size: file.size, text, truncated });
      added.push(file.name);
    } catch (err) {
      errors.push(friendlyError(err));
    }
  }
  return Response.json({ added, errors, documents: listDocuments(id) });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/use-cases/[id]/documents">) {
  const { id } = await ctx.params;
  const docId = Number(new URL(req.url).searchParams.get("docId"));
  deleteDocument(id, docId);
  return Response.json({ documents: listDocuments(id) });
}
