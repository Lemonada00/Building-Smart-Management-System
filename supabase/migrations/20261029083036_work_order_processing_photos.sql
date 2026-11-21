create table public.work_order_photos (
 id uuid primary key default gen_random_uuid(),
 work_order_id uuid not null references public.work_orders(id),
 object_path text not null unique, original_name text not null check(length(trim(original_name))>0),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 size_bytes integer not null check(size_bytes between 1 and 10485760),
 uploader_id uuid not null references public.profiles(id),upload_session_id uuid not null,
 state text not null default 'staged' check(state in ('staged','attached','removed')),
 position integer check(position>=0),created_at timestamptz not null default now(),
 check(state<>'attached' or position is not null)
);
create index work_order_photos_order on public.work_order_photos(work_order_id);
create index work_order_photos_uploader on public.work_order_photos(uploader_id);
create unique index work_order_photos_position on public.work_order_photos(work_order_id,position) where state='attached';
alter table public.work_order_photos enable row level security;
revoke all on public.work_order_photos from public,anon,authenticated;
grant select on public.work_order_photos to authenticated;
grant all on public.work_order_photos to service_role;
create policy photos_read on public.work_order_photos for select to authenticated using(state='attached' and private.can_read_work_order(work_order_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('work-order-photos','work-order-photos',false,10485760,array['image/jpeg','image/png','image/webp']);
create or replace function private.work_order_actions() returns text[] language sql immutable set search_path='' as $$ select array['resolve','reject','reopen','assign','edit']::text[] $$;
create function private.photo_upload_allowed(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.work_order_photos p join public.work_orders w on w.id=p.work_order_id
 where p.object_path=path and p.state='staged' and p.uploader_id=auth.uid() and p.upload_session_id=private.valid_session()
 and p.created_at>now()-interval '24 hours' and private.allowed_work_order_actions(w)?'edit')
$$;
create function private.photo_read_allowed(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.work_order_photos p where p.object_path=path and p.state='attached' and private.can_read_work_order(p.work_order_id))
$$;
create policy work_order_photo_upload on storage.objects for insert to authenticated with check(bucket_id='work-order-photos' and private.photo_upload_allowed(name));
create policy work_order_photo_download on storage.objects for select to authenticated using(bucket_id='work-order-photos' and storage.allow_only_operation('storage.object.get_authenticated') and private.photo_read_allowed(name));
create function private.prepare_work_order_photo(p_number integer,p_name text,p_mime text,p_size integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.work_orders; pid uuid:=gen_random_uuid(); path text;
begin
 select * into w from public.work_orders where number=p_number for update;
 if w.id is null or not coalesce(private.allowed_work_order_actions(w)?'edit',false) then raise exception 'FORBIDDEN'; end if;
 if p_mime is null or p_mime not in ('image/jpeg','image/png','image/webp') or p_size is null or p_size not between 1 and 10485760 or nullif(trim(p_name),'') is null then raise exception 'VALIDATION_FAILED'; end if;
 path:=w.id::text||'/'||pid::text||case p_mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end;
 insert into public.work_order_photos(id,work_order_id,object_path,original_name,mime_type,size_bytes,uploader_id,upload_session_id)
 values(pid,w.id,path,p_name,p_mime,p_size,auth.uid(),private.valid_session());
 return jsonb_build_object('ok',true,'photoId',pid,'path',path,'bucket','work-order-photos');
end $$;
create function private.discard_work_order_photos(p_number integer,p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare wid uuid;
begin
 if private.current_membership() is null then raise exception 'IDENTITY_REQUIRED'; end if;
 select id into wid from public.work_orders where number=p_number for update;
 update public.work_order_photos set state='removed' where work_order_id=wid and id=any(p_ids) and state='staged' and uploader_id=auth.uid() and upload_session_id=private.valid_session();
 return jsonb_build_object('ok',true);
end $$;
create function public.prepare_work_order_photo(p_number integer,p_name text,p_mime text,p_size integer) returns jsonb language sql security invoker set search_path='' as $$ select private.prepare_work_order_photo(p_number,p_name,p_mime,p_size) $$;
create function public.discard_work_order_photos(p_number integer,p_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$ select private.discard_work_order_photos(p_number,p_ids) $$;
alter table public.work_order_records drop constraint work_order_records_changes_check1;
alter table public.work_order_records add constraint work_order_records_changes_check1 check((changes-array['status','assignee_id','severity','discipline','description','location','details','root_cause','prevention','photos'])='{}'::jsonb);
create function private.edit_work_order(w public.work_orders,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.work_orders; ch jsonb:='{}'; k text; ids uuid[]; item public.work_order_photos; meta jsonb; before_photos text; after_photos text; i integer:=0; photo_id uuid;
begin
 -- 即使直接调用私有函数也不能绕过事务入口的版本/身份验证。
 select * into old from public.work_orders where id=w.id for update;
 if not coalesce(private.allowed_work_order_actions(old)?'edit',false) then raise exception 'FORBIDDEN'; end if;
 if old.version<>w.version then raise exception 'CONFLICT'; end if;
 if jsonb_typeof(p) is distinct from 'object' or (p-array['severity','discipline','description','location','details','photoIds'])<>'{}'::jsonb then raise exception 'VALIDATION_FAILED'; end if;
 if exists(select 1 from jsonb_each(p) e where e.key<>'photoIds' and jsonb_typeof(e.value) not in ('string','null')) then raise exception 'VALIDATION_FAILED'; end if;
 w:=old;w.severity:=p->>'severity';w.discipline:=p->>'discipline';w.description:=nullif(trim(p->>'description'),'');w.location:=nullif(trim(p->>'location'),'');w.details:=nullif(trim(p->>'details'),'');
 if w.severity is null or w.severity not in ('minor','normal','major','urgent') or w.discipline is null or w.discipline not in ('architecture','structure','plumbing') or w.description is null or w.location is null or jsonb_typeof(p->'photoIds') is distinct from 'array' then raise exception 'VALIDATION_FAILED'; end if;
 begin select coalesce(array_agg(value::uuid),'{}'::uuid[]) into ids from jsonb_array_elements_text(p->'photoIds'); exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; end;
 if cardinality(ids)>9 or cardinality(ids)<>(select count(distinct v) from unnest(ids) v) then raise exception 'VALIDATION_FAILED'; end if;
 perform 1 from public.work_order_photos where work_order_id=w.id for update;
 if (select count(*) from public.work_order_photos where id=any(ids) and work_order_id=w.id)<>cardinality(ids) then raise exception 'VALIDATION_FAILED'; end if;
 for item in select * from public.work_order_photos where id=any(ids) loop
 if item.state='removed' or (item.state='staged' and (item.uploader_id<>auth.uid() or item.upload_session_id<>private.valid_session() or item.created_at<=now()-interval '24 hours')) then raise exception 'VALIDATION_FAILED'; end if;
 select metadata into meta from storage.objects where bucket_id='work-order-photos' and name=item.object_path;
 if meta is null or (meta->>'size')::bigint is distinct from item.size_bytes::bigint or meta->>'mimetype' is distinct from item.mime_type then raise exception 'PHOTO_NOT_READY'; end if;
 end loop;
 select string_agg(id::text||' '||original_name,E'\n' order by position) into before_photos from public.work_order_photos where work_order_id=w.id and state='attached';
 select string_agg(ph.id::text||' '||ph.original_name,E'\n' order by x.ord) into after_photos from unnest(ids) with ordinality x(id,ord) join public.work_order_photos ph on ph.id=x.id;
 foreach k in array array['severity','discipline','description','location','details'] loop
 if to_jsonb(old)->k is distinct from to_jsonb(w)->k then ch:=ch||jsonb_build_object(k,jsonb_build_object('before',to_jsonb(old)->k,'after',to_jsonb(w)->k)); end if;
 end loop;
 if before_photos is distinct from after_photos then ch:=ch||jsonb_build_object('photos',jsonb_build_object('before',before_photos,'after',after_photos)); end if;
 if ch='{}'::jsonb then return jsonb_build_object('ok',true,'unchanged',true,'number',w.number,'version',w.version,'accessLost',false); end if;
 update public.work_order_photos set state='removed',position=null where work_order_id=w.id and state='attached';
 foreach photo_id in array ids loop
 update public.work_order_photos set state='attached',position=i where id=photo_id;i:=i+1;
 end loop;
 update public.work_orders set severity=w.severity,discipline=w.discipline,description=w.description,location=w.location,details=w.details,version=version+1 where id=w.id;
 insert into public.work_order_records(work_order_id,actor_id,occurred_at,action,changes) values(w.id,auth.uid(),clock_timestamp(),'edited',ch);
 return jsonb_build_object('ok',true,'number',w.number,'version',w.version+1,'accessLost',false);
end $$;
-- 同签名私有函数不直接授权给业务角色，仅由受控事务入口调用。
revoke all on function private.edit_work_order(public.work_orders,jsonb) from public,anon,authenticated;
create function private.work_order_photos(target uuid,num integer) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',original_name,'url','/api/work-orders/'||num::text||'/photos/'||id::text) order by position),'[]'::jsonb) from public.work_order_photos where work_order_id=target and state='attached'
$$;
create or replace function public.get_work_order(p_number integer) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; w public.work_orders;
begin
 result:=public.get_work_order_read(p_number);
 if result->>'kind'='ok' then
 select * into w from public.work_orders where number=p_number;
 result:=jsonb_set(result,'{detail}',result->'detail'||jsonb_build_object('version',w.version,'allowedActions',private.allowed_work_order_actions(w),'photos',private.work_order_photos(w.id,w.number)));
 end if; return result;
end $$;
alter function public.list_work_orders(text,text) rename to list_work_orders_read;
create function public.list_work_orders(p_status text default 'pending',p_sort text default 'newest') returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(item||jsonb_build_object('photos',private.work_order_photos(w.id,w.number)) order by ord),'[]'::jsonb)
 from jsonb_array_elements(public.list_work_orders_read(p_status,p_sort)) with ordinality x(item,ord)
 join public.work_orders w on w.number=(item->>'number')::integer
$$;
revoke all on function private.photo_upload_allowed(text),private.photo_read_allowed(text),private.prepare_work_order_photo(integer,text,text,integer),private.discard_work_order_photos(integer,uuid[]),public.prepare_work_order_photo(integer,text,text,integer),public.discard_work_order_photos(integer,uuid[]),private.work_order_photos(uuid,integer),public.list_work_orders(text,text) from public,anon,authenticated;
grant execute on function private.photo_upload_allowed(text),private.photo_read_allowed(text),private.prepare_work_order_photo(integer,text,text,integer),private.discard_work_order_photos(integer,uuid[]),public.prepare_work_order_photo(integer,text,text,integer),public.discard_work_order_photos(integer,uuid[]),private.work_order_photos(uuid,integer),public.list_work_orders(text,text) to authenticated;
