"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Send } from "lucide-react";
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
    <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600">
      <p className="mb-1 font-medium">แหล่งที่มา / Sources</p>
      <ul className="space-y-1">
        {sources.map((s) => {
          const loc = locationLabel(s);
          const label = `[${s.index}] ${s.title} · v${s.version}${loc ? ` · ${loc}` : ""}`;
          // #page=N is honoured by PDF viewers only; the file route redirects to a short-lived signed URL.
          const href = s.documentId ? `/api/documents/${s.documentId}/file${s.fileExt === "pdf" && s.page ? `#page=${s.page}` : ""}` : null;
          return (
            <li key={s.index}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">{label}</a>
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
    <div className="flex h-[calc(100vh-15rem)] min-h-96 flex-col overflow-hidden rounded-lg border border-border bg-slate-50 shadow-card">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-500">
            ถามคำถามเกี่ยวกับเอกสารของบริษัทได้เลย ระบบจะตอบจากเอกสารที่อัปโหลดเท่านั้น<br />
            Ask a question about company documents. Answers come only from uploaded documents.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${m.role === "user" ? "bg-brand-700 text-white" : m.answered === false ? "border border-amber-200 bg-amber-50 text-slate-900" : "border border-border bg-card text-slate-900 shadow-card"}`}>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m.sources && m.sources.length > 0 && <Sources sources={m.sources} />}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-600" role="status">
            <Search className="size-4 animate-pulse" aria-hidden />
            กำลังค้นหาในฐานความรู้… / Searching the knowledge base…
          </div>
        )}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-slate-200 bg-card p-3">
        <label htmlFor="chat-input" className="sr-only">คำถาม / Question</label>
        <textarea
          id="chat-input" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={MAX_QUESTION_CHARS}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          placeholder="พิมพ์คำถาม… / Type your question…"
          className="flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors hover:border-slate-500 focus-visible:border-ring"
        />
        <Button type="submit" disabled={busy || !text.trim()} className="self-end bg-brand-700 hover:bg-brand-800" aria-label="ส่ง / Send">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
