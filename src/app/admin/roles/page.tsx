import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS, PERMISSION_LABELS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { RoleManager } from "@/components/admin/role-manager";

export const metadata = { title: "Roles" };

export default async function AdminRolesPage() {
  await requirePermission(PERMISSIONS.ROLE_MANAGE);
  const supabase = await createClient();
  const [{ data: roles }, { data: rp }, { data: profiles }] = await Promise.all([
    supabase.from("roles").select("id, key, name, description, is_system").order("created_at"),
    supabase.from("role_permissions").select("role_id, permission"),
    supabase.from("profiles").select("role_id").limit(5000),
  ]);
  const permsOf = new Map<string, string[]>();
  (rp ?? []).forEach((r) => permsOf.set(r.role_id, [...(permsOf.get(r.role_id) ?? []), r.permission]));
  const counts = new Map<string, number>();
  (profiles ?? []).forEach((p) => counts.set(p.role_id, (counts.get(p.role_id) ?? 0) + 1));

  return (
    <div className="space-y-4">
      <PageHeader title="บทบาทและสิทธิ์ / Roles & permissions" />
      <p className="text-sm text-slate-600">สิทธิ์สำคัญของ Admin (เข้า Admin, จัดการผู้ใช้/บทบาท) ถอนไม่ได้เพื่อป้องกันล็อกตัวเอง / Critical admin permissions are protected against lock-out.</p>
      <RoleManager
        roles={(roles ?? []).map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, isSystem: r.is_system, permissions: permsOf.get(r.id) ?? [], userCount: counts.get(r.id) ?? 0 }))}
        perms={Object.values(PERMISSIONS).map((value) => ({ value, label: PERMISSION_LABELS[value] }))}
      />
    </div>
  );
}
