import Link from "next/link";
import { ExternalLink, FileSearch, FileText, FolderOpen, RefreshCw, Search, Settings2, Trash2, X } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_SELECT, type DocumentRow } from "@/types/documents";
import { DOCUMENT_STATUSES, STATUS_LABELS } from "@/constants/documents";
import { StatusBadge } from "@/components/documents/status-badge";
import { UploadPanel } from "@/components/documents/upload-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FileTypeIcon } from "@/components/documents/file-type-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoRefresh } from "@/components/documents/auto-refresh";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteDocumentAction, reindexAction } from "./actions";
import { formatBytes, formatDate } from "@/lib/utils/format";

export const metadata = { title: "Documents" };

// The file route re-checks access (RLS) and redirects to a short-lived signed URL.
const fileHref = (id: string) => `/api/documents/${id}/file`;

const SORTS = {
  newest: { label: "ใหม่สุด / Newest", col: "created_at", asc: false },
  oldest: { label: "เก่าสุด / Oldest", col: "created_at", asc: true },
  updated: { label: "แก้ไขล่าสุด / Recently updated", col: "updated_at", asc: false },
  title: { label: "ชื่อ / Title A-Z", col: "title", asc: true },
} as const;

// Strip characters that have meaning in PostgREST filter syntax or LIKE patterns.
const cleanSearch = (s: string) => s.replace(/[,()%*\\_"']/g, " ").trim().slice(0, 100);

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = cleanSearch(one(sp.q));
  const category = one(sp.category);
  const status = one(sp.status);
  const sortKey = (one(sp.sort) in SORTS ? one(sp.sort) : "newest") as keyof typeof SORTS;
  const isManager = hasPermission(user.permissions, PERMISSIONS.DOCUMENT_MANAGE);

  const supabase = await createClient();
  const categoriesQuery = supabase.from("categories").select("id, name").order("sort_order").order("name");

  let query = supabase.from("documents").select(DOCUMENT_SELECT).order(SORTS[sortKey].col, { ascending: SORTS[sortKey].asc }).limit(200);
  if (!isManager) query = query.not("current_version_id", "is", null);
  if (/^[0-9a-f-]{36}$/i.test(category)) query = query.eq("category_id", category);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  // Categories and documents are independent: fetch them together (one round trip instead of two).
  const [{ data: categories }, { data, error }] = await Promise.all([categoriesQuery, query]);

  let docs = (data ?? []) as unknown as DocumentRow[];
  if (isManager && (DOCUMENT_STATUSES as readonly string[]).includes(status)) {
    docs = docs.filter((d) => d.latest?.status === status);
  }
  const filtering = Boolean(q || category || status);
  // While any file is still being processed, the page re-fetches itself so the badge turns Ready/Failed without a manual refresh.
  const hasPending = isManager && docs.some((d) => d.latest?.status === "processing" || d.latest?.status === "uploading");

  // Chips keep the other active filters (header search, status, sort) so switching category never loses context.
  const href = (over: Record<string, string>) => {
    const params = new URLSearchParams();
    const next = { q, category, status, sort: sortKey === "newest" ? "" : sortKey, ...over };
    Object.entries(next).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return qs ? `/documents?${qs}` : "/documents";
  };

  return (
    <div className="space-y-6">
      <AutoRefresh active={hasPending} />
      <PageHeader
        title="เอกสารความรู้ / Knowledge Documents"
        description={isManager ? "อัปโหลด จัดการ และติดตามสถานะการประมวลผลของเอกสาร / Upload, manage and track document processing." : "ค้นหาและเปิดอ่านเอกสารที่คุณมีสิทธิ์เข้าถึง / Find and read the documents you have access to."}
      />

      {isManager && (
        <Card className="gap-4 p-5" aria-labelledby="upload-h">
          <SectionTitle id="upload-h">อัปโหลดเอกสาร / Upload documents</SectionTitle>
          <UploadPanel categories={categories ?? []} />
          <form action={reindexAction} className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <Button type="submit" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal py-1.5 text-left"><RefreshCw aria-hidden />สร้าง embedding ที่ขาด / Re-index missing embeddings</Button>
            {sp.reindexed !== undefined && <span role="status" className="text-brand-800">{Number(one(sp.reindexed)) > 0 ? `คิวงาน ${one(sp.reindexed)} เวอร์ชัน / queued ${one(sp.reindexed)} version(s)` : "ไม่มีรายการที่ต้องทำ / nothing to re-index"}</span>}
          </form>
        </Card>
      )}

      {/* Category chips are the only filter on this page. A search from the header bar (?q=) or the notification
          bell (?status=failed) still applies; it shows as a chip that can be removed. */}
      <div className="space-y-3">
        <nav aria-label="หมวดหมู่ / Categories" className="flex flex-wrap gap-2">
          {[{ id: "", name: "ทั้งหมด / All" }, ...(categories ?? [])].map((c) => {
            const active = category === c.id;
            return (
              <Link key={c.id || "all"} href={href({ category: c.id })} aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 pointer-coarse:min-h-11 ${active ? "border-transparent bg-ink text-white shadow-card" : "border-slate-200 bg-card text-slate-600 shadow-card hover:border-brand-300 hover:text-brand-800"}`}>
                {c.id ? <FolderOpen className={`size-4 ${active ? "text-brand-400" : "text-slate-400"}`} aria-hidden /> : null}
                {c.name}
              </Link>
            );
          })}
        </nav>
        {(q || (isManager && status)) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {q && (
              <Link href={href({ q: "" })} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100" aria-label={`ล้างคำค้น "${q}" / Clear search`}>
                <Search className="size-3.5" aria-hidden />&quot;{q}&quot;<X className="size-3.5" aria-hidden />
              </Link>
            )}
            {isManager && (DOCUMENT_STATUSES as readonly string[]).includes(status) && (
              <Link href={href({ status: "" })} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200" aria-label="ล้างตัวกรองสถานะ / Clear status filter">
                สถานะ / Status: {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}<X className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </div>

      {error ? (
        <EmptyState tone="error" icon={FileSearch} title="ไม่สามารถโหลดเอกสารได้ / Could not load documents">ลองรีเฟรชหน้านี้ หากยังพบปัญหา โปรดแจ้งผู้ดูแลระบบ / Please refresh, or contact an administrator if it persists.</EmptyState>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={filtering ? FileSearch : FileText}
          title={filtering ? "ไม่พบเอกสารที่ตรงกับเงื่อนไข / No documents match your filters" : isManager ? "ยังไม่มีเอกสารในระบบ / No documents yet" : "ยังไม่มีเอกสารในระบบ / No documents available yet"}
          action={filtering ? <Link href="/documents" className="text-sm font-medium text-brand-700 hover:underline">ล้างตัวกรอง / Clear filters</Link> : undefined}
        >
          {filtering ? "ลองใช้คำค้นอื่น หรือเลือกหมวดหมู่อื่น / Try different keywords or another category." : isManager ? "อัปโหลดเอกสารด้านบนเพื่อเริ่มต้น / Upload a document above to get started." : "เมื่อบริษัทเผยแพร่เอกสาร จะแสดงที่นี่ / Documents will appear here once published."}
        </EmptyState>
      ) : isManager ? (
        <Card className="gap-0 overflow-hidden p-0">
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500" aria-live="polite">พบ {docs.length} รายการ / {docs.length} result(s)</p>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>เอกสาร / Document</TableHead>
                <TableHead>หมวดหมู่ / Category</TableHead>
                <TableHead>ไฟล์ / File</TableHead>
                <TableHead className="hidden min-[90rem]:table-cell">อัปเดต / Updated</TableHead>
                <TableHead>สถานะ / Status</TableHead>
                <TableHead className="text-right"><span className="sr-only">การดำเนินการ / Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => {
                const shown = d.current ?? d.latest;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="min-w-52 max-w-xs whitespace-normal">
                      <div className="flex items-center gap-3">
                        <FileTypeIcon ext={shown?.file_ext} className="size-9" />
                        <div className="min-w-0">
                          {/* Clicking a ready document opens the file; settings/versions/access live behind "Manage". */}
                          {d.current_version_id ? (
                            <a href={fileHref(d.id)} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 hover:text-brand-700 hover:underline">{d.title}</a>
                          ) : (
                            <Link href={`/documents/${d.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">{d.title}</Link>
                          )}
                          {d.description && <p className="line-clamp-1 text-xs text-slate-500">{d.description}</p>}
                          <p className="text-xs text-slate-500 min-[90rem]:hidden">{formatDate(d.updated_at)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{d.category?.name ?? "-"}</TableCell>
                    <TableCell>
                      <span className="uppercase">{shown?.file_ext ?? "-"}</span>{shown ? <span className="ml-1 text-slate-500">{formatBytes(shown.file_size)}</span> : null}
                      <p className="text-xs text-slate-500">{d.current ? `v${d.current.version_number}` : "—"}{d.latest && d.latest.id !== d.current_version_id ? ` → v${d.latest.version_number}` : ""}</p>
                    </TableCell>
                    <TableCell className="hidden text-slate-600 min-[90rem]:table-cell">{formatDate(d.updated_at)}</TableCell>
                    <TableCell className="max-w-48 whitespace-normal">
                      {d.latest ? <StatusBadge status={d.latest.status} /> : "-"}
                      {d.latest?.status === "failed" && d.latest.error_message && (
                        <p className="mt-1 line-clamp-2 text-xs text-red-800" title={d.latest.error_message}>{d.latest.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                      <Link href={`/documents/${d.id}`} title="จัดการ / Manage (versions, access, details)" className={buttonVariants({ variant: "outline", size: "icon-sm" })}>
                        <Settings2 aria-hidden /><span className="sr-only">จัดการ {d.title} / Manage</span>
                      </Link>
                      <form action={deleteDocumentAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <ConfirmSubmit
                          label={<><Trash2 aria-hidden /><span className="whitespace-nowrap">ลบ</span></>}
                          title="ลบเอกสารนี้? / Delete this document?"
                          description={<>เอกสาร &quot;{d.title}&quot; และทุกเวอร์ชันจะถูกลบถาวร / &quot;{d.title}&quot; and all of its versions will be permanently deleted.</>}
                          confirmLabel="ลบถาวร / Delete permanently"
                          variant="outline"
                        />
                      </form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <section aria-label="เอกสาร / Documents" className="space-y-3">
          <p className="text-sm text-slate-500" aria-live="polite">พบ {docs.length} รายการ / {docs.length} result(s)</p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {docs.map((d) => {
              const shown = d.current ?? d.latest;
              return (
                <li key={d.id}>
                  {/* The whole company reads documents here: one click opens the file itself in a new tab. */}
                  <a href={fileHref(d.id)} target="_blank" rel="noopener noreferrer" aria-label={`${d.title} (เปิดในแท็บใหม่ / opens in a new tab)`} className="card-hover flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <FileTypeIcon ext={shown?.file_ext} />
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 font-semibold text-slate-900">{d.title}</h3>
                        {d.category && <p className="mt-0.5 text-xs font-medium text-brand-800">{d.category.name}</p>}
                      </div>
                      <ExternalLink className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
                    </div>
                    {d.description && <p className="line-clamp-2 text-sm text-slate-600">{d.description}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium uppercase text-slate-700">{shown?.file_ext}</span>
                      {shown && <span>{formatBytes(shown.file_size)}</span>}
                      {d.current && <span>v{d.current.version_number}</span>}
                      <span className="ml-auto">{formatDate(d.updated_at)}</span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
