import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateUserForm, InviteUserForm, UserList, type UserRowData } from "@/components/admin/user-manager";

export const metadata = { title: "Users" };

const daysAgoIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export default async function AdminUsersPage() {
  const me = await requirePermission(PERMISSIONS.USER_READ);
  const canManage = hasPermission(me.permissions, PERMISSIONS.USER_MANAGE);
  const supabase = await createClient();
  const admin = createAdminClient();
  const since30 = daysAgoIso(30);

  const [{ data: profiles }, { data: roles }, { data: depts }, { data: memberships }, authUsers, qs] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role_id, is_active").order("email").limit(1000),
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("user_departments").select("user_id, department_id"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("chat_messages").select("chat_sessions!inner(user_id)").eq("role", "user").gte("created_at", since30).limit(5000),
  ]);

  const lastSignIn = new Map((authUsers.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
  const deptOf = new Map<string, string[]>();
  (memberships ?? []).forEach((m) => deptOf.set(m.user_id, [...(deptOf.get(m.user_id) ?? []), m.department_id]));
  const qCount = new Map<string, number>();
  (qs.data ?? []).forEach((r) => {
    const s = r.chat_sessions as unknown as { user_id: string } | { user_id: string }[];
    const uid = Array.isArray(s) ? s[0]?.user_id : s?.user_id;
    if (uid) qCount.set(uid, (qCount.get(uid) ?? 0) + 1);
  });

  const users: UserRowData[] = (profiles ?? []).map((p) => ({
    id: p.id, email: p.email, fullName: p.full_name, roleId: p.role_id, isActive: p.is_active,
    departmentIds: deptOf.get(p.id) ?? [], lastSignIn: lastSignIn.get(p.id) ?? null, questions30d: qCount.get(p.id) ?? 0, isSelf: p.id === me.id,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title={`ผู้ใช้ / Users (${users.length})`} />
      {canManage ? (
        <>
          <h2 className="pt-2 text-base font-semibold text-slate-900">สร้างบัญชีพร้อมรหัสผ่านเริ่มต้น / Create with initial password</h2>
          <CreateUserForm roles={roles ?? []} />
          <h2 className="pt-2 text-base font-semibold text-slate-900">หรือเชิญทางอีเมล (ต้องตั้งค่า SMTP) / Or invite by email (requires SMTP)</h2>
          <InviteUserForm roles={roles ?? []} />
          <p className="text-xs text-slate-500">สมัครเองไม่ได้ ผู้ดูแลต้องสร้างบัญชีเท่านั้น ผู้ใช้จะถูกบังคับตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งแรก / Public sign-up is disabled; users must choose a new password on first sign-in.</p>
          <UserList users={users} roles={roles ?? []} depts={depts ?? []} />
        </>
      ) : (
        <p className="text-sm text-slate-600">คุณดูรายชื่อได้เท่านั้น / Read-only.</p>
      )}
    </div>
  );
}
