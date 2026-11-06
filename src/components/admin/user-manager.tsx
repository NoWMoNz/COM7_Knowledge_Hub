"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUserAction, inviteUserAction, resetUserPasswordAction, setUserDepartmentsAction, updateUserAction } from "@/app/admin/users/actions";

type Role = { id: string; name: string };
type Dept = { id: string; name: string };
export type UserRowData = {
  id: string; email: string; fullName: string | null; roleId: string; isActive: boolean;
  departmentIds: string[]; lastSignIn: string | null; questions30d: number; isSelf: boolean;
};

function Msg({ s }: { s: { error?: string; success?: string } }) {
  if (s.error) return <p role="alert" className="text-sm text-red-700">{s.error}</p>;
  if (s.success) return <p role="status" className="text-sm text-emerald-700">{s.success}</p>;
  return null;
}

export function CreateUserForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState(createUserAction, {});
  return (
    <form action={action} className="grid gap-2 rounded-2xl border border-border bg-card shadow-card p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Input name="email" type="email" required placeholder="email" aria-label="Email" autoComplete="off" />
      <Input name="fullName" placeholder="ชื่อ / Full name" aria-label="Full name" maxLength={200} />
      <select name="roleId" required aria-label="Role" className="rounded-md border border-slate-300 bg-white px-2 text-sm">
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <Input name="password" type="password" required minLength={12} placeholder="รหัสผ่านเริ่มต้น (12+)" aria-label="Initial password" autoComplete="new-password" />
      <Button type="submit" disabled={pending} className="bg-brand-700 hover:bg-brand-800">สร้างบัญชี / Create</Button>
      <div className="sm:col-span-2 lg:col-span-5"><Msg s={state} /></div>
    </form>
  );
}

export function InviteUserForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState(inviteUserAction, {});
  return (
    <form action={action} className="grid gap-2 rounded-2xl border border-border bg-card shadow-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Input name="email" type="email" required placeholder="email" aria-label="Invite email" autoComplete="off" />
      <Input name="fullName" placeholder="ชื่อ / Full name" aria-label="Full name" maxLength={200} />
      <select name="roleId" required aria-label="Role" className="rounded-md border border-slate-300 bg-white px-2 text-sm">
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <Button type="submit" disabled={pending} variant="outline">ส่งคำเชิญทางอีเมล / Send invite</Button>
      <div className="sm:col-span-2 lg:col-span-4"><Msg s={state} /></div>
    </form>
  );
}

function UserRow({ u, roles, depts }: { u: UserRowData; roles: Role[]; depts: Dept[] }) {
  const [upd, update, updPending] = useActionState(updateUserAction, {});
  const [dep, setDeps, depPending] = useActionState(setUserDepartmentsAction, {});
  const [pw, resetPw, pwPending] = useActionState(resetUserPasswordAction, {});
  const role = roles.find((r) => r.id === u.roleId)?.name ?? "-";
  return (
    <li className="rounded-2xl border border-border bg-card shadow-card">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm transition-colors hover:bg-slate-50">
          <span className="font-medium">{u.fullName || u.email}</span>
          <span className="text-slate-500">{u.fullName ? u.email : ""}</span>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{role}</span>
          {!u.isActive && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800">ปิดใช้งาน / inactive</span>}
          <span className="ml-auto text-xs text-slate-500">last sign-in: {u.lastSignIn ? new Date(u.lastSignIn).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" }) : "never"} · {u.questions30d} questions/30d</span>
        </summary>
        <div className="space-y-4 border-t border-slate-100 p-3">
          <form action={update} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={u.id} />
            <label className="text-xs">ชื่อ / Name<Input name="fullName" defaultValue={u.fullName ?? ""} maxLength={200} className="w-52" /></label>
            <label className="text-xs">บทบาท / Role
              <select name="roleId" defaultValue={u.roleId} disabled={u.isSelf} className="block h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            {u.isSelf && <input type="hidden" name="roleId" value={u.roleId} />}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={u.isActive} disabled={u.isSelf} />ใช้งานอยู่ / Active</label>
            {u.isSelf && u.isActive && <input type="hidden" name="isActive" value="on" />}
            <Button type="submit" size="sm" disabled={updPending}>บันทึก / Save</Button>
            <Msg s={upd} />
          </form>
          <form action={setDeps} className="space-y-2">
            <input type="hidden" name="userId" value={u.id} />
            <p className="text-xs font-medium text-slate-600">แผนก / Departments</p>
            {depts.length === 0 ? <p className="text-xs text-slate-500">ยังไม่มีแผนก สร้างได้ที่หน้า Departments / No departments yet.</p> : (
              <div className="flex flex-wrap gap-3">
                {depts.map((d) => <label key={d.id} className="flex items-center gap-1 text-sm"><input type="checkbox" name="departmentId" value={d.id} defaultChecked={u.departmentIds.includes(d.id)} />{d.name}</label>)}
              </div>
            )}
            {depts.length > 0 && <Button type="submit" size="sm" variant="outline" disabled={depPending}>บันทึกแผนก / Save departments</Button>}
            <Msg s={dep} />
          </form>
          <form action={resetPw} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={u.id} />
            <label className="text-xs">ตั้งรหัสผ่านใหม่ / Set new password<Input name="password" type="password" minLength={12} autoComplete="new-password" placeholder="12+ characters" className="w-56" /></label>
            <Button type="submit" size="sm" variant="outline" disabled={pwPending}>ตั้งรหัสผ่าน / Set password</Button>
            <Msg s={pw} />
          </form>
        </div>
      </details>
    </li>
  );
}

const PAGE_SIZE = 15;

export function UserList({ users, roles, depts }: { users: UserRowData[]; roles: Role[]; depts: Dept[] }) {
  const [query, setQuery] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) =>
      (!q || u.email.toLowerCase().includes(q) || (u.fullName ?? "").toLowerCase().includes(q)) &&
      (!roleId || u.roleId === roleId) &&
      (status === "all" || (status === "active") === u.isActive));
  }, [users, query, roleId, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const field = "h-10 rounded-lg border border-input bg-card px-3 text-sm transition-colors hover:border-slate-500 focus-visible:border-ring";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3 shadow-card" role="search">
        <div className="min-w-56 flex-1">
          <label htmlFor="user-search" className="mb-1.5 block text-sm font-medium">ค้นหาผู้ใช้ / Search users</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <input id="user-search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="ชื่อหรืออีเมล / name or email" className={`${field} w-full pl-9`} />
          </div>
        </div>
        <div>
          <label htmlFor="user-role" className="mb-1.5 block text-sm font-medium">บทบาท / Role</label>
          <select id="user-role" value={roleId} onChange={(e) => { setRoleId(e.target.value); setPage(1); }} className={field}>
            <option value="">ทั้งหมด / All</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="user-status" className="mb-1.5 block text-sm font-medium">สถานะ / Status</label>
          <select id="user-status" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} className={field}>
            <option value="all">ทั้งหมด / All</option>
            <option value="active">ใช้งาน / Active</option>
            <option value="inactive">ปิดใช้งาน / Inactive</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-card p-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700"><UserX className="size-5" aria-hidden /></span>
          <p className="text-sm font-medium text-slate-900">{users.length === 0 ? "ยังไม่มีผู้ใช้ / No users" : "ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข / No users match your filters"}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500" aria-live="polite">แสดง {visible.length} จาก {filtered.length} คน / Showing {visible.length} of {filtered.length}</p>
          <ul className="space-y-2">{visible.map((u) => <UserRow key={u.id} u={u} roles={roles} depts={depts} />)}</ul>
          {pages > 1 && (
            <nav className="flex items-center gap-2 text-sm" aria-label="Pagination">
              <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-card px-3 font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"><ChevronLeft className="size-4" aria-hidden />Prev</button>
              <span className="text-slate-500">Page {current} / {pages}</span>
              <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-card px-3 font-medium transition-colors hover:bg-slate-50 disabled:opacity-50">Next<ChevronRight className="size-4" aria-hidden /></button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
