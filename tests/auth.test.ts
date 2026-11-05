import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./helpers/fake-supabase";

const h = vi.hoisted(() => ({ authUser: null as null | { id: string }, profile: null as unknown }));

vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: h.authUser } }) } }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const f = fakeSupabase((table) => (table === "profiles" ? { data: h.profile } : undefined));
    return { ...f.client, auth: { getUser: async () => ({ data: { user: h.authUser } }) } };
  },
}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";
import { getCurrentUser, requirePermission, requireUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const profile = (over: Record<string, unknown> = {}) => ({
  id: "u1", email: "u@x.t", full_name: "U", is_active: true,
  roles: { key: "employee", role_permissions: [{ permission: "document:manage" }] }, ...over,
});

beforeEach(() => {
  h.authUser = null;
  h.profile = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
});

describe("proxy (protected routes)", () => {
  it("redirects anonymous users from every protected page to /login", async () => {
    for (const path of ["/dashboard", "/documents", "/documents/abc", "/chat", "/categories", "/admin/dashboard", "/admin/users", "/unanswered"]) {
      const res = await proxy(req(path));
      expect(res.status, path).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname, path).toBe("/login");
    }
  });
  it("lets anonymous users reach the public auth pages", async () => {
    for (const path of ["/login", "/forgot-password", "/reset-password", "/auth/callback"]) {
      expect((await proxy(req(path))).headers.get("location"), path).toBeNull();
    }
  });
  it("sends signed-in users away from /login", async () => {
    h.authUser = { id: "u1" };
    const res = await proxy(req("/login"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
    expect((await proxy(req("/documents"))).headers.get("location")).toBeNull();
  });
  it("matcher skips /api (routes authenticate themselves) and static assets, but covers pages", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test("/dashboard")).toBe(true);
    expect(re.test("/admin/users")).toBe(true);
    expect(re.test("/api/chat")).toBe(false);
    expect(re.test("/_next/static/x.js")).toBe(false);
    expect(re.test("/logo.png")).toBe(false);
  });
});

describe("session & authorization helpers", () => {
  it("getCurrentUser: null when signed out", async () => {
    expect(await getCurrentUser()).toBeNull();
  });
  it("getCurrentUser: null for deactivated accounts even with a valid token", async () => {
    h.authUser = { id: "u1" };
    h.profile = profile({ is_active: false });
    expect(await getCurrentUser()).toBeNull();
  });
  it("getCurrentUser: returns role and permissions from the database", async () => {
    h.authUser = { id: "u1" };
    h.profile = profile();
    expect(await getCurrentUser()).toMatchObject({ id: "u1", roleKey: "employee", permissions: ["document:manage"] });
  });
  it("requireUser redirects anonymous users to /login", async () => {
    await expect(requireUser()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });
  it("requirePermission sends users lacking the permission to /dashboard and lets holders through", async () => {
    h.authUser = { id: "u1" };
    h.profile = profile();
    await expect(requirePermission(PERMISSIONS.ADMIN_ACCESS)).rejects.toMatchObject({ digest: expect.stringContaining("/dashboard") });
    await expect(requirePermission(PERMISSIONS.DOCUMENT_MANAGE)).resolves.toMatchObject({ id: "u1" });
  });
  it("hasPermission is exact-match only", () => {
    expect(hasPermission(["document:manage"], PERMISSIONS.DOCUMENT_MANAGE)).toBe(true);
    expect(hasPermission(["document:manage"], PERMISSIONS.USER_MANAGE)).toBe(false);
    expect(hasPermission([], PERMISSIONS.ADMIN_ACCESS)).toBe(false);
  });
});
