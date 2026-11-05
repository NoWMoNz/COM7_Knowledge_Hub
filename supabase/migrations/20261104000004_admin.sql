-- Phase 4: admin safeguards. Prevents the system from being locked out of administration.

-- Per-document access management (company / restricted + grants) is an admin function.
insert into public.role_permissions (role_id, permission)
select r.id, 'access:manage' from public.roles r where r.key = 'admin'
on conflict do nothing;

-- System roles cannot be deleted or re-keyed.
create or replace function public.roles_protect() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.is_system then raise exception 'system roles cannot be deleted'; end if;
  if tg_op = 'UPDATE' and old.is_system and (new.key <> old.key or new.is_system = false) then
    raise exception 'system roles cannot be modified this way';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger roles_protect_trg before update or delete on public.roles
  for each row execute function public.roles_protect();

-- The admin role always keeps the permissions needed to administer the system.
create or replace function public.role_permissions_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.permission in ('admin:access', 'role:manage', 'user:manage', 'user:read')
     and exists (select 1 from public.roles r where r.id = old.role_id and r.key = 'admin') then
    raise exception 'critical admin permissions cannot be removed';
  end if;
  return old;
end $$;
create trigger role_permissions_protect_trg before delete on public.role_permissions
  for each row execute function public.role_permissions_protect();

-- Never leave the system without an active admin.
create or replace function public.profiles_keep_admin() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_admin uuid := (select id from public.roles where key = 'admin');
begin
  if old.is_active and old.role_id = v_admin
     and (tg_op = 'DELETE' or new.is_active = false or new.role_id <> old.role_id)
     and not exists (select 1 from public.profiles p where p.id <> old.id and p.is_active and p.role_id = v_admin) then
    raise exception 'cannot remove the last active administrator';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger profiles_keep_admin_trg before update or delete on public.profiles
  for each row execute function public.profiles_keep_admin();
