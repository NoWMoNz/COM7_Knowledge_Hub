import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/documents";


/** Authorizes with the user's RLS-bound client, then redirects to a short-lived signed URL. */
export async function GET(request: Request, ctx: RouteContext<"/api/documents/[id]/file">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = await createClient();
  // RLS (can_access_document) decides whether this row is visible at all.
  const { data: doc } = await supabase.from("documents").select("id, current_version_id").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const requested = new URL(request.url).searchParams.get("version");
  let versionId = doc.current_version_id as string | null;
  if (requested) {
    // Only managers may open non-current versions.
    if (!hasPermission(user.permissions, PERMISSIONS.DOCUMENT_MANAGE) || !uuidSchema.safeParse(requested).success) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    versionId = requested;
  }
  if (!versionId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: version } = await supabase
    .from("document_versions").select("storage_path, document_id").eq("id", versionId).maybeSingle();
  if (!version || version.document_id !== id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: signed, error } = await createAdminClient().storage.from("documents").createSignedUrl(version.storage_path, 60);
  if (error || !signed) return NextResponse.json({ error: "unavailable" }, { status: 502 });
  return NextResponse.redirect(signed.signedUrl, 302);
}
