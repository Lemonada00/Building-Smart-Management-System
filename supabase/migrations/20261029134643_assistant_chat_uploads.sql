insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('assistant-chat-images','assistant-chat-images',true,10485760,array['image/jpeg','image/png','image/webp']);
create table public.assistant_uploads (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.assistant_sessions(id) on delete cascade,
 object_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=10485760),
 original_name text not null,
 created_at timestamptz not null default now()
);
alter table public.assistant_uploads enable row level security;
revoke all on public.assistant_uploads from public,anon,authenticated;
grant select on public.assistant_uploads to authenticated;
create policy assistant_uploads_read on public.assistant_uploads for select to authenticated using(
 exists(select 1 from public.assistant_sessions s where s.id=session_id)
);
create function private.register_assistant_upload(p_session uuid,p_id uuid,p_mime text,p_size bigint,p_name text) returns text
language plpgsql security definer set search_path='' as $$
declare s public.assistant_sessions; path text;
begin
 select * into s from public.assistant_sessions where id=p_session;
 if s.id is null or s.closed or s.user_id<>auth.uid() or s.auth_session_id is distinct from private.valid_session()
 or s.membership_id is distinct from private.current_membership() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 path:=p_session::text||'/'||p_id::text;
 insert into public.assistant_uploads(id,session_id,object_path,mime_type,size_bytes,original_name)
 values(p_id,p_session,path,p_mime,p_size,left(p_name,180));
 return path;
end $$;
create function private.remove_assistant_uploads(p_session uuid,p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.assistant_sessions s where s.id=p_session and not s.closed and s.user_id=auth.uid()
 and s.auth_session_id=private.valid_session() and s.membership_id=private.current_membership())
 then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 delete from public.assistant_uploads where session_id=p_session and id=any(p_ids);
end $$;
create function private.close_assistant_session() returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid; paths jsonb;
begin
 select id into sid from public.assistant_sessions where auth_session_id=private.valid_session()
 and membership_id=private.current_membership() and user_id=auth.uid() for update;
 if sid is null then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(object_path),'[]'::jsonb) into paths from public.assistant_uploads where session_id=sid;
 update public.assistant_sessions set closed=true,messages='[]',revision=revision+1,updated_at=now() where id=sid;
 delete from public.assistant_uploads where session_id=sid;
 return paths;
end $$;
create function public.register_assistant_upload(p_session uuid,p_id uuid,p_mime text,p_size bigint,p_name text) returns text
language sql security invoker set search_path='' as $$ select private.register_assistant_upload(p_session,p_id,p_mime,p_size,p_name) $$;
create function public.remove_assistant_uploads(p_session uuid,p_ids uuid[]) returns void
language sql security invoker set search_path='' as $$ select private.remove_assistant_uploads(p_session,p_ids) $$;
create function public.close_assistant_session() returns jsonb
language sql security invoker set search_path='' as $$ select private.close_assistant_session() $$;
revoke all on function private.register_assistant_upload(uuid,uuid,text,bigint,text),private.remove_assistant_uploads(uuid,uuid[]),private.close_assistant_session(),public.register_assistant_upload(uuid,uuid,text,bigint,text),public.remove_assistant_uploads(uuid,uuid[]),public.close_assistant_session() from public,anon,authenticated;
grant execute on function private.register_assistant_upload(uuid,uuid,text,bigint,text),private.remove_assistant_uploads(uuid,uuid[]),private.close_assistant_session(),public.register_assistant_upload(uuid,uuid,text,bigint,text),public.remove_assistant_uploads(uuid,uuid[]),public.close_assistant_session() to authenticated;
