import { NO_ANSWER_TOKEN } from "./prompt.service";

/**
 * Wraps a delta callback so the start of a streamed answer is held back while it could still be the
 * NO_ANSWER token (normalised the same way validateCitations does). Users never see "NO_ANSWER" flash
 * on screen; once the text clearly is a real answer, everything held so far is released and later
 * pieces pass straight through.
 */
export function gateNoAnswer(emit: (text: string) => void): (piece: string) => void {
  let held = "";
  let open = false;
  return (piece) => {
    if (open) return emit(piece);
    held += piece;
    const normalised = held.replace(/[\s.`"']/g, "").toUpperCase();
    if (NO_ANSWER_TOKEN.startsWith(normalised)) return; // still ambiguous (or empty): keep holding
    open = true;
    emit(held);
    held = "";
  };
}
