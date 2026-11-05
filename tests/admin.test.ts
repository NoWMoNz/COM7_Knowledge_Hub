import { describe, expect, it } from "vitest";
import { lastDays, normalizeQuestion } from "@/services/admin/stats.service";
import { PERMISSIONS, PERMISSION_LABELS } from "@/lib/permissions";

describe("admin stats helpers", () => {
  it("groups repeated questions regardless of case, spacing and trailing punctuation", () => {
    expect(normalizeQuestion("  How do I  request LEAVE?? ")).toBe(normalizeQuestion("how do i request leave"));
    expect(normalizeQuestion("ลาป่วยทำอย่างไร ?")).toBe("ลาป่วยทำอย่างไร");
  });
  it("lastDays returns n consecutive, ascending, unique YYYY-MM-DD keys", () => {
    const d = lastDays(14);
    expect(d).toHaveLength(14);
    expect(new Set(d).size).toBe(14);
    expect([...d].sort()).toEqual(d);
    expect(d.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))).toBe(true);
  });
});

describe("permission catalog", () => {
  it("every permission has a label (role editor stays in sync)", () => {
    for (const p of Object.values(PERMISSIONS)) expect(PERMISSION_LABELS[p]).toBeTruthy();
  });
});
