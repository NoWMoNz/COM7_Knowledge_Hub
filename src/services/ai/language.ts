export type Lang = "th" | "en";

export function detectLanguage(text: string): Lang {
  const thai = (text.match(/[฀-๿]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return thai > 0 && thai >= latin * 0.3 ? "th" : "en";
}

/** Fixed (non-model) fallbacks so "not available" is never an invented answer. */
export const FALLBACK: Record<Lang, string> = {
  th: "ไม่พบข้อมูลที่เพียงพอเกี่ยวกับเรื่องนี้ในเอกสารของบริษัทที่มีอยู่ในขณะนี้ กรุณาติดต่อฝ่ายบุคคล (HR) หรือหน่วยงานที่เกี่ยวข้องเพื่อยืนยันข้อมูล",
  en: "I couldn't find sufficient information about this topic in the currently available company documents. Please contact HR or the relevant department for confirmation.",
};

export const UNAVAILABLE: Record<Lang, string> = {
  th: "ขณะนี้ระบบผู้ช่วย AI ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง หรือติดต่อผู้ดูแลระบบ",
  en: "The AI assistant is temporarily unavailable. Please try again later or contact your administrator.",
};
