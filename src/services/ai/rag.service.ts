import { validateCitations } from "./citation.service";
import { buildUserPrompt, SYSTEM_PROMPT, type PromptSource } from "./prompt.service";
import { FALLBACK, UNAVAILABLE, type Lang } from "./language";

export type RetrievedChunk = {
  chunk_id: string;
  document_id: string;
  version_id: string;
  content: string;
  page_number: number | null;
  section: string | null;
  similarity: number;
  document_title: string;
  version_number: number;
  file_ext: string;
};

export type RagDeps = {
  embedQuery: (q: string) => Promise<number[]>;
  /** Must run as the signed-in user so permission filtering happens inside SQL. */
  search: (embedding: number[], topK: number, minSimilarity: number) => Promise<RetrievedChunk[]>;
  generate: (system: string, user: string) => Promise<{ text: string; blocked: boolean }>;
};

export type UnansweredReason = "no_relevant_content" | "model_declined" | "no_valid_citation" | "ai_unavailable";

export type RagSource = {
  index: number;
  chunk: RetrievedChunk;
};

export type RagResult =
  | { answered: true; text: string; sources: RagSource[]; topSimilarity: number }
  | { answered: false; text: string; reason: UnansweredReason; topSimilarity: number | null };

export async function answerQuestion(
  question: string,
  lang: Lang,
  opts: { topK: number; minSimilarity: number },
  deps: RagDeps,
): Promise<RagResult> {
  let chunks: RetrievedChunk[];
  try {
    const embedding = await deps.embedQuery(question);
    chunks = await deps.search(embedding, opts.topK, opts.minSimilarity);
  } catch (e) {
    console.error("[rag] retrieval failed", String(e));
    return { answered: false, text: UNAVAILABLE[lang], reason: "ai_unavailable", topSimilarity: null };
  }

  // Weak evidence -> no model call at all.
  if (chunks.length === 0) {
    return { answered: false, text: FALLBACK[lang], reason: "no_relevant_content", topSimilarity: null };
  }
  const top = Math.max(...chunks.map((c) => c.similarity));

  const sources: RagSource[] = chunks.map((chunk, i) => ({ index: i + 1, chunk }));
  const promptSources: PromptSource[] = sources.map(({ index, chunk }) => ({
    index,
    title: chunk.document_title,
    versionNumber: chunk.version_number,
    page: chunk.page_number,
    section: chunk.section,
    content: chunk.content,
  }));

  let generated: { text: string; blocked: boolean };
  try {
    generated = await deps.generate(SYSTEM_PROMPT, buildUserPrompt(question, promptSources, lang));
  } catch (e) {
    console.error("[rag] generation failed", String(e));
    return { answered: false, text: UNAVAILABLE[lang], reason: "ai_unavailable", topSimilarity: top };
  }
  if (generated.blocked) return { answered: false, text: FALLBACK[lang], reason: "model_declined", topSimilarity: top };

  const checked = validateCitations(generated.text, sources.map((s) => s.index));
  if (checked.kind === "no_answer") return { answered: false, text: FALLBACK[lang], reason: "model_declined", topSimilarity: top };
  if (checked.kind === "uncited") return { answered: false, text: FALLBACK[lang], reason: "no_valid_citation", topSimilarity: top };

  // Only sources the answer actually cites are returned as references.
  return {
    answered: true,
    text: checked.text,
    sources: sources.filter((s) => checked.cited.includes(s.index)),
    topSimilarity: top,
  };
}
