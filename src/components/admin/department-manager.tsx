"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteDepartmentAction, saveDepartmentAction } from "@/app/admin/departments/actions";

type Dept = { id: string; name: string; description: string | null; members: number };

function Msg({ s }: { s: { error?: string; success?: string } }) {
  if (s.error) return <p role="alert" className="text-sm text-red-700">{s.error}</p>;
  if (s.success) return <p role="status" className="text-sm text-emerald-700">{s.success}</p>;
  return null;
}

function Row({ d }: { d: Dept }) {
  const [save, saveAction, saving] = useActionState(saveDepartmentAction, {});
  const [del, delAction, deleting] = useActionState(deleteDepartmentAction, {});
  return (
    <li className="space-y-2 rounded-lg border border-border bg-card shadow-card p-3">
      <form action={saveAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={d.id} />
        <Input name="name" defaultValue={d.name} required maxLength={120} aria-label="Department name" className="w-56" />
        <Input name="description" defaultValue={d.description ?? ""} maxLength={1000} aria-label="Description" placeholder="คำอธิบาย / Description" className="min-w-48 flex-1" />
        <span className="text-xs text-slate-500">{d.members} members</span>
        <Button type="submit" size="sm" disabled={saving}>บันทึก / Save</Button>
      </form>
      <form action={delAction} className="flex items-center gap-3">
        <input type="hidden" name="id" value={d.id} />
        <ConfirmSubmit label="ลบ / Delete" disabled={deleting} title="ลบแผนกนี้? / Delete this department?" description={<>แผนก &quot;{d.name}&quot; จะถูกลบ สมาชิกจะไม่อยู่ในแผนกนี้อีก และสิทธิ์เอกสารที่ให้แผนกนี้จะถูกถอน / &quot;{d.name}&quot; will be deleted; its memberships and document grants are removed.</>} confirmLabel="ลบแผนก / Delete department" />
        <Msg s={del} /><Msg s={save} />
      </form>
    </li>
  );
}

export function DepartmentManager({ departments }: { departments: Dept[] }) {
  const [state, action, pending] = useActionState(saveDepartmentAction, {});
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card shadow-card p-3">
        <Input name="name" required maxLength={120} placeholder="ชื่อแผนกใหม่ / New department" aria-label="New department name" className="w-64" />
        <Input name="description" maxLength={1000} placeholder="คำอธิบาย / Description" aria-label="Description" className="min-w-48 flex-1" />
        <Button type="submit" disabled={pending} className="bg-brand-700 hover:bg-brand-800">เพิ่ม / Add</Button>
        <Msg s={state} />
      </form>
      {departments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-card p-8 text-center text-sm text-slate-500">ยังไม่มีแผนก / No departments yet. ระบบไม่ได้สร้างแผนกตัวอย่างให้ / None are pre-created.</p>
      ) : (
        <ul className="space-y-2">{departments.map((d) => <Row key={d.id} d={d} />)}</ul>
      )}
    </div>
  );
}
