import Link from "next/link";
import {
  ArrowUpRight, CheckCircle2, ClipboardList, FileText, HelpCircle, Loader2, MessagesSquare, ShieldCheck, Sparkles,
  TriangleAlert, Users, type LucideIcon,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getAdminStats } from "@/services/admin/stats.service";
import { DailyColumns, Meter, RankedBars, Sparkline, fmt } from "@/components/admin/charts";
import { StatusBadge } from "@/components/documents/status-badge";
import { formatDate } from "@/lib/utils/format";
import type { DocumentStatus } from "@/constants/documents";

export const metadata = { title: "Admin Dashboard" };

function Panel({ title, sub, action, className = "", children }: { title: string; sub?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 shadow-card ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Tile({ icon: Icon, label, value, children }: { icon: LucideIcon; label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="card-hover flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon className="size-4" aria-hidden /></span>
        {label}
      </div>
      <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {children}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const user = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const can = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) => hasPermission(user.permissions, p);
  const s = await getAdminStats();

  const q14 = s.series.questions.reduce((a, b) => a + b, 0);
  // Every unanswered row is logged for one user question, so per day: answered = questions − unanswered.
  const answered = s.series.questions.map((q, i) => Math.max(0, q - (s.series.unanswered[i] ?? 0)));
  const answerRate = s.questions.total ? Math.round(((s.questions.total - s.questions.unanswered) / s.questions.total) * 100) : null;
  const rateTone = answerRate === null || answerRate >= 80 ? "good" : answerRate >= 50 ? "warn" : "bad";
  const readyShare = s.documents.total ? Math.round((s.documents.ready / s.documents.total) * 100) : 0;
  const uploads14 = s.series.uploads.reduce((a, b) => a + b, 0);

  const attention = [
    s.documents.failed > 0 && { icon: TriangleAlert, cls: "bg-red-50 text-red-700", text: `${fmt(s.documents.failed)} เอกสารประมวลผลล้มเหลว / failed processing`, href: can(PERMISSIONS.DOCUMENT_MANAGE) ? "/admin/documents" : null },
    s.documents.processing > 0 && { icon: Loader2, cls: "bg-slate-100 text-slate-600", text: `${fmt(s.documents.processing)} เอกสารกำลังประมวลผล / processing`, href: can(PERMISSIONS.DOCUMENT_MANAGE) ? "/admin/documents" : null },
    s.questions.openUnanswered > 0 && { icon: HelpCircle, cls: "bg-amber-50 text-amber-800", text: `${fmt(s.questions.openUnanswered)} คำถามที่ AI ตอบไม่ได้ รอตรวจ / unanswered, open`, href: can(PERMISSIONS.DOCUMENT_MANAGE) ? "/unanswered" : null },
  ].filter(Boolean) as { icon: LucideIcon; cls: string; text: string; href: string | null }[];

  const shortcuts = [
    can(PERMISSIONS.USER_READ) && { href: "/admin/users", label: "ผู้ใช้ / Users", icon: Users },
    can(PERMISSIONS.DOCUMENT_MANAGE) && { href: "/admin/documents", label: "การประมวลผล / Processing", icon: ClipboardList },
    can(PERMISSIONS.AUDIT_READ) && { href: "/admin/audit", label: "Audit logs", icon: ShieldCheck },
  ].filter(Boolean) as { href: string; label: string; icon: LucideIcon }[];

  return (
    <div className="space-y-6">
      {/* Console banner */}
      <section className="rise-in relative isolate overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-pop sm:p-8">
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 -z-10 size-80 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-300 ring-1 ring-white/10">
              <Sparkles className="size-3.5" aria-hidden />Admin Console
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">ภาพรวมระบบ / System overview</h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/65">ข้อมูลจริงจากฐานข้อมูล กราฟแสดง 14 วันล่าสุด (เวลาไทย) / Live database figures; charts cover the last 14 days (Bangkok time).</p>
          </div>
          {shortcuts.length > 0 && (
            <nav aria-label="ทางลัด / Shortcuts" className="flex flex-wrap gap-2">
              {shortcuts.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-3.5 text-sm font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/15">
                  <Icon className="size-4 text-brand-300" aria-hidden />{label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </section>

      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Users} label="ผู้ใช้ที่เปิดใช้งาน / Active users" value={fmt(s.users.active)}>
          <p className="text-xs text-slate-500">จากทั้งหมด {fmt(s.users.total)} บัญชี / of {fmt(s.users.total)} accounts</p>
        </Tile>
        <Tile icon={FileText} label="เอกสารพร้อมใช้ / Ready docs" value={fmt(s.documents.ready)}>
          <div className="space-y-1.5">
            <Meter percent={readyShare} tone="good" label={`พร้อมใช้ ${readyShare}% ของเอกสารทั้งหมด`} />
            <p className="text-xs text-slate-500">{readyShare}% ของ {fmt(s.documents.total)} เอกสาร / of {fmt(s.documents.total)} documents</p>
          </div>
        </Tile>
        <Tile icon={MessagesSquare} label="คำถามถึง AI · 14 วัน / AI questions" value={fmt(q14)}>
          <div className="flex items-end justify-between gap-3">
            <p className="text-xs text-slate-500">ทั้งหมด {fmt(s.questions.total)} / all time</p>
            <Sparkline values={s.series.questions} label={`แนวโน้มคำถาม 14 วัน: ${s.series.questions.join(", ")}`} />
          </div>
        </Tile>
        <Tile icon={CheckCircle2} label="AI ตอบได้ / Answer rate" value={answerRate === null ? "—" : `${answerRate}%`}>
          <div className="space-y-1.5">
            <Meter percent={answerRate ?? 0} tone={rateTone} label={`AI ตอบได้ ${answerRate ?? 0}%`} />
            <p className="text-xs text-slate-500">ตอบไม่ได้ {fmt(s.questions.unanswered)} จาก {fmt(s.questions.total)} คำถาม / unanswered</p>
          </div>
        </Tile>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="คำถามถึง AI รายวัน / AI questions per day" sub="แยกคำถามที่ AI ตอบได้และตอบไม่ได้ · ชี้ที่แท่งเพื่อดูตัวเลข / Answered vs unanswered · hover a column for numbers">
          <DailyColumns
            days={s.days}
            unit="คำถาม / questions"
            series={[
              { label: "ตอบได้ / Answered", values: answered, swatch: "bg-[#337f2c]" },
              { label: "ตอบไม่ได้ / Unanswered", values: s.series.unanswered, swatch: "bg-[#f59e0b]" },
            ]}
          />
        </Panel>

        <Panel title="ต้องดำเนินการ / Needs attention">
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-3 text-sm font-medium text-brand-800">
                <CheckCircle2 className="size-4" aria-hidden />ทุกอย่างปกติ / All clear
              </p>
            ) : (
              <ul className="space-y-2">
                {attention.map(({ icon: Icon, cls, text, href }) => {
                  const body = (
                    <>
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${cls}`}><Icon className="size-4" aria-hidden /></span>
                      <span className="flex-1 text-sm text-slate-800">{text}</span>
                      {href && <ArrowUpRight className="size-4 shrink-0 text-slate-400" aria-hidden />}
                    </>
                  );
                  return (
                    <li key={text}>
                      {href ? <Link href={href} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50">{body}</Link> : <div className="flex items-center gap-3 p-2">{body}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="อัปโหลดรายวัน / Uploads per day" sub={`${fmt(uploads14)} ไฟล์ใน 14 วัน / files in 14 days`}>
          <DailyColumns days={s.days} unit="ไฟล์ / files" labelEvery={4} series={[{ label: "อัปโหลด / Uploads", values: s.series.uploads, swatch: "bg-[#337f2c]" }]} />
        </Panel>
        <Panel title="หมวดที่ AI ใช้ตอบบ่อย / Categories used in answers" sub="จำนวนครั้งที่ถูกอ้างอิง · 30 วัน / Times cited · 30 days">
          <RankedBars items={s.topCategories.map((c) => ({ label: c.name, value: c.count }))} unit="ครั้ง" empty="ยังไม่มีข้อมูล / No data yet." />
        </Panel>
        <Panel title="ผู้ใช้ที่ถามบ่อย / Most active users" sub="จำนวนคำถาม · 30 วัน / Questions · 30 days">
          <RankedBars items={s.activeUsers30d.map((u) => ({ label: u.name, value: u.count }))} unit="คำถาม" empty="ยังไม่มีข้อมูล / No data yet." />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="คำถามที่ถูกถามซ้ำ / Repeated questions" sub="ถามตั้งแต่ 2 ครั้ง · 90 วัน / Asked 2+ times · 90 days">
          {s.frequentQuestions.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">ยังไม่มีคำถามที่ถูกถามซ้ำ / No repeated questions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {s.frequentQuestions.map((f) => (
                <li key={f.text} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <span className="line-clamp-2 text-slate-800" title={f.text}>{f.text}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">×{f.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

      <Panel className="lg:col-span-2" title="เอกสารล่าสุด / Recently uploaded" action={<Link href="/documents" className="text-xs font-medium text-brand-700 hover:underline">ดูทั้งหมด / View all</Link>}>
        {s.recentDocuments.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">ยังไม่มีเอกสาร / No documents yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {s.recentDocuments.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                {/* Ready documents open the file itself; the rest go to the management page to see why. */}
                {d.hasFile ? (
                  <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-sm font-medium text-slate-900 hover:text-brand-700 hover:underline">{d.title}</a>
                ) : (
                  <Link href={`/documents/${d.id}`} className="min-w-0 truncate text-sm font-medium text-slate-900 hover:text-brand-700 hover:underline">{d.title}</Link>
                )}
                <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">{formatDate(d.created_at)} · {d.by} {d.status !== "-" && <StatusBadge status={d.status as DocumentStatus} />}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      </div>
    </div>
  );
}
