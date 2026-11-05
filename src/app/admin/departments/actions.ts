"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation/documents";
import type { FormState } from "@/lib/auth/actions";

const schema = z.object({ name: z.string().trim().min(1, "Name is required").max(120), description: z.string().trim().max(1000).optional() });

export async function saveDepartmentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.DEPARTMENT_MANAGE);
  const p = schema.safeParse({ name: fd.get("name"), description: fd.get("description") ?? "" });
  if (!p.success) return { error: p.error.issues[0].message };
  const idRaw = fd.get("id");
  const id = idRaw ? uuidSchema.safeParse(idRaw) : null;
  if (id && !id.success) return { error: "Invalid department." };

  const supabase = await createClient();
  const row = { name: p.data.name, description: p.data.description || null };
  const { data, error } = id
    ? await supabase.from("departments").update(row).eq("id", id.data).select("id").single()
    : await supabase.from("departments").insert(row).select("id").single();
  if (error) return { error: error.code === "23505" ? "ชื่อแผนกนี้มีอยู่แล้ว / This department already exists." : "Could not save the department." };
  await writeAudit({ actorId: actor.id, action: id ? "department.update" : "department.create", resourceType: "department", resourceId: data.id, metadata: row });
  revalidatePath("/admin/departments");
  return { success: "บันทึกแล้ว / Saved." };
}

export async function deleteDepartmentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.DEPARTMENT_MANAGE);
  const id = uuidSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Invalid department." };
  const supabase = await createClient();
  const { error } = await supabase.from("departments").delete().eq("id", id.data);
  if (error) return { error: "Could not delete the department." };
  // Memberships cascade; document grants to this department (polymorphic) are removed explicitly so nothing dangles.
  await supabase.from("document_access").delete().eq("grantee_type", "department").eq("grantee_id", id.data);
  await writeAudit({ actorId: actor.id, action: "department.delete", resourceType: "department", resourceId: id.data });
  revalidatePath("/admin/departments");
  return { success: "ลบแล้ว / Deleted." };
}
