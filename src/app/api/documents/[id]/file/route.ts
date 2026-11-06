import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/documents";
import { decodeText } from "@/lib/utils/text";


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
    .from("document_versions").select("storage_path, document_id, file_ext, original_filename").eq("id", versionId).maybeSingle();
  if (!version || version.document_id !== id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (version.file_ext === "txt") {
    // Storage serves .txt as "text/plain" with no charset, so browsers guess the encoding and Thai turns into mojibake.
    // Serve text files ourselves, always as UTF-8 (legacy windows-874 files are converted). text/plain + nosniff
    // (global header) means the content is never rendered as HTML.
    const { data: blob, error } = await createAdminClient().storage.from("documents").download(version.storage_path);
    if (error || !blob) return NextResponse.json({ error: "unavailable" }, { status: 502 });
    const text = decodeText(new Uint8Array(await blob.arrayBuffer()));
    const name = String(version.original_filename ?? "document.txt");
    return new NextResponse(text, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `inline; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "private, no-store",
      },
    });
  }

  const { data: signed, error } = await createAdminClient().storage.from("documents").createSignedUrl(version.storage_path, 60);
  if (error || !signed) return NextResponse.json({ error: "unavailable" }, { status: 502 });
  return NextResponse.redirect(signed.signedUrl, 302);
}
