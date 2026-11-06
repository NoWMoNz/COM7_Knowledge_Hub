/**
 * Decodes an uploaded .txt file. UTF-8 first (strict, so a wrong guess fails instead of producing mojibake), then
 * windows-874 (TIS-620 superset) for legacy Thai text files saved by older Windows tools. A leading BOM is dropped.
 */
export function decodeText(buffer: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-874").decode(buffer);
  }
  return text.replace(/^﻿/, "");
}
