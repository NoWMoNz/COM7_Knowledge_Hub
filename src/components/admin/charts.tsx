/**
 * Small, dependency-free charts for the admin dashboard (server components, CSS-only hover).
 * Every chart has a table view, so tooltips never gate a value. Colors were checked with the dataviz palette
 * validator: brand-700 #337f2c + amber-500 #f59e0b pass the colour-blind separation checks; amber is below 3:1 on
 * white, which is why every series also has a legend label and the table view.
 */

export type Series = { label: string; values: number[]; swatch: string };

const dayFmt = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const asDate = (key: string) => new Date(`${key}T00:00:00Z`);
export const fmt = (n: number) => n.toLocaleString("en-US");

/** Clean axis ticks (1/2/5 × 10^n steps) for integer counts. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/**
 * Daily columns. Two or more series stack (bottom → top in the given order) and get a legend; one series needs none
 * (the card title names it). Each day column is the hover/focus target, larger than the painted mark.
 */
export function DailyColumns({ days, series, labelEvery = 2, unit }: { days: string[]; series: Series[]; labelEvery?: number; unit: string }) {
  const totals = days.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const ticks = niceTicks(Math.max(...totals, 0));
  const top = ticks[ticks.length - 1];
  const n = days.length;
  const empty = totals.every((t) => t === 0);

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          {series.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span aria-hidden className={`size-2.5 rounded-[3px] ${s.swatch}`} />
              {s.label}
              <span className="font-semibold text-slate-900">{fmt(s.values.reduce((a, b) => a + b, 0))}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2">
        <div className="relative h-44" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 text-[0.6875rem] tabular-nums text-slate-400" style={{ bottom: `${(t / top) * 100}%` }}>{fmt(t)}</span>
          ))}
        </div>
        <div className="relative h-44">
          {ticks.map((t) => (
            <div key={t} aria-hidden className={`absolute inset-x-0 h-px ${t === 0 ? "bg-slate-300" : "bg-slate-100"}`} style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          {empty && <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">ยังไม่มีข้อมูลในช่วงนี้ / No activity in this period</p>}
          <div className="absolute inset-0 flex">
            {days.map((d, i) => {
              const parts = series.map((s) => ({ ...s, v: s.values[i] ?? 0 })).filter((p) => p.v > 0);
              const align = i < 3 ? "left-0" : i > n - 4 ? "right-0" : "left-1/2 -translate-x-1/2";
              const summary = `${longFmt.format(asDate(d))}: ${fmt(totals[i])} ${unit}${series.length > 1 ? ` (${series.map((s) => `${s.label} ${fmt(s.values[i] ?? 0)}`).join(", ")})` : ""}`;
              return (
                <div key={d} tabIndex={0} aria-label={summary}
                  className="group relative flex h-full flex-1 items-end justify-center rounded-md px-[3px] outline-none transition-colors hover:bg-slate-100/70 focus-visible:bg-slate-100/70 focus-visible:ring-2 focus-visible:ring-brand-600/40">
                  {totals[i] > 0 && (
                    <div className="flex w-full max-w-6 flex-col-reverse gap-[2px]" style={{ height: `${Math.max(2, (totals[i] / top) * 100)}%` }}>
                      {parts.map((p, j) => (
                        <div key={p.label} className={`min-h-[3px] ${p.swatch} transition-[filter] group-hover:brightness-110 ${j === parts.length - 1 ? "rounded-t-[4px]" : ""}`} style={{ flexGrow: p.v, flexBasis: 0 }} />
                      ))}
                    </div>
                  )}
                  <div role="presentation" className={`pointer-events-none invisible absolute bottom-full z-20 mb-2 w-max min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs opacity-0 shadow-pop transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 ${align}`}>
                    <p className="text-slate-500">{longFmt.format(asDate(d))}</p>
                    <p className="text-base font-semibold text-slate-900">{fmt(totals[i])} <span className="text-xs font-normal text-slate-500">{unit}</span></p>
                    {series.length > 1 && series.map((s) => (
                      <p key={s.label} className="mt-0.5 flex items-center gap-2 text-slate-600">
                        <span aria-hidden className={`h-0.5 w-3 rounded-full ${s.swatch}`} />
                        <span className="font-semibold text-slate-900">{fmt(s.values[i] ?? 0)}</span>{s.label}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div />
        <div className="mt-2 flex" aria-hidden>
          {days.map((d, i) => (
            <span key={d} className="flex min-w-0 flex-1 justify-center whitespace-nowrap text-[0.6875rem] text-slate-400">
              {/* Narrow screens show every other label so they never touch. */}
              {(n - 1 - i) % labelEvery === 0 && <span className={(n - 1 - i) % (labelEvery * 2) === 0 ? "" : "hidden sm:inline"}>{dayFmt.format(asDate(d))}</span>}
            </span>
          ))}
        </div>
      </div>
      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer select-none font-medium text-slate-500 hover:text-slate-800">ดูเป็นตาราง / View as table</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-100">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr><th className="px-3 py-1.5 font-medium">วันที่ / Date</th>{series.map((s) => <th key={s.label} className="px-3 py-1.5 text-right font-medium">{s.label}</th>)}{series.length > 1 && <th className="px-3 py-1.5 text-right font-medium">รวม / Total</th>}</tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{longFmt.format(asDate(d))}</td>
                  {series.map((s) => <td key={s.label} className="px-3 py-1.5 text-right">{fmt(s.values[i] ?? 0)}</td>)}
                  {series.length > 1 && <td className="px-3 py-1.5 text-right font-semibold text-slate-900">{fmt(totals[i])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Ranked horizontal bars for one measure (one colour; length carries the value, the number sits at the tip). */
export function RankedBars({ items, unit, empty }: { items: { label: string; value: number }[]; unit?: string; empty: string }) {
  if (items.length === 0) return <p className="py-8 text-center text-xs text-slate-500">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol className="space-y-3">
      {items.map((it, idx) => (
        <li key={it.label} className="text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-4 shrink-0 text-xs tabular-nums text-slate-400">{idx + 1}</span>
              <span className="truncate text-slate-800" title={it.label}>{it.label}</span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-slate-500"><span className="font-semibold text-slate-900">{fmt(it.value)}</span>{unit ? ` ${unit}` : ""}</span>
          </div>
          <div className="ml-6 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** 14-point trend line for a stat tile: de-emphasised line, the latest day marked in the accent. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 112, h = 32, pad = 4;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2), h - pad - (v / max) * (h - pad * 2)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="shrink-0 overflow-visible">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#a1a5aa" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={4} fill="#337f2c" stroke="#fff" strokeWidth={2} />}
    </svg>
  );
}

const METER = {
  good: { fill: "bg-brand-600", track: "bg-brand-100" },
  warn: { fill: "bg-amber-500", track: "bg-amber-100" },
  bad: { fill: "bg-red-600", track: "bg-red-100" },
} as const;

/** A share of a whole (0–100). The fill carries severity; the track is a lighter step of the same hue. */
export function Meter({ percent, tone, label }: { percent: number; tone: keyof typeof METER; label: string }) {
  const c = METER[tone];
  return (
    <div className={`h-2 w-full rounded-full ${c.track}`} role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${c.fill}`} style={{ width: `${Math.min(100, Math.max(percent > 0 ? 2 : 0, percent))}%` }} />
    </div>
  );
}
