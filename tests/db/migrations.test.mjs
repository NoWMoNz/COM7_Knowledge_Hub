import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../../supabase/migrations/", import.meta.url);
const db = new PGlite();
// 768-dim unit vector along axis i (or a blend), as JSON for jsonb / text for vector
const vec = (i, j = null, wj = 0) => Array.from({ length: 768 }, (_, k) => (k === i ? 1 - wj : k === j ? wj : 0));
const chunksJson = (arr) => JSON.stringify(arr.map((c, n) => ({ chunk_index: n, embedding: c.e, embedding_model: "test", ...c.c }))).replace(/'/g, "''");
const vtxt = (v) => `'{${v.join(",")}}'::extensions.vector`;
let pass = 0, fail = 0;
const ok = (n, c, extra = "") => { if (c) pass++; else fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n} ${c ? "" : extra}`); };
const throws = async (n, sql) => { try { await db.exec(sql); ok(n, false, "(no error)"); } catch { ok(n, true); } };
const as = async (uid, role = "authenticated") => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid ?? ""}',false); set role ${role};`);
};
const q = async (sql) => (await db.query(sql)).rows;

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
grant usage on schema auth, public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
// PGlite has no pgvector build: emulate the vector type + cosine-distance operator so the SQL logic
// (permission filter, ordering, thresholds) still runs. The real extension/HNSW index must be verified on Supabase.
await db.exec(`
create schema extensions;
create domain extensions.vector as float8[];
create function extensions.cos_dist(a float8[], b float8[]) returns float8 language sql immutable as $$
  select 1 - (sum(x*y) / nullif(sqrt(sum(x*x)) * sqrt(sum(y*y)), 0)) from unnest(a, b) as t(x, y) $$;
create operator extensions.<=> (leftarg = float8[], rightarg = float8[], function = extensions.cos_dist);
grant usage on schema extensions to anon, authenticated, service_role;
`);
const adapt = (sql) => sql
  .replace(/create extension if not exists vector[^;]*;/g, "")
  .replace(/create schema if not exists extensions;/g, "")
  .replace(/create index document_chunks_embedding_idx[^;]*;/g, "")
  .replace(/extensions\.vector\(768\)/g, "extensions.vector")
  .replace(/\(c->'embedding'\)::text::extensions\.vector/g, "translate((c->'embedding')::text, '[]', '{}')::extensions.vector");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  await db.exec(adapt(readFileSync(new URL(f, dir), "utf8")));
  console.log("applied", f);
}

const [emp, emp2, km, adm] = ["emp@x.t", "emp2@x.t", "km@x.t", "adm@x.t"];
const ids = {};
for (const e of [emp, emp2, km, adm]) ids[e] = (await q(`insert into auth.users(email) values ('${e}') returning id`))[0].id;
await db.exec(`update profiles set role_id=(select id from roles where key='knowledge_manager') where email='${km}';
               update profiles set role_id=(select id from roles where key='admin') where email='${adm}';`);
ok("profile auto-created w/ employee role", (await q(`select count(*)::int c from profiles p join roles r on r.id=p.role_id where r.key='employee'`))[0].c === 2);
ok("7 default categories", (await q(`select count(*)::int c from categories`))[0].c === 7);

// --- profiles / RBAC ---
await as(ids[emp]);
ok("employee sees only own profile", (await q(`select * from profiles`)).length === 1);
await throws("employee cannot self-promote", `update profiles set role_id=(select id from roles where key='admin') where id='${ids[emp]}'`);
ok("employee can edit own name", (await db.query(`update profiles set full_name='A' where id='${ids[emp]}' returning id`)).rows.length === 1);
await throws("employee cannot write audit_logs", `insert into audit_logs(action,resource_type) values('x','y')`);
await throws("employee cannot create category", `insert into categories(name) values('Hack')`);
await throws("employee cannot call claim_processing_job", `select * from claim_processing_job()`);
await as(ids[adm]);
ok("admin sees all profiles", (await q(`select * from profiles`)).length === 4);
await as(ids[km]);
ok("KM can create category", (await db.query(`insert into categories(name) values('X') returning id`)).rows.length === 1);

// --- documents ---
await as(ids[km]);
const doc = (await q(`insert into documents(title, created_by) values ('Doc A','${ids[km]}') returning id`))[0].id;
const v1 = (await q(`insert into document_versions(document_id,version_number,storage_path,original_filename,file_ext,mime_type,file_size,file_hash,status)
  values ('${doc}',1,'p1','a.txt','txt','text/plain',10,'h1','processing') returning id`))[0].id;
await db.exec(`update documents set latest_version_id='${v1}' where id='${doc}'`);
await as(ids[emp]);
ok("employee cannot see doc before Ready", (await q(`select * from documents`)).length === 0);
await throws("employee cannot insert document", `insert into documents(title) values ('evil')`);
await throws("authenticated cannot call complete_version_processing", `select complete_version_processing('${v1}','${chunksJson([{ c: { content: "x" }, e: vec(0) }])}')`);

await as(null, "service_role");
const claimed = await q(`select * from claim_processing_job()`);
ok("no job yet -> claim returns nothing", claimed.length === 0);
await as(null, "service_role");
await db.exec(`insert into processing_jobs(version_id,status) values ('${v1}','queued')`);
const c1 = await q(`select * from claim_processing_job()`);
ok("claim returns job, attempts=1", c1.length === 1 && c1[0].attempts === 1 && c1[0].status === "running");
ok("second claim empty (locked)", (await q(`select * from claim_processing_job()`)).length === 0);
await db.exec(`select complete_version_processing('${v1}','${chunksJson([{ c: { content: "hello", page_number: 1 }, e: vec(0) }, { c: { content: "world" }, e: vec(1) }])}')`);
await db.exec(`select complete_version_processing('${v1}','${chunksJson([{ c: { content: "hello", page_number: 1 }, e: vec(0) }, { c: { content: "world" }, e: vec(1) }])}')`);
ok("idempotent re-run keeps 2 chunks", (await q(`select count(*)::int c from document_chunks where version_id='${v1}'`))[0].c === 2);
await throws("empty chunk list rejected", `select complete_version_processing('${v1}','[]')`);

await as(ids[emp]);
ok("employee sees doc after Ready", (await q(`select * from documents`)).length === 1);
ok("employee sees chunks", (await q(`select * from document_chunks`)).length === 2);
ok("employee sees current version row only", (await q(`select * from document_versions`)).length === 1);
ok("employee cannot see jobs", (await q(`select * from processing_jobs`)).length === 0);

// --- restricted access ---
await as(ids[km]);
await db.exec(`update documents set access_level='restricted' where id='${doc}'`);
await as(ids[emp]);
ok("restricted doc hidden w/o grant", (await q(`select * from documents`)).length === 0);
ok("restricted chunks hidden w/o grant", (await q(`select * from document_chunks`)).length === 0);
await as(ids[adm]);
const dept = (await q(`insert into departments(name) values ('D1') returning id`))[0].id;
await db.exec(`insert into user_departments values ('${ids[emp]}','${dept}')`);
await as(ids[km]);
await db.exec(`insert into document_access(document_id,grantee_type,grantee_id) values ('${doc}','department','${dept}')`);
await as(ids[emp]);
ok("dept member sees restricted doc", (await q(`select * from documents`)).length === 1);
await as(ids[emp2]);
ok("non-member (other department) cannot see it", (await q(`select * from documents`)).length === 0);
ok("non-member cannot see its chunks", (await q(`select * from document_chunks`)).length === 0);

// --- versioning ---
await as(ids[km]);
const v2 = (await q(`insert into document_versions(document_id,version_number,storage_path,original_filename,file_ext,mime_type,file_size,file_hash,status)
  values ('${doc}',2,'p2','a2.txt','txt','text/plain',10,'h2','processing') returning id`))[0].id;
await db.exec(`update documents set latest_version_id='${v2}' where id='${doc}'`);
await db.exec(`update document_versions set status='failed', error_code='corrupt' where id='${v2}'`);
ok("failed replacement keeps v1 current", (await q(`select current_version_id from documents`))[0].current_version_id === v1);
await db.exec(`update document_versions set status='processing' where id='${v2}'`);
await as(null, "service_role");
await db.exec(`select complete_version_processing('${v2}','${chunksJson([{ c: { content: "new" }, e: vec(2) }])}')`);
await as(ids[km]);
ok("v2 Ready becomes current", (await q(`select current_version_id from documents`))[0].current_version_id === v2);
await as(ids[emp]);
const ch = await q(`select content from document_chunks`);
ok("old version chunks not visible; only new", ch.length === 1 && ch[0].content === "new");
await as(null, "service_role");
await db.exec(`select complete_version_processing('${v1}','${chunksJson([{ c: { content: "old" }, e: vec(3) }])}')`);
await as(ids[km]);
ok("late re-processing of older version does not downgrade current", (await q(`select current_version_id from documents`))[0].current_version_id === v2);

// --- category restrict, audit immutability ---
await as(ids[km]);
const cat = (await q(`insert into categories(name) values ('InUse') returning id`))[0].id;
await db.exec(`update documents set category_id='${cat}'`);
await throws("cannot delete category in use", `delete from categories where id='${cat}'`);
await as(null, "service_role");
await db.exec(`insert into audit_logs(action,resource_type) values ('t','t')`);
await throws("audit update blocked", `update audit_logs set action='z'`);
await throws("audit delete blocked", `delete from audit_logs`);
await as(ids[adm]);
ok("admin can read audit", (await q(`select * from audit_logs`)).length === 1);
await as(ids[emp]);
ok("employee cannot read audit", (await q(`select * from audit_logs`)).length === 0);
await as(null, "anon");
await throws("anon cannot read documents", `select * from documents`);


// ================= Phase 3: vector search + chat =================
await as(ids[km]);
const mkDoc = async (title, level) => {
  const d = (await q(`insert into documents(title, access_level) values ('${title}','${level}') returning id`))[0].id;
  const v = (await q(`insert into document_versions(document_id,version_number,storage_path,original_filename,file_ext,mime_type,file_size,file_hash,status)
    values ('${d}',1,'p-${title}','f.pdf','pdf','application/pdf',1,'h-${title}','processing') returning id`))[0].id;
  await db.exec(`update documents set latest_version_id='${v}' where id='${d}'`);
  return { d, v };
};
const pub = await mkDoc("Public", "company");
const sec = await mkDoc("Secret", "restricted");
await db.exec(`insert into document_access(document_id,grantee_type,grantee_id) values ('${sec.d}','department','${dept}')`);
await as(null, "service_role");
await db.exec(`select complete_version_processing('${pub.v}','${chunksJson([{ c: { content: "pub-A", page_number: 2 }, e: vec(10) }, { c: { content: "pub-B" }, e: vec(11) }])}')`);
await db.exec(`select complete_version_processing('${sec.v}','${chunksJson([{ c: { content: "secret-A" }, e: vec(10) }])}')`);
await db.exec(`insert into document_chunks(document_id,version_id,chunk_index,content,char_count,embedding) values ('${pub.d}','${pub.v}',99,'no-embedding',12,null)`);
await throws("completing a version without embeddings is rejected", `select complete_version_processing('${pub.v}','[{"chunk_index":0,"content":"x"}]')`);

const search = async (v, k = 6, min = 0.5) => q(`select * from match_document_chunks(${vtxt(v)}, ${k}, ${min})`);
await as(ids[emp]); // member of dept D1 -> may see restricted doc
let r = await search(vec(10));
ok("dept member: gets public + restricted chunk", r.map((x) => x.content).sort().join() === "pub-A,secret-A");
ok("results carry title/version/page for citations", r.find((x) => x.content === "pub-A").document_title === "Public" && r.find((x) => x.content === "pub-A").page_number === 2);
await as(ids[emp2]); // not in dept
r = await search(vec(10));
ok("non-member NEVER receives restricted chunk", r.length === 1 && r[0].content === "pub-A");
ok("chunk without embedding is never returned", (await search(vec(10), 20, 0)).every((x) => x.content !== "no-embedding"));
ok("min_similarity filters orthogonal matches", (await search(vec(12))).length === 0);
r = await search(vec(10, 11, 0.4), 6, 0.1);
ok("ranked by similarity (A before B)", r[0].content === "pub-A" && r[1].content === "pub-B" && r[0].similarity > r[1].similarity);
ok("match_count is respected", (await search(vec(10, 11, 0.4), 1, 0.1)).length === 1);
await as(ids[km]);
ok("manager search sees restricted too", (await search(vec(10))).length === 2);
await as(null, "anon");
await throws("anon cannot call match_document_chunks", `select * from match_document_chunks(${vtxt(vec(10))}, 6, 0.5)`);

// chat RLS
await as(ids[emp]);
const sess = (await q(`insert into chat_sessions(user_id,title) values ('${ids[emp]}','t') returning id`))[0].id;
await throws("user cannot create session for someone else", `insert into chat_sessions(user_id) values ('${ids[emp2]}')`);
await throws("user cannot forge messages", `insert into chat_messages(session_id,role,content) values ('${sess}','assistant','fake')`);
await as(null, "service_role");
const msg = (await q(`insert into chat_messages(session_id,role,content,answered) values ('${sess}','assistant','hi',true) returning id`))[0].id;
await db.exec(`insert into message_sources(message_id,source_index,document_title,version_number) values ('${msg}',1,'Public',1)`);
await db.exec(`insert into unanswered_questions(user_id,question,reason) values ('${ids[emp]}','q?','no_relevant_content')`);
await as(ids[emp]);
ok("owner reads own messages + sources", (await q(`select * from chat_messages`)).length === 1 && (await q(`select * from message_sources`)).length === 1);
ok("employee cannot read unanswered_questions", (await q(`select * from unanswered_questions`)).length === 0);
await as(ids[emp2]);
ok("other user cannot read the session", (await q(`select * from chat_sessions`)).length === 0);
ok("other user cannot read messages/sources", (await q(`select * from chat_messages`)).length === 0 && (await q(`select * from message_sources`)).length === 0);
await as(ids[km]);
ok("manager reviews unanswered questions", (await q(`select * from unanswered_questions`)).length === 1);
ok("manager can resolve one", (await db.query(`update unanswered_questions set status='resolved' returning id`)).rows.length === 1);
await throws("manager cannot insert unanswered rows directly", `insert into unanswered_questions(question,reason) values ('x','no_relevant_content')`);
await as(ids[adm]);
ok("admin cannot read other users' chats", (await q(`select * from chat_messages`)).length === 0);


// ================= Phase 4: admin safeguards =================
await as(ids[adm]);
await throws("cannot demote/deactivate the last active admin", `update profiles set is_active=false where id='${ids[adm]}'`);
await throws("cannot change the last admin to employee", `update profiles set role_id=(select id from roles where key='employee') where id='${ids[adm]}'`);
await as(null, "service_role");
await throws("service role is also blocked from removing the last admin", `update profiles set is_active=false where id='${ids[adm]}'`);
await db.exec(`update profiles set role_id=(select id from roles where key='admin') where id='${ids[km]}'`); // second admin
await as(ids[adm]);
ok("with a second admin, demotion is allowed", (await db.query(`update profiles set role_id=(select id from roles where key='employee') where id='${ids[adm]}' returning id`)).rows.length === 1);
await as(null, "service_role");
await db.exec(`update profiles set role_id=(select id from roles where key='admin') where id='${ids[adm]}'; update profiles set role_id=(select id from roles where key='knowledge_manager') where id='${ids[km]}'`);

await as(ids[adm]);
await throws("cannot remove critical admin permission", `delete from role_permissions where permission='role:manage' and role_id=(select id from roles where key='admin')`);
await throws("cannot delete a system role", `delete from roles where key='employee'`);
const custom = (await q(`insert into roles(key,name) values ('auditor','Auditor') returning id`))[0].id;
await db.exec(`insert into role_permissions(role_id,permission) values ('${custom}','audit:read')`);
ok("admin can create a custom role with permissions", (await q(`select * from role_permissions where role_id='${custom}'`)).length === 1);
await db.exec(`delete from role_permissions where role_id='${custom}'; delete from roles where id='${custom}'`);
ok("custom roles can be removed", (await q(`select * from roles where key='auditor'`)).length === 0);
ok("admin holds access:manage", (await q(`select 1 from role_permissions rp join roles r on r.id=rp.role_id where r.key='admin' and rp.permission='access:manage'`)).length === 1);
await as(ids[km]);
await throws("manager cannot create roles", `insert into roles(key,name) values ('x','X')`);
await throws("manager cannot edit department membership", `insert into user_departments values ('${ids[emp2]}','${dept}')`);


// ================= Follow-up: inactive users + curated content =================
await db.exec("reset role");
const inactive = (await q(`insert into auth.users(email) values ('gone@x.t') returning id`))[0].id;
await as(ids[emp2]);
ok("active user reads categories/roles/departments", (await q(`select * from categories`)).length > 0 && (await q(`select * from roles`)).length > 0);
await as(null, "service_role");
await db.exec(`update profiles set is_active=false where id='${inactive}'`);
await as(inactive);
ok("deactivated user (valid JWT) cannot read catalog tables", (await q(`select * from categories`)).length === 0 && (await q(`select * from roles`)).length === 0 && (await q(`select * from departments`)).length === 0);
ok("deactivated user cannot read role_permissions", (await q(`select * from role_permissions`)).length === 0);
await throws("deactivated user cannot start a chat session", `insert into chat_sessions(user_id) values ('${inactive}')`);
await as(null, "service_role");
await db.exec(`update profiles set is_active=true where id='${inactive}'`);

await as(ids[km]);
const ann = (await q(`insert into content_items(kind,title,body,created_by) values ('announcement','Hello','Body','${ids[km]}') returning id`))[0].id;
await db.exec(`insert into content_items(kind,title,body,is_published) values ('announcement','Draft','x',false)`);
await db.exec(`insert into content_items(kind,title,url) values ('quick_link','Payroll','https://example.com/x'), ('quick_link','Internal','/documents')`);
await db.exec(`insert into content_items(kind,title,body) values ('faq','Q?','A.')`);
ok("manager sees drafts too", (await q(`select * from content_items`)).length === 5);
await as(ids[emp2]);
ok("employee sees only published content", (await q(`select * from content_items`)).length === 4 && (await q(`select * from content_items where title='Draft'`)).length === 0);
await throws("employee cannot write content", `insert into content_items(kind,title,body) values ('announcement','x','y')`);
ok("employee cannot update or delete content (no rows affected)", (await db.query(`update content_items set title='hacked' where id='${ann}' returning id`)).rows.length === 0 && (await db.query(`delete from content_items where id='${ann}' returning id`)).rows.length === 0);
await as(ids[km]);
for (const [name, sql] of [
  ["javascript: URL rejected", `insert into content_items(kind,title,url) values ('quick_link','x','javascript:alert(1)')`],
  ["protocol-relative URL rejected", `insert into content_items(kind,title,url) values ('quick_link','x','//evil.com')`],
  ["quick link requires a URL", `insert into content_items(kind,title) values ('quick_link','x')`],
  ["FAQ requires an answer", `insert into content_items(kind,title) values ('faq','x')`],
  ["unknown kind rejected", `insert into content_items(kind,title,body) values ('banner','x','y')`],
]) await throws(name, sql);
await as(null, "anon");
await throws("anon cannot read content", `select * from content_items`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
