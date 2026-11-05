import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { STATUS_LABELS, type DocumentStatus } from "@/constants/documents";

// Status is never conveyed by color alone: each state also has an icon and a text label.
const STYLES: Record<DocumentStatus, { cls: string; icon: React.ReactNode }> = {
  uploading: { cls: "border-slate-200 bg-slate-100 text-slate-700", icon: <CircleDashed className="size-3" aria-hidden /> },
  processing: { cls: "border-amber-200 bg-amber-50 text-amber-900", icon: <Loader2 className="size-3 animate-spin" aria-hidden /> },
  ready: { cls: "border-brand-200 bg-brand-50 text-brand-900", icon: <CheckCircle2 className="size-3 text-brand-700" aria-hidden /> },
  failed: { cls: "border-red-200 bg-red-50 text-red-800", icon: <XCircle className="size-3" aria-hidden /> },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.icon}
      {STATUS_LABELS[status]}
    </span>
  );
}
