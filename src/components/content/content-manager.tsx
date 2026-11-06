"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, Link2, Loader2, Megaphone, MessageCircleQuestion, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { SortableList } from "@/components/ui/sortable-list";
import { deleteContentAction, reorderContentAction, saveContentAction } from "@/app/(employee)/content/actions";
import type { FormState } from "@/lib/auth/actions";

export type ContentKind = "announcement" | "faq" | "quick_link";
export type ContentRow = { id: string; kind: ContentKind; title: string; body: string | null; url: string | null; sort_order: number; is_published: boolean };

const KIND: Record<ContentKind, { icon: LucideIcon; noun: string; title: string; titlePh: string; body?: string; bodyPh?: string }> = {
  announcement: { icon: Megaphone, noun: "ประกาศ / announcement", title: "หัวข้อ / Title", titlePh: "เช่น ประกาศวันหยุดประจำปี", body: "รายละเอียด / Details", bodyPh: "ข้อความที่พนักงานจะเห็นบนหน้าแรก / What employees will read" },
  faq: { icon: MessageCircleQuestion, noun: "คำถาม / FAQ", title: "คำถาม / Question", titlePh: "เช่น ลาพักร้อนได้กี่วัน?", body: "คำตอบ / Answer", bodyPh: "ต้องเป็นข้อมูลที่ยืนยันแล้วเท่านั้น / Verified information only" },
  quick_link: { icon: Link2, noun: "ลิงก์ลัด / quick link", title: "ชื่อลิงก์ / Label", titlePh: "เช่น ระบบลางาน" },
};

function Msg({ s }: { s: FormState }) {
  if (s.error) return <p role="alert" className="text-sm text-red-700">{s.error}</p>;
  if (s.success) return <p role="status" className="text-sm text-brand-800">{s.success}</p>;
  return null;
}

const fieldLabel = "mb-1.5 block text-sm font-medium text-slate-700";
const textareaCls = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-500 focus-visible:border-brand-600 focus-visible:shadow-[0_0_0_4px_rgb(92_185_70/0.15)] focus-visible:outline-none";

/** Same field names as before (kind, id, title, body|url, sortOrder, isPublished), so the server action is unchanged. */
function Fields({ kind, item, idPrefix }: { kind: ContentKind; item?: ContentRow; idPrefix: string }) {
  const k = KIND[kind];
  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <div>
        <label htmlFor={`${idPrefix}-title`} className={fieldLabel}>{k.title}</label>
        <Input id={`${idPrefix}-title`} name="title" defaultValue={item?.title} required maxLength={200} placeholder={k.titlePh} />
      </div>
      {kind === "quick_link" ? (
        <div>
          <label htmlFor={`${idPrefix}-url`} className={fieldLabel}>ลิงก์ / URL</label>
          <Input id={`${idPrefix}-url`} name="url" defaultValue={item?.url ?? ""} required maxLength={2000} placeholder="https://… หรือ / or /documents" />
        </div>
      ) : (
        <div>
          <label htmlFor={`${idPrefix}-body`} className={fieldLabel}>{k.body}{kind === "announcement" && <span className="font-normal text-slate-400"> (ไม่บังคับ / optional)</span>}</label>
          <textarea id={`${idPrefix}-body`} name="body" defaultValue={item?.body ?? ""} required={kind === "faq"} maxLength={5000} rows={4} placeholder={k.bodyPh} className={textareaCls} />
        </div>
      )}
      {/* Order is set by dragging the cards. Editing keeps the current position; a new item starts at the top. */}
      <input type="hidden" name="sortOrder" value={item?.sort_order ?? 0} />
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-700">
          <input type="checkbox" name="isPublished" defaultChecked={item?.is_published ?? true} className="peer sr-only" />
          <span aria-hidden className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-card after:transition-transform peer-checked:bg-brand-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/25" />
          เผยแพร่ทันที / Publish
        </label>
      </div>
    </>
  );
}

function ItemCard({ item, handle, editing, setEditing }: { item: ContentRow; handle: React.ReactNode; editing: boolean; setEditing: (v: boolean) => void }) {
  // Same server action; the wrapper only closes the editor once the save succeeded.
  const [save, saveAction, saving] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await saveContentAction(prev, fd);
    if (res.success) setEditing(false);
    return res;
  }, {});
  const [del, delAction, deleting] = useActionState(deleteContentAction, {});
  const Icon = KIND[item.kind].icon;

  if (editing) {
    return (
      <div className="rounded-2xl border border-brand-300 bg-card p-5 shadow-lift ring-4 ring-brand-500/10">
        <form action={saveAction} className="space-y-3">
          <Fields kind={item.kind} item={item} idPrefix={`c-${item.id}`} />
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <Button type="submit" size="sm" disabled={saving}>{saving ? "กำลังบันทึก… / Saving…" : "บันทึก / Save"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>ยกเลิก / Cancel</Button>
            <Msg s={save} />
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`group rounded-2xl border bg-card p-4 shadow-card transition-shadow hover:shadow-lift sm:p-5 ${item.is_published ? "border-border" : "border-dashed border-amber-300 bg-amber-50/30"}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="-ml-1.5 mt-1 sm:-ml-2">{handle}</div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.is_published ? "bg-brand-50 text-brand-700" : "bg-amber-100 text-amber-800"}`}><Icon className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-semibold text-slate-900">{item.title}</h3>
            {item.is_published ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-brand-100"><Eye className="size-3" aria-hidden />เผยแพร่ / Published</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"><EyeOff className="size-3" aria-hidden />ฉบับร่าง ไม่แสดงให้พนักงาน / Draft</span>
            )}
          </div>
          {item.kind === "quick_link" ? (
            <p className="mt-1 truncate text-sm text-brand-700" title={item.url ?? ""}>{item.url}</p>
          ) : item.body ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-600">{item.body}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-slate-600">
            <Pencil aria-hidden /><span className="hidden sm:inline">แก้ไข / Edit</span><span className="sr-only sm:hidden">แก้ไข / Edit</span>
          </Button>
          <form action={delAction}>
            <input type="hidden" name="id" value={item.id} />
            <ConfirmSubmit
              variant="ghost" size="icon-sm" disabled={deleting}
              label={<><Trash2 aria-hidden /><span className="sr-only">ลบ / Delete</span></>}
              title="ลบรายการนี้? / Delete this item?"
              description={<>&quot;{item.title}&quot; จะถูกลบถาวรและไม่แสดงให้พนักงานอีก / &quot;{item.title}&quot; will be permanently removed.</>}
              confirmLabel="ลบ / Delete"
            />
          </form>
        </div>
      </div>
      {(del.error || save.success) && <div className="mt-2 pl-[5.25rem]"><Msg s={del.error ? del : save} /></div>}
    </div>
  );
}

type SaveStatus = { state: "idle" | "saving" | "saved" | "error"; message?: string };

export function ContentManager({ kind, items }: { kind: ContentKind; items: ContentRow[] }) {
  const [state, action, pending] = useActionState(saveContentAction, {});
  // Local order for instant feedback while dragging; resynced whenever the server sends a fresh list.
  const [list, setList] = useState(items);
  const [serverItems, setServerItems] = useState(items);
  if (items !== serverItems) { setServerItems(items); setList(items); }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ state: "idle" });
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function reorder(next: ContentRow[]) {
    setList(next);
    setStatus({ state: "saving" });
    // Debounced: several quick moves (e.g. arrow keys) are saved once, with the final order.
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const res = await reorderContentAction(kind, next.map((i) => i.id)).catch(() => ({ error: "Could not save the new order." }));
      if ("error" in res && res.error) { setList(items); setStatus({ state: "error", message: res.error }); }
      else setStatus({ state: "saved" });
    }, 600);
  }
  const k = KIND[kind];
  const Icon = k.icon;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section aria-labelledby="new-content-h" className="rounded-2xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-24">
        <h2 id="new-content-h" className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Plus className="size-4" aria-hidden /></span>
          เพิ่ม{k.noun.split(" / ")[0]} / New {k.noun.split(" / ")[1]}
        </h2>
        <form action={action} className="space-y-3" key={items.length}>
          <Fields kind={kind} idPrefix="new-content" />
          <Button type="submit" disabled={pending} className="w-full">{pending ? "กำลังเพิ่ม… / Adding…" : "เพิ่ม / Add"}</Button>
          <Msg s={state} />
        </form>
      </section>

      <section aria-label="รายการ / Items">
        {list.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-card/70 px-6 py-14 text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-6" aria-hidden /></span>
            <p className="font-medium text-slate-900">ยังไม่มีรายการ / Nothing here yet</p>
            <p className="mt-1 text-sm text-slate-500">เพิ่มรายการแรกจากฟอร์ม รายการที่เผยแพร่จะแสดงบนหน้าแรกทันที / Published items appear on the home page right away.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs">
              <p className="flex items-center gap-1.5 text-slate-500">
                <GripVertical className="size-3.5" aria-hidden />ลากการ์ดขึ้นหรือลงเพื่อจัดลำดับที่แสดงบนหน้าแรก / Drag cards to set the order on the home page
              </p>
              <span role="status" className={status.state === "error" ? "text-red-700" : "text-slate-500"}>
                {status.state === "saving" && <span className="inline-flex items-center gap-1"><Loader2 className="size-3.5 animate-spin" aria-hidden />กำลังบันทึกลำดับ… / Saving order…</span>}
                {status.state === "saved" && <span className="text-brand-800">บันทึกลำดับแล้ว / Order saved</span>}
                {status.state === "error" && status.message}
              </span>
            </div>
            <SortableList
              items={list}
              onReorder={reorder}
              isLocked={(i) => i.id === editingId}
              label="รายการ (ลากเพื่อจัดลำดับ) / Items (drag to reorder)"
              renderItem={(i, { handle }) => (
                <ItemCard item={i} handle={handle} editing={editingId === i.id} setEditing={(v) => setEditingId(v ? i.id : null)} />
              )}
            />
          </>
        )}
      </section>
    </div>
  );
}
