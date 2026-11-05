-- Phase 2: documents, versions, chunks (no embeddings yet), access grants, processing jobs, storage bucket.

-- Managers (and admins) may manage documents.
insert into public.role_permissions (role_id, permission)
select r.id, 'document:manage' from public.roles r where r.key in ('knowledge_manager', 'admin');

-- ---------- documents ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 2000),
  category_id uuid references public.categories(id) on delete restrict,
  -- company = every active employee once a version is Ready; restricted = only users matched by document_access
  access_level text not null default 'company' check (access_level in ('company', 'restricted')),
  current_version_id uuid,  -- active, searchable version (always a Ready version)
  latest_version_id uuid,   -- newest uploaded version (any status); drives status display
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_category_idx on public.documents(category_id);
create index documents_created_idx on public.documents(created_at desc);
create trigger documents_updated before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number int not null check (version_number > 0),
  storage_path text not null,
  original_filename text not null check (length(original_filename) between 1 and 255),
  file_ext text not null check (file_ext in ('pdf', 'docx', 'xlsx', 'pptx', 'txt')),
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  file_hash text not null,
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'ready', 'failed')),
  error_code text,
  error_message text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,  -- snapshot at upload time, so managers need not read other users' profiles
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (document_id, version_number)
);
create index document_versions_hash_idx on public.document_versions(file_hash);
create index document_versions_status_idx on public.document_versions(status);

alter table public.documents
  add constraint documents_current_version_fk foreign key (current_version_id)
    references public.document_versions(id) on delete set null,
  add constraint documents_latest_version_fk foreign key (latest_version_id)
    references public.document_versions(id) on delete set null;

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_id uuid not null references public.document_versions(id) on delete cascade,
  chunk_index int not null check (chunk_index >= 0),
  content text not null,
  page_number int,   -- only set when the extractor knows it (PDF page, PPTX slide)
  section text,      -- only set when known (e.g. XLSX sheet name)
  char_count int not null,
  created_at timestamptz not null default now(),
  unique (version_id, chunk_index)
);
create index document_chunks_document_idx on public.document_chunks(document_id);

-- Access grants for access_level = 'restricted'. grantee_id is polymorphic (role/department/user id).
create table public.document_access (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  grantee_type text not null check (grantee_type in ('role', 'department', 'user')),
  grantee_id uuid not null,
  created_at timestamptz not null default now(),
  unique (document_id, grantee_type, grantee_id)
);
create index document_access_grantee_idx on public.document_access(grantee_type, grantee_id);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null unique references public.document_versions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index processing_jobs_status_idx on public.processing_jobs(status, created_at);
create trigger processing_jobs_updated before update on public.processing_jobs
  for each row execute function public.set_updated_at();

-- ---------- single source of truth for document visibility ----------
-- Used by RLS now; Phase 3 vector search must call this inside the SQL search function.
create or replace function public.can_access_document(doc_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d
    where d.id = doc_id
      and (
        public.has_permission('document:manage')
        or (
          d.current_version_id is not null
          and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
          and (
            d.access_level = 'company'
            or exists (
              select 1 from public.document_access a
              where a.document_id = d.id
                and (
                  (a.grantee_type = 'user' and a.grantee_id = auth.uid())
                  or (a.grantee_type = 'role' and a.grantee_id = (select role_id from public.profiles where id = auth.uid()))
                  or (a.grantee_type = 'department' and a.grantee_id in
                        (select department_id from public.user_departments where user_id = auth.uid()))
                )
            )
          )
        )
      )
  );
$$;

-- ---------- worker functions (service role only) ----------
create or replace function public.claim_processing_job() returns setof public.processing_jobs
language plpgsql security definer set search_path = public as $$
declare v_job public.processing_jobs;
begin
  -- Jobs that crashed mid-run and have no attempts left are failed, not retried forever.
  with dead as (
    update public.processing_jobs
       set status = 'failed', last_error = coalesce(last_error, 'Processing timed out'), locked_at = null
     where status = 'running' and locked_at < now() - interval '10 minutes' and attempts >= max_attempts
    returning version_id
  )
  update public.document_versions v
     set status = 'failed', error_code = 'timeout', error_message = 'Processing timed out'
    from dead where v.id = dead.version_id;

  update public.processing_jobs j
     set status = 'running', attempts = j.attempts + 1, locked_at = now()
   where j.id = (
     select id from public.processing_jobs
      where attempts < max_attempts
        and (status = 'queued' or (status = 'running' and locked_at < now() - interval '10 minutes'))
      order by created_at
      limit 1
      for update skip locked
   )
  returning j.* into v_job;

  if v_job.id is not null then return next v_job; end if;
  return;
end $$;

-- Idempotent: replaces any previous chunks of this version, marks Ready, activates if newer than current.
create or replace function public.complete_version_processing(p_version_id uuid, p_chunks jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_doc uuid; v_num int;
begin
  if p_chunks is null or jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'no chunks to store';
  end if;

  select document_id, version_number into v_doc, v_num
    from public.document_versions where id = p_version_id for update;
  if not found then raise exception 'version not found'; end if;

  delete from public.document_chunks where version_id = p_version_id;
  insert into public.document_chunks (document_id, version_id, chunk_index, content, page_number, section, char_count)
  select v_doc, p_version_id, (c->>'chunk_index')::int, c->>'content',
         nullif(c->>'page_number', '')::int, nullif(c->>'section', ''), length(c->>'content')
    from jsonb_array_elements(p_chunks) c;

  update public.document_versions
     set status = 'ready', error_code = null, error_message = null, processed_at = now()
   where id = p_version_id;

  -- Activate only if this version is newer than the current one; a failed replacement never gets here.
  update public.documents d set current_version_id = p_version_id
   where d.id = v_doc
     and (d.current_version_id is null
          or v_num > (select version_number from public.document_versions where id = d.current_version_id));

  update public.processing_jobs set status = 'succeeded', locked_at = null, last_error = null
   where version_id = p_version_id;
end $$;

revoke execute on function public.claim_processing_job() from public, anon, authenticated;
revoke execute on function public.complete_version_processing(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_processing_job() to service_role;
grant execute on function public.complete_version_processing(uuid, jsonb) to service_role;

-- ---------- RLS ----------
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_chunks enable row level security;
alter table public.document_access enable row level security;
alter table public.processing_jobs enable row level security;

create policy documents_select on public.documents for select to authenticated
  using (public.can_access_document(id));
create policy documents_write on public.documents for all to authenticated
  using (public.has_permission('document:manage')) with check (public.has_permission('document:manage'));

-- Employees only see the current (active) version; managers see all versions.
create policy versions_select on public.document_versions for select to authenticated
  using (
    public.has_permission('document:manage')
    or (public.can_access_document(document_id)
        and id = (select current_version_id from public.documents d where d.id = document_id))
  );
create policy versions_write on public.document_versions for all to authenticated
  using (public.has_permission('document:manage')) with check (public.has_permission('document:manage'));

-- Chunks are readable only for the active version of a document the user may access. Written by the worker only.
create policy chunks_select on public.document_chunks for select to authenticated
  using (
    public.can_access_document(document_id)
    and version_id = (select current_version_id from public.documents d where d.id = document_id)
  );

create policy doc_access_manage on public.document_access for all to authenticated
  using (public.has_permission('document:manage')) with check (public.has_permission('document:manage'));

create policy jobs_select on public.processing_jobs for select to authenticated
  using (public.has_permission('document:manage'));

-- ---------- private storage bucket ----------
-- No storage.objects policies: only the server (service role) reads/writes; users get short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)
on conflict (id) do nothing;

-- Defense in depth: anonymous (signed-out) clients get no table privileges at all.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
