"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type FormState = { error?: string; success?: string };

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง / Enter a valid email and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // Generic message: do not reveal whether the email exists.
  if (error || !data.user) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง / Invalid email or password." };

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).single();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: "บัญชีนี้ไม่สามารถใช้งานได้ / This account is not active." };
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.string().trim().email().max(254).safeParse(formData.get("email"));
  if (!parsed.success) return { error: "กรุณากรอกอีเมลให้ถูกต้อง / Enter a valid email." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });
  // Always the same response to avoid account enumeration.
  return { success: "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว / If the email exists, a reset link has been sent." };
}

const resetSchema = z
  .object({ password: z.string().min(12).max(200), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: "รหัสผ่านต้องยาวอย่างน้อย 12 ตัวอักษรและต้องตรงกัน / Password must be 12+ characters and match." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error || !data.user) return { error: "ไม่สามารถเปลี่ยนรหัสผ่านได้ ลิงก์อาจหมดอายุ / Could not update password; the link may have expired." };
  if (data.user.app_metadata?.must_change_password) {
    // app_metadata can only be changed server-side, so users cannot clear this flag themselves.
    await createAdminClient().auth.admin.updateUserById(data.user.id, { app_metadata: { must_change_password: false } });
  }
  redirect("/dashboard");
}
