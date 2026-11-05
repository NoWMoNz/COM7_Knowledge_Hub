import { File, FileSpreadsheet, FileText, Presentation, type LucideIcon } from "lucide-react";

// File-type color coding is a convention (not brand color): PDF red, Word sky, Excel green, PowerPoint orange.
const TYPES: Record<string, { icon: LucideIcon; cls: string }> = {
  pdf: { icon: FileText, cls: "bg-red-50 text-red-700" },
  docx: { icon: FileText, cls: "bg-sky-50 text-sky-800" },
  xlsx: { icon: FileSpreadsheet, cls: "bg-brand-50 text-brand-800" },
  pptx: { icon: Presentation, cls: "bg-orange-50 text-orange-800" },
  txt: { icon: File, cls: "bg-slate-100 text-slate-700" },
};

export function FileTypeIcon({ ext, className = "size-10" }: { ext?: string | null; className?: string }) {
  const t = TYPES[ext ?? ""] ?? TYPES.txt;
  const Icon = t.icon;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md ${t.cls} ${className}`} title={ext?.toUpperCase()}>
      <Icon className="size-1/2" aria-hidden />
    </span>
  );
}
