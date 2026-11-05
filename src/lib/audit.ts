import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Append-only audit write (service role). Failures are logged, never thrown into the user flow. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { error } = await createAdminClient().from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    metadata: entry.metadata ?? {},
  });
  if (error) console.error("[audit] write failed", { action: entry.action, message: error.message });
}
