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

async function request(model: string, method: string, body: unknown, query = ""): Promise<Response> {
  const { apiKey } = getAiConfig();
  if (!apiKey) throw new AiNotConfiguredError();
  let res: Response;
  try {
    res = await fetch(`${BASE}/${model}:${method}${query}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, // key in header, never in URL/logs
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000), // covers reading a streamed body too
    });
  } catch {
    throw new GeminiApiError(0, "Gemini request failed (network/timeout)");
  }
  if (!res.ok) throw new GeminiApiError(res.status, `Gemini ${method} returned ${res.status}`); // body intentionally not logged
  return res;
}

async function post<T>(model: string, method: string, body: unknown): Promise<T> {
  return (await (await request(model, method, body)).json()) as T;
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
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export type GenerateResult = { text: string; blocked: boolean };

const answerText = (data: GenerateResponse) =>
  (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");

/**
 * Chat answer. With `onDelta`, the answer is streamed (SSE) and each new piece of text is passed to it as it
 * arrives; the resolved result is the same full text either way.
 */
export async function generateText(system: string, user: string, onDelta?: (text: string) => void): Promise<GenerateResult> {
  const { GEMINI_CHAT_MODEL, GEMINI_THINKING_LEVEL } = getAiConfig();
  const thinking = GEMINI_THINKING_LEVEL === "default" ? {} : { thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL.toUpperCase() } };
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048, ...thinking },
  };

  if (!onDelta) {
    const data = await post<GenerateResponse>(GEMINI_CHAT_MODEL, "generateContent", body);
    if (data.promptFeedback?.blockReason) return { text: "", blocked: true };
    const text = answerText(data).trim();
    return { text, blocked: !text && data.candidates?.[0]?.finishReason === "SAFETY" };
  }

  const res = await request(GEMINI_CHAT_MODEL, "streamGenerateContent", body, "?alt=sse");
  if (!res.body) throw new GeminiApiError(502, "Gemini stream had no body");
  let text = "";
  let blocked = false;
  let finishReason: string | undefined;
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    let data: GenerateResponse;
    try {
      data = JSON.parse(line.slice(5)) as GenerateResponse;
    } catch {
      throw new GeminiApiError(502, "Unexpected stream event");
    }
    if (data.promptFeedback?.blockReason) blocked = true;
    finishReason = data.candidates?.[0]?.finishReason ?? finishReason;
    const piece = answerText(data);
    if (piece && !blocked) {
      text += piece;
      onDelta(piece);
    }
  };
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      lines.forEach(handle);
    }
    handle(buffer);
  } catch (e) {
    if (e instanceof GeminiApiError) throw e;
    throw new GeminiApiError(0, "Gemini stream interrupted (network/timeout)");
  }
  if (blocked) return { text: "", blocked: true };
  text = text.trim();
  return { text, blocked: !text && finishReason === "SAFETY" };
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
