"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveAccessAction } from "@/app/(employee)/documents/access-actions";

type Opt = { id: string; label: string };
type Props = {
  documentId: string;
  level: "company" | "restricted";
  granted: string[]; // "type:id"
  departments: Opt[];
  roles: Opt[];
  users: Opt[];
};

function Group({ title, type, opts, granted }: { title: string; type: string; opts: Opt[]; granted: Set<string> }) {
  if (opts.length === 0) return null;
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-medium text-slate-600">{title}</legend>
      <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-y-auto">
        {opts.map((o) => (
          <label key={o.id} className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="grant" value={`${type}:${o.id}`} defaultChecked={granted.has(`${type}:${o.id}`)} />{o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DocumentAccessForm({ documentId, level, granted, departments, roles, users }: Props) {
  const [state, action, pending] = useActionState(saveAccessAction, {});
  const [lvl, setLvl] = useState(level);
  const g = new Set(granted);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-border bg-card shadow-card p-4">
      <input type="hidden" name="id" value={documentId} />
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="level" value="company" checked={lvl === "company"} onChange={() => setLvl("company")} />ทั้งบริษัท / Company-wide</label>
        <label className="flex items-center gap-2"><input type="radio" name="level" value="restricted" checked={lvl === "restricted"} onChange={() => setLvl("restricted")} />จำกัดสิทธิ์ / Restricted</label>
      </div>
      {lvl === "restricted" ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-600">ผู้จัดการเอกสารเห็นเสมอ นอกนั้นเห็นเฉพาะที่เลือกด้านล่าง ทั้งในการค้นหาและคำตอบของ AI / Managers always see it; everyone else only if selected below, including in AI answers.</p>
          <Group title="แผนก / Departments" type="department" opts={departments} granted={g} />
          <Group title="บทบาท / Roles" type="role" opts={roles} granted={g} />
          <Group title="ผู้ใช้รายบุคคล / Individual users" type="user" opts={users} granted={g} />
          {departments.length === 0 && <p className="text-xs text-amber-700">ยังไม่มีแผนก สร้างที่ Admin → Departments / No departments yet.</p>}
        </div>
      ) : (
        <p className="text-xs text-slate-600">พนักงานที่ใช้งานอยู่ทุกคนเห็นเอกสารนี้เมื่อสถานะ Ready / Every active employee can see this once Ready.</p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending} className="bg-brand-700 hover:bg-brand-800">บันทึกสิทธิ์ / Save access</Button>
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
      </div>
    </form>
  );
}
