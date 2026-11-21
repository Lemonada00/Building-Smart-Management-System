-- 业务账号仍不可直接写表，所有操作由窄事务入口完成。
alter table public.work_orders add column version integer not null default 1 check(version>0);
create function private.work_order_actions() returns text[] language sql immutable set search_path='' as $$ select array['resolve','reject']::text[] $$;
create function private.allowed_work_order_actions(w public.work_orders) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(a),'[]'::jsonb) from unnest(private.work_order_actions()) a
 where private.can_read_work_order(w.id) and
 ((a in ('resolve','reject','assign') and w.status='pending' and
 (private.current_role()='admin' or (private.current_role()='contractor' and w.assignee_id=auth.uid())))
 or (a='edit' and w.status='pending' and (private.current_role()='admin'
 or (private.current_role()='inspector' and w.creator_id=auth.uid())
 or (private.current_role()='contractor' and w.assignee_id=auth.uid())))
 or (a='reopen' and w.status in ('completed','rejected') and
 (private.current_role()='admin' or (private.current_role()='inspector' and w.creator_id=auth.uid()))))
$$;
-- 保留阶段 2 DTO 构造，附加版本和动作；后续照片继续使用相同包装。
alter function public.get_work_order(integer) rename to get_work_order_read;
create function public.get_work_order(p_number integer) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; w public.work_orders;
begin
 result:=public.get_work_order_read(p_number);
 if result->>'kind'='ok' then
 select * into w from public.work_orders where number=p_number;
 result:=jsonb_set(result,'{detail}',result->'detail'||jsonb_build_object('version',w.version,'allowedActions',private.allowed_work_order_actions(w)));
 end if;
 return result;
end $$;
create function private.process_work_order(p_number integer,p_expected_version integer,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.work_orders; old public.work_orders; ch jsonb:='{}'; k text; keys text[]; new_assignee uuid; event text; why text;
begin
 if auth.uid() is null or private.valid_session() is null then raise exception 'UNAUTHENTICATED'; end if;
 if private.current_membership() is null then raise exception 'IDENTITY_REQUIRED'; end if;
 select * into w from public.work_orders where number=p_number for update;
 if w.id is null then raise exception 'NOT_FOUND'; end if;
 if not private.can_read_work_order(w.id) then raise exception 'FORBIDDEN'; end if;
 if p_expected_version is null or p_expected_version<1 then raise exception 'VALIDATION_FAILED'; end if;
 if w.version<>p_expected_version then raise exception 'CONFLICT'; end if;
 if not coalesce(private.allowed_work_order_actions(w)?p_action,false) then raise exception 'FORBIDDEN'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'VALIDATION_FAILED'; end if;
 if p_action='edit' then return private.edit_work_order(w,p_payload); end if;
 keys:=case p_action when 'resolve' then array['rootCause','prevention'] when 'assign' then array['assigneeId','reason'] else array['reason'] end;
 if (p_payload-keys)<>'{}'::jsonb or exists(select 1 from jsonb_each(p_payload) e where jsonb_typeof(e.value) not in ('string','null')) then raise exception 'VALIDATION_FAILED'; end if;
 old:=w; why:=nullif(trim(p_payload->>'reason'),'');
 if p_action='resolve' then
 w.status:='completed'; w.root_cause:=nullif(trim(p_payload->>'rootCause'),''); w.prevention:=nullif(trim(p_payload->>'prevention'),''); event:='resolved';
 if w.root_cause is null then raise exception 'VALIDATION_FAILED'; end if;
 elsif p_action='reject' then
 w.status:='rejected'; w.root_cause:=null; w.prevention:=null; event:='rejected';
 elsif p_action='reopen' then
 w.status:='pending'; w.root_cause:=null; w.prevention:=null; event:='reopened';
 elsif p_action='assign' then
 begin new_assignee:=(p_payload->>'assigneeId')::uuid; exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; end;
 if new_assignee is null or new_assignee=w.assignee_id or not exists(select 1 from public.project_memberships m where m.user_id=new_assignee and m.project_id=w.project_id and m.role='contractor' and m.is_active) then raise exception 'VALIDATION_FAILED'; end if;
 w.assignee_id:=new_assignee; event:='assigned';
 else raise exception 'VALIDATION_FAILED'; end if;
 if p_action<>'resolve' and why is null then raise exception 'VALIDATION_FAILED'; end if;
 foreach k in array array['status','assignee_id','root_cause','prevention'] loop
 if to_jsonb(old)->k is distinct from to_jsonb(w)->k then ch:=ch||jsonb_build_object(k,jsonb_build_object('before',to_jsonb(old)->k,'after',to_jsonb(w)->k)); end if;
 end loop;
 update public.work_orders set status=w.status,assignee_id=w.assignee_id,root_cause=w.root_cause,prevention=w.prevention,version=version+1 where id=w.id;
 insert into public.work_order_records(work_order_id,actor_id,occurred_at,action,reason,changes,root_cause,prevention)
 values(w.id,auth.uid(),clock_timestamp(),event,why,ch,case when event='resolved' then w.root_cause end,case when event='resolved' then w.prevention end);
 return jsonb_build_object('ok',true,'number',w.number,'version',w.version+1,'accessLost',not private.can_read_work_order(w.id));
end $$;
create function public.process_work_order(p_number integer,p_expected_version integer,p_action text,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.process_work_order(p_number,p_expected_version,p_action,p_payload) $$;
revoke all on function private.work_order_actions(),private.allowed_work_order_actions(public.work_orders),private.process_work_order(integer,integer,text,jsonb),public.get_work_order(integer),public.process_work_order(integer,integer,text,jsonb) from public,anon,authenticated;
grant execute on function private.work_order_actions(),private.allowed_work_order_actions(public.work_orders),private.process_work_order(integer,integer,text,jsonb),public.get_work_order(integer),public.process_work_order(integer,integer,text,jsonb) to authenticated;
