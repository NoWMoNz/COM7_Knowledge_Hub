import { CHUNK_OVERLAP_CHARS, CHUNK_TARGET_CHARS } from "@/constants/documents";
import type { Segment } from "./extraction.service";

export type Chunk = { chunk_index: number; content: string; page_number: number | null; section: string | null };

/** Unicode-normalize, drop control characters, collapse whitespace but keep paragraph breaks. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​﻿]/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split an oversized paragraph on word boundaries (Intl.Segmenter handles Thai, which has no spaces). */
function splitLong(text: string, max: number): string[] {
  const seg = new Intl.Segmenter(["th", "en"], { granularity: "word" });
  const parts: string[] = [];
  let cur = "";
  for (const { segment } of seg.segment(text)) {
    if (cur.length + segment.length > max && cur.length > 0) {
      parts.push(cur);
      cur = "";
    }
    cur += segment;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** Chunk one text; never merges text across segments, so page/section stay accurate. */
export function chunkText(text: string, target = CHUNK_TARGET_CHARS, overlap = CHUNK_OVERLAP_CHARS): string[] {
  const paragraphs = text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
  const units = paragraphs.flatMap((p) => (p.length > target ? splitLong(p, target) : [p]));
  const chunks: string[] = [];
  let cur = "";
  for (const u of units) {
    if (cur && cur.length + u.length + 1 > target) {
      chunks.push(cur);
      const tail = cur.slice(-overlap);
      cur = tail.length < cur.length ? tail.trimStart() : "";
    }
    cur = cur ? `${cur}\n${u}` : u;
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

export function buildChunks(segments: Segment[]): Chunk[] {
  const out: Chunk[] = [];
  for (const s of segments) {
    const text = normalizeText(s.text);
    if (!text) continue;
    for (const content of chunkText(text)) {
      out.push({ chunk_index: out.length, content, page_number: s.page ?? null, section: s.section ?? null });
    }
  }
  return out;
}
