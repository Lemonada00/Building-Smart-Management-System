create table public.assistant_sessions (
 id uuid primary key default gen_random_uuid(),
 auth_session_id uuid not null references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 membership_id uuid not null references public.project_memberships(id) on delete cascade,
 messages jsonb not null default '[]'::jsonb check(jsonb_typeof(messages)='array'),
 revision integer not null default 0 check(revision>=0),
 closed boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(auth_session_id,membership_id)
);
alter table public.assistant_sessions enable row level security;
revoke all on public.assistant_sessions from public,anon,authenticated;
grant select on public.assistant_sessions to authenticated;
create policy assistant_session_read on public.assistant_sessions for select to authenticated using(
 not closed and user_id=auth.uid() and auth_session_id=private.valid_session()
 and membership_id=private.current_membership()
);
-- Minimal privileged writes: ordinary accounts can only execute the guarded wrappers.
create function private.ensure_assistant_session() returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.valid_session(); mid uuid:=private.current_membership(); row public.assistant_sessions;
begin
 if sid is null or mid is null then raise exception 'IDENTITY_REQUIRED' using errcode='42501'; end if;
 insert into public.assistant_sessions(auth_session_id,user_id,membership_id) values(sid,auth.uid(),mid)
 on conflict(auth_session_id,membership_id) do nothing;
 select * into row from public.assistant_sessions where auth_session_id=sid and membership_id=mid and user_id=auth.uid();
 if row.closed then raise exception 'SESSION_CLOSED' using errcode='42501'; end if;
 return jsonb_build_object('id',row.id,'revision',row.revision,'messages',row.messages);
end $$;
create function private.save_assistant_snapshot(p_id uuid,p_revision integer,p_messages jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare row public.assistant_sessions; next_revision integer;
begin
 select * into row from public.assistant_sessions where id=p_id for update;
 if row.id is null or row.closed or row.user_id<>auth.uid() or row.auth_session_id is distinct from private.valid_session()
 or row.membership_id is distinct from private.current_membership() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if row.revision<>p_revision then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if jsonb_typeof(p_messages)<>'array' or octet_length(p_messages::text)>2097152
 or (select count(*) from jsonb_array_elements(p_messages) m where m->>'role'='user')>6
 or exists(select 1 from jsonb_array_elements(p_messages) m where m->>'role' not in ('user','assistant'))
 then raise exception 'INVALID_MESSAGES' using errcode='22023'; end if;
 update public.assistant_sessions set messages=p_messages,revision=revision+1,updated_at=now() where id=p_id returning revision into next_revision;
 return next_revision;
end $$;
create function public.ensure_assistant_session() returns jsonb language sql security invoker set search_path='' as $$
 select private.ensure_assistant_session()
$$;
create function public.save_assistant_snapshot(p_id uuid,p_revision integer,p_messages jsonb) returns integer language sql security invoker set search_path='' as $$
 select private.save_assistant_snapshot(p_id,p_revision,p_messages)
$$;
revoke all on function private.ensure_assistant_session(),private.save_assistant_snapshot(uuid,integer,jsonb),public.ensure_assistant_session(),public.save_assistant_snapshot(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.ensure_assistant_session(),private.save_assistant_snapshot(uuid,integer,jsonb),public.ensure_assistant_session(),public.save_assistant_snapshot(uuid,integer,jsonb) to authenticated;
