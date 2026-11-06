import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./helpers/fake-supabase";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const h = vi.hoisted(() => ({
  perms: [] as string[],
  current: [] as { id: string; sort_order: number }[],
  updateError: null as null | { message: string },
  fake: null as null | ReturnType<typeof import("./helpers/fake-supabase").fakeSupabase>,
  audit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requirePermission: async (p: string) => {
    if (!h.perms.includes(p)) throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/dashboard;307;" });
    return { id: "u1", permissions: h.perms };
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => h.fake!.client }));
vi.mock("@/lib/audit", () => ({ writeAudit: h.audit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { reorderContentAction } from "@/app/(employee)/content/actions";
import { move } from "@/components/ui/sortable-list";

beforeEach(() => {
  h.perms = ["content:manage"];
  h.current = [{ id: ID(1), sort_order: 0 }, { id: ID(2), sort_order: 1 }, { id: ID(3), sort_order: 2 }];
  h.updateError = null;
  h.audit.mockReset();
  h.fake = fakeSupabase((table, calls) => {
    if (table !== "content_items") return undefined;
    if (calls.some((c) => c.method === "update")) return { error: h.updateError };
    return { data: h.current };
  });
});

describe("move()", () => {
  it("moves an item down and up without mutating the input", () => {
    const list = ["a", "b", "c", "d"];
    expect(move(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(move(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });
});

describe("reorderContentAction", () => {
  it("writes only the rows whose position changed, scoped to the kind", async () => {
    const res = await reorderContentAction("faq", [ID(1), ID(3), ID(2)]);
    expect(res).toEqual({ success: expect.any(String) });
    const updates = h.fake!.ops("content_items", "update").map((c) => c.args[0]);
    expect(updates).toEqual([{ sort_order: 1 }, { sort_order: 2 }]);
    expect(h.fake!.ops("content_items", "eq").some((c) => c.args[0] === "kind" && c.args[1] === "faq")).toBe(true);
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "content.reorder", metadata: { kind: "faq", moved: 2 } }));
  });

  it("no-op order writes nothing and logs nothing", async () => {
    expect(await reorderContentAction("faq", [ID(1), ID(2), ID(3)])).toEqual({ success: expect.any(String) });
    expect(h.fake!.ops("content_items", "update")).toHaveLength(0);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("rejects bad input: unknown kind, non-uuid, duplicates, empty", async () => {
    for (const [kind, ids] of [["page", [ID(1)]], ["faq", ["x"]], ["faq", [ID(1), ID(1)]], ["faq", []]] as const) {
      expect(await reorderContentAction(kind, [...ids])).toEqual({ error: "Invalid order." });
    }
    expect(h.fake!.ops("content_items", "update")).toHaveLength(0);
  });

  it("refuses when the ids do not match the stored rows (stale list or another kind)", async () => {
    h.current = [{ id: ID(1), sort_order: 0 }, { id: ID(2), sort_order: 1 }];
    expect((await reorderContentAction("faq", [ID(1), ID(2), ID(9)])).error).toBeTruthy();
    expect(h.fake!.ops("content_items", "update")).toHaveLength(0);
  });

  it("reports a failed write", async () => {
    h.updateError = { message: "rls" };
    expect(await reorderContentAction("faq", [ID(3), ID(2), ID(1)])).toEqual({ error: "Could not save the new order." });
  });

  it("requires content:manage", async () => {
    h.perms = [];
    await expect(reorderContentAction("faq", [ID(1)])).rejects.toMatchObject({ digest: expect.stringContaining("/dashboard") });
  });
});
