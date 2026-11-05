"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation/documents";
import type { FormState } from "@/lib/auth/actions";

const KNOWN = new Set<string>(Object.values(PERMISSIONS));

export async function savePermissionsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.ROLE_MANAGE);
  const roleId = uuidSchema.safeParse(fd.get("roleId"));
  if (!roleId.success) return { error: "Invalid role." };
  const wanted = new Set(fd.getAll("permission").map(String).filter((p) => KNOWN.has(p)) as Permission[]);

  const supabase = await createClient();
  const { data: cur } = await supabase.from("role_permissions").select("permission").eq("role_id", roleId.data);
  const have = new Set((cur ?? []).map((r) => r.permission as string));
  const add = [...wanted].filter((p) => !have.has(p));
  const remove = [...have].filter((p) => !wanted.has(p as Permission));

  if (add.length) {
    const { error } = await supabase.from("role_permissions").insert(add.map((permission) => ({ role_id: roleId.data, permission })));
    if (error) return { error: "Could not save permissions." };
  }
  if (remove.length) {
    const { error } = await supabase.from("role_permissions").delete().eq("role_id", roleId.data).in("permission", remove);
    if (error) {
      return { error: /critical admin/i.test(error.message) ? "ไม่สามารถถอนสิทธิ์สำคัญของ Admin ได้ / Critical admin permissions cannot be removed." : "Could not save permissions." };
    }
  }
  if (add.length || remove.length) {
    await writeAudit({ actorId: actor.id, action: "role.permissions_change", resourceType: "role", resourceId: roleId.data, metadata: { add, remove } });
  }
  revalidatePath("/admin/roles");
  return { success: "บันทึกแล้ว / Saved." };
}

const createSchema = z.object({
  key: z.string().trim().regex(/^[a-z_]{2,40}$/, "Key: lowercase letters and underscores only"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

export async function createRoleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.ROLE_MANAGE);
  const p = createSchema.safeParse({ key: fd.get("key"), name: fd.get("name"), description: fd.get("description") ?? "" });
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").insert({ ...p.data, description: p.data.description || null }).select("id").single();
  if (error) return { error: error.code === "23505" ? "Key นี้ถูกใช้แล้ว / This key already exists." : "Could not create the role." };
  await writeAudit({ actorId: actor.id, action: "role.create", resourceType: "role", resourceId: data.id, metadata: p.data });
  revalidatePath("/admin/roles");
  return { success: "สร้างบทบาทแล้ว / Role created." };
}

export async function deleteRoleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.ROLE_MANAGE);
  const roleId = uuidSchema.safeParse(fd.get("roleId"));
  if (!roleId.success) return { error: "Invalid role." };
  const supabase = await createClient();
  const { error } = await supabase.from("roles").delete().eq("id", roleId.data);
  if (error) {
    return { error: error.code === "23503" ? "ยังมีผู้ใช้ในบทบาทนี้ ย้ายผู้ใช้ก่อน / Users still have this role. Reassign them first." : /system roles/i.test(error.message) ? "ลบบทบาทระบบไม่ได้ / System roles cannot be deleted." : "Could not delete the role." };
  }
  await writeAudit({ actorId: actor.id, action: "role.delete", resourceType: "role", resourceId: roleId.data });
  revalidatePath("/admin/roles");
  return { success: "ลบแล้ว / Deleted." };
}
