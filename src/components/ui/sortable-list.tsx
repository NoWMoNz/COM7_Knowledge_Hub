"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

/**
 * Vertical drag-and-drop list without a library.
 * - Mouse: press anywhere on a card (not on its buttons/inputs) and drag.
 * - Touch: drag by the grip handle (the rest of the card still scrolls the page normally).
 * - Keyboard: focus the grip handle and use ↑ / ↓.
 * The list only reports the new order through `onReorder`; saving is up to the caller.
 */

type DragState = {
  id: string;
  from: number;
  to: number;
  dy: number;
  dropping: boolean;
  tops: number[];
  heights: number[];
  gap: number;
  startPageY: number;
};

const INTERACTIVE = "button, a, input, textarea, select, label, [contenteditable='true']";
const EDGE = 72; // px from the viewport edge where auto-scroll starts
const SETTLE_MS = 160;

export function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function SortableList<T extends { id: string }>({
  items, onReorder, renderItem, isLocked, label, className = "space-y-3",
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, ctx: { handle: React.ReactNode; dragging: boolean }) => React.ReactNode;
  /** Items that cannot be dragged right now (e.g. open in an editor). */
  isLocked?: (item: T) => boolean;
  label: string;
  className?: string;
}) {
  const refs = useRef(new Map<string, HTMLLIElement>());
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announce, setAnnounce] = useState("");
  const focusAfter = useRef<string | null>(null);
  const cleanup = useRef<() => void>(() => {});

  const set = (d: DragState | null) => { dragRef.current = d; setDrag(d); };

  // Keep keyboard focus on the moved item's handle (moving DOM nodes can drop focus).
  useEffect(() => {
    if (!focusAfter.current) return;
    refs.current.get(focusAfter.current)?.querySelector<HTMLElement>("[data-drag-handle]")?.focus();
    focusAfter.current = null;
  });
  useEffect(() => () => cleanup.current(), []);

  function begin(id: string, clientY: number) {
    const from = items.findIndex((i) => i.id === id);
    const rects = items.map((i) => refs.current.get(i.id)!.getBoundingClientRect());
    const tops = rects.map((r) => r.top + window.scrollY);
    const heights = rects.map((r) => r.height);
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    window.getSelection()?.removeAllRanges();
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    set({ id, from, to: from, dy: 0, dropping: false, tops, heights, gap, startPageY: clientY + window.scrollY });
  }

  function update(clientY: number) {
    const d = dragRef.current;
    if (!d || d.dropping) return;
    const last = d.tops.length - 1;
    const min = d.tops[0] - d.tops[d.from];
    const max = d.tops[last] + d.heights[last] - (d.tops[d.from] + d.heights[d.from]);
    const dy = Math.min(max, Math.max(min, clientY + window.scrollY - d.startPageY));
    // Leading edge decides: moving down, the card's bottom passing a neighbour's middle takes its slot; moving up, its top.
    // (Using the card's centre would fail to reach the last slot when the dragged card is taller than its neighbours.)
    const top = d.tops[d.from] + dy, bottom = top + d.heights[d.from];
    let to = d.from;
    for (let j = d.from + 1; j <= last; j++) if (bottom > d.tops[j] + d.heights[j] / 2) to = j;
    for (let j = d.from - 1; j >= 0; j--) if (top < d.tops[j] + d.heights[j] / 2) to = j;
    set({ ...d, dy, to });
  }

  function finish(cancel = false) {
    cleanup.current();
    const d = dragRef.current;
    if (!d) return;
    const to = cancel ? d.from : d.to;
    // Slide the card into its slot, then commit the new order.
    let target = 0;
    if (to > d.from) for (let j = d.from + 1; j <= to; j++) target += d.heights[j] + d.gap;
    if (to < d.from) for (let j = to; j < d.from; j++) target -= d.heights[j] + d.gap;
    set({ ...d, to, dy: target, dropping: true });
    window.setTimeout(() => {
      set(null);
      if (to !== d.from) {
        onReorder(move(items, d.from, to));
        setAnnounce(`ย้ายไปลำดับที่ ${to + 1} จาก ${items.length} / Moved to position ${to + 1} of ${items.length}`);
      }
    }, SETTLE_MS);
  }

  function onPointerDown(e: React.PointerEvent, item: T) {
    if (e.button !== 0 || dragRef.current || isLocked?.(item)) return;
    const target = e.target as HTMLElement;
    const onHandle = Boolean(target.closest("[data-drag-handle]"));
    // Touch/pen only via the handle, so swiping a card still scrolls the page.
    if (!onHandle && (e.pointerType !== "mouse" || target.closest(INTERACTIVE))) return;
    if (onHandle) e.preventDefault();

    const startX = e.clientX, startY = e.clientY;
    let started = false, lastY = startY, raf = 0;
    const tick = () => {
      if (!dragRef.current) return;
      const speed = lastY < EDGE ? -Math.ceil((EDGE - lastY) / 4) : lastY > window.innerHeight - EDGE ? Math.ceil((lastY - (window.innerHeight - EDGE)) / 4) : 0;
      if (speed) { window.scrollBy(0, speed); update(lastY); }
      raf = requestAnimationFrame(tick);
    };
    const onMove = (ev: PointerEvent) => {
      lastY = ev.clientY;
      if (!started) {
        // A small threshold keeps ordinary clicks (and text selection by double-click) working.
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        started = true;
        begin(item.id, startY);
        raf = requestAnimationFrame(tick);
      }
      ev.preventDefault();
      update(ev.clientY);
    };
    const onUp = () => (started ? finish() : cleanup.current());
    const onCancel = () => (started ? finish(true) : cleanup.current());
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape" && started) finish(true); };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    cleanup.current = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      cleanup.current = () => {};
    };
  }

  function onHandleKey(e: React.KeyboardEvent, index: number, item: T) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const to = e.key === "ArrowUp" ? index - 1 : index + 1;
    if (to < 0 || to >= items.length || isLocked?.(item)) return;
    focusAfter.current = item.id;
    onReorder(move(items, index, to));
    setAnnounce(`ย้ายไปลำดับที่ ${to + 1} จาก ${items.length} / Moved to position ${to + 1} of ${items.length}`);
  }

  const shift = drag ? drag.heights[drag.from] + drag.gap : 0;

  return (
    <>
      <ul className={className} aria-label={label}>
        {items.map((item, j) => {
          const dragging = drag?.id === item.id;
          let offset = 0;
          if (drag && dragging) offset = drag.dy;
          else if (drag && j > drag.from && j <= drag.to) offset = -shift;
          else if (drag && j < drag.from && j >= drag.to) offset = shift;
          const locked = isLocked?.(item) ?? false;
          const handle = (
            <button
              type="button" data-drag-handle disabled={locked}
              onKeyDown={(e) => onHandleKey(e, j, item)}
              aria-label={`จัดลำดับ: ${j + 1} จาก ${items.length} — กดลูกศรขึ้น/ลงเพื่อย้าย / Reorder: position ${j + 1} of ${items.length}, use arrow keys`}
              title="ลากเพื่อจัดลำดับ / Drag to reorder"
              className="flex size-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 active:cursor-grabbing disabled:cursor-default disabled:opacity-40 pointer-coarse:size-10"
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
          );
          return (
            <li
              key={item.id}
              ref={(el) => { if (el) refs.current.set(item.id, el); else refs.current.delete(item.id); }}
              onPointerDown={(e) => onPointerDown(e, item)}
              style={{
                transform: offset ? `translate3d(0, ${offset}px, 0)` : undefined,
                transition: drag && (!dragging || drag.dropping) ? `transform ${SETTLE_MS}ms cubic-bezier(.2,.8,.2,1)` : undefined,
                position: "relative",
                zIndex: dragging ? 20 : undefined,
              }}
              className={locked ? undefined : "cursor-grab active:cursor-grabbing pointer-coarse:cursor-auto"}
            >
              <div className={`rounded-2xl transition-[box-shadow,scale] duration-150 ${dragging ? "scale-[1.015] shadow-pop ring-2 ring-brand-500/40" : ""}`}>
                {renderItem(item, { handle, dragging })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </>
  );
}
