"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

const reorderSchema = z.object({
  kind: z.enum(["announcement", "faq", "quick_link"]),
  ids: z.array(uuidSchema).min(1).max(200).refine((ids) => new Set(ids).size === ids.length, "Duplicate items."),
});

/** Drag-and-drop reorder: position i becomes sort_order i. Only rows whose order actually changed are written. */
export async function reorderContentAction(kind: string, ids: string[]): Promise<FormState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const p = reorderSchema.safeParse({ kind, ids });
  if (!p.success) return { error: "Invalid order." };

  const supabase = await createClient(); // RLS requires content:manage
  const { data: current, error: readError } = await supabase.from("content_items").select("id, sort_order").eq("kind", p.data.kind).in("id", p.data.ids);
  if (readError || !current || current.length !== p.data.ids.length) return { error: "รายการมีการเปลี่ยนแปลง กรุณารีเฟรช / The list changed, please refresh." };

  const was = new Map(current.map((r) => [r.id as string, r.sort_order as number]));
  const changed = p.data.ids.map((id, i) => ({ id, i })).filter(({ id, i }) => was.get(id) !== i);
  const results = await Promise.all(changed.map(({ id, i }) => supabase.from("content_items").update({ sort_order: i }).eq("id", id).eq("kind", p.data.kind)));
  if (results.some((r) => r.error)) return { error: "Could not save the new order." };

  if (changed.length > 0) {
    await writeAudit({ actorId: user.id, action: "content.reorder", resourceType: "content", metadata: { kind: p.data.kind, moved: changed.length } });
  }
  revalidatePath("/content");
  revalidatePath("/dashboard");
  return { success: "บันทึกลำดับแล้ว / Order saved." };
}
