import type { LucideIcon } from "lucide-react";

/** Empty / no-results / error placeholder. `tone="error"` is announced to assistive tech. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  tone = "neutral",
  compact = false,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "error";
  compact?: boolean;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`flex flex-col items-center rounded-2xl border border-dashed text-center ${compact ? "gap-1 p-5" : "gap-2 p-12"} ${tone === "error" ? "border-red-300 bg-red-50" : "border-slate-300 bg-card/70"}`}
    >
      {Icon && (
        <span className={`mb-2 flex size-12 items-center justify-center rounded-2xl ${tone === "error" ? "bg-red-100 text-red-700" : "bg-linear-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200"}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {children && <div className="max-w-md text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
