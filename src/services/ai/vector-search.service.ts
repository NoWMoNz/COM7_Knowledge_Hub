import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedChunk } from "./rag.service";

/**
 * Permission-aware semantic search. `supabase` MUST be the signed-in user's client (not the service role):
 * match_document_chunks runs as that user, so RLS and can_access_document() filter inside the query itself.
 */
export async function searchChunks(
  supabase: SupabaseClient,
  embedding: number[],
  topK: number,
  minSimilarity: number,
): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: topK,
    min_similarity: minSimilarity,
  });
  if (error) throw new Error(`match_document_chunks failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}
