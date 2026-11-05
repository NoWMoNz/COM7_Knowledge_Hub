import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { sanitizeFilename, UploadValidationError, validateUpload } from "./file-validation.service";

const BUCKET = "documents";

export type UploadInput = {
  actorId: string;
  actorName: string;
  filename: string;
  buffer: Buffer;
  /** Present when replacing: adds a new version to this document. */
  documentId?: string;
  title?: string;
  description?: string | null;
  categoryId?: string | null;
};

export async function createUpload(input: UploadInput): Promise<{ documentId: string; versionId: string; versionNumber: number }> {
  const sb = createAdminClient();
  const filename = sanitizeFilename(input.filename);
  const { ext, mime } = await validateUpload(filename, input.buffer);
  const hash = createHash("sha256").update(input.buffer).digest("hex");

  // Duplicate handling: identical content already present (and not failed) anywhere.
  const { data: dup, error: dupErr } = await sb
    .from("document_versions")
    .select("document_id, documents!document_versions_document_id_fkey(title)")
    .eq("file_hash", hash)
    .neq("status", "failed")
    .limit(1);
  if (dupErr) throw new Error(`duplicate check failed: ${dupErr.message}`); // never skip silently
  if (dup && dup.length > 0) {
    const d = dup[0].documents as { title: string } | { title: string }[] | null;
    const title = Array.isArray(d) ? d[0]?.title : d?.title;
    throw new UploadValidationError("duplicate", `This file already exists${title ? ` as "${title}"` : ""}.`);
  }

  let documentId = input.documentId;
  let versionNumber = 1;
  let createdDocument = false;

  if (documentId) {
    const { data: last } = await sb
      .from("document_versions").select("version_number").eq("document_id", documentId)
      .order("version_number", { ascending: false }).limit(1);
    const { data: doc } = await sb.from("documents").select("id").eq("id", documentId).single();
    if (!doc) throw new UploadValidationError("not_found", "Document not found.");
    versionNumber = (last?.[0]?.version_number ?? 0) + 1;
  } else {
    const fallbackTitle = filename.replace(/\.[^.]+$/, "").slice(0, 200) || "Untitled";
    const { data: doc, error } = await sb
      .from("documents")
      .insert({
        title: (input.title?.trim() || fallbackTitle).slice(0, 200),
        description: input.description ?? null,
        category_id: input.categoryId ?? null,
        created_by: input.actorId,
      })
      .select("id").single();
    if (error || !doc) throw new Error(`document insert failed: ${error?.message}`);
    documentId = doc.id;
    createdDocument = true;
  }

  const versionId = randomUUID();
  const storagePath = `${documentId}/${versionId}.${ext}`; // never derived from the user's filename

  const rollback = async () => {
    await sb.from("document_versions").delete().eq("id", versionId);
    if (createdDocument) await sb.from("documents").delete().eq("id", documentId!);
  };

  const { error: vErr } = await sb.from("document_versions").insert({
    id: versionId, document_id: documentId, version_number: versionNumber, storage_path: storagePath,
    original_filename: filename, file_ext: ext, mime_type: mime, file_size: input.buffer.length,
    file_hash: hash, status: "uploading", uploaded_by: input.actorId, uploaded_by_name: input.actorName,
  });
  if (vErr) {
    await rollback();
    throw new Error(`version insert failed: ${vErr.message}`);
  }

  const { error: sErr } = await sb.storage.from(BUCKET).upload(storagePath, input.buffer, { contentType: mime, upsert: false });
  if (sErr) {
    await rollback();
    throw new Error(`storage upload failed: ${sErr.message}`);
  }

  // File is stored: queue processing. The previous current version stays active until this one is Ready.
  await sb.from("document_versions").update({ status: "processing" }).eq("id", versionId);
  await sb.from("documents").update({ latest_version_id: versionId }).eq("id", documentId);
  await sb.from("processing_jobs").insert({ version_id: versionId, status: "queued" });

  await writeAudit({
    actorId: input.actorId,
    action: input.documentId ? "document.replace" : "document.upload",
    resourceType: "document",
    resourceId: documentId,
    metadata: { versionId, versionNumber, filename, size: input.buffer.length, ext },
  });
  return { documentId: documentId!, versionId, versionNumber };
}
