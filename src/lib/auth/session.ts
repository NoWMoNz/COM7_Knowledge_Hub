import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, type Permission } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  roleKey: string;
  permissions: string[];
  /** Set (server-side only, via app_metadata) for admin-created accounts until the user picks their own password. */
  mustChangePassword: boolean;
};

/** Verified user (token validated with Supabase Auth) plus role/permissions. Null if signed out or inactive. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_active, roles(key, role_permissions(permission))")
    .eq("id", auth.user.id)
    .single();
  if (!profile || !profile.is_active || !profile.roles) return null;

  const role = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles;
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    roleKey: role.key,
    permissions: (role.role_permissions ?? []).map((p: { permission: string }) => p.permission),
    mustChangePassword: auth.user.app_metadata?.must_change_password === true,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/reset-password");
  return user;
}

/** Server-side authorization guard. Redirects to /dashboard when permission is missing. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, permission)) redirect("/dashboard");
  return user;
}
