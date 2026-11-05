import "server-only";
import { EMBEDDING_DIMENSIONS, EMBED_BATCH_SIZE } from "@/constants/ai";
import { embedTexts } from "./gemini.service";

/** gemini-embedding-2 has no task_type; the task is expressed as a text prefix (asymmetric retrieval). */
export const documentPrompt = (title: string, text: string) => `title: ${title || "none"} | text: ${text}`;
export const queryPrompt = (text: string) => `task: search result | query: ${text}`;

export function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

export async function embedQuery(question: string): Promise<number[]> {
  const [v] = await embedTexts([queryPrompt(question)], EMBEDDING_DIMENSIONS);
  return l2Normalize(v);
}

/** Embeds chunk texts in batches; output order matches input order. */
export async function embedDocumentChunks(title: string, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE).map((t) => documentPrompt(title, t));
    out.push(...(await embedTexts(batch, EMBEDDING_DIMENSIONS)).map(l2Normalize));
  }
  return out;
}
