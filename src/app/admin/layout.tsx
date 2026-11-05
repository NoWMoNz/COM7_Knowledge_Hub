import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";

// Session is read per request; opt out of static-shell prerendering (see Next docs: instant navigation).
export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  return <AppShell user={user} variant="admin">{children}</AppShell>;
}
