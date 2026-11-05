import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCircle } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import { setUnansweredStatusAction } from "./actions";

export const metadata = { title: "Unanswered questions" };

const REASONS: Record<string, string> = {
  no_relevant_content: "ไม่พบเอกสารที่เกี่ยวข้อง / No relevant content",
  model_declined: "ข้อมูลไม่เพียงพอ / Not enough information",
  no_valid_citation: "ตอบโดยไม่มีแหล่งอ้างอิง / Answer had no valid citation",
  ai_unavailable: "ระบบ AI ไม่พร้อม / AI unavailable",
};
const PAGE_SIZE = 50;

export default async function UnansweredPage(props: PageProps<"/unanswered">) {
  await requirePermission(PERMISSIONS.DOCUMENT_MANAGE);
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const status = one(sp.status) === "resolved" ? "resolved" : one(sp.status) === "all" ? "all" : "open";
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  const supabase = await createClient();
  let q = supabase.from("unanswered_questions").select("id, question, language, reason, top_similarity, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== "all") q = q.eq("status", status);
  const { data, count } = await q;

  return (
    <div className="space-y-4">
      <PageHeader title="คำถามที่ AI ตอบไม่ได้ / Unanswered questions" description="ใช้เป็นแนวทางว่าควรอัปโหลดเอกสารใดเพิ่ม ไม่แสดงชื่อผู้ถาม / Use these to decide which documents to add. Askers are not shown." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex rounded-md border border-slate-300 bg-card p-0.5 text-sm" aria-label="Filter">
          {([["open", "ยังไม่แก้ / Open"], ["resolved", "แก้แล้ว / Resolved"], ["all", "ทั้งหมด / All"]] as const).map(([s, label]) => (
            <Link key={s} href={`/unanswered?status=${s}`} aria-current={status === s ? "true" : undefined}
              className={`rounded px-3 py-1.5 transition-colors pointer-coarse:py-2.5 ${status === s ? "bg-brand-700 font-medium text-white" : "text-slate-700 hover:bg-slate-100"}`}>{label}</Link>
          ))}
        </nav>
        <span className="text-sm text-slate-500">{count ?? 0} รายการ / items</span>
      </div>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={HelpCircle} title="ไม่มีคำถามในรายการนี้ / Nothing here" />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((u) => (
            <li key={u.id}>
              <Card className="flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-sm font-medium text-slate-900">{u.question}</p>
                  <p className="mt-1 text-xs text-slate-500">{REASONS[u.reason] ?? u.reason} · {u.language?.toUpperCase()} · {formatDate(u.created_at)}{u.top_similarity != null ? ` · best match ${(u.top_similarity * 100).toFixed(0)}%` : ""}</p>
                </div>
                <form action={setUnansweredStatusAction} className="shrink-0">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="status" value={u.status === "open" ? "resolved" : "open"} />
                  <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">{u.status === "open" ? "ทำเครื่องหมายว่าแก้แล้ว / Mark resolved" : "เปิดใหม่ / Reopen"}</Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex gap-4 text-sm" aria-label="Pagination">
        {page > 1 && <Link href={`/unanswered?status=${status}&page=${page - 1}`} className="font-medium text-brand-700 hover:underline">← Prev</Link>}
        {(count ?? 0) > page * PAGE_SIZE && <Link href={`/unanswered?status=${status}&page=${page + 1}`} className="font-medium text-brand-700 hover:underline">Next →</Link>}
      </nav>
    </div>
  );
}
