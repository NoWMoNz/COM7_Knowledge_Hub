import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildChunks, chunkText, normalizeText } from "@/services/documents/chunking.service";
import { extractSegments, ExtractionError } from "@/services/documents/extraction.service";
import { validateUpload, UploadValidationError, sanitizeFilename } from "@/services/documents/file-validation.service";

const CT = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`;

async function zipOf(files: Record<string, string>) {
  const z = new JSZip();
  for (const [k, v] of Object.entries(files)) z.file(k, v);
  return Buffer.from(await z.generateAsync({ type: "nodebuffer" }));
}

const docx = () =>
  zipOf({
    "[Content_Types].xml": `${CT}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello DOCX</w:t></w:r></w:p><w:p><w:r><w:t>สวัสดีครับ</w:t></w:r></w:p></w:body></w:document>`,
  });

const pptx = () =>
  zipOf({
    "ppt/presentation.xml": "<p/>",
    "ppt/slides/slide2.xml": `<p:sld xmlns:a="a"><a:p><a:r><a:t>Second &amp; last</a:t></a:r></a:p></p:sld>`,
    "ppt/slides/slide1.xml": `<p:sld xmlns:a="a"><a:p><a:r><a:t>First slide</a:t></a:r></a:p></p:sld>`,
  });

const xlsx = () =>
  zipOf({
    "[Content_Types].xml": `${CT}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Leave" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Type</t></is></c><c r="B1" t="inlineStr"><is><t>Days</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Sick</t></is></c><c r="B2"><v>30</v></c></row></sheetData></worksheet>`,
  });

const pdf = () =>
  Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
      "4 0 obj<</Length 60>>stream\nBT /F1 18 Tf 20 150 Td (Hello PDF world, this is test text) Tj ET\nendstream endobj\n" +
      "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF",
  );

describe("normalizeText / chunking", () => {
  it("normalizes whitespace and control chars", () => {
    expect(normalizeText("a \t b\r\n\r\n\r\n\r\nc\u0000d​")).toBe("a b\n\ncd");
  });
  it("keeps chunks within target and overlaps", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ${"x".repeat(80)}`).join("\n\n");
    const chunks = chunkText(text, 500, 100);
    expect(chunks.length).toBeGreaterThan(3);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(520);
  });
  it("splits long Thai text without spaces", () => {
    const thai = "การลาป่วยต้องแจ้งหัวหน้างานล่วงหน้า".repeat(60);
    const chunks = chunkText(thai, 300, 50);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.length <= 360)).toBe(true);
  });
  it("is deterministic (idempotent retries) and tags page/section", () => {
    const segs = [{ text: "one", page: 1 }, { text: "two", section: "Sheet" }];
    const a = buildChunks(segs);
    expect(buildChunks(segs)).toEqual(a);
    expect(a).toEqual([
      { chunk_index: 0, content: "one", page_number: 1, section: null },
      { chunk_index: 1, content: "two", page_number: null, section: "Sheet" },
    ]);
  });
  it("returns no chunks for blank input", () => {
    expect(buildChunks([{ text: "  \n " }])).toEqual([]);
  });
});

describe("validateUpload", () => {
  it("accepts real files of every type", async () => {
    expect((await validateUpload("a.docx", await docx())).ext).toBe("docx");
    expect((await validateUpload("a.pptx", await pptx())).ext).toBe("pptx");
    expect((await validateUpload("a.xlsx", await xlsx())).ext).toBe("xlsx");
    expect((await validateUpload("a.PDF", pdf())).ext).toBe("pdf");
    expect((await validateUpload("a.txt", Buffer.from("hello"))).ext).toBe("txt");
  });
  it("rejects unsupported extension, empty, oversize", async () => {
    await expect(validateUpload("a.exe", Buffer.from("MZ"))).rejects.toMatchObject({ code: "unsupported_type" });
    await expect(validateUpload("a.txt", Buffer.alloc(0))).rejects.toMatchObject({ code: "empty_file" });
    await expect(validateUpload("a.txt", Buffer.alloc(21 * 1024 * 1024, 65))).rejects.toMatchObject({ code: "file_too_large" });
  });
  it("rejects content that does not match the extension", async () => {
    await expect(validateUpload("a.pdf", Buffer.from("MZ not a pdf"))).rejects.toBeInstanceOf(UploadValidationError);
    await expect(validateUpload("a.docx", Buffer.from("plain text"))).rejects.toMatchObject({ code: "content_mismatch" });
    await expect(validateUpload("a.docx", await xlsx())).rejects.toMatchObject({ code: "content_mismatch" });
    await expect(validateUpload("a.txt", Buffer.from([65, 0, 66]))).rejects.toMatchObject({ code: "content_mismatch" });
  });
  it("sanitizes filenames", () => {
    expect(sanitizeFilename("..\\..\\evil/../a\u0000.pdf")).toBe("a.pdf");
  });
});

describe("extractSegments", () => {
  it("txt: utf-8 and legacy Thai (windows-874)", async () => {
    expect((await extractSegments("txt", Buffer.from("สวัสดี")))[0].text).toBe("สวัสดี");
    const tis = Buffer.from([0xca, 0xc7, 0xd1, 0xca, 0xb4, 0xd5]); // สวัสดี in TIS-620
    expect((await extractSegments("txt", tis))[0].text).toBe("สวัสดี");
  });
  it("docx text incl. Thai", async () => {
    const [s] = await extractSegments("docx", await docx());
    expect(s.text).toContain("Hello DOCX");
    expect(s.text).toContain("สวัสดีครับ");
  });
  it("pptx slides in order with slide numbers", async () => {
    const segs = await extractSegments("pptx", await pptx());
    expect(segs).toEqual([{ text: "First slide", page: 1 }, { text: "Second & last", page: 2 }]);
  });
  it("xlsx sheet name as section", async () => {
    const [s] = await extractSegments("xlsx", await xlsx());
    expect(s.section).toBe("Leave");
    expect(s.text).toContain("Sick\t30");
  });
  it("pdf text with page number", async () => {
    const [s] = await extractSegments("pdf", pdf());
    expect(s.page).toBe(1);
    expect(s.text).toContain("Hello PDF world");
  });
  it("pdf without text layer fails with needs_ocr (non-retryable)", async () => {
    const blank = Buffer.from(pdf().toString("latin1").replace("(Hello PDF world, this is test text) Tj", ""), "latin1");
    await expect(extractSegments("pdf", blank)).rejects.toMatchObject({ code: "needs_ocr", retryable: false });
  });
  it("corrupt files raise ExtractionError", async () => {
    await expect(extractSegments("pdf", Buffer.from("%PDF-1.4 garbage"))).rejects.toBeInstanceOf(ExtractionError);
    await expect(extractSegments("pptx", Buffer.from("not a zip"))).rejects.toBeInstanceOf(ExtractionError);
  });
});
