import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiOcr, getOcrProvider, OCR_MAX_BYTES, OcrError, parseOcrPages } from "@/services/documents/ocr";
import { extractSegments, ExtractionError } from "@/services/documents/extraction.service";

const NO_TEXT_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF",
);
const reply = (text: string, finishReason = "STOP") =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }), { status: 200 });

beforeEach(() => {
  process.env.GEMINI_API_KEY = "k-test";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
  delete process.env.OCR_PROVIDER;
});

describe("parseOcrPages", () => {
  it("splits on page markers and keeps real page numbers", () => {
    expect(parseOcrPages("=== PAGE 1 ===\nสวัสดี\n\n=== PAGE 2 ===\nHello\n=== PAGE 3 ===\n")).toEqual([
      { page: 1, text: "สวัสดี" },
      { page: 2, text: "Hello" },
    ]);
  });
  it("never invents page numbers when the model omits markers", () => {
    expect(parseOcrPages("just text")).toEqual([{ text: "just text" }]);
    expect(parseOcrPages("  ")).toEqual([]);
  });
});

describe("OCR provider selection", () => {
  it("is disabled by default, enabled by OCR_PROVIDER=gemini", () => {
    expect(getOcrProvider()).toBeNull();
    process.env.OCR_PROVIDER = "gemini";
    expect(getOcrProvider()?.name).toBe("gemini");
  });
});

describe("geminiOcr", () => {
  it("sends the PDF inline with a system prompt that treats the document as untrusted data", async () => {
    const f = vi.fn(async () => reply("=== PAGE 1 ===\nHello"));
    vi.stubGlobal("fetch", f);
    expect(await geminiOcr.recognizePdf(NO_TEXT_PDF)).toEqual([{ page: 1, text: "Hello" }]);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.contents[0].parts[0].inline_data.mime_type).toBe("application/pdf");
    expect(body.systemInstruction.parts[0].text).toMatch(/untrusted/i);
  });
  it("refuses files over the inline limit without calling the API", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(geminiOcr.recognizePdf(Buffer.alloc(OCR_MAX_BYTES + 1))).rejects.toMatchObject({ code: "ocr_too_large" });
    expect(f).not.toHaveBeenCalled();
  });
  it("truncated output is a permanent failure (never index half a document silently)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply("=== PAGE 1 ===\npartial", "MAX_TOKENS")));
    await expect(geminiOcr.recognizePdf(NO_TEXT_PDF)).rejects.toMatchObject({ code: "ocr_truncated" });
  });
  it("classifies API errors: 4xx permanent (OcrError), 5xx transient (retried by the worker)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })));
    await expect(geminiOcr.recognizePdf(NO_TEXT_PDF)).rejects.toBeInstanceOf(OcrError);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const e = await geminiOcr.recognizePdf(NO_TEXT_PDF).catch((x) => x);
    expect(e).not.toBeInstanceOf(OcrError);
  });
});

describe("scanned PDF through extraction", () => {
  it("without OCR: needs_ocr", async () => {
    await expect(extractSegments("pdf", NO_TEXT_PDF)).rejects.toMatchObject({ code: "needs_ocr" });
  });
  it("with OCR enabled: text and page numbers come from the OCR result", async () => {
    process.env.OCR_PROVIDER = "gemini";
    vi.stubGlobal("fetch", vi.fn(async () => reply("=== PAGE 1 ===\nนโยบายการลา")));
    expect(await extractSegments("pdf", NO_TEXT_PDF)).toEqual([{ text: "นโยบายการลา", page: 1 }]);
  });
  it("OCR permanent errors surface as non-retryable ExtractionErrors with the OCR code", async () => {
    process.env.OCR_PROVIDER = "gemini";
    vi.stubGlobal("fetch", vi.fn(async () => reply("x", "MAX_TOKENS")));
    const e = await extractSegments("pdf", NO_TEXT_PDF).catch((x) => x);
    expect(e).toBeInstanceOf(ExtractionError);
    expect(e).toMatchObject({ code: "ocr_truncated", retryable: false });
  });
});
