"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookOpenText, FileText, FolderTree, HelpCircle, History, LayoutDashboard, Megaphone, Settings2, ShieldCheck, Sparkles, Users, Building2, Workflow, type LucideIcon,
} from "lucide-react";

// Icons are referenced by key so the (server-rendered) shell can pass plain data to this client component.
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, documents: FileText, chat: Sparkles, categories: FolderTree, content: Megaphone, unanswered: HelpCircle,
  admin: BarChart3, users: Users, roles: ShieldCheck, departments: Building2, processing: Workflow, audit: History, settings: Settings2, book: BookOpenText,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
export type NavGroup = { title: string | null; items: NavItem[] };

export function NavLinks({ groups, tone = "light" }: { groups: NavGroup[]; tone?: "light" | "dark" }) {
  const pathname = usePathname() ?? "";
  const dark = tone === "dark";
  return (
    <nav aria-label="Main" className="space-y-6">
      {groups.map((g) => (
        <div key={g.title ?? "main"} className="space-y-1">
          {g.title && <p className={`px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider ${dark ? "text-slate-400" : "text-slate-500"}`}>{g.title}</p>}
          {g.items.map((i) => {
            const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
            const Icon = ICONS[i.icon] ?? FileText;
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 pointer-coarse:min-h-11 ${
                  dark
                    ? active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                    : active ? "bg-brand-50 font-medium text-brand-900" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-500" />}
                <Icon className={`size-[1.125rem] shrink-0 ${active ? (dark ? "text-brand-400" : "text-brand-700") : dark ? "text-slate-400 group-hover:text-slate-200" : "text-slate-500 group-hover:text-slate-700"}`} aria-hidden />
                <span className="truncate">{i.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
