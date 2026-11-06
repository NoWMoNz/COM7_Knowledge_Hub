import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { embedTexts, generateText, GeminiApiError } from "@/services/ai/gemini.service";
import { AiNotConfiguredError } from "@/lib/ai-config";
import { gateNoAnswer } from "@/services/ai/stream-gate";

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

  it("generateText sends the configured thinking level (default low); 'default' sends none", async () => {
    const f = vi.fn(async () => json({ candidates: [{ content: { parts: [{ text: "ok [1]" }] } }] }));
    vi.stubGlobal("fetch", f);
    const cfgOf = (i: number) => JSON.parse((f.mock.calls[i] as unknown as [string, RequestInit])[1].body as string).generationConfig;
    await generateText("sys", "user");
    expect(cfgOf(0).thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    process.env.GEMINI_THINKING_LEVEL = "minimal";
    await generateText("sys", "user");
    expect(cfgOf(1).thinkingConfig).toEqual({ thinkingLevel: "MINIMAL" });
    process.env.GEMINI_THINKING_LEVEL = "default";
    await generateText("sys", "user");
    expect(cfgOf(2).thinkingConfig).toBeUndefined();
    delete process.env.GEMINI_THINKING_LEVEL;
  });

  /** An SSE body delivered in awkward network chunks (events split mid-line). */
  const sse = (events: unknown[], cut = 7) => {
    const raw = events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join("");
    const parts = raw.match(new RegExp(`[\\s\\S]{1,${cut}}`, "g")) ?? [];
    return new Response(new ReadableStream({ start(c) { parts.forEach((p) => c.enqueue(new TextEncoder().encode(p))); c.close(); } }));
  };
  const piece = (text: string, extra: object = {}) => ({ candidates: [{ content: { parts: [{ text }] }, ...extra }] });

  it("with onDelta: streams via SSE, passes each piece on, skips thought parts, returns the full text", async () => {
    const f = vi.fn(async () => sse([
      { candidates: [{ content: { parts: [{ text: "thinking…", thought: true }] } }] },
      piece("ลาป่วย "), piece("ได้ 30 วัน "), piece("[1]", { finishReason: "STOP" }),
    ]));
    vi.stubGlobal("fetch", f);
    const deltas: string[] = [];
    expect(await generateText("sys", "user", (t) => deltas.push(t))).toEqual({ text: "ลาป่วย ได้ 30 วัน [1]", blocked: false });
    expect(deltas).toEqual(["ลาป่วย ", "ได้ 30 วัน ", "[1]"]);
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(url).toContain("gemini-3.6-flash:streamGenerateContent?alt=sse");
    expect(url).not.toContain("test-key-123");
  });

  it("streaming reports safety blocks and HTTP errors like the non-streaming call", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sse([{ promptFeedback: { blockReason: "SAFETY" } }])));
    expect((await generateText("sys", "user", () => undefined)).blocked).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => sse([{ candidates: [{ finishReason: "SAFETY" }] }])));
    expect((await generateText("sys", "user", () => undefined)).blocked).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "x" }, 429)));
    expect((await generateText("sys", "user", () => undefined).catch((x) => x)).retryable).toBe(true);
  });

  it("gateNoAnswer holds back a NO_ANSWER reply but releases real answers in full", () => {
    const out: string[] = [];
    const gate = gateNoAnswer((t) => out.push(t));
    ["`NO", "_ANS", "WER`"].forEach(gate);
    expect(out).toEqual([]);
    const out2: string[] = [];
    const gate2 = gateNoAnswer((t) => out2.push(t));
    ["N", "o, sick leave", " is 30 days"].forEach(gate2);
    expect(out2.join("")).toBe("No, sick leave is 30 days");
  });

  it("fails clearly without an API key and makes no network call", async () => {
    delete process.env.GEMINI_API_KEY;
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(embedTexts(["a"], 4)).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(f).not.toHaveBeenCalled();
  });
});
