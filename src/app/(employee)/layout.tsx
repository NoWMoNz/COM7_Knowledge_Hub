import { requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

// Session is read per request; opt out of static-shell prerendering (see Next docs: instant navigation).
export const instant = false;

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Admins get the dark "Admin Console" chrome everywhere, not only after opening an /admin page.
  const variant = hasPermission(user.permissions, PERMISSIONS.ADMIN_ACCESS) ? "admin" : "employee";
  return <AppShell user={user} variant={variant}>{children}</AppShell>;
}
