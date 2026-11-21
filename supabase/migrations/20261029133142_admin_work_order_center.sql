create function public.list_admin_work_orders(
 p_status text default null, p_severity text default null,
 p_discipline text default null, p_keyword text default null, p_number text default null
) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; target_project uuid; query_number integer; number_input text;
begin
 target_project := private.current_project();
 if private.current_membership() is null or private.current_role() is distinct from 'admin' or target_project is null then
  raise exception '当前身份无法访问管理员工单中心' using errcode='42501';
 end if;
 p_status := case when p_status in ('pending','completed','rejected') then p_status else null end;
 p_severity := case when p_severity in ('minor','normal','major','urgent') then p_severity else null end;
 p_discipline := case when p_discipline in ('architecture','structure','plumbing') then p_discipline else null end;
 p_keyword := nullif(btrim(p_keyword),'');
 number_input := nullif(btrim(regexp_replace(btrim(p_number),'^#','')),'');
 if number_input is not null then
  if number_input !~ '^[1-9][0-9]{0,9}$' then return jsonb_build_object('items','[]'::jsonb,'total',0); end if;
  if number_input::bigint>2147483647 then return jsonb_build_object('items','[]'::jsonb,'total',0); end if;
  query_number := number_input::integer;
 end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(q.item order by q.created_at desc,q.number desc),'[]'::jsonb),'total',count(*)) into result
 from (
  select w.created_at,w.number,jsonb_build_object(
   'number',w.number,'status',w.status,'severity',w.severity,'discipline',w.discipline,
   'description',w.description,'createdAt',w.created_at,
   'creator',jsonb_build_object('id',w.creator_id,'name',people.names->>w.creator_id::text),
   'assignee',jsonb_build_object('id',w.assignee_id,'name',people.names->>w.assignee_id::text)
  ) item
  from public.work_orders w
  cross join lateral (select private.work_order_people(w.number) names) people
  where w.project_id=target_project
   and (p_status is null or w.status=p_status)
   and (p_severity is null or w.severity=p_severity)
   and (p_discipline is null or w.discipline=p_discipline)
   and (query_number is null or w.number=query_number)
   and (p_keyword is null or strpos(lower(w.description),lower(p_keyword))>0
    or strpos(lower(w.location),lower(p_keyword))>0 or strpos(lower(coalesce(w.details,'')),lower(p_keyword))>0)
 ) q;
 return result;
end $$;
revoke all on function public.list_admin_work_orders(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.list_admin_work_orders(text,text,text,text,text) to authenticated;
