"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { getPublicEnv } from "@/lib/env";
import { uuidSchema } from "@/lib/validation/documents";
import type { FormState } from "@/lib/auth/actions";

const BAN_FOREVER = "876000h";
const friendly = (msg: string) =>
  /last active administrator/i.test(msg) ? "ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน / At least one active administrator is required." : "Could not save changes.";

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().max(200).optional(),
  roleId: uuidSchema,
  password: z.string().min(12, "Password must be at least 12 characters").max(200),
});

export async function createUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const p = createSchema.safeParse({ email: fd.get("email"), fullName: fd.get("fullName") ?? "", roleId: fd.get("roleId"), password: fd.get("password") });
  if (!p.success) return { error: p.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: p.data.email, password: p.data.password, email_confirm: true,
    app_metadata: { must_change_password: true },
    user_metadata: p.data.fullName ? { full_name: p.data.fullName } : undefined,
  });
  if (error || !data.user) {
    return { error: /already|registered|exists/i.test(error?.message ?? "") ? "อีเมลนี้มีบัญชีอยู่แล้ว / This email already has an account." : "Could not create the account." };
  }
  // The profile row is created by a DB trigger with the default role; apply the chosen role (trusted server path).
  const { error: roleErr } = await admin.from("profiles").update({ role_id: p.data.roleId }).eq("id", data.user.id);
  await writeAudit({ actorId: actor.id, action: "user.create", resourceType: "user", resourceId: data.user.id, metadata: { email: p.data.email, roleId: p.data.roleId } });
  revalidatePath("/admin/users");
  return roleErr
    ? { error: "สร้างบัญชีแล้ว แต่ตั้งบทบาทไม่สำเร็จ โปรดแก้ในรายการ / Account created, but the role could not be set. Fix it in the list." }
    : { success: "สร้างบัญชีแล้ว แจ้งรหัสผ่านเริ่มต้นให้ผู้ใช้ทางช่องทางที่ปลอดภัย / Account created. Share the initial password securely." };
}

const updateSchema = z.object({ userId: uuidSchema, roleId: uuidSchema, fullName: z.string().trim().max(200).optional() });

export async function updateUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const p = updateSchema.safeParse({ userId: fd.get("userId"), roleId: fd.get("roleId"), fullName: fd.get("fullName") ?? "" });
  if (!p.success) return { error: "Invalid input." };
  const isActive = fd.get("isActive") === "on";

  const supabase = await createClient(); // RLS + guard triggers apply
  const { data: before } = await supabase.from("profiles").select("role_id, is_active").eq("id", p.data.userId).maybeSingle();
  if (!before) return { error: "User not found." };
  if (p.data.userId === actor.id && (before.role_id !== p.data.roleId || !isActive)) {
    return { error: "ไม่สามารถเปลี่ยนบทบาทหรือปิดบัญชีของตนเองได้ ให้ผู้ดูแลคนอื่นทำแทน / You cannot change your own role or deactivate yourself." };
  }

  const { error } = await supabase.from("profiles").update({ role_id: p.data.roleId, is_active: isActive, full_name: p.data.fullName || null }).eq("id", p.data.userId);
  if (error) return { error: friendly(error.message) };

  if (before.is_active !== isActive) {
    // Also block sign-in/refresh at the auth layer, not just in the app.
    await createAdminClient().auth.admin.updateUserById(p.data.userId, { ban_duration: isActive ? "none" : BAN_FOREVER });
  }
  const changes: Record<string, unknown> = {};
  if (before.role_id !== p.data.roleId) changes.role = { from: before.role_id, to: p.data.roleId };
  if (before.is_active !== isActive) changes.active = { from: before.is_active, to: isActive };
  await writeAudit({
    actorId: actor.id, action: before.role_id !== p.data.roleId ? "user.role_change" : "user.update",
    resourceType: "user", resourceId: p.data.userId, metadata: changes,
  });
  revalidatePath("/admin/users");
  return { success: "บันทึกแล้ว / Saved." };
}

export async function setUserDepartmentsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const userId = uuidSchema.safeParse(fd.get("userId"));
  const wanted = new Set(fd.getAll("departmentId").map(String).filter((v) => uuidSchema.safeParse(v).success));
  if (!userId.success) return { error: "Invalid user." };

  const supabase = await createClient();
  const { data: cur } = await supabase.from("user_departments").select("department_id").eq("user_id", userId.data);
  const have = new Set((cur ?? []).map((r) => r.department_id as string));
  const add = [...wanted].filter((d) => !have.has(d));
  const remove = [...have].filter((d) => !wanted.has(d));
  if (add.length) {
    const { error } = await supabase.from("user_departments").insert(add.map((department_id) => ({ user_id: userId.data, department_id })));
    if (error) return { error: "Could not save departments." };
  }
  if (remove.length) {
    const { error } = await supabase.from("user_departments").delete().eq("user_id", userId.data).in("department_id", remove);
    if (error) return { error: "Could not save departments." };
  }
  if (add.length || remove.length) {
    await writeAudit({ actorId: actor.id, action: "user.departments_change", resourceType: "user", resourceId: userId.data, metadata: { add, remove } });
  }
  revalidatePath("/admin/users");
  return { success: "บันทึกแล้ว / Saved." };
}

export async function resetUserPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const p = z.object({ userId: uuidSchema, password: z.string().min(12, "Password must be at least 12 characters").max(200) })
    .safeParse({ userId: fd.get("userId"), password: fd.get("password") });
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await createAdminClient().auth.admin.updateUserById(p.data.userId, { password: p.data.password, app_metadata: { must_change_password: true } });
  if (error) return { error: "Could not reset the password." };
  await writeAudit({ actorId: actor.id, action: "user.password_reset", resourceType: "user", resourceId: p.data.userId }); // never log the password
  return { success: "ตั้งรหัสผ่านใหม่แล้ว / Password updated." };
}

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), fullName: z.string().trim().max(200).optional(), roleId: uuidSchema });

/** Sends a Supabase invite email. Requires SMTP + the invite template described in the README. */
export async function inviteUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const p = inviteSchema.safeParse({ email: fd.get("email"), fullName: fd.get("fullName") ?? "", roleId: fd.get("roleId") });
  if (!p.success) return { error: p.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(p.data.email, {
    data: p.data.fullName ? { full_name: p.data.fullName } : undefined,
    redirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });
  if (error || !data.user) {
    return { error: /already|registered|exists/i.test(error?.message ?? "") ? "อีเมลนี้มีบัญชีอยู่แล้ว / This email already has an account." : "ส่งคำเชิญไม่สำเร็จ ตรวจสอบการตั้งค่า SMTP / Could not send the invite. Check the SMTP settings." };
  }
  // The invited person must choose a password before using the app.
  await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { must_change_password: true } });
  const { error: roleErr } = await admin.from("profiles").update({ role_id: p.data.roleId }).eq("id", data.user.id);
  await writeAudit({ actorId: actor.id, action: "user.invite", resourceType: "user", resourceId: data.user.id, metadata: { email: p.data.email, roleId: p.data.roleId } });
  revalidatePath("/admin/users");
  return roleErr
    ? { error: "ส่งคำเชิญแล้ว แต่ตั้งบทบาทไม่สำเร็จ โปรดแก้ในรายการ / Invite sent, but the role could not be set. Fix it in the list." }
    : { success: "ส่งคำเชิญทางอีเมลแล้ว / Invitation email sent." };
}
