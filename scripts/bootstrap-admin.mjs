// Idempotent bootstrap: ensures each email in BOOTSTRAP_ADMIN_EMAILS exists and has the admin role.
// Usage: npm run bootstrap-admin   (reads .env.local via node --env-file)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const emails = (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
if (emails.length === 0) throw new Error("BOOTSTRAP_ADMIN_EMAILS is empty");

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: adminRole, error: roleErr } = await sb.from("roles").select("id").eq("key", "admin").single();
if (roleErr) throw new Error(`Cannot read roles (migrations applied?): ${roleErr.message}`);

async function findUserByEmail(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
}

for (const email of emails) {
  let user = await findUserByEmail(email);
  if (!user) {
    if (!password || password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD (12+ chars) is required to create new admins");
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { must_change_password: true } });
    if (error) throw error;
    user = data.user;
    console.log(`created user ${email}`);
  }
  const { data: profile } = await sb.from("profiles").select("role_id").eq("id", user.id).single();
  if (profile?.role_id === adminRole.id) {
    console.log(`${email}: already admin (no change)`);
    continue;
  }
  const { error } = await sb.from("profiles").update({ role_id: adminRole.id, is_active: true }).eq("id", user.id);
  if (error) throw error;
  await sb.from("audit_logs").insert({
    actor_id: null, action: "bootstrap_admin", resource_type: "profile", resource_id: user.id, metadata: { email },
  });
  console.log(`${email}: promoted to admin`);
}
