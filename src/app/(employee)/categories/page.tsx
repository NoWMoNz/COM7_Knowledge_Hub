import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/categories/category-manager";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requirePermission(PERMISSIONS.CATEGORY_MANAGE);
  const supabase = await createClient();
  const [{ data: cats }, { data: docs }] = await Promise.all([
    supabase.from("categories").select("id, name, description").order("sort_order").order("name"),
    supabase.from("documents").select("category_id"),
  ]);
  const counts = new Map<string, number>();
  (docs ?? []).forEach((d) => d.category_id && counts.set(d.category_id, (counts.get(d.category_id) ?? 0) + 1));

  return (
    <div className="space-y-4">
      <PageHeader title="จัดการหมวดหมู่ / Manage categories" />
      <p className="text-sm text-slate-600">
        หมวดหมู่เริ่มต้นเป็นเพียงป้ายชื่อ ไม่ใช่นโยบายของบริษัท / The default categories are labels only, not company policy.
      </p>
      <CategoryManager categories={(cats ?? []).map((c) => ({ ...c, docCount: counts.get(c.id) ?? 0 }))} />
    </div>
  );
}
