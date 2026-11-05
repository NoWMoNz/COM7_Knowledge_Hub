-- Phase 1 foundation: identity, RBAC, departments, categories, audit log, RLS.
-- Seeds below are SYSTEM CONFIG (roles/permissions/category labels), not company data.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- roles & permissions ----------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]+$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission text not null check (permission ~ '^[a-z_]+:[a-z_]+$'),
  primary key (role_id, permission)
);

insert into public.roles (key, name, description, is_system) values
  ('employee', 'Employee', 'Default role: read and ask', true),
  ('knowledge_manager', 'Knowledge Manager / HR', 'Manages knowledge content', true),
  ('admin', 'Admin', 'Full system administration', true);

insert into public.role_permissions (role_id, permission)
select r.id, p.perm from public.roles r
join (values
  ('knowledge_manager','category:manage'),
  ('admin','category:manage'),
  ('admin','user:read'),
  ('admin','user:manage'),
  ('admin','role:manage'),
  ('admin','department:manage'),
  ('admin','audit:read'),
  ('admin','admin:access')
) as p(role_key, perm) on p.role_key = r.key;

-- ---------- departments ----------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger departments_updated before update on public.departments
  for each row execute function public.set_updated_at();

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text check (full_name is null or length(full_name) <= 200),
  role_id uuid not null references public.roles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles(role_id);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_departments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, department_id)
);
create index user_departments_dept_idx on public.user_departments(department_id);

-- ---------- categories ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 120),
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

-- Initial category LABELS only (not verified company content). Admin-editable.
insert into public.categories (name, sort_order) values
  ('HR & Human Resources', 1), ('Company Policies', 2), ('Employee Benefits', 3),
  ('IT Support', 4), ('Work Procedures', 5), ('Finance', 6), ('General Information', 7);

-- ---------- audit log (append-only) ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id);

create or replace function public.audit_logs_immutable() returns trigger
language plpgsql as $$ begin raise exception 'audit_logs is append-only'; end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- ---------- permission helpers ----------
create or replace function public.has_permission(perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    where p.id = auth.uid() and p.is_active and rp.permission = perm
  );
$$;

-- ---------- new auth user -> profile (default role: employee) ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role_id)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data->>'full_name',
          (select id from public.roles where key = 'employee'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- block self privilege escalation ----------
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for service-role / migrations (trusted server paths)
  if auth.uid() is not null and not public.has_permission('user:manage') then
    if new.role_id is distinct from old.role_id
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
       or new.id is distinct from old.id then
      raise exception 'not allowed to change role, status or email';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard_trg before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------- RLS ----------
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.user_departments enable row level security;
alter table public.categories enable row level security;
alter table public.audit_logs enable row level security;

create policy roles_read on public.roles for select to authenticated using (true);
create policy roles_write on public.roles for all to authenticated
  using (public.has_permission('role:manage')) with check (public.has_permission('role:manage'));

create policy role_perm_read on public.role_permissions for select to authenticated using (true);
create policy role_perm_write on public.role_permissions for all to authenticated
  using (public.has_permission('role:manage')) with check (public.has_permission('role:manage'));

create policy dept_read on public.departments for select to authenticated using (true);
create policy dept_write on public.departments for all to authenticated
  using (public.has_permission('department:manage')) with check (public.has_permission('department:manage'));

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('user:read'));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.has_permission('user:manage')) with check (public.has_permission('user:manage'));

create policy user_dept_select on public.user_departments for select to authenticated
  using (user_id = auth.uid() or public.has_permission('user:read'));
create policy user_dept_write on public.user_departments for all to authenticated
  using (public.has_permission('user:manage')) with check (public.has_permission('user:manage'));

create policy categories_read on public.categories for select to authenticated using (true);
create policy categories_write on public.categories for all to authenticated
  using (public.has_permission('category:manage')) with check (public.has_permission('category:manage'));

create policy audit_read on public.audit_logs for select to authenticated
  using (public.has_permission('audit:read'));
-- No insert/update/delete policies: audit rows are written server-side with the service role only.

revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.audit_logs from authenticated;
