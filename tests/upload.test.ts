import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Call, type Result } from "./helpers/fake-supabase";

const h = vi.hoisted(() => ({ fake: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => (h.fake as { client: unknown }).client }));

import { createUpload } from "@/services/documents/upload.service";
import { UploadValidationError } from "@/services/documents/file-validation.service";

type Opts = { dup?: unknown[]; lastVersion?: number; docExists?: boolean; storageError?: boolean; versionInsertError?: boolean };

function setup({ dup = [], lastVersion, docExists = true, storageError = false, versionInsertError = false }: Opts = {}) {
  const fake = fakeSupabase((table: string, calls: Call[]): Result | undefined => {
    const m = (name: string) => calls.some((c) => c.method === name);
    if (table === "document_versions") {
      if (m("insert")) return versionInsertError ? { error: { message: "boom" } } : undefined;
      if (m("limit") && m("neq")) return { data: dup }; // duplicate check
      if (m("order")) return { data: lastVersion ? [{ version_number: lastVersion }] : [] }; // latest version number
    }
    if (table === "documents") {
      if (m("insert")) return { data: { id: "new-doc" } };
      if (m("single")) return docExists ? { data: { id: "doc-1" } } : { data: null };
    }
    return undefined;
  });
  if (storageError) fake.storageUpload.mockResolvedValue({ data: null as never, error: { message: "bucket missing" } });
  h.fake = fake;
  return fake;
}

const base = { actorId: "u1", actorName: "KM", filename: "handbook.txt", buffer: Buffer.from("Hello policy text") };
const inserted = (f: ReturnType<typeof setup>, table: string) => f.ops(table, "insert").map((c) => c.args[0] as Record<string, unknown>);

beforeEach(() => {
  h.fake = null;
});

describe("createUpload", () => {
  it("new document: v1 row, private path from ids (never the filename), queued job, audit", async () => {
    const f = setup();
    const r = await createUpload({ ...base, filename: "../../evil name.txt", title: "Handbook", categoryId: null });
    expect(r).toMatchObject({ documentId: "new-doc", versionNumber: 1 });
    const v = inserted(f, "document_versions")[0];
    expect(v).toMatchObject({ document_id: "new-doc", version_number: 1, status: "uploading", uploaded_by: "u1", uploaded_by_name: "KM", file_ext: "txt", original_filename: "evil name.txt" });
    expect(String(v.storage_path)).toMatch(/^new-doc\/[0-9a-f-]{36}\.txt$/);
    expect(String(v.file_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(f.storageUpload).toHaveBeenCalledTimes(1);
    expect(inserted(f, "processing_jobs")[0]).toMatchObject({ status: "queued" });
    expect(f.ops("document_versions", "update")[0].args[0]).toMatchObject({ status: "processing" }); // only after the file is stored
    expect(inserted(f, "audit_logs")[0]).toMatchObject({ action: "document.upload", actor_id: "u1" });
  });

  it("replacement: next version number, previous version stays active, audited as replace", async () => {
    const f = setup({ lastVersion: 2 });
    const r = await createUpload({ ...base, documentId: "doc-1" });
    expect(r).toMatchObject({ documentId: "doc-1", versionNumber: 3 });
    expect(inserted(f, "documents")).toHaveLength(0); // no new document
    expect(f.ops("documents", "update")[0].args[0]).toEqual({ latest_version_id: r.versionId }); // current_version_id untouched
    expect(inserted(f, "audit_logs")[0]).toMatchObject({ action: "document.replace" });
  });

  it("replacing a document that does not exist is rejected before anything is stored", async () => {
    const f = setup({ docExists: false });
    await expect(createUpload({ ...base, documentId: "ghost" })).rejects.toMatchObject({ code: "not_found" });
    expect(f.storageUpload).not.toHaveBeenCalled();
  });

  it("duplicate content is rejected (409 path) and nothing is created", async () => {
    const f = setup({ dup: [{ document_id: "d9", documents: { title: "Existing" } }] });
    const err = await createUpload(base).catch((e) => e);
    expect(err).toBeInstanceOf(UploadValidationError);
    expect(err).toMatchObject({ code: "duplicate" });
    expect(err.message).toContain("Existing");
    expect(inserted(f, "documents")).toHaveLength(0);
    expect(f.storageUpload).not.toHaveBeenCalled();
  });

  it("storage failure rolls back the version and the just-created document", async () => {
    const f = setup({ storageError: true });
    await expect(createUpload(base)).rejects.toThrow(/storage upload failed/);
    expect(f.ops("document_versions", "delete")).toHaveLength(1);
    expect(f.ops("documents", "delete")).toHaveLength(1);
    expect(inserted(f, "processing_jobs")).toHaveLength(0);
  });

  it("storage failure on a replacement keeps the existing document", async () => {
    const f = setup({ storageError: true, lastVersion: 1 });
    await expect(createUpload({ ...base, documentId: "doc-1" })).rejects.toThrow();
    expect(f.ops("document_versions", "delete")).toHaveLength(1);
    expect(f.ops("documents", "delete")).toHaveLength(0);
  });

  it("version insert failure rolls back a new document", async () => {
    const f = setup({ versionInsertError: true });
    await expect(createUpload(base)).rejects.toThrow(/version insert failed/);
    expect(f.ops("documents", "delete")).toHaveLength(1);
    expect(f.storageUpload).not.toHaveBeenCalled();
  });

  it("rejects bad content / type / empty files before touching the database", async () => {
    const f = setup();
    await expect(createUpload({ ...base, filename: "x.exe" })).rejects.toMatchObject({ code: "unsupported_type" });
    await expect(createUpload({ ...base, filename: "x.pdf", buffer: Buffer.from("not a pdf") })).rejects.toMatchObject({ code: "content_mismatch" });
    await expect(createUpload({ ...base, buffer: Buffer.alloc(0) })).rejects.toMatchObject({ code: "empty_file" });
    expect(f.log).toHaveLength(0);
  });

  it("a failing duplicate check stops the upload instead of being skipped", async () => {
    const fake = fakeSupabase((table, calls) => (table === "document_versions" && calls.some((c) => c.method === "neq") ? { error: { message: "PGRST201 ambiguous" } } : undefined));
    h.fake = fake;
    await expect(createUpload(base)).rejects.toThrow(/duplicate check failed/);
    expect(fake.storageUpload).not.toHaveBeenCalled();
  });
});
