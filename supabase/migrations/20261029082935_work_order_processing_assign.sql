create or replace function private.work_order_actions() returns text[] language sql immutable set search_path='' as $$ select array['resolve','reject','reopen','assign']::text[] $$;
create function private.list_work_order_assignees(p_number integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare w public.work_orders; result jsonb;
begin
 select * into w from public.work_orders where number=p_number;
 if w.id is null or not coalesce(private.allowed_work_order_actions(w)?'assign',false) then raise exception 'FORBIDDEN'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'employeeId',p.employee_id,'department',p.department) order by p.employee_id),'[]'::jsonb)
 into result from public.profiles p where p.id<>w.assignee_id and exists(select 1 from public.project_memberships m where m.user_id=p.id and m.project_id=w.project_id and m.role='contractor' and m.is_active);
 return jsonb_build_object('ok',true,'data',result);
end $$;
create function public.list_work_order_assignees(p_number integer) returns jsonb language sql stable security invoker set search_path='' as $$ select private.list_work_order_assignees(p_number) $$;
revoke all on function private.list_work_order_assignees(integer),public.list_work_order_assignees(integer) from public,anon,authenticated;
grant execute on function private.list_work_order_assignees(integer),public.list_work_order_assignees(integer) to authenticated;
