"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Trash2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteChatSessionAction } from "@/app/(employee)/chat/actions";

type Session = { id: string; title: string };

/** Conversation history with an active state and a per-conversation delete (confirmed, own chats only via RLS). */
export function SessionList({ sessions }: { sessions: Session[] }) {
  const pathname = usePathname() ?? "";
  return (
    <ul className="space-y-0.5">
      {sessions.map((s) => {
        const active = pathname === `/chat/${s.id}`;
        return (
          <li key={s.id} className={`group relative flex items-center rounded-xl transition-colors ${active ? "bg-white shadow-card ring-1 ring-slate-200/80" : "hover:bg-slate-900/[0.04]"}`}>
            <Link
              href={`/chat/${s.id}`}
              aria-current={active ? "page" : undefined}
              className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 pr-1 text-sm pointer-coarse:py-3"
            >
              <MessageSquare className={`size-4 shrink-0 ${active ? "text-brand-700" : "text-slate-400"}`} aria-hidden />
              <span className={`truncate ${active ? "font-semibold text-slate-900" : "text-slate-700"}`}>{s.title}</span>
            </Link>
            <form action={deleteChatSessionAction} className={`shrink-0 pr-1 transition-opacity ${active ? "opacity-100" : "opacity-100 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"}`}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="back" value={pathname} />
              <ConfirmSubmit
                variant="ghost"
                size="icon-sm"
                label={<><Trash2 aria-hidden /><span className="sr-only">ลบการสนทนา {s.title} / Delete conversation</span></>}
                title="ลบการสนทนานี้? / Delete this conversation?"
                description={<>&quot;{s.title}&quot; และข้อความทั้งหมดจะถูกลบถาวร / &quot;{s.title}&quot; and all its messages will be permanently deleted.</>}
                confirmLabel="ลบ / Delete"
              />
            </form>
          </li>
        );
      })}
    </ul>
  );
}
