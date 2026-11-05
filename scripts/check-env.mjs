// Validates configuration without printing any secret values. Usage: npm run check-env
const required = [
  ["NEXT_PUBLIC_SUPABASE_URL", "public", (v) => /^https?:\/\//.test(v)],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "public", (v) => v.length > 20],
  ["SUPABASE_SERVICE_ROLE_KEY", "secret", (v) => v.length > 20],
  ["NEXT_PUBLIC_APP_URL", "public", (v) => /^https?:\/\//.test(v)],
  ["GEMINI_API_KEY", "secret", (v) => v.length > 10],
  ["JOB_RUNNER_SECRET", "secret", (v) => v.length >= 16],
];
const optional = ["GEMINI_EMBEDDING_MODEL", "GEMINI_CHAT_MODEL", "RAG_TOP_K", "RAG_MIN_SIMILARITY", "BOOTSTRAP_ADMIN_EMAILS", "BOOTSTRAP_ADMIN_PASSWORD"];

let bad = 0;
for (const [name, kind, valid] of required) {
  const v = process.env[name];
  const state = !v ? "MISSING" : valid(v) ? "ok" : "INVALID";
  if (state !== "ok") bad++;
  console.log(`${state.padEnd(8)} ${name} (${kind})`);
}
for (const name of optional) console.log(`${(process.env[name] ? "set" : "default").padEnd(8)} ${name}`);
if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
  console.log("DANGER   a secret is exposed with a NEXT_PUBLIC_ prefix"); bad++;
}
if ((process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("http://") && process.env.NODE_ENV === "production") {
  console.log("WARN     NEXT_PUBLIC_APP_URL should be https in production");
}
console.log(bad ? `\n${bad} problem(s) found.` : "\nConfiguration looks complete.");
process.exit(bad ? 1 : 0);
