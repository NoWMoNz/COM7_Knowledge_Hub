"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { runPendingJobs } from "@/services/documents/processing.service";

/** Kicks the queue now (also reclaims jobs stuck for 10+ minutes). Runs after the response is sent. */
export async function runQueueAction(): Promise<void> {
  const user = await requirePermission(PERMISSIONS.DOCUMENT_MANAGE);
  after(() => runPendingJobs(10).catch((e) => console.error("[queue] manual run failed", String(e))));
  await writeAudit({ actorId: user.id, action: "queue.run", resourceType: "processing_jobs" });
  redirect("/admin/documents?started=1");
}
