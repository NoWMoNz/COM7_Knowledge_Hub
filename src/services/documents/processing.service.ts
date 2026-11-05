import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractSegments, ExtractionError } from "./extraction.service";
import { buildChunks } from "./chunking.service";
import type { FileExt } from "@/constants/documents";
import { AiNotConfiguredError, getAiConfig } from "@/lib/ai-config";
import { embedDocumentChunks } from "@/services/ai/embedding.service";
import { GeminiApiError } from "@/services/ai/gemini.service";

type Job = { id: string; version_id: string; attempts: number; max_attempts: number };

const BUCKET = "documents";

async function failPermanently(job: Job, code: string, message: string) {
  const sb = createAdminClient();
  await sb.from("processing_jobs").update({ status: "failed", last_error: message, locked_at: null }).eq("id", job.id);
  await sb
    .from("document_versions")
    .update({ status: "failed", error_code: code, error_message: message })
    .eq("id", job.version_id);
}

async function processJob(job: Job): Promise<void> {
  const sb = createAdminClient();
  try {
    const { data: version, error } = await sb
      .from("document_versions")
      .select("id, file_ext, storage_path, documents!document_versions_document_id_fkey(title)")
      .eq("id", job.version_id)
      .single();
    if (error || !version) throw new ExtractionError("version_missing", "Document version no longer exists.");

    const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(version.storage_path);
    if (dlErr || !blob) throw new Error(`storage download failed: ${dlErr?.message}`); // transient -> retry

    const segments = await extractSegments(version.file_ext as FileExt, Buffer.from(await blob.arrayBuffer()));
    const chunks = buildChunks(segments);
    if (chunks.length === 0) throw new ExtractionError("empty_content", "No readable text was found in this file.");

    // Embeddings are part of processing: a version is Ready only once the AI can search it.
    const docRel = version.documents as { title: string } | { title: string }[] | null;
    const title = (Array.isArray(docRel) ? docRel[0]?.title : docRel?.title) ?? "";
    let vectors: number[][];
    try {
      vectors = await embedDocumentChunks(title, chunks.map((c) => c.content));
    } catch (e) {
      if (e instanceof AiNotConfiguredError) {
        throw new ExtractionError("ai_not_configured", "AI embedding is not configured (GEMINI_API_KEY missing). Retry after configuring it.");
      }
      if (e instanceof GeminiApiError && !e.retryable) {
        throw new ExtractionError("embedding_rejected", "The embedding service rejected the request. Check the API key and model settings.");
      }
      if (e instanceof GeminiApiError && e.status === 429) await new Promise((r) => setTimeout(r, 2000 * job.attempts));
      throw e; // transient: handled by the retry logic below
    }
    const model = getAiConfig().GEMINI_EMBEDDING_MODEL;
    const withVectors = chunks.map((c, i) => ({ ...c, embedding: vectors[i], embedding_model: model }));

    const { error: rpcErr } = await sb.rpc("complete_version_processing", {
      p_version_id: version.id,
      p_chunks: withVectors,
    });
    if (rpcErr) throw new Error(`complete_version_processing failed: ${rpcErr.message}`);
  } catch (e) {
    if (e instanceof ExtractionError && !e.retryable) {
      await failPermanently(job, e.code, e.message);
      return;
    }
    console.error("[processing] job error", { jobId: job.id, attempt: job.attempts, error: String(e) });
    if (job.attempts >= job.max_attempts) {
      await failPermanently(job, "processing_error", "Processing failed after several attempts. Please retry later.");
    } else {
      await sb.from("processing_jobs").update({ status: "queued", last_error: "transient error", locked_at: null }).eq("id", job.id);
    }
  }
}

/** Claims and processes queued jobs (SKIP LOCKED makes concurrent runners safe). Returns number handled. */
export async function runPendingJobs(max = 5): Promise<number> {
  const sb = createAdminClient();
  let handled = 0;
  while (handled < max) {
    const { data, error } = await sb.rpc("claim_processing_job");
    if (error) {
      console.error("[processing] claim failed", error.message);
      break;
    }
    const job = (Array.isArray(data) ? data[0] : data) as Job | null | undefined;
    if (!job?.id) break;
    await processJob(job);
    handled++;
  }
  return handled;
}

/** Manual retry of a failed version: resets the job; chunks are replaced idempotently on completion. */
export async function requeueVersion(versionId: string): Promise<boolean> {
  const sb = createAdminClient();
  const { data: v } = await sb.from("document_versions").select("id, status").eq("id", versionId).single();
  if (!v || v.status !== "failed") return false;
  await sb.from("document_versions").update({ status: "processing", error_code: null, error_message: null }).eq("id", versionId);
  const { error } = await sb
    .from("processing_jobs")
    .upsert({ version_id: versionId, status: "queued", attempts: 0, last_error: null, locked_at: null }, { onConflict: "version_id" });
  return !error;
}

/**
 * Re-embeds Ready versions whose chunks lack embeddings (documents processed before Phase 3, or after a model change).
 * The version stays Ready/searchable meanwhile: chunks are replaced atomically on completion.
 */
export async function requeueUnembedded(): Promise<number> {
  const sb = createAdminClient();
  const { data } = await sb.from("document_chunks").select("version_id").is("embedding", null).limit(5000);
  const ids = [...new Set((data ?? []).map((r) => r.version_id as string))];
  if (ids.length === 0) return 0;
  const { error } = await sb.from("processing_jobs").upsert(
    ids.map((version_id) => ({ version_id, status: "queued", attempts: 0, last_error: null, locked_at: null })),
    { onConflict: "version_id" },
  );
  return error ? 0 : ids.length;
}
