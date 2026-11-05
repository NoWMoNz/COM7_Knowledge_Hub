import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { ContentManager, type ContentKind, type ContentRow } from "@/components/content/content-manager";

export const metadata = { title: "Content" };

const TABS: [ContentKind, string][] = [["announcement", "ประกาศ / Announcements"], ["faq", "FAQ"], ["quick_link", "ลิงก์ลัด / Quick links"]];

export default async function ContentPage(props: PageProps<"/content">) {
  await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const kind = (TABS.some(([k]) => k === raw) ? raw : "announcement") as ContentKind;

  const supabase = await createClient();
  const { data } = await supabase.from("content_items").select("id, kind, title, body, url, sort_order, is_published")
    .eq("kind", kind).order("sort_order").order("created_at", { ascending: false }).limit(200);

  return (
    <div className="space-y-4">
      <PageHeader title="จัดการเนื้อหาหน้าแรก / Dashboard content" />
      <p className="text-sm text-slate-600">
        ระบบไม่มีเนื้อหาตัวอย่าง ทุกรายการมาจากผู้ที่ได้รับสิทธิ์เท่านั้น และจะแสดงเป็นข้อมูลทางการของบริษัท โปรดตรวจสอบก่อนเผยแพร่ /
        Nothing is pre-filled; whatever you publish appears as official company information.
      </p>
      <nav className="inline-flex flex-wrap rounded-md border border-slate-300 bg-card p-0.5 text-sm" aria-label="Content type">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/content?kind=${k}`} aria-current={k === kind ? "true" : undefined} className={`rounded px-3 py-1.5 transition-colors pointer-coarse:py-2.5 ${k === kind ? "bg-brand-700 font-medium text-white" : "text-slate-700 hover:bg-slate-100"}`}>{label}</Link>
        ))}
      </nav>
      <ContentManager key={kind} kind={kind} items={(data ?? []) as ContentRow[]} />
    </div>
  );
}
