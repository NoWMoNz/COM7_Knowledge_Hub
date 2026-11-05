import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Call, type Result } from "./helpers/fake-supabase";

const h = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; fullName: string | null; roleKey: string; permissions: string[] },
  userDb: null as unknown,
  adminDb: null as unknown,
  createUpload: vi.fn(),
  runPendingJobs: vi.fn(),
  embedQuery: vi.fn(),
  searchChunks: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => undefined }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (h.userDb as { client: unknown }).client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => (h.adminDb as { client: unknown }).client }));
vi.mock("@/services/documents/upload.service", () => ({ createUpload: h.createUpload }));
vi.mock("@/services/documents/processing.service", () => ({ runPendingJobs: h.runPendingJobs }));
vi.mock("@/services/ai/embedding.service", () => ({ embedQuery: h.embedQuery }));
vi.mock("@/services/ai/vector-search.service", () => ({ searchChunks: h.searchChunks }));
vi.mock("@/services/ai/gemini.service", () => ({ generateText: h.generateText }));

import { POST as uploadPOST } from "@/app/api/documents/upload/route";
import { GET as fileGET } from "@/app/api/documents/[id]/file/route";
import { POST as jobsPOST } from "@/app/api/jobs/process/route";
import { POST as chatPOST } from "@/app/api/chat/route";
import { UploadValidationError } from "@/services/documents/file-validation.service";

const ID = "11111111-1111-4111-8111-111111111111";
const VID = "22222222-2222-4222-8222-222222222222";
const employee = { id: "u-emp", email: "e@x.t", fullName: null, roleKey: "employee", permissions: [] };
const manager = { id: "u-km", email: "k@x.t", fullName: "KM", roleKey: "knowledge_manager", permissions: ["document:manage"] };

const isCount = (calls: Call[]) => calls.some((c) => c.method === "select" && (c.args[1] as { count?: string } | undefined)?.count);

beforeEach(() => {
  h.user = null;
  h.createUpload.mockReset().mockResolvedValue({ documentId: ID, versionId: VID, versionNumber: 1 });
  h.runPendingJobs.mockReset().mockResolvedValue(2);
  h.embedQuery.mockReset().mockResolvedValue([1]);
  h.searchChunks.mockReset().mockResolvedValue([]);
  h.generateText.mockReset();
  h.userDb = fakeSupabase(() => undefined);
  h.adminDb = fakeSupabase((t, calls) => (isCount(calls) ? { count: 0 } : t === "chat_messages" && calls.some((c) => c.method === "single") ? { data: { id: "m-assistant" } } : undefined));
  process.env.GEMINI_API_KEY = "k-test";
  process.env.JOB_RUNNER_SECRET = "a-very-long-secret-1234";
});

function uploadReq(fields: Record<string, string | File> = { file: new File(["hello"], "a.txt", { type: "text/plain" }) }) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  return new Request("http://localhost/api/documents/upload", { method: "POST", body: form });
}

describe("POST /api/documents/upload", () => {
  it("401 when signed out; 403 for employees (server-side authorization)", async () => {
    expect((await uploadPOST(uploadReq())).status).toBe(401);
    h.user = employee;
    expect((await uploadPOST(uploadReq())).status).toBe(403);
    expect(h.createUpload).not.toHaveBeenCalled();
  });

  it("400 for missing file or invalid documentId", async () => {
    h.user = manager;
    expect((await uploadPOST(uploadReq({ title: "x" }))).status).toBe(400);
    expect((await uploadPOST(uploadReq({ file: new File(["a"], "a.txt"), documentId: "not-a-uuid" }))).status).toBe(400);
  });

  it("maps validation errors: duplicate 409, too large 413, unsupported 422", async () => {
    h.user = manager;
    for (const [code, status] of [["duplicate", 409], ["file_too_large", 413], ["unsupported_type", 422], ["content_mismatch", 422]] as const) {
      h.createUpload.mockRejectedValueOnce(new UploadValidationError(code, "msg"));
      expect((await uploadPOST(uploadReq())).status).toBe(status);
    }
  });

  it("unexpected failure returns a generic 500 (no internals leaked)", async () => {
    h.user = manager;
    h.createUpload.mockRejectedValueOnce(new Error("relation documents does not exist; key=SECRET"));
    const res = await uploadPOST(uploadReq());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/relation|SECRET/);
  });

  it("429 when the per-minute upload limit is hit", async () => {
    h.user = manager;
    h.adminDb = fakeSupabase((t, calls) => (isCount(calls) ? { count: 60 } : undefined));
    expect((await uploadPOST(uploadReq())).status).toBe(429);
    expect(h.createUpload).not.toHaveBeenCalled();
  });

  it("201 and forwards actor + documentId for a replacement upload", async () => {
    h.user = manager;
    const res = await uploadPOST(uploadReq({ file: new File(["hello"], "a.txt"), documentId: ID }));
    expect(res.status).toBe(201);
    expect(h.createUpload).toHaveBeenCalledWith(expect.objectContaining({ actorId: "u-km", actorName: "KM", documentId: ID, filename: "a.txt" }));
  });
});

describe("GET /api/documents/[id]/file", () => {
  const ctx = (id = ID) => ({ params: Promise.resolve({ id }) }) as never;
  const req = (qs = "") => new Request(`http://localhost/api/documents/${ID}/file${qs}`);
  const visible = () => fakeSupabase((table) =>
    table === "documents" ? { data: { id: ID, current_version_id: VID } } : table === "document_versions" ? { data: { storage_path: `${ID}/${VID}.pdf`, document_id: ID } } : undefined);

  it("401 signed out", async () => {
    expect((await fileGET(req(), ctx())).status).toBe(401);
  });
  it("404 for malformed ids and for documents RLS hides (no existence leak)", async () => {
    h.user = employee;
    h.userDb = fakeSupabase(() => undefined);
    expect((await fileGET(req(), ctx("nope"))).status).toBe(404);
    expect((await fileGET(req(), ctx())).status).toBe(404);
  });
  it("authorized user is redirected to a short-lived signed URL", async () => {
    h.user = employee;
    h.userDb = visible();
    h.adminDb = visible();
    const res = await fileGET(req(), ctx());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://signed.example/x");
  });
  it("only managers may request a specific (non-current) version", async () => {
    h.userDb = visible();
    h.adminDb = visible();
    h.user = employee;
    expect((await fileGET(req(`?version=${VID}`), ctx())).status).toBe(403);
    h.user = manager;
    expect((await fileGET(req(`?version=${VID}`), ctx())).status).toBe(302);
  });
  it("404 when the version belongs to a different document", async () => {
    h.user = manager;
    h.userDb = fakeSupabase((table) =>
      table === "documents" ? { data: { id: ID, current_version_id: VID } } : { data: { storage_path: "x", document_id: "99999999-9999-4999-8999-999999999999" } });
    expect((await fileGET(req(`?version=${VID}`), ctx())).status).toBe(404);
  });
});

describe("POST /api/jobs/process", () => {
  const call = (secret?: string) => jobsPOST(new Request("http://localhost/api/jobs/process", { method: "POST", headers: secret ? { "x-job-secret": secret } : {} }));
  it("rejects missing or wrong secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("wrong-secret-value-xx")).status).toBe(401);
    expect(h.runPendingJobs).not.toHaveBeenCalled();
  });
  it("refuses to run at all when the configured secret is too short or unset", async () => {
    process.env.JOB_RUNNER_SECRET = "short";
    expect((await call("short")).status).toBe(401);
    delete process.env.JOB_RUNNER_SECRET;
    expect((await call("anything-long-enough-12345")).status).toBe(401);
  });
  it("runs the queue with the correct secret", async () => {
    const res = await call("a-very-long-secret-1234");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ handled: 2 });
  });
});

describe("POST /api/chat", () => {
  const chatReq = (body: unknown) => new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const sessionDb = (found = true) => fakeSupabase((table, calls) => {
    if (table !== "chat_sessions") return undefined;
    return calls.some((c) => c.method === "insert") ? { data: { id: "s-new" } } : found ? { data: { id: "s-old" } } : { data: null };
  });
  const chunk = { chunk_id: "c1", document_id: "d1", version_id: "v1", content: "Sick leave: 30 days.", page_number: 4, section: null, similarity: 0.9, document_title: "Handbook", version_number: 2, file_ext: "pdf" };
  const assistantInsert = () => (h.adminDb as ReturnType<typeof fakeSupabase>).ops("chat_messages", "insert").map((c) => c.args[0] as Record<string, unknown>).find((r) => r.role === "assistant");

  it("401 signed out; 400 for empty / oversized / malformed bodies", async () => {
    expect((await chatPOST(chatReq({ message: "hi" }))).status).toBe(401);
    h.user = employee;
    for (const body of [{ message: "" }, { message: "x".repeat(2001) }, { message: "hi", sessionId: "bad" }, null]) {
      expect((await chatPOST(chatReq(body))).status).toBe(400);
    }
  });

  it("429 when the per-minute question limit is reached", async () => {
    h.user = employee;
    h.userDb = sessionDb();
    h.adminDb = fakeSupabase((t, calls) => (isCount(calls) ? { count: 15 } : undefined));
    expect((await chatPOST(chatReq({ message: "hi" }))).status).toBe(429);
  });

  it("404 for someone else's / unknown session (RLS returns nothing)", async () => {
    h.user = employee;
    h.userDb = sessionDb(false);
    expect((await chatPOST(chatReq({ message: "hi", sessionId: ID }))).status).toBe(404);
  });

  it("no evidence: fixed fallback, model never called, question logged as unanswered", async () => {
    h.user = employee;
    h.userDb = sessionDb();
    const res = await chatPOST(chatReq({ message: "นโยบายลาคลอดคืออะไร" }));
    const body = await res.json();
    expect(body).toMatchObject({ sessionId: "s-new", answered: false, sources: [] });
    expect(body.answer).toContain("ฝ่ายบุคคล");
    expect(h.generateText).not.toHaveBeenCalled();
    const un = (h.adminDb as ReturnType<typeof fakeSupabase>).ops("unanswered_questions", "insert")[0].args[0];
    expect(un).toMatchObject({ reason: "no_relevant_content", language: "th", user_id: "u-emp" });
  });

  it("grounded answer: returns cited sources and persists a traceable source snapshot", async () => {
    h.user = employee;
    h.userDb = sessionDb();
    h.searchChunks.mockResolvedValue([chunk]);
    h.generateText.mockResolvedValue({ text: "Sick leave is 30 days [1].", blocked: false });
    const body = await (await chatPOST(chatReq({ message: "How many sick days?" }))).json();
    expect(body).toMatchObject({ answered: true, sources: [{ index: 1, documentId: "d1", title: "Handbook", version: 2, page: 4, fileExt: "pdf" }] });
    expect(assistantInsert()).toMatchObject({ answered: true, language: "en" });
    const src = (h.adminDb as ReturnType<typeof fakeSupabase>).ops("message_sources", "insert")[0].args[0] as Record<string, unknown>[];
    expect(src[0]).toMatchObject({ chunk_id: "c1", document_id: "d1", version_id: "v1", version_number: 2, page_number: 4 });
    expect((h.adminDb as ReturnType<typeof fakeSupabase>).ops("unanswered_questions", "insert")).toHaveLength(0);
  });

  it("search runs with the signed-in user's client (permission filtering in SQL), not the service role", async () => {
    h.user = employee;
    const userDb = sessionDb();
    h.userDb = userDb;
    await chatPOST(chatReq({ message: "hi there" }));
    expect(h.searchChunks.mock.calls[0][0]).toBe(userDb.client);
  });

  it("model answer without valid citations is withheld", async () => {
    h.user = employee;
    h.userDb = sessionDb();
    h.searchChunks.mockResolvedValue([chunk]);
    h.generateText.mockResolvedValue({ text: "Probably 30 days.", blocked: false });
    const body = await (await chatPOST(chatReq({ message: "How many sick days?" }))).json();
    expect(body).toMatchObject({ answered: false, sources: [] });
    expect(body.answer).not.toContain("30 days");
  });

  it("without GEMINI_API_KEY: reports unavailable, makes no external calls", async () => {
    delete process.env.GEMINI_API_KEY;
    h.user = employee;
    h.userDb = sessionDb();
    const body = await (await chatPOST(chatReq({ message: "hello" }))).json();
    expect(body.answered).toBe(false);
    expect(body.answer).toMatch(/not available|temporarily unavailable/i);
    expect(h.embedQuery).not.toHaveBeenCalled();
  });
});

// keep type-only import used
export type _Unused = Result;
