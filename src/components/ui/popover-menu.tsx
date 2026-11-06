"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight accessible disclosure menu (button + panel): closes on outside click, Escape and when a link inside is used.
 * Used for the notification bell and the user menu so both behave identically.
 */
export function PopoverMenu({
  trigger,
  label,
  children,
  align = "right",
  triggerClassName = "",
}: {
  trigger: React.ReactNode;
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center rounded-full transition-colors hover:bg-slate-900/5 ${triggerClassName}`}
      >
        {trigger}
      </button>
      {open && (
        <div
          onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
          className={`fade-in absolute z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/80 bg-card p-3 text-sm shadow-pop ${align === "right" ? "right-0" : "left-0"}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
