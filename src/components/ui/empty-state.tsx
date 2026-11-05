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
      className={`flex flex-col items-center rounded-lg border border-dashed text-center ${compact ? "gap-1 p-4" : "gap-2 p-10"} ${tone === "error" ? "border-red-300 bg-red-50" : "border-slate-300 bg-card"}`}
    >
      {Icon && (
        <span className={`mb-1 flex size-10 items-center justify-center rounded-full ${tone === "error" ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-700"}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {children && <div className="max-w-md text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
