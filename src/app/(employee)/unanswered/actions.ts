"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation/documents";

export async function setUnansweredStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.DOCUMENT_MANAGE);
  const id = uuidSchema.safeParse(formData.get("id"));
  const status = formData.get("status") === "resolved" ? "resolved" : "open";
  if (!id.success) return;
  const supabase = await createClient(); // RLS: only document managers can update
  const { error } = await supabase.from("unanswered_questions").update({ status }).eq("id", id.data);
  if (!error) {
    await writeAudit({ actorId: user.id, action: `unanswered.${status}`, resourceType: "unanswered_question", resourceId: id.data });
    revalidatePath("/unanswered");
  }
}
