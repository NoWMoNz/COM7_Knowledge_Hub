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
  // The user id comes from a locally verified JWT (no network with asymmetric signing keys), so the profile
  // query can run IN PARALLEL with the authoritative getUser() check instead of after it. Nothing is trusted
  // until getUser() confirms the same user, so revoked/deleted sessions are still rejected on every request.
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) return null;

  const [{ data: auth }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("id, email, full_name, is_active, roles(key, role_permissions(permission))")
      .eq("id", sub)
      .single(),
  ]);
  if (!auth.user || auth.user.id !== sub) return null;
  if (!profile || profile.id !== auth.user.id || !profile.is_active || !profile.roles) return null;

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
