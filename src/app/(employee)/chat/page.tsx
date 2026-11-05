import { ChatClient } from "@/components/chat/chat-client";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "AI Assistant" };

export default function NewChatPage() {
  return (
    <div className="space-y-2">
      <PageHeader title="ผู้ช่วย AI / AI Assistant" description="คำตอบอ้างอิงจากเอกสารที่เผยแพร่ในระบบเท่านั้น และแสดงแหล่งที่มาทุกครั้ง / Answers come only from published documents, with sources." />
      <ChatClient key="new" sessionId={null} initialMessages={[]} />
    </div>
  );
}
