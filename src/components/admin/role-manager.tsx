"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { createRoleAction, deleteRoleAction, savePermissionsAction } from "@/app/admin/roles/actions";

type Role = { id: string; key: string; name: string; description: string | null; isSystem: boolean; permissions: string[]; userCount: number };
type Perm = { value: string; label: string };

function Msg({ s }: { s: { error?: string; success?: string } }) {
  if (s.error) return <p role="alert" className="text-sm text-red-700">{s.error}</p>;
  if (s.success) return <p role="status" className="text-sm text-emerald-700">{s.success}</p>;
  return null;
}

function RoleCard({ role, perms }: { role: Role; perms: Perm[] }) {
  const [save, saveAction, saving] = useActionState(savePermissionsAction, {});
  const [del, delAction, deleting] = useActionState(deleteRoleAction, {});
  return (
    <li className="space-y-3 rounded-lg border border-border bg-card shadow-card p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-medium text-slate-900">{role.name}</h2>
        <code className="text-xs text-slate-500">{role.key}</code>
        {role.isSystem && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">system</span>}
        <span className="ml-auto text-xs text-slate-500">{role.userCount} users</span>
      </div>
      <form action={saveAction} className="space-y-2">
        <input type="hidden" name="roleId" value={role.id} />
        <div className="grid gap-1 sm:grid-cols-2">
          {perms.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="permission" value={p.value} defaultChecked={role.permissions.includes(p.value)} />{p.label}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3"><Button type="submit" size="sm" disabled={saving}>บันทึกสิทธิ์ / Save</Button><Msg s={save} /></div>
      </form>
      {!role.isSystem && (
        <form action={delAction} className="flex items-center gap-3">
          <input type="hidden" name="roleId" value={role.id} />
          <ConfirmSubmit label="ลบบทบาท / Delete role" disabled={deleting} title="ลบบทบาทนี้? / Delete this role?" description={<>บทบาท &quot;{role.name}&quot; จะถูกลบ หากยังมีผู้ใช้อยู่ในบทบาทนี้ ระบบจะไม่อนุญาตให้ลบ / &quot;{role.name}&quot; will be deleted. A role that still has users cannot be deleted.</>} confirmLabel="ลบบทบาท / Delete role" /><Msg s={del} />
        </form>
      )}
    </li>
  );
}

export function RoleManager({ roles, perms }: { roles: Role[]; perms: Perm[] }) {
  const [state, action, pending] = useActionState(createRoleAction, {});
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card shadow-card p-4">
        <Input name="name" required maxLength={120} placeholder="ชื่อบทบาท / Role name" aria-label="Role name" className="w-56" />
        <Input name="key" required pattern="[a-z_]{2,40}" placeholder="key_like_this" aria-label="Role key" className="w-44" />
        <Input name="description" maxLength={500} placeholder="คำอธิบาย / Description" aria-label="Description" className="min-w-48 flex-1" />
        <Button type="submit" disabled={pending} className="bg-brand-700 hover:bg-brand-800">เพิ่มบทบาท / Add role</Button>
        <Msg s={state} />
      </form>
      <ul className="space-y-3">{roles.map((r) => <RoleCard key={r.id} role={r} perms={perms} />)}</ul>
    </div>
  );
}
