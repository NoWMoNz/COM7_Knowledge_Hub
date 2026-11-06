"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";
import { ACCEPT_ATTR, ALLOWED_EXTENSIONS, MAX_FILE_BYTES } from "@/constants/documents";
import { formatBytes } from "@/lib/utils/format";

type Category = { id: string; name: string };
type Item = {
  key: string;
  file: File;
  progress: number;
  state: "queued" | "uploading" | "done" | "error";
  message?: string;
};

const CONCURRENCY = 3;

function upload(item: Item, fields: Record<string, string>, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", item.file);
    Object.entries(fields).forEach(([k, v]) => v && form.append(k, v));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = "Upload failed.";
      try { msg = JSON.parse(xhr.responseText).error?.message ?? msg; } catch { /* keep default */ }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Network error."));
    xhr.send(form);
  });
}

export function UploadPanel({ categories, documentId }: { categories: Category[]; documentId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const single = Boolean(documentId);

  const patch = (key: string, p: Partial<Item>) =>
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const start = useCallback(async (files: File[]) => {
    const picked = (single ? files.slice(0, 1) : files).map<Item>((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let message: string | undefined;
      if (!(ALLOWED_EXTENSIONS as string[]).includes(ext)) message = `Unsupported type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
      else if (file.size > MAX_FILE_BYTES) message = `Larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`;
      else if (file.size === 0) message = "File is empty";
      return { key: `${file.name}-${file.size}-${crypto.randomUUID()}`, file, progress: 0, state: message ? "error" : "queued", message };
    });
    setItems(picked);
    setBusy(true);
    const queue = picked.filter((i) => i.state === "queued");
    const fields = { categoryId, ...(documentId ? { documentId } : {}) };
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const item = queue[next++];
        patch(item.key, { state: "uploading" });
        try {
          await upload(item, fields, (progress) => patch(item.key, { progress }));
          patch(item.key, { state: "done", progress: 100 });
        } catch (e) {
          patch(item.key, { state: "error", message: (e as Error).message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setBusy(false);
    router.refresh();
    // Uploaded files are tracked in the document list below (status badge); drop them from here so the
    // message does not stay on screen forever. Failures stay until the next upload so they can be read.
    setTimeout(() => setItems((cur) => cur.filter((i) => i.state !== "done")), 4000);
  }, [categoryId, documentId, router, single]);

  return (
    <div className="space-y-3">
      {!single && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="upload-category" className="font-medium text-slate-700">หมวดหมู่ของไฟล์ที่อัปโหลด / Category for uploads</label>
          <select id="upload-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-card px-2 text-sm transition-colors hover:border-slate-500">
            <option value="">— ไม่ระบุ / None —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) start(Array.from(e.dataTransfer.files)); }}
        className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-150 sm:p-8 ${dragging ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-brand-400"}`}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><UploadCloud className="size-6" aria-hidden /></span>
        <p className="text-sm text-slate-700">
          ลากไฟล์มาวางที่นี่ หรือ / Drag files here, or{" "}
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex min-h-8 items-center font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 disabled:opacity-50">
            เลือกไฟล์ / browse
          </button>
        </p>
        <p className="text-xs text-slate-500">{ALLOWED_EXTENSIONS.join(", ").toUpperCase()} · max {MAX_FILE_BYTES / 1024 / 1024} MB{single ? "" : " · multiple files allowed"}</p>
        <input ref={inputRef} type="file" multiple={!single} accept={ACCEPT_ATTR} className="sr-only" aria-label="Select files"
          onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) start(f); }} />
      </div>
      {items.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {items.map((i) => (
            <li key={i.key} className="rounded-md border border-slate-200 bg-card p-3 text-sm shadow-card">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{i.file.name} <span className="font-normal text-slate-500">({formatBytes(i.file.size)})</span></span>
                {i.state === "done" && <CheckCircle2 className="size-4 text-brand-700" aria-label="Uploaded" />}
                {i.state === "error" && <XCircle className="size-4 text-red-600" aria-label="Failed" />}
                {(i.state === "uploading" || i.state === "queued") && <Loader2 className="size-4 animate-spin text-slate-500" aria-label="Uploading" />}
              </div>
              {i.state === "error" && <p className="mt-1 text-red-700">{i.message}</p>}
              {i.state === "done" && <p className="mt-1 text-brand-800">อัปโหลดสำเร็จ ดูสถานะการประมวลผลในรายการด้านล่าง / Uploaded. Track processing in the list below.</p>}
              {(i.state === "uploading" || i.state === "done") && (
                <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-100" role="progressbar" aria-valuenow={i.progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-brand-600 transition-all" style={{ width: `${i.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
