-- Phase 5 follow-up: (1) deactivated users lose read access immediately even with an unexpired JWT,
-- (2) manager-curated content for the dashboard (announcements, FAQ, quick links).

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;

-- Catalog tables were readable by any authenticated JWT; require an active account.
drop policy roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using (public.is_active_user());
drop policy role_perm_read on public.role_permissions;
create policy role_perm_read on public.role_permissions for select to authenticated using (public.is_active_user());
drop policy dept_read on public.departments;
create policy dept_read on public.departments for select to authenticated using (public.is_active_user());
drop policy categories_read on public.categories;
create policy categories_read on public.categories for select to authenticated using (public.is_active_user());

drop policy chat_sessions_own on public.chat_sessions;
create policy chat_sessions_own on public.chat_sessions for all to authenticated
  using (user_id = auth.uid() and public.is_active_user()) with check (user_id = auth.uid() and public.is_active_user());
drop policy chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages for select to authenticated
  using (public.is_active_user() and exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid()));
drop policy message_sources_read on public.message_sources;
create policy message_sources_read on public.message_sources for select to authenticated
  using (public.is_active_user() and exists (select 1 from public.chat_messages m join public.chat_sessions s on s.id = m.session_id
                                              where m.id = message_id and s.user_id = auth.uid()));

-- ---------- manager-curated dashboard content ----------
-- Empty by default. Nothing here is seeded: every row is written by an authorized person.
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('announcement', 'faq', 'quick_link')),
  title text not null check (length(btrim(title)) between 1 and 200),
  body text check (body is null or length(body) <= 5000),
  url text check (url is null or url ~ '^(https?://[^[:space:]]+|/[^/[:space:]][^[:space:]]*)$'),
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'quick_link' or url is not null),
  check (kind <> 'faq' or body is not null)
);
create index content_items_kind_idx on public.content_items(kind, is_published, sort_order, created_at desc);
create trigger content_items_updated before update on public.content_items
  for each row execute function public.set_updated_at();

alter table public.content_items enable row level security;
create policy content_read on public.content_items for select to authenticated
  using (public.is_active_user() and (is_published or public.has_permission('content:manage')));
create policy content_write on public.content_items for all to authenticated
  using (public.has_permission('content:manage')) with check (public.has_permission('content:manage'));
revoke all on public.content_items from anon;

insert into public.role_permissions (role_id, permission)
select r.id, 'content:manage' from public.roles r where r.key in ('knowledge_manager', 'admin')
on conflict do nothing;
