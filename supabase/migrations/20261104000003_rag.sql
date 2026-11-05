-- Phase 3: pgvector, permission-aware vector search, chat history, unanswered questions.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- ---------- embeddings ----------
alter table public.document_chunks
  add column embedding extensions.vector(768),   -- keep in sync with EMBEDDING_DIMENSIONS
  add column embedding_model text,
  add column embedded_at timestamptz;

create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- A version becomes Ready only together with its embeddings (Ready = searchable by the AI).
create or replace function public.complete_version_processing(p_version_id uuid, p_chunks jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_doc uuid; v_num int;
begin
  if p_chunks is null or jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'no chunks to store';
  end if;
  if exists (select 1 from jsonb_array_elements(p_chunks) c where c->'embedding' is null or jsonb_typeof(c->'embedding') <> 'array') then
    raise exception 'every chunk needs an embedding';
  end if;

  select document_id, version_number into v_doc, v_num
    from public.document_versions where id = p_version_id for update;
  if not found then raise exception 'version not found'; end if;

  delete from public.document_chunks where version_id = p_version_id;
  insert into public.document_chunks
    (document_id, version_id, chunk_index, content, page_number, section, char_count, embedding, embedding_model, embedded_at)
  select v_doc, p_version_id, (c->>'chunk_index')::int, c->>'content',
         nullif(c->>'page_number', '')::int, nullif(c->>'section', ''), length(c->>'content'),
         (c->'embedding')::text::extensions.vector, c->>'embedding_model', now()
    from jsonb_array_elements(p_chunks) c;

  update public.document_versions
     set status = 'ready', error_code = null, error_message = null, processed_at = now()
   where id = p_version_id;

  update public.documents d set current_version_id = p_version_id
   where d.id = v_doc
     and (d.current_version_id is null
          or v_num > (select version_number from public.document_versions where id = d.current_version_id));

  update public.processing_jobs set status = 'succeeded', locked_at = null, last_error = null
   where version_id = p_version_id;
end $$;

-- ---------- permission-aware search ----------
-- SECURITY INVOKER on purpose: RLS (chunks_select) and can_access_document() both apply for the calling user,
-- so unauthorized chunks are never selected. The AI is never asked to "hide" anything.
create or replace function public.match_document_chunks(
  query_embedding extensions.vector(768),
  match_count int default 6,
  min_similarity float default 0.5
) returns table (
  chunk_id uuid, document_id uuid, version_id uuid, content text, page_number int, section text,
  similarity float, document_title text, version_number int, file_ext text
)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.document_id, c.version_id, c.content, c.page_number, c.section,
         (1 - (c.embedding <=> query_embedding))::float, d.title, v.version_number, v.file_ext
    from public.document_chunks c
    join public.documents d on d.id = c.document_id and d.current_version_id = c.version_id
    join public.document_versions v on v.id = c.version_id
   where c.embedding is not null
     and public.can_access_document(c.document_id)
     and (1 - (c.embedding <=> query_embedding)) >= min_similarity
   order by c.embedding <=> query_embedding
   limit least(greatest(match_count, 1), 20);
$$;

revoke execute on function public.match_document_chunks(extensions.vector, int, float) from public, anon;
grant execute on function public.match_document_chunks(extensions.vector, int, float) to authenticated;

-- ---------- chat ----------
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New conversation' check (length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_sessions_user_idx on public.chat_sessions(user_id, updated_at desc);
create trigger chat_sessions_updated before update on public.chat_sessions
  for each row execute function public.set_updated_at();

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  answered boolean,              -- assistant only: true = grounded answer, false = fallback
  language text check (language in ('th', 'en')),
  created_at timestamptz not null default now()
);
create index chat_messages_session_idx on public.chat_messages(session_id, created_at);

-- Snapshot of what each answer was based on. Titles/versions are copied so history stays accurate after edits/deletes.
create table public.message_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  source_index int not null,
  chunk_id uuid references public.document_chunks(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  version_id uuid references public.document_versions(id) on delete set null,
  document_title text not null,
  version_number int not null,
  file_ext text,
  page_number int,
  section text,
  similarity real,
  unique (message_id, source_index)
);

create table public.unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid references public.chat_sessions(id) on delete set null,
  question text not null,
  language text check (language in ('th', 'en')),
  reason text not null check (reason in ('no_relevant_content', 'model_declined', 'no_valid_citation', 'ai_unavailable')),
  top_similarity real,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
create index unanswered_status_idx on public.unanswered_questions(status, created_at desc);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.message_sources enable row level security;
alter table public.unanswered_questions enable row level security;

-- Users own their sessions. Messages/sources are written by the server only (service role), so users
-- cannot forge assistant answers or fake citations through the public API.
create policy chat_sessions_own on public.chat_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy chat_messages_read on public.chat_messages for select to authenticated
  using (exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy message_sources_read on public.message_sources for select to authenticated
  using (exists (select 1 from public.chat_messages m join public.chat_sessions s on s.id = m.session_id
                  where m.id = message_id and s.user_id = auth.uid()));
create policy unanswered_manage on public.unanswered_questions for select to authenticated
  using (public.has_permission('document:manage'));
create policy unanswered_resolve on public.unanswered_questions for update to authenticated
  using (public.has_permission('document:manage')) with check (public.has_permission('document:manage'));

revoke all on public.chat_messages, public.message_sources, public.unanswered_questions from anon;
revoke insert, update, delete on public.chat_messages, public.message_sources from authenticated;
revoke insert, delete on public.unanswered_questions from authenticated;
