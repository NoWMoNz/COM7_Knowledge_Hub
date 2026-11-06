import { Info } from "lucide-react";
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
  const uncategorized = (docs ?? []).filter((d) => !d.category_id).length;

  return (
    <div>
      <PageHeader
        title="จัดการหมวดหมู่ / Manage categories"
        description="จัดกลุ่มเอกสารให้พนักงานค้นหาได้ง่าย หมวดหมู่จะแสดงบนหน้าแรกและหน้าเอกสาร / Group documents so employees can find them; categories appear on the home and documents pages."
        actions={
          <div className="flex gap-2 text-sm">
            <span className="rounded-xl border border-border bg-card px-3.5 py-2 shadow-card"><span className="font-semibold text-slate-900">{(cats ?? []).length}</span> <span className="text-slate-500">หมวดหมู่ / categories</span></span>
            {uncategorized > 0 && <span className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-amber-900"><span className="font-semibold">{uncategorized}</span> ไม่มีหมวด / uncategorized</span>}
          </div>
        }
      />
      <p className="mb-6 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
        หมวดหมู่เริ่มต้นเป็นเพียงป้ายชื่อ ไม่ใช่นโยบายของบริษัท หมวดที่ยังมีเอกสารอยู่จะลบไม่ได้ / Default categories are labels only, not company policy. Categories that still hold documents cannot be deleted.
      </p>
      <CategoryManager categories={(cats ?? []).map((c) => ({ ...c, docCount: counts.get(c.id) ?? 0 }))} />
    </div>
  );
}
