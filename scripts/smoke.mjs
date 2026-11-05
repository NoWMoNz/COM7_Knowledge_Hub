// Smoke test against a real production server (needs `npm run build` first). No Supabase required:
// verifies security headers, route protection and API authentication for anonymous callers.
import { spawn } from "node:child_process";

const PORT = 3998;
const base = `http://localhost:${PORT}`;
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:9",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "smoke",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? base,
};
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env, stdio: "ignore" });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${ok ? "" : extra}`); };
const get = (path, init) => fetch(base + path, { redirect: "manual", ...init });

try {
  for (let i = 0; i < 60; i++) {
    try { await get("/login"); break; } catch { await new Promise((r) => setTimeout(r, 500)); }
    if (i === 59) throw new Error("server did not start (run `npm run build` first)");
  }

  const login = await get("/login");
  const h = (n) => login.headers.get(n) ?? "";
  check("GET /login -> 200", login.status === 200);
  check("login page renders", (await login.text()).includes("COM7 Knowledge Hub"));
  check("X-Content-Type-Options: nosniff", h("x-content-type-options") === "nosniff");
  check("X-Frame-Options: DENY", h("x-frame-options") === "DENY");
  check("HSTS present", h("strict-transport-security").includes("max-age"));
  check("CSP forbids framing, objects and foreign form posts", /frame-ancestors 'none'/.test(h("content-security-policy")) && /object-src 'none'/.test(h("content-security-policy")) && /form-action 'self'/.test(h("content-security-policy")));
  check("X-Powered-By hidden", !login.headers.has("x-powered-by"));

  for (const p of ["/dashboard", "/documents", "/chat", "/categories", "/content", "/unanswered", "/admin/dashboard", "/admin/users", "/admin/audit"]) {
    const r = await get(p);
    check(`anonymous ${p} -> redirect to /login`, r.status === 307 && new URL(r.headers.get("location"), base).pathname === "/login", `(got ${r.status})`);
  }
  for (const p of ["/forgot-password", "/reset-password"]) check(`public ${p} -> 200`, (await get(p)).status === 200);

  const json = { "content-type": "application/json" };
  check("POST /api/chat anonymous -> 401", (await get("/api/chat", { method: "POST", headers: json, body: '{"message":"hi"}' })).status === 401);
  check("POST /api/documents/upload anonymous -> 401", (await get("/api/documents/upload", { method: "POST" })).status === 401);
  check("GET /api/documents/<id>/file anonymous -> 401", (await get("/api/documents/11111111-1111-4111-8111-111111111111/file")).status === 401);
  check("POST /api/jobs/process without secret -> 401", (await get("/api/jobs/process", { method: "POST" })).status === 401);
  check("POST /api/jobs/process wrong secret -> 401", (await get("/api/jobs/process", { method: "POST", headers: { "x-job-secret": "x".repeat(32) } })).status === 401);
  check("unknown page -> 307/404 (no stack trace)", [307, 404].includes((await get("/definitely-not-a-page")).status));
} catch (e) {
  fail++;
  console.log("FAIL ", String(e));
} finally {
  server.kill();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
