"use client";

import { useActionState, useState } from "react";
import { FileText, FolderOpen, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteCategoryAction, saveCategoryAction } from "@/app/(employee)/categories/actions";
import type { FormState } from "@/lib/auth/actions";

type Category = { id: string; name: string; description: string | null; docCount: number };

function Msg({ s }: { s: FormState }) {
  if (s.error) return <p role="alert" className="text-sm text-red-700">{s.error}</p>;
  if (s.success) return <p role="status" className="text-sm text-brand-800">{s.success}</p>;
  return null;
}

const fieldLabel = "mb-1.5 block text-sm font-medium text-slate-700";
const textareaCls = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-500 focus-visible:border-brand-600 focus-visible:shadow-[0_0_0_4px_rgb(92_185_70/0.15)] focus-visible:outline-none";

function CategoryFields({ c, idPrefix }: { c?: Category; idPrefix: string }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div>
        <label htmlFor={`${idPrefix}-name`} className={fieldLabel}>ชื่อหมวดหมู่ / Name</label>
        <Input id={`${idPrefix}-name`} name="name" defaultValue={c?.name} required maxLength={120} placeholder="เช่น / e.g. HR & Human Resources" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-desc`} className={fieldLabel}>คำอธิบาย <span className="font-normal text-slate-400">(ไม่บังคับ / optional)</span></label>
        <textarea id={`${idPrefix}-desc`} name="description" defaultValue={c?.description ?? ""} maxLength={1000} rows={2} placeholder="หมวดนี้เก็บเอกสารเกี่ยวกับอะไร / What belongs here" className={textareaCls} />
      </div>
    </>
  );
}

function CategoryCard({ c }: { c: Category }) {
  const [editing, setEditing] = useState(false);
  // Same server action; the wrapper only closes the editor once the save succeeded.
  const [saveState, save, saving] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await saveCategoryAction(prev, fd);
    if (res.success) setEditing(false);
    return res;
  }, {});
  const [delState, del, deleting] = useActionState(deleteCategoryAction, {});
  const inUse = c.docCount > 0;

  if (editing) {
    return (
      <li className="rounded-2xl border border-brand-300 bg-card p-4 shadow-lift ring-4 ring-brand-500/10">
        <form action={save} className="space-y-3">
          <CategoryFields c={c} idPrefix={`cat-${c.id}`} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={saving}>{saving ? "กำลังบันทึก… / Saving…" : "บันทึก / Save"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>ยกเลิก / Cancel</Button>
            <Msg s={saveState} />
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="card-hover group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-800 text-white shadow-glow">
          <FolderOpen className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900" title={c.name}>{c.name}</h3>
          <p className={`mt-0.5 line-clamp-2 text-sm ${c.description ? "text-slate-600" : "italic text-slate-400"}`}>{c.description || "ไม่มีคำอธิบาย / No description"}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          <FileText className="size-3.5" aria-hidden />{c.docCount} เอกสาร
        </span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-slate-600">
            <Pencil aria-hidden />แก้ไข / Edit
          </Button>
          <form action={del}>
            <input type="hidden" name="id" value={c.id} />
            {/* The database still refuses deleting a category in use; this only explains it up front. */}
            <span title={inUse ? "ย้ายหรือลบเอกสารในหมวดนี้ก่อน / Move or delete its documents first" : undefined}>
              <ConfirmSubmit
                variant="ghost" size="icon-sm" disabled={deleting || inUse}
                label={<><Trash2 aria-hidden /><span className="sr-only">ลบ {c.name} / Delete</span></>}
                title="ลบหมวดหมู่นี้? / Delete this category?"
                description={<>หมวดหมู่ &quot;{c.name}&quot; จะถูกลบ / &quot;{c.name}&quot; will be deleted.</>}
                confirmLabel="ลบ / Delete"
              />
            </span>
          </form>
        </div>
      </div>
      {(delState.error || delState.success || saveState.success) && <Msg s={delState.error || delState.success ? delState : saveState} />}
    </li>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [state, create, pending] = useActionState(saveCategoryAction, {});
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <section aria-labelledby="new-cat-h" className="rounded-2xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-24">
        <h2 id="new-cat-h" className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><FolderPlus className="size-4" aria-hidden /></span>
          เพิ่มหมวดหมู่ / New category
        </h2>
        <form action={create} className="space-y-3" key={categories.length}>
          <CategoryFields idPrefix="new-cat" />
          <Button type="submit" disabled={pending} className="w-full">{pending ? "กำลังเพิ่ม… / Adding…" : "เพิ่มหมวดหมู่ / Add category"}</Button>
          <Msg s={state} />
        </form>
      </section>

      <section aria-label="หมวดหมู่ทั้งหมด / All categories">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-card/70 px-6 py-14 text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><FolderOpen className="size-6" aria-hidden /></span>
            <p className="font-medium text-slate-900">ยังไม่มีหมวดหมู่ / No categories yet</p>
            <p className="mt-1 text-sm text-slate-500">เพิ่มหมวดหมู่แรกจากฟอร์มด้านซ้าย / Add the first one with the form.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{categories.map((c) => <CategoryCard key={c.id} c={c} />)}</ul>
        )}
      </section>
    </div>
  );
}
