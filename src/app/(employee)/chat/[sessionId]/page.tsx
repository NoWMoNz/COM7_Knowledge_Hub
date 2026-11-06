import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/documents";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteChatSessionAction } from "../actions";
import { ChatClient, type ChatMessage, type ChatSource } from "@/components/chat/chat-client";

export const metadata = { title: "AI Assistant" };

export default async function ChatSessionPage(props: PageProps<"/chat/[sessionId]">) {
  const { sessionId } = await props.params;
  if (!uuidSchema.safeParse(sessionId).success) notFound();

  const supabase = await createClient();
  // RLS: only the owner can read a session (and its messages/sources), so other users' ids simply 404.
  // One round trip: the session and its messages (with sources embedded) are fetched together.
  const [{ data: session }, { data: rows }] = await Promise.all([
    supabase.from("chat_sessions").select("id, title").eq("id", sessionId).maybeSingle(),
    supabase.from("chat_messages")
      .select("id, role, content, answered, message_sources(source_index, document_id, document_title, version_number, page_number, section, file_ext)")
      .eq("session_id", sessionId).order("created_at").order("source_index", { referencedTable: "message_sources" }),
  ]);
  if (!session) notFound();

  type SourceRow = { source_index: number; document_id: string | null; document_title: string; version_number: number; page_number: number | null; section: string | null; file_ext: string | null };
  const messages: ChatMessage[] = (rows ?? []).map((r) => {
    const srcs = (r.message_sources ?? []) as SourceRow[];
    const sources: ChatSource[] = srcs.map((s) => ({ index: s.source_index, documentId: s.document_id, title: s.document_title, version: s.version_number, page: s.page_number, section: s.section, fileExt: s.file_ext }));
    return { id: r.id, role: r.role, content: r.content, answered: r.answered, sources: sources.length ? sources : undefined };
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title={<span className="block truncate">{session.title}</span>}
        actions={
          <form action={deleteChatSessionAction}>
            <input type="hidden" name="id" value={session.id} />
            <ConfirmSubmit
              label={<><Trash2 aria-hidden />ลบการสนทนา / Delete</>}
              title="ลบการสนทนานี้? / Delete this conversation?"
              description={<>&quot;{session.title}&quot; และข้อความทั้งหมดจะถูกลบถาวร / &quot;{session.title}&quot; and all its messages will be permanently deleted.</>}
              confirmLabel="ลบ / Delete"
            />
          </form>
        }
      />
      <ChatClient key={sessionId} sessionId={sessionId} initialMessages={messages} />
    </div>
  );
}
