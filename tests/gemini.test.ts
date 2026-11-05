import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { embedTexts, generateText, GeminiApiError } from "@/services/ai/gemini.service";
import { AiNotConfiguredError } from "@/lib/ai-config";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const vec = (n: number) => Array.from({ length: n }, () => 0.1);

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key-123";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe("gemini.service (mocked fetch; no real API call)", () => {
  it("sends the key in a header, never in the URL, and uses the configured model", async () => {
    const f = vi.fn(async () => json({ embeddings: [{ values: vec(4) }] }));
    vi.stubGlobal("fetch", f);
    await embedTexts(["hello"], 4);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("gemini-embedding-2:batchEmbedContents");
    expect(url).not.toContain("test-key-123");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key-123");
    expect(JSON.parse(init.body as string).requests[0].output_dimensionality).toBe(4);
  });

  it("accepts plural and singular embedding response shapes, rejects wrong dimensions/counts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ embedding: { values: vec(4) } })));
    expect(await embedTexts(["a"], 4)).toHaveLength(1);
    vi.stubGlobal("fetch", vi.fn(async () => json({ embeddings: [{ values: vec(3) }] })));
    await expect(embedTexts(["a"], 4)).rejects.toBeInstanceOf(GeminiApiError);
    vi.stubGlobal("fetch", vi.fn(async () => json({ embeddings: [{ values: vec(4) }] })));
    await expect(embedTexts(["a", "b"], 4)).rejects.toBeInstanceOf(GeminiApiError);
  });

  it("classifies errors: 429/5xx/network retryable, 400/403 not", async () => {
    for (const [status, retryable] of [[429, true], [503, true], [400, false], [403, false]] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => json({ error: "x" }, status)));
      const e = await embedTexts(["a"], 4).catch((x) => x);
      expect(e).toBeInstanceOf(GeminiApiError);
      expect(e.retryable).toBe(retryable);
    }
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect((await embedTexts(["a"], 4).catch((x) => x)).retryable).toBe(true);
  });

  it("error messages never include the response body or key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { message: "secret detail test-key-123" } }, 400)));
    const e = await embedTexts(["a"], 4).catch((x) => x);
    expect(e.message).not.toContain("secret detail");
    expect(e.message).not.toContain("test-key-123");
  });

  it("generateText joins parts and reports safety blocks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ candidates: [{ content: { parts: [{ text: "Hello " }, { text: "[1]" }] } }] })));
    expect(await generateText("sys", "user")).toEqual({ text: "Hello [1]", blocked: false });
    vi.stubGlobal("fetch", vi.fn(async () => json({ promptFeedback: { blockReason: "SAFETY" } })));
    expect((await generateText("sys", "user")).blocked).toBe(true);
  });

  it("fails clearly without an API key and makes no network call", async () => {
    delete process.env.GEMINI_API_KEY;
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(embedTexts(["a"], 4)).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(f).not.toHaveBeenCalled();
  });
});
