import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, CalendarDays, Clock3, ExternalLink, FolderOpen, Link2, Megaphone, MessageCircleQuestion,
  Plus, Search, Sparkles, Zap, type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_SELECT, type DocumentRow } from "@/types/documents";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FileTypeIcon } from "@/components/documents/file-type-icon";

export const metadata = { title: "Dashboard" };

const thDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
const showDate = (iso: string) => thDate.format(new Date(iso));
/** "New" = published within the last 7 days (evaluated at request time; this page is rendered per request). */
const isRecent = (iso: string) => Date.now() - new Date(iso).getTime() < 7 * 86_400_000;
const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

/** Section heading with an icon tile, optional subtitle and a right-aligned action. */
function Head({ id, icon: Icon, title, sub, aside, tone = "brand" }: { id: string; icon: LucideIcon; title: string; sub?: string; aside?: React.ReactNode; tone?: "brand" | "ink" }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone === "ink" ? "bg-ink text-brand-400" : "bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-glow"}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id={id} className="text-lg font-semibold leading-tight tracking-tight text-slate-900">{title}</h2>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}

const NewBadge = () => (
  <span className="inline-flex shrink-0 items-center rounded-full bg-brand-500 px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-ink">ใหม่ · New</span>
);

export default async function DashboardPage() {
  const supabase = await createClient();

  // RLS scopes every query to the signed-in user, so they run alongside the session check (one round trip instead of
  // two). Nothing renders unless requireUser() passes (it redirects otherwise).
  const [user, [{ data: categories }, { data: ready }, { data: recent }, { data: content }]] = await Promise.all([
    requireUser(),
    Promise.all([
      supabase.from("categories").select("id, name, description").order("sort_order").order("name"),
      supabase.from("documents").select("category_id").not("current_version_id", "is", null).limit(5000),
      supabase.from("documents").select(DOCUMENT_SELECT).not("current_version_id", "is", null).order("created_at", { ascending: false }).limit(5),
      supabase.from("content_items").select("id, kind, title, body, url, created_at").eq("is_published", true)
        .order("sort_order").order("created_at", { ascending: false }).limit(60),
    ]),
  ]);
  const items = (content ?? []) as { id: string; kind: string; title: string; body: string | null; url: string | null; created_at: string }[];
  const announcements = items.filter((i) => i.kind === "announcement").slice(0, 4); // 1 featured + up to 3
  const faqs = items.filter((i) => i.kind === "faq").slice(0, 8);
  const quickLinks = items.filter((i) => i.kind === "quick_link").slice(0, 10);
  const counts = new Map<string, number>();
  (ready ?? []).forEach((d) => d.category_id && counts.set(d.category_id, (counts.get(d.category_id) ?? 0) + 1));
  const recentDocs = (recent ?? []) as unknown as DocumentRow[];
  const [featured, ...moreAnnouncements] = announcements;
  // Only links managed on the Content page (each one can be edited or deleted there); nothing is hard-coded.
  const tiles: { key: string; href: string; title: string; sub: string; icon: LucideIcon; external: boolean }[] = quickLinks.map((l) => {
    const url = l.url ?? "#";
    const internal = url.startsWith("/");
    return { key: l.id, href: url, title: l.title, sub: internal ? "ในระบบ / In this hub" : hostOf(url), icon: internal ? Link2 : ExternalLink, external: !internal };
  });

  return (
    <div className="space-y-10">
      {/* Hero: the two primary jobs of the hub, finding documents and asking the AI. Stats are real counts. */}
      <section className="rise-in bg-brand-mesh relative isolate overflow-hidden rounded-3xl p-6 text-white shadow-pop sm:p-10">
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <svg className="pointer-events-none absolute -right-16 -top-20 -z-10 size-80 text-brand-400/20 sm:size-[26rem]" viewBox="0 0 100 100" aria-hidden>
          <rect x="18" y="18" width="64" height="64" rx="12" transform="rotate(45 50 50)" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <rect x="30" y="30" width="40" height="40" rx="8" transform="rotate(45 50 50)" fill="currentColor" opacity="0.5" />
        </svg>
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200 ring-1 ring-white/15 backdrop-blur">
                <Sparkles className="size-3.5" aria-hidden />COM7 Employee Knowledge Hub
              </span>
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2.5rem]">
                สวัสดี, <span className="text-gradient-brand">{user.fullName ?? user.email}</span>
              </h1>
              <p className="max-w-xl text-[0.9375rem] text-white/70">ค้นหาเอกสาร นโยบาย และคู่มือของบริษัท หรือถามผู้ช่วย AI ที่ตอบจากเอกสารทางการเท่านั้น / Find documents or ask the AI, grounded in official documents.</p>
            </div>
            <form action="/documents" role="search" className="flex flex-col gap-2 rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/15 backdrop-blur sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  name="q" aria-label="ค้นหาความรู้ / Search knowledge" placeholder="พิมพ์สิ่งที่ต้องการค้นหา… / What are you looking for?"
                  className="h-12 w-full rounded-xl border-0 bg-white pl-12 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-brand-400"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 rounded-xl px-6">ค้นหา / Search</Button>
            </form>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/chat" className="group inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-ink shadow-card transition-transform hover:-translate-y-px">
                <span className="flex size-6 items-center justify-center rounded-md bg-linear-to-br from-brand-500 to-brand-700 text-white"><Sparkles className="size-3.5" aria-hidden /></span>
                ถามผู้ช่วย AI / Ask the AI
                <ArrowUpRight className="size-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link href="/documents" className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium text-white/85 ring-1 ring-white/20 transition-colors hover:bg-white/10">ดูเอกสารทั้งหมด / Browse all</Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 lg:w-64 lg:grid-cols-1">
            <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur">
              <dt className="text-xs text-white/60">เอกสารพร้อมใช้งาน / Ready documents</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums">{(ready ?? []).length.toLocaleString()}</dd>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur">
              <dt className="text-xs text-white/60">หมวดหมู่ / Categories</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums">{(categories ?? []).length.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Company announcements: the most important thing after search, so they sit right under the hero. */}
      <section aria-labelledby="ann-h">
        <Head id="ann-h" icon={Megaphone} title="ประกาศบริษัท / Company announcements" sub="ข่าวสารและประกาศทางการจากบริษัท / Official news from the company" />
        {!featured ? (
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-card/70 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Megaphone className="size-5" aria-hidden /></span>
            <div>
              <p className="font-medium text-slate-900">ยังไม่มีประกาศ / No announcements right now</p>
              <p className="text-sm text-slate-500">เมื่อบริษัทมีประกาศใหม่ จะแสดงที่นี่เป็นอันดับแรก / New announcements will appear here first.</p>
            </div>
          </div>
        ) : (
          <div className={`grid items-start gap-4 ${moreAnnouncements.length ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""}`}>
            <article className="rise-in relative isolate overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-pop sm:p-8">
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 -z-10 size-72 rounded-full bg-brand-500/30 blur-3xl" />
              <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)]" />
              <Megaphone aria-hidden className="pointer-events-none absolute -bottom-6 -right-4 -z-10 size-40 -rotate-12 text-white/[0.06]" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-brand-300 ring-1 ring-white/15">
                  <Megaphone className="size-3.5" aria-hidden />ประกาศล่าสุด / Latest
                </span>
                {isRecent(featured.created_at) && <NewBadge />}
                <span className="inline-flex items-center gap-1 text-xs text-white/55"><CalendarDays className="size-3.5" aria-hidden />{showDate(featured.created_at)}</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{featured.title}</h3>
              {featured.body && (
                featured.body.length > 280 ? (
                  <details className="group/more mt-3">
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <p className="line-clamp-4 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-white/75 group-open/more:line-clamp-none">{featured.body}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-300 hover:text-brand-200">
                        <span className="group-open/more:hidden">อ่านต่อ / Read more</span><span className="hidden group-open/more:inline">ย่อ / Show less</span>
                        <ArrowRight className="size-4 transition-transform group-open/more:-rotate-90" aria-hidden />
                      </span>
                    </summary>
                  </details>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-white/75">{featured.body}</p>
                )
              )}
            </article>
            {moreAnnouncements.length > 0 && (
              <ul className="flex flex-col gap-3">
                {moreAnnouncements.map((n) => (
                  <li key={n.id}>
                    <details className="group/ann rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow open:shadow-lift hover:shadow-lift">
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700"><Megaphone className="size-3.5" aria-hidden /></span>
                          {showDate(n.created_at)}
                          {isRecent(n.created_at) && <NewBadge />}
                        </div>
                        <h3 className="mt-2 font-semibold leading-snug text-slate-900">{n.title}</h3>
                        {n.body && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600 group-open/ann:line-clamp-none">{n.body}</p>}
                        {n.body && n.body.length > 110 && (
                          <span className="mt-2 inline-flex text-xs font-semibold text-brand-700"><span className="group-open/ann:hidden">อ่านต่อ / Read more</span><span className="hidden group-open/ann:inline">ย่อ / Show less</span></span>
                        )}
                      </summary>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="cat-h">
        <Head id="cat-h" icon={FolderOpen} title="หมวดหมู่ความรู้ / Knowledge categories" sub="เลือกหมวดเพื่อดูเอกสารในหมวดนั้น / Pick a category to browse" aside={<Link href="/documents" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">ดูทั้งหมด / View all<ArrowRight className="size-4" aria-hidden /></Link>} />
        {(categories ?? []).length === 0 ? (
          <EmptyState icon={FolderOpen} title="ยังไม่มีหมวดหมู่ / No categories yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(categories ?? []).map((c) => {
              const n = counts.get(c.id) ?? 0;
              return (
                <Link key={c.id} href={`/documents?category=${c.id}`} className="card-hover group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/70 transition-colors group-hover:from-brand-500 group-hover:to-brand-700 group-hover:text-white"><FolderOpen className="size-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{c.name}</span>
                    <span className="block text-xs text-slate-500">{n > 0 ? `${n} เอกสาร / document${n > 1 ? "s" : ""}` : "ยังไม่มีความรู้ในหมวดนี้ / No knowledge available in this category."}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-slate-300 transition-colors group-hover:text-brand-700" aria-hidden />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Without quick links the recent documents take the full width. */}
      <div className={`grid gap-8 ${tiles.length ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" : ""}`}>
        <section aria-labelledby="recent-h" className="min-w-0">
          <Head id="recent-h" icon={Clock3} title="เอกสารล่าสุด / Recently uploaded" sub="คลิกเพื่อเปิดไฟล์ในแท็บใหม่ / Opens the file in a new tab" aside={<Link href="/documents" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">ดูทั้งหมด / View all<ArrowRight className="size-4" aria-hidden /></Link>} />
          {recentDocs.length === 0 ? (
            <EmptyState compact title="ยังไม่มีเอกสาร / No documents available" />
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {recentDocs.map((d, i) => (
                <li key={d.id} className={i > 0 ? "border-t border-slate-100" : undefined}>
                  <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer" aria-label={`${d.title} (เปิดในแท็บใหม่ / opens in a new tab)`}
                    className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-brand-50/40 sm:px-5">
                    <FileTypeIcon ext={d.current?.file_ext} className="size-11 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-slate-900 group-hover:text-brand-800">{d.title}</span>
                        {isRecent(d.created_at) && <NewBadge />}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        {d.category?.name && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{d.category.name}</span>}
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{showDate(d.created_at)}</span>
                        {d.current?.file_ext && <span className="font-semibold uppercase tracking-wide text-slate-400">{d.current.file_ext}</span>}
                      </span>
                    </span>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                      <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {tiles.length > 0 && <section aria-labelledby="links-h" className="min-w-0">
          <Head id="links-h" icon={Zap} tone="ink" title="ทางลัด / Quick links" sub="ระบบและหน้าที่ใช้บ่อย / Frequently used tools" />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {tiles.map((t) => {
              const Icon = t.icon;
              const body = (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-colors group-hover:bg-brand-600 group-hover:text-white group-hover:ring-transparent">
                    <Icon className="size-[1.125rem]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{t.title}</span>
                    <span className="block truncate text-xs text-slate-500">{t.sub}</span>
                  </span>
                </>
              );
              const cls = "card-hover group flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card";
              return (
                <li key={t.key}>
                  {t.external ? (
                    <a href={t.href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
                  ) : (
                    <Link href={t.href} className={cls}>{body}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>}
      </div>

      <section aria-labelledby="faq-h">
        <Head id="faq-h" icon={MessageCircleQuestion} title="คำถามที่พบบ่อย / Frequently asked questions" sub="คำตอบที่ทีมงานยืนยันแล้ว / Answers verified by the team" />
        {faqs.length === 0 ? (
          <EmptyState compact icon={MessageCircleQuestion} title="ยังไม่มีคำถามที่พบบ่อย / No frequently asked questions yet" />
        ) : (
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {faqs.map((f) => (
              <details key={f.id} className="group rounded-2xl border border-border bg-card shadow-card transition-[box-shadow,border-color] open:border-brand-200 open:shadow-lift">
                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden sm:p-5">
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 transition-colors group-open:bg-brand-600 group-open:text-white">Q</span>
                  <span className="flex-1 pt-0.5 font-medium text-slate-900">{f.title}</span>
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200 group-open:rotate-45 group-open:border-brand-200 group-open:text-brand-700"><Plus className="size-4" /></span>
                </summary>
                <div className="fade-in flex gap-3 px-4 pb-5 sm:px-5">
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-800">A</span>
                  <p className="flex-1 whitespace-pre-wrap pt-0.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </div>
              </details>
            ))}
          </div>
        )}
        <Link href="/chat" className="group mt-4 flex items-center gap-4 rounded-2xl border border-brand-200 bg-linear-to-r from-brand-50 to-white p-4 transition-shadow hover:shadow-lift sm:p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-brand-400"><Sparkles className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900">ไม่พบคำตอบที่ต้องการ? / Didn&apos;t find your answer?</span>
            <span className="block text-sm text-slate-600">ถามผู้ช่วย AI ระบบจะตอบจากเอกสารทางการพร้อมแหล่งอ้างอิง / Ask the AI, answered from official documents with sources.</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-brand-700 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
