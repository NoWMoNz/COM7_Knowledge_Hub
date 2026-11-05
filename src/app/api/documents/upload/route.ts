import { NextResponse } from "next/server";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { documentMetadataSchema, uuidSchema } from "@/lib/validation/documents";
import { MAX_FILE_BYTES } from "@/constants/documents";
import { createUpload } from "@/services/documents/upload.service";
import { UploadValidationError } from "@/services/documents/file-validation.service";
import { runPendingJobs } from "@/services/documents/processing.service";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const UPLOADS_PER_MINUTE = 60;

const err = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return err(401, "unauthenticated", "Please sign in.");
  if (!hasPermission(user.permissions, PERMISSIONS.DOCUMENT_MANAGE)) return err(403, "forbidden", "Not allowed.");

  // Per-user rate limit from actual upload records.
  const { count } = await createAdminClient()
    .from("document_versions").select("id", { count: "exact", head: true })
    .eq("uploaded_by", user.id).gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((count ?? 0) >= UPLOADS_PER_MINUTE) return err(429, "rate_limited", "Too many uploads. Please wait a moment.");

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES + 1024 * 1024) return err(413, "file_too_large", "File is too large.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err(400, "bad_request", "Invalid upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return err(400, "bad_request", "No file provided.");
  if (file.size > MAX_FILE_BYTES) return err(413, "file_too_large", "File is too large.");

  const documentIdRaw = form.get("documentId");
  const documentId = documentIdRaw ? uuidSchema.safeParse(documentIdRaw) : null;
  if (documentId && !documentId.success) return err(400, "bad_request", "Invalid document id.");

  const meta = documentMetadataSchema.partial({ title: true }).safeParse({
    title: form.get("title") ?? undefined,
    description: form.get("description") ?? "",
    categoryId: form.get("categoryId") ?? "",
  });
  if (!meta.success) return err(400, "validation", meta.error.issues[0]?.message ?? "Invalid metadata.");

  try {
    const result = await createUpload({
      actorId: user.id,
      actorName: user.fullName ?? user.email,
      filename: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
      documentId: documentId?.data,
      title: meta.data.title,
      description: meta.data.description,
      categoryId: meta.data.categoryId,
    });
    after(() => runPendingJobs(3).catch((e) => console.error("[upload] background run failed", String(e))));
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof UploadValidationError) {
      return err(e.code === "duplicate" ? 409 : e.code === "file_too_large" ? 413 : 422, e.code, e.message);
    }
    console.error("[upload] failed", String(e));
    return err(500, "server_error", "Upload failed. Please try again.");
  }
}
