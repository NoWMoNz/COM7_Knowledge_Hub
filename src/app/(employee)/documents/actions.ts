"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { documentMetadataSchema, uuidSchema } from "@/lib/validation/documents";
import { requeueUnembedded, requeueVersion, runPendingJobs } from "@/services/documents/processing.service";
import type { FormState } from "@/lib/auth/actions";

export async function updateDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(PERMISSIONS.DOCUMENT_MANAGE);
  const id = uuidSchema.safeParse(formData.get("id"));
  const meta = documentMetadataSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    categoryId: formData.get("categoryId") ?? "",
  });
  if (!id.success || !meta.success) return { error: meta.success ? "Invalid document." : meta.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ title: meta.data.title, description: meta.data.description, category_id: meta.data.categoryId })
    .eq("id", id.data);
  if (error) return { error: "Could not save changes." };

  await writeAudit({ actorId: user.id, action: "document.update", resourceType: "document", resourceId: id.data, metadata: meta.data });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id.data}`);
  return { success: "บันทึกแล้ว / Saved." };
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.DOCUMENT_MANAGE);
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/documents");

  const supabase = await createClient();
  const { data: versions } = await supabase.from("document_versions").select("storage_path").eq("document_id", id.data);
  const { data: doc } = await supabase.from("documents").select("title").eq("id", id.data).maybeSingle();
  const { error } = await supabase.from("documents").delete().eq("id", id.data);
  if (error) redirect(`/documents/${id.data}?error=delete`);

  const paths = (versions ?? []).map((v) => v.storage_path as string);
  if (paths.length) await createAdminClient().storage.from("documents").remove(paths);
  await writeAudit({ actorId: user.id, action: "document.delete", resourceType: "document", resourceId: id.data, metadata: { title: doc?.title, versions: paths.length } });
  revalidatePath("/documents");
  redirect("/documents");
}

export async function retryProcessingAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.DOCUMENT_MANAGE);
  const versionId = uuidSchema.safeParse(formData.get("versionId"));
  const documentId = uuidSchema.safeParse(formData.get("documentId"));
  if (!versionId.success || !documentId.success) redirect("/documents");

  // Confirm the caller can see this version under RLS before using the service role.
  const supabase = await createClient();
  const { data: v } = await supabase.from("document_versions").select("id").eq("id", versionId.data).eq("document_id", documentId.data).maybeSingle();
  if (v && (await requeueVersion(versionId.data))) {
    await writeAudit({ actorId: user.id, action: "document.retry_processing", resourceType: "document", resourceId: documentId.data, metadata: { versionId: versionId.data } });
    after(() => runPendingJobs(3).catch((e) => console.error("[retry] background run failed", String(e))));
  }
  revalidatePath(`/documents/${documentId.data}`);
  revalidatePath("/documents");
  redirect(`/documents/${documentId.data}`);
}

export async function reindexAction(): Promise<void> {
  const user = await requirePermission(PERMISSIONS.DOCUMENT_MANAGE);
  const n = await requeueUnembedded();
  if (n > 0) {
    await writeAudit({ actorId: user.id, action: "document.reindex", resourceType: "document", metadata: { versions: n } });
    after(() => runPendingJobs(5).catch((e) => console.error("[reindex] background run failed", String(e))));
  }
  revalidatePath("/documents");
  redirect(`/documents?reindexed=${n}`);
}
