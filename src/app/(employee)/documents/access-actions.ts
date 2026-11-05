"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation/documents";
import type { FormState } from "@/lib/auth/actions";

const TYPES = ["department", "role", "user"] as const;

/** Sets access_level and replaces grants. Grant values arrive as "type:uuid". */
export async function saveAccessAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission(PERMISSIONS.ACCESS_MANAGE);
  const id = uuidSchema.safeParse(fd.get("id"));
  const level = fd.get("level") === "restricted" ? "restricted" : "company";
  if (!id.success) return { error: "Invalid document." };

  const wanted = new Map<string, { grantee_type: string; grantee_id: string }>();
  if (level === "restricted") {
    for (const raw of fd.getAll("grant").map(String)) {
      const [type, gid] = raw.split(":");
      if ((TYPES as readonly string[]).includes(type) && uuidSchema.safeParse(gid).success) wanted.set(raw, { grantee_type: type, grantee_id: gid });
    }
  }

  const supabase = await createClient(); // RLS requires document:manage
  const { data: cur, error: curErr } = await supabase.from("document_access").select("grantee_type, grantee_id").eq("document_id", id.data);
  if (curErr) return { error: "Could not read current access." };
  const have = new Set((cur ?? []).map((g) => `${g.grantee_type}:${g.grantee_id}`));
  const add = [...wanted.entries()].filter(([k]) => !have.has(k)).map(([, v]) => ({ document_id: id.data, ...v }));
  const remove = [...have].filter((k) => !wanted.has(k));

  const { error: lvlErr } = await supabase.from("documents").update({ access_level: level }).eq("id", id.data);
  if (lvlErr) return { error: "Could not save access level." };
  if (add.length) {
    const { error } = await supabase.from("document_access").insert(add);
    if (error) return { error: "Could not save grants." };
  }
  for (const k of remove) {
    const [type, gid] = k.split(":");
    await supabase.from("document_access").delete().eq("document_id", id.data).eq("grantee_type", type).eq("grantee_id", gid);
  }
  await writeAudit({ actorId: actor.id, action: "document.access_change", resourceType: "document", resourceId: id.data, metadata: { level, added: add.length, removed: remove.length } });
  revalidatePath(`/documents/${id.data}`);
  return { success: level === "restricted" && wanted.size === 0 ? "บันทึกแล้ว: ขณะนี้เฉพาะผู้จัดการเอกสารเท่านั้นที่เห็น / Saved: only document managers can see it." : "บันทึกแล้ว / Saved." };
}
