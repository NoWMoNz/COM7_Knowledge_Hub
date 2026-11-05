"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteCategoryAction, saveCategoryAction } from "@/app/(employee)/categories/actions";

type Category = { id: string; name: string; description: string | null; docCount: number };

function Msg({ error, success }: { error?: string; success?: string }) {
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (success) return <p role="status" className="text-sm text-emerald-700">{success}</p>;
  return null;
}

function CategoryRow({ c }: { c: Category }) {
  const [saveState, save, saving] = useActionState(saveCategoryAction, {});
  const [delState, del, deleting] = useActionState(deleteCategoryAction, {});
  return (
    <li className="space-y-2 rounded-lg border border-border bg-card shadow-card p-3">
      <form action={save} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={c.id} />
        <Input name="name" defaultValue={c.name} required maxLength={120} aria-label="Category name" className="w-56" />
        <Input name="description" defaultValue={c.description ?? ""} maxLength={1000} aria-label="Description" placeholder="คำอธิบาย / Description" className="min-w-48 flex-1" />
        <span className="text-xs text-slate-500">{c.docCount} docs</span>
        <Button type="submit" size="sm" disabled={saving}>บันทึก / Save</Button>
      </form>
      <form action={del} className="flex items-center gap-3">
        <input type="hidden" name="id" value={c.id} />
        <ConfirmSubmit label="ลบ / Delete" disabled={deleting} title="ลบหมวดหมู่นี้? / Delete this category?" description={<>หมวดหมู่ &quot;{c.name}&quot; จะถูกลบ หากยังมีเอกสารใช้อยู่ ระบบจะไม่อนุญาตให้ลบ / &quot;{c.name}&quot; will be deleted. Categories still used by documents cannot be deleted.</>} confirmLabel="ลบ / Delete" />
        <Msg error={delState.error} success={delState.success} />
        <Msg error={saveState.error} success={saveState.success} />
      </form>
    </li>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [state, create, pending] = useActionState(saveCategoryAction, {});
  return (
    <div className="space-y-4">
      <form action={create} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card shadow-card p-3">
        <Input name="name" required maxLength={120} placeholder="ชื่อหมวดหมู่ใหม่ / New category name" aria-label="New category name" className="w-64" />
        <Input name="description" maxLength={1000} placeholder="คำอธิบาย / Description" aria-label="Description" className="min-w-48 flex-1" />
        <Button type="submit" disabled={pending} className="bg-brand-700 hover:bg-brand-800">เพิ่ม / Add</Button>
        <Msg error={state.error} success={state.success} />
      </form>
      {categories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-card p-8 text-center text-sm text-slate-500">ยังไม่มีหมวดหมู่ / No categories yet.</p>
      ) : (
        <ul className="space-y-2">{categories.map((c) => <CategoryRow key={c.id} c={c} />)}</ul>
      )}
    </div>
  );
}
