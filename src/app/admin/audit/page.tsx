import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ScrollText, Search } from "lucide-react";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Audit logs" };

const PAGE_SIZE = 50;

export default async function AuditLogPage(props: PageProps<"/admin/audit">) {
  await requirePermission(PERMISSIONS.AUDIT_READ);
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const action = one(sp.action).replace(/[^a-z_.]/gi, "").slice(0, 60);
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  const supabase = await createClient(); // RLS: audit:read required
  let q = supabase.from("audit_logs").select("id, actor_id, action, resource_type, resource_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (action) q = q.ilike("action", `${action}%`);
  const { data, count } = await q;

  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean) as string[])];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, email, full_name").in("id", actorIds) : { data: [] };
  const nameOf = new Map((actors ?? []).map((a) => [a.id, a.full_name || a.email]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const link = (p: number) => `/admin/audit?${new URLSearchParams({ ...(action ? { action } : {}), page: String(p) })}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Audit logs" description="บันทึกการกระทำสำคัญของระบบ แก้ไขหรือลบไม่ได้ / Append-only record of security-relevant actions." />
      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3" role="search">
          <div className="min-w-56 flex-1 sm:max-w-sm">
            <label htmlFor="audit-action" className="mb-1.5 block text-sm font-medium">กรองตาม Action (เช่น document, user, role)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input id="audit-action" name="action" defaultValue={action} placeholder="document." className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm transition-colors hover:border-slate-500 focus-visible:border-ring" />
            </div>
          </div>
          <Button type="submit" size="lg">กรอง / Filter</Button>
          {action && <Link href="/admin/audit" className="inline-flex h-10 items-center text-sm font-medium text-brand-700 hover:underline">ล้าง / Clear</Link>}
        </form>
      </Card>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={ScrollText} title="ยังไม่มีบันทึก / No audit entries" />
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50"><TableHead>เวลา / Time</TableHead><TableHead>ผู้ทำ / Actor</TableHead><TableHead>Action</TableHead><TableHead>ทรัพยากร / Resource</TableHead><TableHead>รายละเอียด / Details</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((r) => (
                <TableRow key={r.id} className="align-top">
                  <TableCell className="text-xs text-slate-600">{formatDate(r.created_at)}</TableCell>
                  <TableCell>{r.actor_id ? nameOf.get(r.actor_id) ?? r.actor_id.slice(0, 8) : "system"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.action}</TableCell>
                  <TableCell className="text-xs">{r.resource_type}{r.resource_id ? ` · ${String(r.resource_id).slice(0, 8)}` : ""}</TableCell>
                  <TableCell className="max-w-md whitespace-normal break-words font-mono text-xs text-slate-600">{Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <nav className="flex flex-wrap items-center gap-3 text-sm" aria-label="Pagination">
        {page > 1 && <Link href={link(page - 1)} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"><ChevronLeft className="size-4" aria-hidden />Prev</Link>}
        <span className="text-slate-500">Page {page} / {pages} · {count ?? 0} entries</span>
        {page < pages && <Link href={link(page + 1)} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">Next<ChevronRight className="size-4" aria-hidden /></Link>}
      </nav>
    </div>
  );
}
