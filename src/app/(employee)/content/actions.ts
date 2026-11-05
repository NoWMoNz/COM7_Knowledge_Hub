"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { contentSchema, uuidSchema } from "@/lib/validation/documents";
import type { FormState } from "@/lib/auth/actions";

export async function saveContentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const p = contentSchema.safeParse({
    kind: fd.get("kind"), title: fd.get("title"), body: fd.get("body") ?? "", url: fd.get("url") ?? "",
    sortOrder: fd.get("sortOrder") || 0, isPublished: fd.get("isPublished") === "on",
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const idRaw = fd.get("id");
  const id = idRaw ? uuidSchema.safeParse(idRaw) : null;
  if (id && !id.success) return { error: "Invalid item." };

  const row = {
    kind: p.data.kind, title: p.data.title, body: p.data.body,
    url: p.data.kind === "quick_link" ? p.data.url : null, sort_order: p.data.sortOrder, is_published: p.data.isPublished,
  };
  const supabase = await createClient(); // RLS requires content:manage
  const { data, error } = id
    ? await supabase.from("content_items").update(row).eq("id", id.data).select("id").single()
    : await supabase.from("content_items").insert({ ...row, created_by: user.id }).select("id").single();
  if (error) return { error: "Could not save." };
  await writeAudit({ actorId: user.id, action: id ? "content.update" : "content.create", resourceType: "content", resourceId: data.id, metadata: { kind: row.kind, title: row.title, published: row.is_published } });
  revalidatePath("/content");
  revalidatePath("/dashboard");
  return { success: "บันทึกแล้ว / Saved." };
}

export async function deleteContentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = uuidSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Invalid item." };
  const supabase = await createClient();
  const { error } = await supabase.from("content_items").delete().eq("id", id.data);
  if (error) return { error: "Could not delete." };
  await writeAudit({ actorId: user.id, action: "content.delete", resourceType: "content", resourceId: id.data });
  revalidatePath("/content");
  revalidatePath("/dashboard");
  return { success: "ลบแล้ว / Deleted." };
}
