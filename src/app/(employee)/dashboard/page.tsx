import Link from "next/link";
import { ArrowUpRight, FolderOpen, Link2, Megaphone, MessageCircleQuestion, Search, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_SELECT, type DocumentRow } from "@/types/documents";
import { formatDate } from "@/lib/utils/format";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle } from "@/components/ui/page-header";
import { FileTypeIcon } from "@/components/documents/file-type-icon";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: categories }, { data: ready }, { data: recent }, { data: content }] = await Promise.all([
    supabase.from("categories").select("id, name, description").order("sort_order").order("name"),
    supabase.from("documents").select("category_id").not("current_version_id", "is", null).limit(5000),
    supabase.from("documents").select(DOCUMENT_SELECT).not("current_version_id", "is", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("content_items").select("id, kind, title, body, url").eq("is_published", true)
      .order("sort_order").order("created_at", { ascending: false }).limit(60),
  ]);
  const items = (content ?? []) as { id: string; kind: string; title: string; body: string | null; url: string | null }[];
  const announcements = items.filter((i) => i.kind === "announcement").slice(0, 3);
  const faqs = items.filter((i) => i.kind === "faq").slice(0, 8);
  const quickLinks = items.filter((i) => i.kind === "quick_link").slice(0, 10);
  const counts = new Map<string, number>();
  (ready ?? []).forEach((d) => d.category_id && counts.set(d.category_id, (counts.get(d.category_id) ?? 0) + 1));
  const recentDocs = (recent ?? []) as unknown as DocumentRow[];
  const linkCls = "group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 hover:text-brand-800 pointer-coarse:min-h-11";

  return (
    <div className="space-y-8">
      {/* Hero: the two primary jobs of the hub, finding documents and asking the AI */}
      <section className="relative overflow-hidden rounded-lg border border-brand-200 bg-brand-50 p-5 sm:p-8">
        <svg className="pointer-events-none absolute -right-10 -top-10 size-56 text-brand-500/15" viewBox="0 0 100 100" aria-hidden>
          <rect x="18" y="18" width="64" height="64" rx="10" transform="rotate(45 50 50)" fill="currentColor" />
        </svg>
        <div className="relative max-w-2xl space-y-4">
          <div>
            <p className="text-sm font-medium text-brand-800">ศูนย์ความรู้พนักงาน / Employee Knowledge Hub</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">สวัสดี / Welcome, {user.fullName ?? user.email}</h1>
          </div>
          <form action="/documents" role="search" className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                name="q" aria-label="ค้นหาความรู้ / Search knowledge" placeholder="ค้นหาเอกสาร / Search"
                className="h-12 w-full rounded-md border border-input bg-card pl-11 pr-3 text-base shadow-card transition-colors hover:border-slate-500 focus-visible:border-ring"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-6">ค้นหา / Search</Button>
          </form>
          <Link href="/chat" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
            <Sparkles className="text-brand-700" aria-hidden />ถามผู้ช่วย AI / Ask the AI assistant
          </Link>
        </div>
      </section>

      <section aria-labelledby="cat-h">
        <SectionTitle id="cat-h" aside={<Link href="/documents" className="text-sm font-medium text-brand-700 hover:underline">ดูเอกสารทั้งหมด / View all</Link>}>หมวดหมู่ความรู้ / Knowledge categories</SectionTitle>
        {(categories ?? []).length === 0 ? (
          <EmptyState icon={FolderOpen} title="ยังไม่มีหมวดหมู่ / No categories yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(categories ?? []).map((c) => {
              const n = counts.get(c.id) ?? 0;
              return (
                <Link key={c.id} href={`/documents?category=${c.id}`} className="card-hover flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700"><FolderOpen className="size-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{c.name}</span>
                    <span className="block text-xs text-slate-500">{n > 0 ? `${n} เอกสาร / document${n > 1 ? "s" : ""}` : "ยังไม่มีความรู้ในหมวดนี้ / No knowledge available in this category."}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="recent-h">
          <SectionTitle id="recent-h">เอกสารล่าสุด / Recently uploaded</SectionTitle>
          {recentDocs.length === 0 ? (
            <EmptyState compact title="ยังไม่มีเอกสาร / No documents available" />
          ) : (
            <Card className="gap-0 p-1.5">
              <ul>
                {recentDocs.map((d) => (
                  <li key={d.id}>
                    <Link href={`/documents/${d.id}`} className="flex items-center gap-3 rounded-md p-2.5 transition-colors hover:bg-slate-50">
                      <FileTypeIcon ext={d.current?.file_ext} className="size-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{d.title}</span>
                        <span className="block truncate text-xs text-slate-500">{d.category?.name ?? "-"} · {formatDate(d.created_at)}</span>
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section aria-labelledby="ann-h">
          <SectionTitle id="ann-h">ประกาศบริษัท / Announcements</SectionTitle>
          {announcements.length === 0 ? (
            <EmptyState compact icon={Megaphone} title="ยังไม่มีประกาศ / No recent announcements" />
          ) : (
            <ul className="space-y-3">
              {announcements.map((n) => (
                <li key={n.id}>
                  <Card className="gap-1 border-l-4 border-l-brand-500 p-4">
                    <p className="font-semibold text-slate-900">{n.title}</p>
                    {n.body && <p className="whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="faq-h">
          <SectionTitle id="faq-h">คำถามที่พบบ่อย / FAQ</SectionTitle>
          {faqs.length === 0 ? (
            <EmptyState compact icon={MessageCircleQuestion} title="ยังไม่มีคำถามที่พบบ่อย / No frequently asked questions yet" />
          ) : (
            <Card className="gap-0 divide-y divide-slate-100 p-0">
              {faqs.map((f) => (
                <details key={f.id} className="group p-4 text-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                    {f.title}
                    <span aria-hidden className="text-slate-400 transition-transform duration-150 group-open:rotate-45">+</span>
                  </summary>
                  <p className="fade-in mt-2 whitespace-pre-wrap text-slate-600">{f.body}</p>
                </details>
              ))}
            </Card>
          )}
        </section>

        <section aria-labelledby="links-h">
          <SectionTitle id="links-h">ทางลัด / Quick links</SectionTitle>
          <Card className="gap-0 p-1.5">
            <ul>
              <li><Link href="/documents" className={linkCls}>เอกสารทั้งหมด / All documents<ArrowUpRight className="size-4 text-slate-400" aria-hidden /></Link></li>
              <li><Link href="/chat" className={linkCls}>ผู้ช่วย AI / AI assistant<ArrowUpRight className="size-4 text-slate-400" aria-hidden /></Link></li>
              {quickLinks.map((l) => (
                <li key={l.id}>
                  {l.url?.startsWith("/") ? (
                    <Link href={l.url} className={linkCls}>{l.title}<Link2 className="size-4 text-slate-400" aria-hidden /></Link>
                  ) : (
                    <a href={l.url ?? "#"} target="_blank" rel="noopener noreferrer" className={linkCls}>{l.title}<ArrowUpRight className="size-4 text-slate-400" aria-hidden /></a>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
}
