"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/**
 * Responsive chrome. >= lg: fixed sidebar. Below lg (tablet/mobile): off-canvas drawer with overlay,
 * closed by Escape, overlay click or navigating. Content slots are rendered by the server shell.
 */
export function ShellFrame({
  variant,
  sidebar,
  headerRight,
  breadcrumbs,
  children,
}: {
  variant: "employee" | "admin";
  sidebar: React.ReactNode;
  headerRight: React.ReactNode;
  breadcrumbs: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const admin = variant === "admin";

  // Close the drawer after navigation (state is adjusted during render, per React guidance, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-700 focus:shadow-pop">
        ข้ามไปที่เนื้อหา / Skip to content
      </a>

      <header className={`sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-4 ${admin ? "border-t-[3px] border-t-slate-900" : ""}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู / Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="-ml-1 flex size-10 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <Link href="/dashboard" className="flex min-h-10 items-center rounded-md" aria-label="COM7 Knowledge Hub">
          <Logo height={34} priority />
        </Link>
        <span className="hidden text-sm font-medium text-slate-500 sm:inline">Knowledge Hub</span>
        {admin && (
          <span className="ml-1 rounded bg-slate-900 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-white">Admin Console</span>
        )}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">{headerRight}</div>
      </header>

      <div className="lg:flex">
        {/* overlay (drawer mode only) */}
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity duration-200 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        />
        <aside
          id="app-sidebar"
          aria-label="Navigation"
          className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r p-4 shadow-pop transition-transform duration-200 ease-out lg:sticky lg:top-14 lg:z-20 lg:h-[calc(100vh-3.5rem)] lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
            admin ? "border-slate-800 bg-slate-900" : "border-border bg-card"
          } ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <span className={`text-sm font-semibold ${admin ? "text-white" : "text-slate-900"}`}>เมนู / Menu</span>
            <button
              type="button" onClick={() => setOpen(false)} aria-label="ปิดเมนู / Close menu"
              className={`flex size-10 items-center justify-center rounded-md transition-colors ${admin ? "text-slate-300 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {sidebar}
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            {breadcrumbs}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
