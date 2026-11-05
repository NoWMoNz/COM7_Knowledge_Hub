import "server-only";
import { z } from "zod";

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default("gemini-embedding-2"),
  GEMINI_CHAT_MODEL: z.string().min(1).default("gemini-3.6-flash"),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
  RAG_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.5),
  OCR_PROVIDER: z.enum(["none", "gemini"]).default("none"),
});

export type AiConfig = Omit<z.infer<typeof schema>, "GEMINI_API_KEY"> & { apiKey: string | null };

/** Reads and validates AI settings; the API key is optional here so the app runs (and reports clearly) without it. */
export function getAiConfig(): AiConfig {
  const env = Object.fromEntries(
    Object.keys(schema.shape).map((k) => [k, process.env[k] === "" ? undefined : process.env[k]]),
  );
  const parsed = schema.parse(env);
  const { GEMINI_API_KEY, ...rest } = parsed;
  return { ...rest, apiKey: GEMINI_API_KEY ?? null };
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not configured");
  }
}
