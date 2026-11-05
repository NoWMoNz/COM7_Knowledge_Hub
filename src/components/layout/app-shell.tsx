import { Suspense } from "react";
import { Bell, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { PopoverMenu } from "@/components/ui/popover-menu";
import { NavLinks, type NavGroup } from "./nav-links";
import { Breadcrumbs } from "./breadcrumbs";
import { NotificationBell } from "./notification-bell";
import { ShellFrame } from "./shell-frame";

const ROLE_LABELS: Record<string, string> = {
  employee: "พนักงาน / Employee",
  knowledge_manager: "Knowledge Manager / HR",
  admin: "Admin",
};

function buildNav(user: CurrentUser): NavGroup[] {
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(user.permissions, p);
  const groups: NavGroup[] = [{
    title: null,
    items: [
      { href: "/dashboard", label: "หน้าแรก / Dashboard", icon: "dashboard" },
      { href: "/documents", label: "เอกสาร / Documents", icon: "documents" },
      { href: "/chat", label: "ผู้ช่วย AI / AI Assistant", icon: "chat" },
    ],
  }];
  const manage: NavGroup["items"] = [];
  if (can(PERMISSIONS.CATEGORY_MANAGE)) manage.push({ href: "/categories", label: "หมวดหมู่ / Categories", icon: "categories" });
  if (can(PERMISSIONS.CONTENT_MANAGE)) manage.push({ href: "/content", label: "เนื้อหาหน้าแรก / Content", icon: "content" });
  if (can(PERMISSIONS.DOCUMENT_MANAGE)) manage.push({ href: "/unanswered", label: "ตอบไม่ได้ / Unanswered", icon: "unanswered" });
  if (manage.length) groups.push({ title: "จัดการความรู้ / Knowledge", items: manage });

  const admin: NavGroup["items"] = [];
  if (can(PERMISSIONS.ADMIN_ACCESS)) admin.push({ href: "/admin/dashboard", label: "Admin Dashboard", icon: "admin" });
  if (can(PERMISSIONS.USER_READ)) admin.push({ href: "/admin/users", label: "ผู้ใช้ / Users", icon: "users" });
  if (can(PERMISSIONS.ROLE_MANAGE)) admin.push({ href: "/admin/roles", label: "บทบาท / Roles", icon: "roles" });
  if (can(PERMISSIONS.DEPARTMENT_MANAGE)) admin.push({ href: "/admin/departments", label: "แผนก / Departments", icon: "departments" });
  if (can(PERMISSIONS.ADMIN_ACCESS) && can(PERMISSIONS.DOCUMENT_MANAGE)) admin.push({ href: "/admin/documents", label: "การประมวลผล / Processing", icon: "processing" });
  if (can(PERMISSIONS.AUDIT_READ)) admin.push({ href: "/admin/audit", label: "Audit logs", icon: "audit" });
  if (admin.length) groups.push({ title: "ผู้ดูแลระบบ / Administration", items: admin });
  return groups;
}

function initials(user: CurrentUser): string {
  const src = (user.fullName ?? user.email).trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

/**
 * Shared application chrome for employee and admin areas. `variant="admin"` gives the admin console a clearly
 * different look (dark sidebar, "Admin Console" badge, dark top rule) so people always know where they are.
 */
export function AppShell({ user, variant = "employee", children }: { user: CurrentUser; variant?: "employee" | "admin"; children: React.ReactNode }) {
  const role = ROLE_LABELS[user.roleKey] ?? user.roleKey;
  return (
    <ShellFrame
      variant={variant}
      sidebar={<NavLinks groups={buildNav(user)} tone={variant === "admin" ? "dark" : "light"} />}
      breadcrumbs={<Breadcrumbs />}
      headerRight={
        <>
          {/* Streams in on its own so its queries never delay the page content. */}
          <Suspense fallback={<span className="flex size-10 items-center justify-center" aria-hidden><Bell className="size-5 text-slate-400" /></span>}>
            <NotificationBell user={user} />
          </Suspense>
          <PopoverMenu
            label="เมนูผู้ใช้ / User menu"
            triggerClassName="gap-2 py-1 pl-1 pr-2"
            trigger={
              <>
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-900">{initials(user)}</span>
                <span className="hidden max-w-40 truncate text-sm font-medium text-slate-800 md:inline">{user.fullName ?? user.email}</span>
              </>
            }
          >
            <div className="border-b border-slate-100 pb-3">
              <p className="truncate font-medium text-slate-900">{user.fullName ?? user.email}</p>
              {user.fullName && <p className="truncate text-xs text-slate-500">{user.email}</p>}
              <p className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{role}</p>
            </div>
            <form action={logoutAction} className="pt-3">
              <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 pointer-coarse:min-h-11">
                <LogOut className="size-4" aria-hidden />ออกจากระบบ / Logout
              </button>
            </form>
          </PopoverMenu>
        </>
      }
    >
      {children}
    </ShellFrame>
  );
}
