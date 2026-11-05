"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "หน้าแรก", documents: "เอกสาร", chat: "ผู้ช่วย AI", categories: "หมวดหมู่", content: "เนื้อหาหน้าแรก",
  unanswered: "คำถามที่ตอบไม่ได้", admin: "Admin", users: "ผู้ใช้", roles: "บทบาท", departments: "แผนก", audit: "Audit logs",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Breadcrumbs() {
  const segments = (usePathname() ?? "").split("/").filter(Boolean);
  // A single top-level page needs no trail; the page title already says where you are.
  if (segments.length < 2) return null;
  // `admin/documents` is the processing monitor (route name kept for URL stability).
  const label = (seg: string, i: number) =>
    UUID.test(seg) ? "รายละเอียด"
      : segments[0] === "admin" && i === 1 && seg === "documents" ? "การประมวลผล"
      : segments[0] === "admin" && i === 1 && seg === "dashboard" ? "ภาพรวม"
      : (LABELS[seg] ?? seg);
  const crumbs = segments.map((seg, i) => ({
    key: `/${segments.slice(0, i + 1).join("/")}`,
    // /admin has no page of its own: its crumb points at the admin dashboard.
    href: seg === "admin" && i === 0 ? "/admin/dashboard" : `/${segments.slice(0, i + 1).join("/")}`,
    label: label(seg, i),
  }));
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-[0.8125rem] text-slate-500">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((c, i) => (
          <li key={c.key} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 text-slate-400" aria-hidden />}
            {i === crumbs.length - 1
              ? <span aria-current="page" className="font-medium text-slate-800">{c.label}</span>
              : <Link href={c.href} className="rounded transition-colors hover:text-brand-700 hover:underline">{c.label}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
