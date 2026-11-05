import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("chat_sessions").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(50);

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <aside aria-label="Conversations" className="space-y-2">
        <Link href="/chat" className="flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-brand-800 pointer-coarse:min-h-11">
          <MessageSquarePlus className="size-4" aria-hidden />สนทนาใหม่ / New conversation
        </Link>
        {(sessions ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-card p-4 text-center text-xs text-slate-500">ยังไม่มีประวัติการสนทนา / No conversations yet.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {(sessions ?? []).map((s) => (
              <li key={s.id}>
                <Link href={`/chat/${s.id}`} className="block truncate rounded-md px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-200 pointer-coarse:py-3">{s.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section>{children}</section>
    </div>
  );
}
