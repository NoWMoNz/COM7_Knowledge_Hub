import Link from "next/link";
import { Link2, Megaphone, MessageCircleQuestion, ShieldAlert, type LucideIcon } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { ContentManager, type ContentKind, type ContentRow } from "@/components/content/content-manager";

export const metadata = { title: "Content" };

const TABS: [ContentKind, string, LucideIcon][] = [
  ["announcement", "ประกาศ / Announcements", Megaphone],
  ["faq", "FAQ", MessageCircleQuestion],
  ["quick_link", "ลิงก์ลัด / Quick links", Link2],
];

export default async function ContentPage(props: PageProps<"/content">) {
  await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const kind = (TABS.some(([k]) => k === raw) ? raw : "announcement") as ContentKind;

  const supabase = await createClient();
  const [{ data }, { data: kinds }] = await Promise.all([
    supabase.from("content_items").select("id, kind, title, body, url, sort_order, is_published")
      .eq("kind", kind).order("sort_order").order("created_at", { ascending: false }).limit(200),
    supabase.from("content_items").select("kind").limit(1000), // tab counts
  ]);
  const count = (k: ContentKind) => (kinds ?? []).filter((r) => r.kind === k).length;

  return (
    <div>
      <PageHeader
        title="จัดการเนื้อหาหน้าแรก / Dashboard content"
        description="ประกาศ คำถามที่พบบ่อย และลิงก์ลัดที่พนักงานเห็นบนหน้าแรก / Announcements, FAQs and quick links shown on the employee home page."
      />
      <p className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        ระบบไม่มีเนื้อหาตัวอย่าง ทุกรายการที่เผยแพร่จะแสดงเป็นข้อมูลทางการของบริษัท โปรดตรวจสอบก่อนเผยแพร่ / Nothing is pre-filled; whatever you publish appears as official company information.
      </p>
      <nav aria-label="ประเภทเนื้อหา / Content type" className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1 shadow-card sm:inline-flex">
        {TABS.map(([k, label, Icon]) => {
          const active = k === kind;
          return (
            <Link key={k} href={`/content?kind=${k}`} aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors pointer-coarse:py-2.5 ${active ? "bg-ink text-white shadow-card" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
              <Icon className={`size-4 ${active ? "text-brand-400" : "text-slate-400"}`} aria-hidden />
              {label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>{count(k)}</span>
            </Link>
          );
        })}
      </nav>
      <ContentManager key={kind} kind={kind} items={(data ?? []) as ContentRow[]} />
    </div>
  );
}
