import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { PopoverMenu } from "@/components/ui/popover-menu";

type Alert = { href: string; text: string };

/** Managers see work that needs attention; everyone sees the latest published announcements. Nothing is fabricated. */
export async function NotificationBell({ user }: { user: CurrentUser }) {
  const supabase = await createClient();
  const alerts: Alert[] = [];
  const isManager = hasPermission(user.permissions, PERMISSIONS.DOCUMENT_MANAGE);

  // All three lookups are independent, so they run together (one round trip instead of two in a row).
  const [docsRes, openRes, newsRes] = await Promise.all([
    isManager ? supabase.from("documents").select("id, latest:document_versions!documents_latest_version_fk(status)").limit(2000) : null,
    isManager ? supabase.from("unanswered_questions").select("id", { count: "exact", head: true }).eq("status", "open") : null,
    supabase.from("content_items").select("id, title").eq("kind", "announcement").eq("is_published", true)
      .order("created_at", { ascending: false }).limit(3),
  ]);
  const news = newsRes.data;

  if (isManager) {
    const docs = docsRes?.data;
    const open = openRes?.count;
    const failed = (docs ?? []).filter((d) => {
      const l = d.latest as { status: string } | { status: string }[] | null;
      return (Array.isArray(l) ? l[0] : l)?.status === "failed";
    }).length;
    if (failed > 0) alerts.push({ href: "/documents?status=failed", text: `${failed} เอกสารประมวลผลล้มเหลว / ${failed} document(s) failed processing` });
    if ((open ?? 0) > 0) alerts.push({ href: "/unanswered", text: `${open} คำถามที่ AI ตอบไม่ได้ / ${open} unanswered question(s)` });
  }

  const count = alerts.length;
  return (
    <PopoverMenu
      label={`การแจ้งเตือน / Notifications${count ? ` (${count})` : ""}`}
      triggerClassName="size-10 justify-center"
      trigger={
        <>
          <Bell className="size-5 text-slate-700" aria-hidden />
          {count > 0 && (
            <span aria-hidden className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-white ring-2 ring-card">{count}</span>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {alerts.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">ต้องดำเนินการ / Needs attention</p>
            <ul className="space-y-0.5">
              {alerts.map((a) => <li key={a.href}><Link href={a.href} className="block rounded-md px-2 py-1.5 text-brand-800 transition-colors hover:bg-brand-50">{a.text}</Link></li>)}
            </ul>
          </div>
        )}
        {(news ?? []).length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">ประกาศล่าสุด / Latest announcements</p>
            <ul className="space-y-0.5">
              {(news ?? []).map((n) => <li key={n.id}><Link href="/dashboard" className="block rounded-md px-2 py-1.5 text-slate-800 transition-colors hover:bg-slate-100">{n.title}</Link></li>)}
            </ul>
          </div>
        )}
        {alerts.length === 0 && (news ?? []).length === 0 && <p className="py-2 text-center text-slate-500">ไม่มีการแจ้งเตือน / No notifications.</p>}
      </div>
    </PopoverMenu>
  );
}
