"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_QUESTION_CHARS } from "@/constants/ai";

export type ChatSource = {
  index: number;
  documentId: string | null;
  title: string;
  version: number;
  page: number | null;
  section: string | null;
  fileExt: string | null;
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  answered?: boolean | null;
  sources?: ChatSource[];
};

function locationLabel(s: ChatSource): string {
  if (s.page) return s.fileExt === "pptx" ? `สไลด์ / slide ${s.page}` : `หน้า / page ${s.page}`;
  return s.section ? `ชีต / section: ${s.section}` : "";
}

function Sources({ sources }: { sources: ChatSource[] }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
      <p className="mb-1.5 font-semibold uppercase tracking-wide text-[0.625rem] text-slate-400">แหล่งที่มา / Sources</p>
      <ul className="space-y-1">
        {sources.map((s) => {
          const loc = locationLabel(s);
          const label = `[${s.index}] ${s.title} · v${s.version}${loc ? ` · ${loc}` : ""}`;
          // #page=N is honoured by PDF viewers only; the file route redirects to a short-lived signed URL.
          const href = s.documentId ? `/api/documents/${s.documentId}/file${s.fileExt === "pdf" && s.page ? `#page=${s.page}` : ""}` : null;
          return (
            <li key={s.index}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg bg-brand-50 px-2 py-1 font-medium text-brand-800 ring-1 ring-brand-100 transition-colors hover:bg-brand-100">{label}</a>
              ) : (
                <span>{label} (เอกสารนี้ถูกลบแล้ว / document removed)</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChatClient({ sessionId, initialMessages }: { sessionId: string | null; initialMessages: ChatMessage[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [sid, setSid] = useState(sessionId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setText("");
    setBusy(true);
    setMessages((m) => [...m, { id: `tmp-${crypto.randomUUID()}`, role: "user", content: message }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid ?? undefined, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Request failed.");
      setMessages((m) => [...m, { id: `a-${crypto.randomUUID()}`, role: "assistant", content: data.answer, answered: data.answered, sources: data.sources }]);
      if (!sid) {
        setSid(data.sessionId);
        window.history.replaceState(null, "", `/chat/${data.sessionId}`);
      }
      router.refresh(); // refresh the conversation list
    } catch (err) {
      setError((err as Error).message || "เกิดข้อผิดพลาด / Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-card shadow-card">
      <div className="flex-1 space-y-5 overflow-y-auto bg-linear-to-b from-slate-50/80 to-white p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="rise-in mx-auto mt-6 flex max-w-md flex-col items-center text-center sm:mt-12">
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-800 text-white shadow-glow">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <p className="text-lg font-semibold tracking-tight text-slate-900">มีอะไรให้ช่วยค้นหาไหม? / How can I help?</p>
            <p className="mt-2 text-sm text-slate-500">
              ถามคำถามเกี่ยวกับเอกสารของบริษัทได้เลย ระบบจะตอบจากเอกสารที่อัปโหลดเท่านั้น พร้อมแหล่งอ้างอิง<br />
              Ask about company documents. Answers come only from uploaded documents, with sources.
            </p>
          </div>
        )}
        {messages.map((m) => m.role === "user" ? (
          <div key={m.id} className="fade-in flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-linear-to-br from-brand-600 to-brand-800 px-4 py-2.5 text-sm text-white shadow-card">
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          </div>
        ) : (
          <div key={m.id} className="fade-in flex items-start gap-3">
            <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-ink text-brand-400 ring-1 ring-white/10">
              <Sparkles className="size-4" />
            </span>
            <div className={`min-w-0 max-w-[85%] rounded-2xl rounded-tl-md px-4 py-3 text-sm ${m.answered === false ? "border border-amber-200 bg-amber-50 text-slate-900" : "border border-slate-200/80 bg-white text-slate-900 shadow-card"}`}>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
              {m.sources && m.sources.length > 0 && <Sources sources={m.sources} />}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-3" role="status">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-ink text-brand-400"><Search className="size-4 animate-pulse" /></span>
            <span className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-2.5 text-sm text-slate-600 shadow-card">
              กำลังค้นหาในฐานความรู้… / Searching the knowledge base…
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={send} className="border-t border-slate-200/80 bg-white p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-2 transition-[border-color,box-shadow] focus-within:border-brand-600 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgb(92_185_70/0.15)]">
          <label htmlFor="chat-input" className="sr-only">คำถาม / Question</label>
          <textarea
            id="chat-input" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={MAX_QUESTION_CHARS}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            placeholder="พิมพ์คำถาม… (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่) / Type your question…"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-slate-400 focus-visible:outline-none"
          />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} className="size-10 rounded-xl" aria-label="ส่ง / Send">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="mt-2 px-1 text-[0.6875rem] text-slate-400">AI อาจผิดพลาดได้ ตรวจสอบกับเอกสารอ้างอิงทุกครั้ง / AI can make mistakes. Always check the cited sources.</p>
      </form>
    </div>
  );
}
