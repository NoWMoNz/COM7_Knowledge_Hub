"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/**
 * Responsive chrome. >= lg: full-height fixed sidebar (brand on top) + glass top bar. Below lg: off-canvas drawer
 * with overlay, closed by Escape, overlay click or navigating. Content slots are rendered by the server shell.
 * The top-bar search is a plain GET form to /documents?q= (the existing document search); "/" focuses it.
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
  const searchRef = useRef<HTMLInputElement>(null);

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

  // "/" jumps to search unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const brand = (
    <Link href="/dashboard" className="flex min-h-10 items-center gap-3 rounded-xl" aria-label="COM7 Knowledge Hub">
      <span className={`flex items-center rounded-xl px-2.5 py-1.5 ${admin ? "bg-white shadow-card" : ""}`}>
        <Logo height={30} priority />
      </span>
    </Link>
  );

  return (
    <div className="bg-canvas min-h-screen text-slate-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-700 focus:shadow-pop">
        ข้ามไปที่เนื้อหา / Skip to content
      </a>

      {/* overlay (drawer mode only) */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        id="app-sidebar"
        aria-label="Navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col transition-transform duration-200 ease-out lg:z-30 lg:translate-x-0 ${
          admin ? "bg-ink text-white" : "border-r border-slate-200/80 bg-white/85 backdrop-blur-xl"
        } ${open ? "translate-x-0 shadow-pop" : "-translate-x-full"}`}
      >
        {admin && <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0 opacity-60" />}
        {admin && <div aria-hidden className="pointer-events-none absolute -left-20 top-0 size-72 rounded-full bg-brand-600/25 blur-3xl" />}
        <div className="relative flex h-16 shrink-0 items-center justify-between gap-2 px-4">
          {brand}
          <button
            type="button" onClick={() => setOpen(false)} aria-label="ปิดเมนู / Close menu"
            className={`flex size-10 items-center justify-center rounded-lg transition-colors lg:hidden ${admin ? "text-slate-300 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="relative px-4 pb-3">
          <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${admin ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-brand-50/70 ring-1 ring-brand-100"}`}>
            <span className={`font-semibold ${admin ? "text-white" : "text-brand-900"}`}>Knowledge Hub</span>
            {admin ? (
              <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-ink">Admin Console</span>
            ) : (
              <span className="text-brand-800/80">Employee</span>
            )}
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-4">{sidebar}</div>
        <p className={`relative border-t px-5 py-3 text-[0.6875rem] ${admin ? "border-white/10 text-slate-400" : "border-slate-200/80 text-slate-500"}`}>
          © COM7 · Internal use only
        </p>
      </aside>

      <div className="lg:pl-[17rem]">
        <header className={`glass sticky top-0 z-20 flex h-16 items-center gap-2 border-b px-3 sm:gap-3 sm:px-6 lg:px-8 ${admin ? "border-b-slate-200/70" : "border-slate-200/70"}`}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="เปิดเมนู / Open menu"
            aria-expanded={open}
            aria-controls="app-sidebar"
            className="-ml-1 flex size-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-900/5 lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <Link href="/dashboard" className="flex min-h-10 items-center lg:hidden" aria-label="COM7 Knowledge Hub">
            <Logo height={28} priority />
          </Link>
          {admin && <span className="hidden rounded-md bg-ink px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-brand-400 sm:inline lg:hidden">Admin</span>}

          <form action="/documents" role="search" className="relative ml-auto hidden w-full max-w-md md:block lg:ml-0">
            <label htmlFor="global-search" className="sr-only">ค้นหาเอกสาร / Search documents</label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              ref={searchRef}
              id="global-search" name="q" type="search" autoComplete="off"
              placeholder="ค้นหาเอกสาร คู่มือ นโยบาย… / Search"
              className="h-10 w-full rounded-full border border-slate-200 bg-white/80 pl-10 pr-12 text-sm shadow-card transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-brand-600 focus-visible:shadow-[0_0_0_4px_rgb(92_185_70/0.18)] focus-visible:outline-none"
            />
            <kbd aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[0.6875rem] text-slate-500">/</kbd>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link href="/documents" aria-label="ค้นหา / Search" className="flex size-10 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-900/5 md:hidden">
              <Search className="size-5" aria-hidden />
            </Link>
            {headerRight}
          </div>
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-6xl">
            {breadcrumbs}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
