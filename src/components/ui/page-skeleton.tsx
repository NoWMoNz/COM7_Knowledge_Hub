import { Skeleton } from "@/components/ui/skeleton";

/** Generic loading placeholder (title + toolbar + list), shown while a page streams in. */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="กำลังโหลด / Loading" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: Math.min(rows, 6) }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <span className="sr-only">กำลังโหลด… / Loading…</span>
    </div>
  );
}
