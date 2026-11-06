import Link from "next/link";
import { History, MessageSquarePlus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SessionList } from "@/components/chat/session-list";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // RLS limits the query to the caller's own sessions, so it runs alongside the session check instead of after it.
  // Nothing renders unless requireUser() passes (it redirects otherwise).
  const [, { data: sessions }] = await Promise.all([
    requireUser(),
    supabase.from("chat_sessions").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(50),
  ]);

  return (
    <div className="grid gap-6 md:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside aria-label="Conversations" className="space-y-4">
        <Link href="/chat" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-b from-brand-600 to-brand-700 px-3 text-sm font-semibold text-white shadow-glow transition-transform hover:-translate-y-px pointer-coarse:min-h-11">
          <MessageSquarePlus className="size-4" aria-hidden />สนทนาใหม่ / New chat
        </Link>
        <div>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-400"><History className="size-3.5" aria-hidden />ประวัติ / History</p>
          {(sessions ?? []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-card/70 p-4 text-center text-xs text-slate-500">ยังไม่มีประวัติการสนทนา / No conversations yet.</p>
          ) : (
            <div className="max-h-[32vh] overflow-y-auto md:max-h-[calc(100vh-17rem)]">
              <SessionList sessions={(sessions ?? []).map((s) => ({ id: s.id, title: s.title }))} />
            </div>
          )}
        </div>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
