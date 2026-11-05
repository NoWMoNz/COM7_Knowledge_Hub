import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/documents";
import { PageHeader } from "@/components/ui/page-header";
import { ChatClient, type ChatMessage, type ChatSource } from "@/components/chat/chat-client";

export const metadata = { title: "AI Assistant" };

export default async function ChatSessionPage(props: PageProps<"/chat/[sessionId]">) {
  const { sessionId } = await props.params;
  if (!uuidSchema.safeParse(sessionId).success) notFound();

  const supabase = await createClient();
  // RLS: only the owner can read a session, so other users' ids simply 404.
  const { data: session } = await supabase.from("chat_sessions").select("id, title").eq("id", sessionId).maybeSingle();
  if (!session) notFound();

  const { data: rows } = await supabase
    .from("chat_messages").select("id, role, content, answered").eq("session_id", sessionId).order("created_at");
  const ids = (rows ?? []).map((r) => r.id);
  const { data: srcs } = ids.length
    ? await supabase.from("message_sources")
        .select("message_id, source_index, document_id, document_title, version_number, page_number, section, file_ext")
        .in("message_id", ids).order("source_index")
    : { data: [] };

  const byMessage = new Map<string, ChatSource[]>();
  (srcs ?? []).forEach((s) => {
    const list = byMessage.get(s.message_id) ?? [];
    list.push({ index: s.source_index, documentId: s.document_id, title: s.document_title, version: s.version_number, page: s.page_number, section: s.section, fileExt: s.file_ext });
    byMessage.set(s.message_id, list);
  });
  const messages: ChatMessage[] = (rows ?? []).map((r) => ({
    id: r.id, role: r.role, content: r.content, answered: r.answered, sources: byMessage.get(r.id),
  }));

  return (
    <div className="space-y-2">
      <PageHeader title={<span className="block truncate">{session.title}</span>} />
      <ChatClient key={sessionId} sessionId={sessionId} initialMessages={messages} />
    </div>
  );
}
