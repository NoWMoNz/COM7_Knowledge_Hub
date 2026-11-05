/** Minimal accessible bar chart (CSS only). Renders a table-equivalent via title/aria text. */
export function BarSeries({ title, days, values, color = "bg-brand-600" }: { title: string; days: string[]; values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <figure className="rounded-lg border border-border bg-card shadow-card p-4">
      <figcaption className="mb-3 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-800">{title}</span>
        <span className="text-slate-500">{total} / {days.length} วัน / days</span>
      </figcaption>
      {total === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">ยังไม่มีข้อมูล / No data yet.</p>
      ) : (
        <div className="flex h-24 items-end gap-1" role="img" aria-label={`${title}: ${values.join(", ")}`}>
          {values.map((v, i) => (
            <div key={days[i]} title={`${days[i]}: ${v}`} className={`flex-1 rounded-t ${color}`} style={{ height: `${Math.max(v ? 6 : 1, (v / max) * 100)}%`, opacity: v ? 1 : 0.2 }} />
          ))}
        </div>
      )}
    </figure>
  );
}
