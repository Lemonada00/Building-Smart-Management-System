create or replace function private.edit_work_order(w public.work_orders,p jsonb) returns jsonb
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
 if meta is null or meta->>'cacheControl' is distinct from 'max-age=0, no-store' or (meta->>'size')::bigint is distinct from item.size_bytes::bigint or meta->>'mimetype' is distinct from item.mime_type then raise exception 'PHOTO_NOT_READY'; end if;
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
