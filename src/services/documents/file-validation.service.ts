import JSZip from "jszip";
import { ALLOWED_EXTENSIONS, FILE_TYPES, MAX_FILE_BYTES, MAX_ZIP_ENTRIES, type FileExt } from "@/constants/documents";

export class UploadValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const OOXML_MARKER: Partial<Record<FileExt, string>> = {
  docx: "word/document.xml",
  xlsx: "xl/workbook.xml",
  pptx: "ppt/presentation.xml",
};

export function getExtension(filename: string): FileExt {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!(ALLOWED_EXTENSIONS as string[]).includes(ext)) {
    throw new UploadValidationError("unsupported_type", `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }
  return ext as FileExt;
}

/** Strip path parts and control characters; the result is for display only (storage paths never use it). */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
  return cleaned || "file";
}

/** Validates extension, size and the real file content (magic bytes / container structure). */
export async function validateUpload(filename: string, buffer: Buffer): Promise<{ ext: FileExt; mime: string }> {
  const ext = getExtension(filename);
  if (buffer.length === 0) throw new UploadValidationError("empty_file", "The file is empty.");
  if (buffer.length > MAX_FILE_BYTES) {
    throw new UploadValidationError("file_too_large", `File exceeds ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }

  if (ext === "pdf") {
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new UploadValidationError("content_mismatch", "File content is not a valid PDF.");
    }
  } else if (ext === "txt") {
    if (buffer.includes(0)) throw new UploadValidationError("content_mismatch", "File content is not plain text.");
  } else {
    if (buffer.readUInt32BE(0) !== 0x504b0304) {
      throw new UploadValidationError("content_mismatch", `File content is not a valid ${ext.toUpperCase()}.`);
    }
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      throw new UploadValidationError("content_mismatch", `File content is not a valid ${ext.toUpperCase()}.`);
    }
    if (Object.keys(zip.files).length > MAX_ZIP_ENTRIES) {
      throw new UploadValidationError("content_mismatch", "File structure is not acceptable.");
    }
    if (!zip.file(OOXML_MARKER[ext]!)) {
      throw new UploadValidationError("content_mismatch", `File content is not a valid ${ext.toUpperCase()}.`);
    }
  }
  return { ext, mime: FILE_TYPES[ext].mimes[0] };
}
