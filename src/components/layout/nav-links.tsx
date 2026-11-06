"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookOpenText, Loader2, FileText, FolderTree, HelpCircle, History, LayoutDashboard, Megaphone, Settings2, ShieldCheck, Sparkles, Users, Building2, Workflow, type LucideIcon,
} from "lucide-react";

// Icons are referenced by key so the (server-rendered) shell can pass plain data to this client component.
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, documents: FileText, chat: Sparkles, categories: FolderTree, content: Megaphone, unanswered: HelpCircle,
  admin: BarChart3, users: Users, roles: ShieldCheck, departments: Building2, processing: Workflow, audit: History, settings: Settings2, book: BookOpenText,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
export type NavGroup = { title: string | null; items: NavItem[] };

/** Instant feedback while a navigation is in flight (must render inside the <Link>). */
function PendingSpinner({ dark }: { dark: boolean }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-hidden className={`ml-auto size-4 shrink-0 animate-spin ${dark ? "text-brand-400" : "text-brand-700"}`} /> : null;
}

export function NavLinks({ groups, tone = "light" }: { groups: NavGroup[]; tone?: "light" | "dark" }) {
  const pathname = usePathname() ?? "";
  const dark = tone === "dark";
  return (
    <nav aria-label="Main" className="space-y-6">
      {groups.map((g) => (
        <div key={g.title ?? "main"} className="space-y-0.5">
          {g.title && <p className={`px-3 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] ${dark ? "text-slate-400" : "text-slate-400"}`}>{g.title}</p>}
          {g.items.map((i) => {
            const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
            const Icon = ICONS[i.icon] ?? FileText;
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-all duration-150 pointer-coarse:min-h-11 ${
                  dark
                    ? active ? "bg-white/[0.08] font-semibold text-white ring-1 ring-white/10" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                    : active ? "bg-white font-semibold text-slate-900 shadow-card ring-1 ring-slate-200/80" : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
                }`}
              >
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? dark ? "bg-brand-500 text-ink" : "bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-glow"
                    : dark ? "text-slate-400 group-hover:text-slate-200" : "text-slate-500 group-hover:text-slate-800"
                }`}>
                  <Icon className="size-[1.125rem]" aria-hidden />
                </span>
                <span className="truncate">{i.label}</span>
                <PendingSpinner dark={dark} />
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
