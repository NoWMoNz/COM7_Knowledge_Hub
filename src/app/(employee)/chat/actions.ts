"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation/documents";

/**
 * Deletes one of the caller's own conversations. Uses the user's client, so RLS (`chat_sessions_own`:
 * user_id = auth.uid()) guarantees nobody can delete someone else's chat. Messages and their sources cascade;
 * unanswered-question records keep their text for managers (session_id is set to null by the FK).
 */
export async function deleteChatSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/chat");

  const supabase = await createClient();
  const { data: deleted, error } = await supabase.from("chat_sessions").delete().eq("id", id.data).select("id");
  if (!error && deleted && deleted.length > 0) {
    await writeAudit({ actorId: user.id, action: "chat.delete", resourceType: "chat_session", resourceId: id.data });
  }
  revalidatePath("/chat", "layout");
  // Stay where the user was unless they just deleted the conversation they were looking at.
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/chat/") && !back.endsWith(id.data) ? back : "/chat");
}
