import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./helpers/fake-supabase";

const h = vi.hoisted(() => ({
  authUser: null as null | { id: string; app_metadata?: Record<string, unknown> },
  profile: null as unknown,
  verifyOtp: vi.fn(),
  exchange: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const f = fakeSupabase((table) => (table === "profiles" ? { data: h.profile } : undefined));
    return { ...f.client, auth: { getClaims: async () => ({ data: h.authUser ? { claims: { sub: h.authUser.id } } : null }), getUser: async () => ({ data: { user: h.authUser } }), verifyOtp: h.verifyOtp, exchangeCodeForSession: h.exchange } };
  },
}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

import { NextRequest } from "next/server";
import { GET as callbackGET } from "@/app/auth/callback/route";
import { getCurrentUser, requirePermission, requireUser } from "@/lib/auth/session";
import { contentSchema, SAFE_URL } from "@/lib/validation/documents";

const profile = { id: "u1", email: "u@x.t", full_name: "U", is_active: true, roles: { key: "admin", role_permissions: [{ permission: "admin:access" }] } };

beforeEach(() => {
  h.authUser = null;
  h.profile = profile;
  h.verifyOtp.mockReset().mockResolvedValue({ error: null });
  h.exchange.mockReset().mockResolvedValue({ error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
});

describe("forced password change for admin-created / invited accounts", () => {
  it("flag comes from app_metadata (server-only), not user_metadata", async () => {
    h.authUser = { id: "u1", app_metadata: { must_change_password: true } };
    expect((await getCurrentUser())?.mustChangePassword).toBe(true);
    h.authUser = { id: "u1" };
    expect((await getCurrentUser())?.mustChangePassword).toBe(false);
  });
  it("requireUser / requirePermission send such users to /reset-password before anything else", async () => {
    h.authUser = { id: "u1", app_metadata: { must_change_password: true } };
    await expect(requireUser()).rejects.toMatchObject({ digest: expect.stringContaining("/reset-password") });
    await expect(requirePermission("admin:access")).rejects.toMatchObject({ digest: expect.stringContaining("/reset-password") });
  });
  it("normal users pass through", async () => {
    h.authUser = { id: "u1", app_metadata: {} };
    await expect(requireUser()).resolves.toMatchObject({ id: "u1" });
  });
});

describe("GET /auth/callback", () => {
  const call = (qs: string) => callbackGET(new NextRequest(`http://localhost/auth/callback?${qs}`));
  const loc = (r: Response) => new URL(r.headers.get("location")!).pathname;

  it("invite / recovery token hashes are verified server-side and redirect to the requested page", async () => {
    const r = await call("token_hash=abc&type=invite&next=/reset-password");
    expect(h.verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "abc" });
    expect(loc(r)).toBe("/reset-password");
  });
  it("rejects unknown OTP types and failed verification (falls back to /login)", async () => {
    expect(loc(await call("token_hash=abc&type=magiclink&next=/dashboard"))).toBe("/login");
    expect(h.verifyOtp).not.toHaveBeenCalled();
    h.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    expect(loc(await call("token_hash=abc&type=recovery"))).toBe("/login");
  });
  it("PKCE code exchange still works", async () => {
    expect(loc(await call("code=xyz&next=/reset-password"))).toBe("/reset-password");
    expect(h.exchange).toHaveBeenCalledWith("xyz");
  });
  it("open-redirect attempts are neutralised", async () => {
    for (const next of ["//evil.com", "https://evil.com", "evil.com", "/\\evil.com"]) {
      const r = await call(`code=xyz&next=${encodeURIComponent(next)}`);
      expect(new URL(r.headers.get("location")!).host, next).toBe("localhost");
    }
    expect(loc(await call("code=xyz&next=//evil.com"))).toBe("/dashboard");
  });
});

describe("dashboard content validation", () => {
  const base = { kind: "announcement", title: "t", body: "", url: "", sortOrder: "0", isPublished: true };
  it("SAFE_URL allows http(s) and site paths only", () => {
    for (const ok of ["https://example.com/a", "http://x.y", "/documents", "/documents?q=1"]) expect(SAFE_URL.test(ok), ok).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.com", "ftp://x", "/ x", "evil.com", ""]) expect(SAFE_URL.test(bad), bad).toBe(false);
  });
  it("quick links need a safe URL; FAQs need an answer; announcements need neither", () => {
    expect(contentSchema.safeParse(base).success).toBe(true);
    expect(contentSchema.safeParse({ ...base, kind: "quick_link" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...base, kind: "quick_link", url: "javascript:alert(1)" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...base, kind: "quick_link", url: "/documents" }).success).toBe(true);
    expect(contentSchema.safeParse({ ...base, kind: "faq" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...base, kind: "faq", body: "Answer" }).success).toBe(true);
  });
  it("rejects empty titles, unknown kinds and absurd sort orders", () => {
    expect(contentSchema.safeParse({ ...base, title: "  " }).success).toBe(false);
    expect(contentSchema.safeParse({ ...base, kind: "banner" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...base, sortOrder: "1e9" }).success).toBe(false);
  });
});
