create function public.search_assistant_work_orders(
 p_number integer default null,p_keyword text default null,p_location text default null,
 p_status text default 'all',p_severity text default null,p_scope text default 'visible'
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; total bigint; found jsonb;
begin
 if private.current_membership() is null then raise exception 'IDENTITY_REQUIRED' using errcode='42501'; end if;
 if p_number is not null then
  found:=public.get_work_order(p_number);
  return jsonb_build_object('kind',found->>'kind','total',case when found->>'kind'='ok' then 1 else 0 end,
   'hasMore',false,'items',case when found->>'kind'='ok' then jsonb_build_array(found->'detail') else '[]'::jsonb end);
 end if;
 if p_scope not in ('visible','created_by_me','assigned_to_me') or p_status not in ('all','pending','completed','rejected','ended')
 or (p_severity is not null and p_severity not in ('minor','normal','major','urgent'))
 or length(coalesce(p_keyword,''))>200 or length(coalesce(p_location,''))>200 then raise exception 'INVALID_FILTERS' using errcode='22023'; end if;
 with matched as (
 select w.* from public.work_orders w
 where w.project_id=private.current_project()
 and (p_status='all' or w.status=p_status or (p_status='ended' and w.status in ('completed','rejected')))
 and (p_severity is null or w.severity=p_severity)
 and (nullif(p_keyword,'') is null or strpos(lower(w.description||' '||w.location),lower(p_keyword))>0)
 and (nullif(p_location,'') is null or strpos(lower(w.location),lower(p_location))>0)
 and (p_scope='visible' or (p_scope='created_by_me' and w.creator_id=auth.uid()) or (p_scope='assigned_to_me' and w.assignee_id=auth.uid()))
 ), limited as (
 select number,severity,created_at from matched order by (severity='urgent') desc,created_at desc,number desc limit 20
 )
 select (select count(*) from matched),coalesce(jsonb_agg(public.get_work_order(number)->'detail'
 order by (severity='urgent') desc,created_at desc,number desc),'[]'::jsonb) into total,result from limited;
 return jsonb_build_object('kind','ok','total',total,'hasMore',total>20,'items',result);
end $$;
revoke all on function public.search_assistant_work_orders(integer,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.search_assistant_work_orders(integer,text,text,text,text,text) to authenticated;
