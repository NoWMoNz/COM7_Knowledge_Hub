import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, RotateCcw, Workflow } from "lucide-react";
import { StatusBadge } from "@/components/documents/status-badge";
import { retryProcessingAction } from "@/app/(employee)/documents/actions";
import { runQueueAction } from "./actions";
import { formatDate } from "@/lib/utils/format";
import type { DocumentStatus } from "@/constants/documents";

export const metadata = { title: "Processing" };

const JOB_STATUSES = ["queued", "running", "failed", "succeeded"] as const;
const STUCK_MS = 10 * 60_000;
const isStuck = (lockedAt: string | null) => Boolean(lockedAt) && Date.now() - new Date(lockedAt!).getTime() > STUCK_MS;

type JobRow = {
  id: string; status: string; attempts: number; max_attempts: number; last_error: string | null; updated_at: string; locked_at: string | null;
  version: { id: string; version_number: number; status: DocumentStatus; error_code: string | null; original_filename: string; document_id: string; doc: { title: string } | { title: string }[] | null } | null;
};

export default async function ProcessingMonitorPage(props: PageProps<"/admin/documents">) {
  await requirePermission(PERMISSIONS.DOCUMENT_MANAGE);
  const sp = await props.searchParams;
  const filter = (Array.isArray(sp.status) ? sp.status[0] : sp.status) ?? "";
  const supabase = await createClient();

  let q = supabase.from("processing_jobs")
    .select("id, status, attempts, max_attempts, last_error, updated_at, locked_at, version:document_versions!processing_jobs_version_id_fkey(id, version_number, status, error_code, original_filename, document_id, doc:documents!document_versions_document_id_fkey(title))")
    .order("updated_at", { ascending: false }).limit(100);
  if ((JOB_STATUSES as readonly string[]).includes(filter)) q = q.eq("status", filter);

  const [{ data }, ...counts] = await Promise.all([
    q,
    ...JOB_STATUSES.map((s) => supabase.from("processing_jobs").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  const jobs = (data ?? []) as unknown as JobRow[];
  const done = counts[3].count ?? 0, failed = counts[2].count ?? 0;
  const successRate = done + failed ? Math.round((done / (done + failed)) * 100) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="การประมวลผลเอกสาร / Document processing"
        description="สถานะคิวงาน การลองใหม่ และข้อผิดพลาด / Queue status, retries and errors."
        actions={
          <form action={runQueueAction} className="flex items-center gap-3">
            {sp.started && <span role="status" className="text-xs text-brand-800">เริ่มประมวลผลคิวแล้ว / Queue run started</span>}
            <Button type="submit" variant="outline"><Play aria-hidden />รันคิวตอนนี้ / Run queue now</Button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {JOB_STATUSES.map((s, i) => (
          <Link key={s} href={filter === s ? "/admin/documents" : `/admin/documents?status=${s}`} aria-current={filter === s ? "true" : undefined}
            className={`card-hover rounded-lg border p-4 shadow-card ${filter === s ? "border-brand-600 bg-brand-50" : "border-border bg-card"}`}>
            <p className="text-xs capitalize text-slate-500">{s}</p><p className="text-2xl font-semibold tabular-nums">{counts[i].count ?? 0}</p>
          </Link>
        ))}
        <Card className="gap-0 p-4"><p className="text-xs text-slate-500">Success rate</p><p className="text-2xl font-semibold tabular-nums">{successRate === null ? "—" : `${successRate}%`}</p></Card>
      </div>

      {jobs.length === 0 ? (
        <EmptyState icon={Workflow} title="ไม่มีงานประมวลผล / No processing jobs" />
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50"><TableHead>เอกสาร / Document</TableHead><TableHead>งาน / Job</TableHead><TableHead>ครั้งที่ / Attempts</TableHead><TableHead>อัปเดต / Updated</TableHead><TableHead>ข้อผิดพลาด / Error</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => {
                const v = j.version;
                const title = v ? (Array.isArray(v.doc) ? v.doc[0]?.title : v.doc?.title) : null;
                const stuck = j.status === "running" && isStuck(j.locked_at);
                return (
                  <TableRow key={j.id} className="align-top">
                    <TableCell className="max-w-xs whitespace-normal">{v ? <Link href={`/documents/${v.document_id}`} className="font-medium text-brand-800 hover:underline">{title ?? v.original_filename}</Link> : "-"}{v && <p className="text-xs text-slate-500">v{v.version_number} · {v.original_filename}</p>}</TableCell>
                    <TableCell><span className="capitalize">{j.status}</span>{stuck && <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs text-amber-900">stuck</span>}{v && <div className="mt-1"><StatusBadge status={v.status} /></div>}</TableCell>
                    <TableCell className="tabular-nums">{j.attempts}/{j.max_attempts}</TableCell>
                    <TableCell className="text-xs text-slate-600">{formatDate(j.updated_at)}</TableCell>
                    <TableCell className="max-w-xs whitespace-normal text-xs text-red-700">{v?.error_code ? `${v.error_code}: ` : ""}{j.last_error ?? ""}</TableCell>
                    <TableCell>
                      {v?.status === "failed" && v.error_code !== "needs_ocr" && (
                        <form action={retryProcessingAction}>
                          <input type="hidden" name="versionId" value={v.id} /><input type="hidden" name="documentId" value={v.document_id} />
                          <Button type="submit" size="sm" variant="outline"><RotateCcw aria-hidden />Retry</Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
