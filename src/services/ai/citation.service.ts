import { NO_ANSWER_TOKEN } from "./prompt.service";

export type CitationResult =
  | { kind: "no_answer" }
  | { kind: "uncited" }
  | { kind: "ok"; text: string; cited: number[] };

/**
 * Validates the model output: it must cite at least one source that really was retrieved.
 * Citation numbers that do not exist are removed from the text (never shown as references).
 */
export function validateCitations(raw: string, validIndexes: number[]): CitationResult {
  const text = raw.trim();
  if (!text || text.replace(/[\s.`"']/g, "").toUpperCase() === NO_ANSWER_TOKEN) return { kind: "no_answer" };

  const valid = new Set(validIndexes);
  const cited = new Set<number>();
  const cleaned = text.replace(/\[(\d{1,3})\]/g, (m, n: string) => {
    const i = Number(n);
    if (valid.has(i)) {
      cited.add(i);
      return m;
    }
    return "";
  });
  if (cited.size === 0) return { kind: "uncited" };
  return { kind: "ok", text: cleaned.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim(), cited: [...cited].sort((a, b) => a - b) };
}
