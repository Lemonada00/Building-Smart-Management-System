create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 employee_id text not null unique check (employee_id ~ '^[a-z0-9-]{2,32}$'),
 name text not null check (length(trim(name)) > 0),
 department text not null check (length(trim(department)) > 0),
 avatar_url text
);
create table public.projects (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 city text not null,
 customer_name text not null,
 project_type text not null check (project_type in ('商业地产','工业园区','住宅','政府项目')),
 is_active boolean not null default true
);
create table public.project_memberships (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade,
 role text not null check (role in ('inspector','contractor','admin')),
 is_active boolean not null default true,
 unique(user_id,project_id,role)
);
create index on public.project_memberships(project_id);
create table private.login_identities (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 membership_id uuid references public.project_memberships(id) on delete set null,
 revoked boolean not null default false
);
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;
alter table private.login_identities enable row level security;
revoke all on public.profiles, public.projects, public.project_memberships from anon, authenticated;
grant select on public.profiles, public.projects, public.project_memberships to authenticated;
grant all on public.profiles, public.projects, public.project_memberships to service_role;

-- auth.sessions is not available to ordinary users. This private helper performs
-- the minimal privileged lookup and never accepts a user or session from callers.
create function private.valid_session() returns uuid
language sql stable security definer set search_path = ''
as $$
 select s.id from auth.sessions s
 where s.id = nullif(auth.jwt()->>'session_id','')::uuid and s.user_id = auth.uid()
 and auth.uid() is not null
 and not exists (select 1 from private.login_identities i where i.session_id=s.id and i.revoked)
$$;
create function private.current_membership() returns uuid
language sql stable security definer set search_path = ''
as $$
 select m.id from private.login_identities i
 join public.project_memberships m on m.id=i.membership_id and m.user_id=auth.uid() and m.is_active
 join public.projects p on p.id=m.project_id and p.is_active
 where i.session_id=private.valid_session() and i.user_id=auth.uid() and not i.revoked
$$;
create function private.current_project() returns uuid
language sql stable security definer set search_path = ''
as $$
 select m.project_id from public.project_memberships m
 where m.id=private.current_membership() and m.user_id=auth.uid()
$$;
create policy profiles_self on public.profiles for select to authenticated
 using (id=(select auth.uid()) and (select private.valid_session()) is not null);
create policy memberships_self on public.project_memberships for select to authenticated
 using (user_id=(select auth.uid()) and (select private.valid_session()) is not null);
create policy projects_current on public.projects for select to authenticated
 using (id=(select private.current_project()) and is_active);

create function private.login_context() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare sid uuid := private.valid_session(); result jsonb;
begin
 if auth.uid() is null or sid is null then
  raise exception '登录已失效，请重新登录' using errcode='42501';
 end if;
 select jsonb_build_object(
  'profile',(select to_jsonb(p) from public.profiles p where p.id=auth.uid()),
  'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'project_id',m.project_id,'project_name',p.name,'role',m.role) order by p.name,m.role)
   from public.project_memberships m join public.projects p on p.id=m.project_id
   where m.user_id=auth.uid() and m.is_active and p.is_active),'[]'::jsonb),
  'selected',exists(select 1 from private.login_identities i where i.session_id=sid and i.user_id=auth.uid()),
  'activeIdentity',(select jsonb_build_object('id',m.id,'project_id',m.project_id,'project_name',p.name,'role',m.role)
   from public.project_memberships m join public.projects p on p.id=m.project_id
   where m.id=private.current_membership() and m.user_id=auth.uid())
 ) into result;
 return result;
end $$;

create function private.choose_identity(chosen uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare sid uuid := private.valid_session(); actual uuid; is_revoked boolean;
begin
 if auth.uid() is null or sid is null then
  raise exception '登录已失效，请重新登录' using errcode='42501';
 end if;
 if not exists(select 1 from public.project_memberships m join public.projects p on p.id=m.project_id
   where m.id=chosen and m.user_id=auth.uid() and m.is_active and p.is_active) then
  raise exception '该身份不可用，请重新登录' using errcode='42501';
 end if;
 insert into private.login_identities(session_id,user_id,membership_id) values(sid,auth.uid(),chosen)
 on conflict(session_id) do nothing;
 select membership_id,revoked into actual,is_revoked from private.login_identities
 where session_id=sid and user_id=auth.uid();
 if actual is distinct from chosen or is_revoked then
  raise exception '本次登录身份已确定，切换身份请先退出登录' using errcode='42501';
 end if;
end $$;

create function private.revoke_login_identity() returns void
language plpgsql security definer set search_path = ''
as $$
declare sid uuid;
begin
 select s.id into sid from auth.sessions s
 where s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=auth.uid();
 if auth.uid() is null or sid is null then return; end if;
 insert into private.login_identities(session_id,user_id,membership_id,revoked)
 values(sid,auth.uid(),null,true)
 on conflict(session_id) do update set revoked=true;
end $$;

create function public.get_login_context() returns jsonb
language sql security invoker set search_path = '' as $$ select private.login_context() $$;
create function public.choose_identity(membership_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.choose_identity(membership_id) $$;
create function public.revoke_login_identity() returns void
language sql security invoker set search_path = '' as $$ select private.revoke_login_identity() $$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.valid_session(),private.current_membership(),private.current_project(),
 private.login_context(),private.choose_identity(uuid),private.revoke_login_identity() to authenticated;
revoke all on function public.get_login_context(),public.choose_identity(uuid),public.revoke_login_identity() from public,anon;
grant execute on function public.get_login_context(),public.choose_identity(uuid),public.revoke_login_identity() to authenticated;
