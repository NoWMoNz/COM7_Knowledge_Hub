export const MAX_FILE_BYTES = 20 * 1024 * 1024; // keep in sync with the storage bucket file_size_limit

export const FILE_TYPES = {
  pdf: { mimes: ["application/pdf"] },
  docx: { mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  xlsx: { mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
  pptx: { mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] },
  txt: { mimes: ["text/plain"] },
} as const;

export type FileExt = keyof typeof FILE_TYPES;
export const ALLOWED_EXTENSIONS = Object.keys(FILE_TYPES) as FileExt[];
export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export const DOCUMENT_STATUSES = ["uploading", "processing", "ready", "failed"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  uploading: "กำลังอัปโหลด / Uploading",
  processing: "กำลังประมวลผล / Processing",
  ready: "พร้อมใช้งาน / Ready",
  failed: "ล้มเหลว / Failed",
};

export const CHUNK_TARGET_CHARS = 1000;
export const CHUNK_OVERLAP_CHARS = 150;
export const MAX_ZIP_ENTRIES = 5000;
