import "server-only";
import { AiNotConfiguredError, getAiConfig } from "@/lib/ai-config";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
  /** Rate limits and server errors are worth retrying; other 4xx are not. */
  get retryable() {
    return this.status === 429 || this.status >= 500 || this.status === 0;
  }
}

async function post<T>(model: string, method: string, body: unknown): Promise<T> {
  const { apiKey } = getAiConfig();
  if (!apiKey) throw new AiNotConfiguredError();
  let res: Response;
  try {
    res = await fetch(`${BASE}/${model}:${method}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, // key in header, never in URL/logs
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new GeminiApiError(0, "Gemini request failed (network/timeout)");
  }
  if (!res.ok) throw new GeminiApiError(res.status, `Gemini ${method} returned ${res.status}`); // body intentionally not logged
  return (await res.json()) as T;
}

type EmbedResponse = { embedding?: { values?: number[] }; embeddings?: { values?: number[] }[] };

/** Raw batch embedding call. Accepts both the single and plural response shapes. */
export async function embedTexts(texts: string[], dimensions: number): Promise<number[][]> {
  const model = getAiConfig().GEMINI_EMBEDDING_MODEL;
  const data = await post<EmbedResponse>(model, "batchEmbedContents", {
    requests: texts.map((text) => ({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      output_dimensionality: dimensions,
    })),
  });
  const vectors = (data.embeddings ?? (data.embedding ? [data.embedding] : [])).map((e) => e.values);
  if (vectors.length !== texts.length || vectors.some((v) => !Array.isArray(v) || v.length !== dimensions)) {
    throw new GeminiApiError(502, "Unexpected embedding response shape");
  }
  return vectors as number[][];
}

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export type GenerateResult = { text: string; blocked: boolean };

export async function generateText(system: string, user: string): Promise<GenerateResult> {
  const data = await post<GenerateResponse>(getAiConfig().GEMINI_CHAT_MODEL, "generateContent", {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  });
  if (data.promptFeedback?.blockReason) return { text: "", blocked: true };
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  return { text, blocked: !text && cand?.finishReason === "SAFETY" };
}

export type PartsResult = { text: string; blocked: boolean; truncated: boolean };

/** Generic multimodal call (used by OCR). `parts` may include inline_data. */
export async function generateFromParts(system: string, parts: unknown[], maxOutputTokens: number): Promise<PartsResult> {
  const data = await post<GenerateResponse>(getAiConfig().GEMINI_CHAT_MODEL, "generateContent", {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0, maxOutputTokens },
  });
  if (data.promptFeedback?.blockReason) return { text: "", blocked: true, truncated: false };
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  return { text, blocked: !text && cand?.finishReason === "SAFETY", truncated: cand?.finishReason === "MAX_TOKENS" };
}
