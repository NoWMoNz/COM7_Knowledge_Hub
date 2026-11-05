import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { DepartmentManager } from "@/components/admin/department-manager";

export const metadata = { title: "Departments" };

export default async function AdminDepartmentsPage() {
  await requirePermission(PERMISSIONS.DEPARTMENT_MANAGE);
  const supabase = await createClient();
  const [{ data: depts }, { data: members }] = await Promise.all([
    supabase.from("departments").select("id, name, description").order("name"),
    supabase.from("user_departments").select("department_id"),
  ]);
  const counts = new Map<string, number>();
  (members ?? []).forEach((m) => counts.set(m.department_id, (counts.get(m.department_id) ?? 0) + 1));
  return (
    <div className="space-y-4">
      <PageHeader title="แผนก / Departments" />
      <p className="text-sm text-slate-600">ใช้กำหนดว่าเอกสารแบบ &quot;จำกัดสิทธิ์&quot; แผนกใดเปิดอ่านได้ / Departments control who can read restricted documents.</p>
      <DepartmentManager departments={(depts ?? []).map((d) => ({ ...d, members: counts.get(d.id) ?? 0 }))} />
    </div>
  );
}
