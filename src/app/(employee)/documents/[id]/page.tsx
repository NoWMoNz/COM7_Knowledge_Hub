import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_SELECT, type DocumentRow, type VersionRow } from "@/types/documents";
import { uuidSchema } from "@/lib/validation/documents";
import { StatusBadge } from "@/components/documents/status-badge";
import { FileTypeIcon } from "@/components/documents/file-type-icon";
import { UploadPanel } from "@/components/documents/upload-panel";
import { AutoRefresh } from "@/components/documents/auto-refresh";
import { DocumentEditForm } from "@/components/documents/document-edit-form";
import { DocumentAccessForm } from "@/components/documents/document-access-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteDocumentAction, retryProcessingAction } from "../actions";
import { formatBytes, formatDate } from "@/lib/utils/format";

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 text-sm last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="min-w-0 break-words text-slate-900">{children}</dd>
    </div>
  );
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-slate-200 bg-card px-2.5 py-0.5 text-xs font-medium text-slate-700">{children}</span>
);

export default async function DocumentDetailPage(props: PageProps<"/documents/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  // The document read is RLS-scoped, so it runs alongside the session check; nothing renders unless requireUser() passes.
  const [user, { data }] = await Promise.all([
    requireUser(),
    supabase.from("documents").select(DOCUMENT_SELECT).eq("id", id).maybeSingle(),
  ]);
  if (!data) notFound(); // also hides documents the user may not access
  const doc = data as unknown as DocumentRow;
  const isManager = hasPermission(user.permissions, PERMISSIONS.DOCUMENT_MANAGE);
  const canAccess = hasPermission(user.permissions, PERMISSIONS.ACCESS_MANAGE);
  const shown = doc.current ?? doc.latest;

  type AccessData = { granted: string[]; departments: { id: string; label: string }[]; roles: { id: string; label: string }[]; users: { id: string; label: string }[] };
  type RelatedRow = { id: string; title: string; current: { file_ext: string } | { file_ext: string }[] | null };
  // The three sections below are independent of each other: load them in one round trip instead of three.
  const [{ versions, categories }, access, related] = await Promise.all([
    (async (): Promise<{ versions: VersionRow[]; categories: { id: string; name: string }[] }> => {
      if (!isManager) return { versions: [], categories: [] };
      const [v, c] = await Promise.all([
        supabase.from("document_versions").select("id, document_id, version_number, original_filename, file_ext, file_size, status, error_code, error_message, created_at, processed_at, uploaded_by, uploaded_by_name").eq("document_id", id).order("version_number", { ascending: false }),
        supabase.from("categories").select("id, name").order("sort_order").order("name"),
      ]);
      return { versions: (v.data ?? []) as VersionRow[], categories: c.data ?? [] };
    })(),
    (async (): Promise<AccessData | null> => {
      if (!canAccess) return null;
      const [g, d, r, u] = await Promise.all([
        supabase.from("document_access").select("grantee_type, grantee_id").eq("document_id", id),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("roles").select("id, name").order("name"),
        supabase.from("profiles").select("id, email, full_name").eq("is_active", true).order("email").limit(500),
      ]);
      return {
        granted: (g.data ?? []).map((x) => `${x.grantee_type}:${x.grantee_id}`),
        departments: (d.data ?? []).map((x) => ({ id: x.id, label: x.name })),
        roles: (r.data ?? []).map((x) => ({ id: x.id, label: x.name })),
        users: (u.data ?? []).map((x) => ({ id: x.id, label: x.full_name || x.email })),
      };
    })(),
    // Related = other documents in the same category the user can already see (RLS applies); read-only.
    (async (): Promise<RelatedRow[]> => {
      if (!doc.category_id) return [];
      const { data: rel } = await supabase
        .from("documents")
        .select("id, title, current:document_versions!documents_current_version_fk(file_ext)")
        .eq("category_id", doc.category_id).neq("id", id).not("current_version_id", "is", null)
        .order("updated_at", { ascending: false }).limit(4);
      return (rel ?? []) as unknown as RelatedRow[];
    })(),
  ]);

  return (
    <div className="space-y-6">
      <AutoRefresh active={isManager && (doc.latest?.status === "processing" || doc.latest?.status === "uploading")} />
      <PageHeader
        title={doc.title}
        description={doc.description ?? undefined}
        actions={
          doc.current_version_id ? (
            <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "lg" })}>
              <ExternalLink aria-hidden />เปิดไฟล์ต้นฉบับ / Open original
            </a>
          ) : undefined
        }
      />
      <div className="-mt-3 flex flex-wrap gap-2">
        {doc.category && <Chip>{doc.category.name}</Chip>}
        {shown && <Chip>{shown.file_ext.toUpperCase()} · {formatBytes(shown.file_size)}</Chip>}
        {doc.current && <Chip>เวอร์ชัน / Version {doc.current.version_number}</Chip>}
        <Chip>อัปเดต / Updated {formatDate(doc.updated_at)}</Chip>
        {isManager && doc.latest && <StatusBadge status={doc.latest.status} />}
      </div>

      {sp.error === "delete" && <p role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="size-4" aria-hidden />ลบไม่สำเร็จ / Could not delete.</p>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card className="gap-0 px-5 py-2">
            <dl>
              <Row k="ชื่อไฟล์เดิม / Original filename"><span className="inline-flex items-center gap-2"><FileTypeIcon ext={shown?.file_ext} className="size-7" />{shown?.original_filename ?? "-"}</span></Row>
              <Row k="หมวดหมู่ / Category">{doc.category?.name ?? "-"}</Row>
              <Row k="คำอธิบาย / Description">{doc.description ?? "-"}</Row>
              <Row k="รูปแบบ / Format">{shown ? `${shown.file_ext.toUpperCase()} · ${formatBytes(shown.file_size)}` : "-"}</Row>
              <Row k="เวอร์ชันปัจจุบัน / Current version">{doc.current ? `v${doc.current.version_number}` : "ยังไม่พร้อมใช้งาน / not available yet"}</Row>
              <Row k="อัปโหลดโดย / Uploaded by">{shown?.uploaded_by_name ?? "-"}</Row>
              <Row k="อัปโหลดเมื่อ / Uploaded">{formatDate(doc.created_at)}</Row>
              <Row k="แก้ไขล่าสุด / Last updated">{formatDate(doc.updated_at)}</Row>
            </dl>
          </Card>

          {isManager && (
            <>
              {doc.latest?.status === "failed" && (
                <Card className="gap-3 border-red-200 bg-red-50 p-5" aria-labelledby="fail-h">
                  <h2 id="fail-h" className="flex items-center gap-2 font-semibold text-red-900"><AlertTriangle className="size-4" aria-hidden />การประมวลผลล้มเหลว (v{doc.latest.version_number}) / Processing failed</h2>
                  <p className="text-sm text-red-800">{doc.latest.error_message ?? "Unknown error"} {doc.latest.error_code ? `(${doc.latest.error_code})` : ""}</p>
                  {doc.current && <p className="text-sm text-slate-700">เวอร์ชันก่อนหน้า v{doc.current.version_number} ยังใช้งานได้ / Previous version v{doc.current.version_number} is still active.</p>}
                  {doc.latest.error_code !== "needs_ocr" && (
                    <form action={retryProcessingAction}>
                      <input type="hidden" name="versionId" value={doc.latest.id} />
                      <input type="hidden" name="documentId" value={doc.id} />
                      <Button type="submit" size="sm"><RotateCcw aria-hidden />ลองประมวลผลใหม่ / Retry</Button>
                    </form>
                  )}
                </Card>
              )}

              <Card className="gap-4 p-5" aria-labelledby="edit-h">
                <SectionTitle id="edit-h">แก้ไขข้อมูล / Edit metadata</SectionTitle>
                <div className="max-w-xl"><DocumentEditForm doc={doc} categories={categories} /></div>
              </Card>

              {access && (
                <Card className="gap-4 p-5" aria-labelledby="access-h">
                  <SectionTitle id="access-h">สิทธิ์การเข้าถึง / Access</SectionTitle>
                  <DocumentAccessForm documentId={doc.id} level={doc.access_level} {...access} />
                </Card>
              )}

              <Card className="gap-4 p-5" aria-labelledby="replace-h">
                <div>
                  <SectionTitle id="replace-h">แทนที่ด้วยเวอร์ชันใหม่ / Upload a new version</SectionTitle>
                  <p className="text-sm text-slate-500">เวอร์ชันเดิมจะยังใช้งานได้จนกว่าเวอร์ชันใหม่จะพร้อม / The current version stays active until the new one is Ready.</p>
                </div>
                <UploadPanel categories={[]} documentId={doc.id} />
              </Card>

              <Card className="gap-0 overflow-hidden p-0" aria-labelledby="ver-h">
                <div className="border-b border-slate-100 p-5 pb-3"><SectionTitle id="ver-h">ประวัติเวอร์ชัน / Version history</SectionTitle></div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead>เวอร์ชัน</TableHead><TableHead>ไฟล์ / File</TableHead><TableHead>อัปโหลด / Uploaded</TableHead><TableHead>สถานะ / Status</TableHead><TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">v{v.version_number}{v.id === doc.current_version_id ? <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800">current</span> : null}</TableCell>
                        <TableCell className="max-w-56 truncate text-slate-600" title={v.original_filename}>{v.original_filename} <span className="text-slate-400">· {formatBytes(v.file_size)}</span></TableCell>
                        <TableCell className="text-slate-600">{formatDate(v.created_at)} · {v.uploaded_by_name ?? "-"}</TableCell>
                        <TableCell><StatusBadge status={v.status} /></TableCell>
                        <TableCell className="text-right"><a href={`/api/documents/${doc.id}/file?version=${v.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 hover:underline">เปิด / Open</a></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Card className="gap-3 border-red-200 p-5" aria-labelledby="del-h">
                <h2 id="del-h" className="text-lg font-semibold text-red-900">ลบเอกสาร / Delete document</h2>
                <p className="text-sm text-slate-600">การลบจะนำเอกสารและทุกเวอร์ชันออกจากระบบ และ AI จะไม่ใช้เอกสารนี้อีก ไม่สามารถกู้คืนได้ / This removes the document and all versions permanently; the AI will no longer use it.</p>
                <form action={deleteDocumentAction}>
                  <input type="hidden" name="id" value={doc.id} />
                  <ConfirmSubmit
                    label="ลบเอกสารและทุกเวอร์ชัน / Delete document and all versions"
                    title="ลบเอกสารนี้? / Delete this document?"
                    description={<>เอกสาร &quot;{doc.title}&quot; และทุกเวอร์ชันจะถูกลบถาวร / &quot;{doc.title}&quot; and all of its versions will be permanently deleted.</>}
                    confirmLabel="ลบถาวร / Delete permanently"
                  />
                </form>
              </Card>
            </>
          )}
        </div>

        <aside className="space-y-4" aria-label="เอกสารที่เกี่ยวข้อง / Related documents">
          <Card className="gap-3 p-4">
            <h2 className="text-sm font-semibold text-slate-900">เอกสารที่เกี่ยวข้อง / Related documents</h2>
            {related.length === 0 ? (
              <p className="text-sm text-slate-500">{doc.category_id ? "ยังไม่มีเอกสารอื่นในหมวดหมู่นี้ / No other documents in this category yet." : "เอกสารนี้ยังไม่ได้ระบุหมวดหมู่ / This document has no category."}</p>
            ) : (
              <ul className="space-y-1">
                {related.map((r) => {
                  const c = Array.isArray(r.current) ? r.current[0] : r.current;
                  return (
                    <li key={r.id}>
                      <a href={`/api/documents/${r.id}/file`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-slate-50">
                        <FileTypeIcon ext={c?.file_ext} className="size-8" />
                        <span className="line-clamp-2 text-sm font-medium text-slate-800">{r.title}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {doc.category_id && <Link href={`/documents?category=${doc.category_id}`} className="text-sm font-medium text-brand-700 hover:underline">ดูทั้งหมวด / View whole category</Link>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
