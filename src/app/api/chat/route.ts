import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiConfig } from "@/lib/ai-config";
import { MAX_QUESTION_CHARS } from "@/constants/ai";
import { embedQuery } from "@/services/ai/embedding.service";
import { generateText } from "@/services/ai/gemini.service";
import { searchChunks } from "@/services/ai/vector-search.service";
import { answerQuestion, type RagResult } from "@/services/ai/rag.service";
import { detectLanguage, UNAVAILABLE } from "@/services/ai/language";

export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
});

const RATE_LIMIT_PER_MINUTE = 15;

const err = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return err(401, "unauthenticated", "Please sign in.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err(400, "validation", "Invalid message.");
  const { message } = parsed.data;

  const supabase = await createClient(); // user-bound: RLS + permission-aware search
  const admin = createAdminClient(); // server-only writes (messages, sources, unanswered)

  // Rate limit (per user, last 60s, from actual message records) and the session lookup are independent:
  // one round trip instead of two.
  const since = new Date(Date.now() - 60_000).toISOString();
  let sessionId = parsed.data.sessionId;
  const [{ count }, existing] = await Promise.all([
    admin
      .from("chat_messages")
      .select("id, chat_sessions!inner(user_id)", { count: "exact", head: true })
      .eq("chat_sessions.user_id", user.id)
      .eq("role", "user")
      .gte("created_at", since),
    // The session must belong to the caller (RLS-checked).
    sessionId ? supabase.from("chat_sessions").select("id").eq("id", sessionId).maybeSingle() : null,
  ]);
  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) return err(429, "rate_limited", "Too many questions. Please wait a moment.");

  if (sessionId) {
    if (!existing?.data) return err(404, "not_found", "Conversation not found.");
  } else {
    const { data: s, error } = await supabase
      .from("chat_sessions").insert({ user_id: user.id, title: message.slice(0, 60) }).select("id").single();
    if (error || !s) return err(500, "server_error", "Could not start a conversation.");
    sessionId = s.id;
  }

  const lang = detectLanguage(message);
  const cfg = getAiConfig();
  // Saving the question runs while the AI works; it is awaited before the answer is stored, so the order is kept.
  const savedQuestion = (async () => admin.from("chat_messages").insert({ session_id: sessionId, role: "user", content: message, language: lang }))();

  const result: RagResult = cfg.apiKey
    ? await answerQuestion(message, lang, { topK: cfg.RAG_TOP_K, minSimilarity: cfg.RAG_MIN_SIMILARITY }, {
        embedQuery,
        search: (emb, k, min) => searchChunks(supabase, emb, k, min),
        generate: generateText,
      })
    : { answered: false, text: UNAVAILABLE[lang], reason: "ai_unavailable", topSimilarity: null }; // no key: no external calls
  await savedQuestion;

  // Independent writes run together; only the sources have to wait for the assistant message id.
  await Promise.all([
    (async () => {
      const { data: assistant } = await admin
        .from("chat_messages")
        .insert({ session_id: sessionId, role: "assistant", content: result.text, answered: result.answered, language: lang })
        .select("id").single();
      if (assistant && result.answered) {
        await admin.from("message_sources").insert(
          result.sources.map(({ index, chunk }) => ({
            message_id: assistant.id,
            source_index: index,
            chunk_id: chunk.chunk_id,
            document_id: chunk.document_id,
            version_id: chunk.version_id,
            document_title: chunk.document_title,
            version_number: chunk.version_number,
            file_ext: chunk.file_ext,
            page_number: chunk.page_number,
            section: chunk.section,
            similarity: chunk.similarity,
          })),
        );
      }
    })(),
    result.answered
      ? null
      : admin.from("unanswered_questions").insert({
          user_id: user.id, session_id: sessionId, question: message, language: lang,
          reason: result.reason, top_similarity: result.topSimilarity,
        }),
    admin.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId),
  ]);

  return NextResponse.json({
    sessionId,
    answer: result.text,
    answered: result.answered,
    sources: result.answered
      ? result.sources.map(({ index, chunk }) => ({
          index, documentId: chunk.document_id, title: chunk.document_title, version: chunk.version_number,
          page: chunk.page_number, section: chunk.section, fileExt: chunk.file_ext,
        }))
      : [],
  });
}
