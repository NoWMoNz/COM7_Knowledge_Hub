import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Call } from "./helpers/fake-supabase";

const h = vi.hoisted(() => ({ fake: null as unknown, embed: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => (h.fake as { client: unknown }).client }));
vi.mock("@/services/ai/embedding.service", () => ({ embedDocumentChunks: h.embed }));

import { requeueUnembedded, requeueVersion, runPendingJobs } from "@/services/documents/processing.service";
import { AiNotConfiguredError } from "@/lib/ai-config";
import { GeminiApiError } from "@/services/ai/gemini.service";

const NO_TEXT_PDF =
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF";

type Setup = { ext?: string; body?: BlobPart; attempts?: number; maxAttempts?: number; completeError?: string };

function setup({ ext = "txt", body = "Sick leave needs notice.\n\nBenefits are listed in the handbook.", attempts = 1, maxAttempts = 3, completeError }: Setup = {}) {
  let claimed = false;
  const fake = fakeSupabase(
    (table, calls: Call[]) => {
      if (table === "document_versions" && calls.some((c) => c.method === "single")) {
        return { data: { id: "v1", file_ext: ext, storage_path: "d/v1." + ext, documents: { title: "Handbook" } } };
      }
      return undefined;
    },
    (name) => {
      if (name === "claim_processing_job") {
        if (claimed) return { data: null };
        claimed = true;
        return { data: { id: "j1", version_id: "v1", attempts, max_attempts: maxAttempts } };
      }
      if (name === "complete_version_processing" && completeError) return { error: { message: completeError } };
      return { data: null };
    },
  );
  fake.storageDownload.mockResolvedValue({ data: new Blob([body]), error: null });
  h.fake = fake;
  return fake;
}

const updates = (f: ReturnType<typeof setup>, table: string) => f.ops(table, "update").map((c) => c.args[0] as Record<string, unknown>);

beforeEach(() => {
  h.embed.mockReset();
  h.embed.mockImplementation(async (_t: string, texts: string[]) => texts.map(() => [0.1, 0.2]));
});

describe("document processing worker", () => {
  it("success: chunks + embeddings are stored through one atomic RPC; nothing is marked failed", async () => {
    const f = setup();
    expect(await runPendingJobs()).toBe(1);
    const call = f.rpcLog.find((r) => r.name === "complete_version_processing")!;
    const args = call.args as { p_version_id: string; p_chunks: { content: string; embedding: number[]; embedding_model: string; chunk_index: number }[] };
    expect(args.p_version_id).toBe("v1");
    expect(args.p_chunks.length).toBeGreaterThan(0);
    expect(args.p_chunks.every((c) => c.embedding.length === 2 && c.embedding_model)).toBe(true);
    expect(args.p_chunks.map((c) => c.chunk_index)).toEqual(args.p_chunks.map((_, i) => i));
    expect(updates(f, "processing_jobs")).toHaveLength(0);
    expect(updates(f, "document_versions")).toHaveLength(0);
    expect(h.embed).toHaveBeenCalledWith("Handbook", expect.any(Array));
  });

  it("scanned PDF (no text layer): fails permanently as needs_ocr, no retry, no embedding call", async () => {
    const f = setup({ ext: "pdf", body: NO_TEXT_PDF });
    await runPendingJobs();
    expect(updates(f, "document_versions")[0]).toMatchObject({ status: "failed", error_code: "needs_ocr" });
    expect(updates(f, "processing_jobs")[0]).toMatchObject({ status: "failed" });
    expect(h.embed).not.toHaveBeenCalled();
    expect(f.rpcLog.some((r) => r.name === "complete_version_processing")).toBe(false);
  });

  it("empty document: fails with empty_content", async () => {
    const f = setup({ body: "   \n\n  " });
    await runPendingJobs();
    expect(updates(f, "document_versions")[0]).toMatchObject({ status: "failed", error_code: "empty_content" });
  });

  it("transient embedding error with attempts left: job re-queued, document NOT marked failed", async () => {
    const f = setup({ attempts: 1 });
    h.embed.mockRejectedValue(new GeminiApiError(503, "unavailable"));
    await runPendingJobs();
    expect(updates(f, "processing_jobs")[0]).toMatchObject({ status: "queued" });
    expect(updates(f, "document_versions")).toHaveLength(0);
  });

  it("transient error on the last attempt: marked failed with a safe message", async () => {
    const f = setup({ attempts: 3, maxAttempts: 3 });
    h.embed.mockRejectedValue(new GeminiApiError(503, "unavailable"));
    await runPendingJobs();
    const v = updates(f, "document_versions")[0];
    expect(v).toMatchObject({ status: "failed", error_code: "processing_error" });
    expect(String(v.error_message)).not.toMatch(/503|gemini/i);
  });

  it("missing API key: permanent ai_not_configured failure (retry after configuring)", async () => {
    const f = setup();
    h.embed.mockRejectedValue(new AiNotConfiguredError());
    await runPendingJobs();
    expect(updates(f, "document_versions")[0]).toMatchObject({ status: "failed", error_code: "ai_not_configured" });
  });

  it("embedding API rejects the request (4xx): permanent embedding_rejected", async () => {
    const f = setup();
    h.embed.mockRejectedValue(new GeminiApiError(400, "bad"));
    await runPendingJobs();
    expect(updates(f, "document_versions")[0]).toMatchObject({ status: "failed", error_code: "embedding_rejected" });
  });

  it("database failure while completing is treated as transient", async () => {
    const f = setup({ completeError: "deadlock" });
    await runPendingJobs();
    expect(updates(f, "processing_jobs")[0]).toMatchObject({ status: "queued" });
    expect(updates(f, "document_versions")).toHaveLength(0);
  });

  it("storage download failure is transient", async () => {
    const f = setup();
    f.storageDownload.mockResolvedValue({ data: null as unknown as Blob, error: { message: "timeout" } });
    await runPendingJobs();
    expect(updates(f, "processing_jobs")[0]).toMatchObject({ status: "queued" });
  });

  it("returns 0 when the queue is empty", async () => {
    h.fake = fakeSupabase(() => undefined, () => ({ data: null }));
    expect(await runPendingJobs()).toBe(0);
  });
});

describe("retry / re-index", () => {
  it("retry resets a failed version and its job (attempts back to 0)", async () => {
    const f = fakeSupabase((table) => (table === "document_versions" ? { data: { id: "v1", status: "failed" } } : undefined));
    h.fake = f;
    expect(await requeueVersion("v1")).toBe(true);
    expect(f.ops("document_versions", "update")[0].args[0]).toMatchObject({ status: "processing", error_code: null });
    expect(f.ops("processing_jobs", "upsert")[0].args[0]).toMatchObject({ version_id: "v1", status: "queued", attempts: 0 });
  });

  it("retry refuses versions that are not failed", async () => {
    const f = fakeSupabase((table) => (table === "document_versions" ? { data: { id: "v1", status: "ready" } } : undefined));
    h.fake = f;
    expect(await requeueVersion("v1")).toBe(false);
    expect(f.ops("processing_jobs", "upsert")).toHaveLength(0);
  });

  it("re-index queues each version with missing embeddings once", async () => {
    const f = fakeSupabase((table) => (table === "document_chunks" ? { data: [{ version_id: "a" }, { version_id: "a" }, { version_id: "b" }] } : undefined));
    h.fake = f;
    expect(await requeueUnembedded()).toBe(2);
    expect((f.ops("processing_jobs", "upsert")[0].args[0] as unknown[]).length).toBe(2);
  });

  it("re-index does nothing when everything is embedded", async () => {
    const f = fakeSupabase((table) => (table === "document_chunks" ? { data: [] } : undefined));
    h.fake = f;
    expect(await requeueUnembedded()).toBe(0);
    expect(f.ops("processing_jobs", "upsert")).toHaveLength(0);
  });
});
