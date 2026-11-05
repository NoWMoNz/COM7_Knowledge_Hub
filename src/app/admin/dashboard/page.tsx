import Link from "next/link";
import { CheckCircle2, FileText, HelpCircle, MessagesSquare, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { getAdminStats } from "@/services/admin/stats.service";
import { BarSeries } from "@/components/admin/bar-series";
import { StatusBadge } from "@/components/documents/status-badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils/format";
import type { DocumentStatus } from "@/constants/documents";

export const metadata = { title: "Admin Dashboard" };

const TONES = {
  neutral: "bg-slate-100 text-slate-700",
  good: "bg-brand-50 text-brand-800",
  warn: "bg-amber-50 text-amber-800",
  bad: "bg-red-50 text-red-700",
} as const;

function Stat({ label, value, sub, icon: Icon, tone = "neutral" }: { label: string; value: number; sub?: string; icon: LucideIcon; tone?: keyof typeof TONES }) {
  return (
    <Card className="flex-row items-start gap-3 p-4">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-md ${TONES[tone]}`}><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value.toLocaleString("en-US")}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </Card>
  );
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] | null }) {
  return (
    <Card className="gap-3 p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {children && children.length > 0 ? <ul className="divide-y divide-slate-100 text-sm">{children}</ul> : <p className="py-6 text-center text-xs text-slate-500">{empty}</p>}
    </Card>
  );
}

export default async function AdminDashboardPage() {
  await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const s = await getAdminStats();
  const rate = s.questions.total ? Math.round((s.questions.unanswered / s.questions.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" description="ภาพรวมระบบจากข้อมูลจริงในฐานข้อมูล / System overview from live database records." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat icon={Users} label="ผู้ใช้ทั้งหมด / Users" value={s.users.total} sub={`${s.users.active} active`} />
        <Stat icon={FileText} label="เอกสารทั้งหมด / Documents" value={s.documents.total} sub={`${s.documents.processing} processing`} />
        <Stat icon={CheckCircle2} tone="good" label="ประมวลผลสำเร็จ / Ready" value={s.documents.ready} />
        <Stat icon={TriangleAlert} tone={s.documents.failed > 0 ? "bad" : "neutral"} label="ล้มเหลว / Failed" value={s.documents.failed} />
        <Stat icon={MessagesSquare} label="คำถามถึง AI / AI questions" value={s.questions.total} />
        <Stat icon={HelpCircle} tone={s.questions.openUnanswered > 0 ? "warn" : "neutral"} label="ตอบไม่ได้ / Unanswered" value={s.questions.unanswered} sub={`${s.questions.openUnanswered} open · ${rate}%`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <BarSeries title="คำถามต่อวัน / Questions per day" days={s.days} values={s.series.questions} />
        <BarSeries title="ตอบไม่ได้ต่อวัน / Unanswered per day" days={s.days} values={s.series.unanswered} color="bg-amber-500" />
        <BarSeries title="อัปโหลดต่อวัน / Uploads per day" days={s.days} values={s.series.uploads} color="bg-brand-600" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="หมวดที่ถูกใช้ตอบบ่อยที่สุด (30 วัน) / Most used categories (30 days)" empty="ยังไม่มีข้อมูล / No data yet.">
          {s.topCategories.map((c) => <li key={c.name} className="flex justify-between py-2"><span>{c.name}</span><span className="tabular-nums text-slate-500">{c.count}</span></li>)}
        </Panel>
        <Panel title="คำถามที่พบบ่อย / Frequently asked questions" empty="ยังไม่มีคำถามที่ถูกถามซ้ำ / No repeated questions yet.">
          {s.frequentQuestions.map((f) => <li key={f.text} className="flex justify-between gap-3 py-2"><span className="truncate">{f.text}</span><span className="shrink-0 tabular-nums text-slate-500">×{f.n}</span></li>)}
        </Panel>
        <Panel title="ผู้ใช้ที่ใช้งานมากสุด (30 วัน) / Most active users (30 days)" empty="ยังไม่มีข้อมูล / No data yet.">
          {s.activeUsers30d.map((u) => <li key={u.name} className="flex justify-between py-2"><span className="truncate">{u.name}</span><span className="shrink-0 tabular-nums text-slate-500">{u.count} questions</span></li>)}
        </Panel>
        <Panel title="เอกสารล่าสุด / Recently uploaded" empty="ยังไม่มีเอกสาร / No documents yet.">
          {s.recentDocuments.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <Link href={`/documents/${d.id}`} className="min-w-0 truncate font-medium text-brand-800 hover:underline">{d.title}</Link>
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">{formatDate(d.created_at)} · {d.by} {d.status !== "-" && <StatusBadge status={d.status as DocumentStatus} />}</span>
            </li>
          ))}
        </Panel>
      </div>
    </div>
  );
}
