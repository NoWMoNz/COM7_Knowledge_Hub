import JSZip from "jszip";
import type { FileExt } from "@/constants/documents";
import { decodeText } from "@/lib/utils/text";
import { getOcrProvider, OcrError } from "./ocr";

export type Segment = { text: string; page?: number; section?: string };

export class ExtractionError extends Error {
  constructor(public code: string, message: string, public retryable = false) {
    super(message);
  }
}

const MIN_PDF_TEXT_CHARS = 20;

async function extractPdf(buffer: Buffer): Promise<Segment[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    pages = (await extractText(pdf, { mergePages: false })).text;
  } catch {
    throw new ExtractionError("corrupt_file", "The PDF could not be read (corrupt or encrypted).");
  }
  const segments = pages.map((text, i) => ({ text, page: i + 1 }));
  if (segments.reduce((n, s) => n + s.text.trim().length, 0) >= MIN_PDF_TEXT_CHARS) return segments;

  const ocr = getOcrProvider();
  if (!ocr) throw new ExtractionError("needs_ocr", "No text layer found (scanned PDF). OCR is not enabled (set OCR_PROVIDER=gemini).");
  try {
    return (await ocr.recognizePdf(buffer)).map((p) => ({ text: p.text, page: p.page }));
  } catch (e) {
    if (e instanceof OcrError) throw new ExtractionError(e.code, e.message, false);
    throw e;
  }
}

async function extractDocx(buffer: Buffer): Promise<Segment[]> {
  const mammoth = await import("mammoth");
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return [{ text: value }];
  } catch {
    throw new ExtractionError("corrupt_file", "The DOCX file could not be read.");
  }
}

async function extractXlsx(buffer: Buffer): Promise<Segment[]> {
  const { default: readXlsxFile } = await import("read-excel-file/node");
  try {
    const sheets = await readXlsxFile(buffer);
    return sheets.map(({ sheet, data }) => ({
      section: sheet,
      text: data.map((row) => row.map((c) => (c == null ? "" : String(c))).join("\t")).join("\n"),
    }));
  } catch {
    throw new ExtractionError("corrupt_file", "The XLSX file could not be read.");
  }
}

function xmlText(xml: string): string {
  const paragraphs = xml.split(/<\/a:p>/);
  return paragraphs
    .map((p) => [...p.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(""))
    .filter(Boolean)
    .join("\n")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

async function extractPptx(buffer: Buffer): Promise<Segment[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ExtractionError("corrupt_file", "The PPTX file could not be read.");
  }
  const slides = Object.keys(zip.files)
    .map((n) => ({ n, m: n.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m![1]) - Number(b.m![1]));
  const out: Segment[] = [];
  for (const s of slides) {
    out.push({ text: xmlText(await zip.file(s.n)!.async("string")), page: Number(s.m![1]) });
  }
  return out;
}

function extractTxt(buffer: Buffer): Segment[] {
  return [{ text: decodeText(buffer) }]; // UTF-8, or legacy Thai windows-874
}

export async function extractSegments(ext: FileExt, buffer: Buffer): Promise<Segment[]> {
  switch (ext) {
    case "pdf": return extractPdf(buffer);
    case "docx": return extractDocx(buffer);
    case "xlsx": return extractXlsx(buffer);
    case "pptx": return extractPptx(buffer);
    case "txt": return extractTxt(buffer);
  }
}
