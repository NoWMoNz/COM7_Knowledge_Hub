"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteContentAction, saveContentAction } from "@/app/(employee)/content/actions";

export type ContentKind = "announcement" | "faq" | "quick_link";
export type ContentRow = { id: string; kind: ContentKind; title: string; body: string | null; url: string | null; sort_order: number; is_published: boolean };

function Msg({ s }: { s: { error?: string; success?: string } }) {
  if (s.error) return <p role="alert" className="text-sm text-red-700">{s.error}</p>;
  if (s.success) return <p role="status" className="text-sm text-emerald-700">{s.success}</p>;
  return null;
}

function Fields({ kind, item }: { kind: ContentKind; item?: ContentRow }) {
  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <Input name="title" defaultValue={item?.title} required maxLength={200} aria-label={kind === "faq" ? "Question" : "Title"} placeholder={kind === "faq" ? "คำถาม / Question" : "หัวข้อ / Title"} className="min-w-56 flex-1" />
      {kind === "quick_link" ? (
        <Input name="url" defaultValue={item?.url ?? ""} required maxLength={2000} aria-label="URL" placeholder="https://… หรือ /documents" className="min-w-56 flex-1" />
      ) : (
        <textarea name="body" defaultValue={item?.body ?? ""} required={kind === "faq"} maxLength={5000} rows={2} aria-label={kind === "faq" ? "Answer" : "Details"}
          placeholder={kind === "faq" ? "คำตอบ (ต้องเป็นข้อมูลที่ยืนยันแล้ว) / Answer" : "รายละเอียด / Details"} className="min-w-56 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
      )}
      <Input name="sortOrder" type="number" defaultValue={item?.sort_order ?? 0} aria-label="Sort order" className="w-20" title="ลำดับ / Sort order" />
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="isPublished" defaultChecked={item?.is_published ?? true} />เผยแพร่ / Published</label>
    </>
  );
}

function ItemRow({ item }: { item: ContentRow }) {
  const [save, saveAction, saving] = useActionState(saveContentAction, {});
  const [del, delAction, deleting] = useActionState(deleteContentAction, {});
  return (
    <li className="space-y-2 rounded-lg border border-border bg-card shadow-card p-3">
      <form action={saveAction} className="flex flex-wrap items-start gap-2">
        <Fields kind={item.kind} item={item} />
        <Button type="submit" size="sm" disabled={saving}>บันทึก / Save</Button>
      </form>
      <form action={delAction} className="flex items-center gap-3">
        <input type="hidden" name="id" value={item.id} />
        <ConfirmSubmit label="ลบ / Delete" disabled={deleting} title="ลบรายการนี้? / Delete this item?" description={<>&quot;{item.title}&quot; จะถูกลบถาวรและไม่แสดงให้พนักงานอีก / &quot;{item.title}&quot; will be permanently removed.</>} confirmLabel="ลบ / Delete" />
        {!item.is_published && <span className="text-xs text-amber-700">ฉบับร่าง ยังไม่แสดงให้พนักงาน / Draft, hidden from employees</span>}
        <Msg s={del} /><Msg s={save} />
      </form>
    </li>
  );
}

export function ContentManager({ kind, items }: { kind: ContentKind; items: ContentRow[] }) {
  const [state, action, pending] = useActionState(saveContentAction, {});
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-card shadow-card p-3" key={items.length}>
        <Fields kind={kind} />
        <Button type="submit" disabled={pending} className="bg-brand-700 hover:bg-brand-800">เพิ่ม / Add</Button>
        <Msg s={state} />
      </form>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-card p-8 text-center text-sm text-slate-500">ยังไม่มีรายการ / Nothing yet.</p>
      ) : (
        <ul className="space-y-2">{items.map((i) => <ItemRow key={i.id} item={i} />)}</ul>
      )}
    </div>
  );
}
