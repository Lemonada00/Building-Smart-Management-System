create function public.get_admin_dashboard() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare target_project uuid; project jsonb; result jsonb;
begin
 target_project := private.current_project();
 if private.current_membership() is null or private.current_role() is distinct from 'admin' or target_project is null then
  raise exception '当前身份无法访问数据大盘' using errcode='42501';
 end if;
 select jsonb_build_object('id',p.id,'name',p.name,'city',p.city,'customerName',p.customer_name,'projectType',p.project_type)
 into project from public.projects p where p.id=target_project and p.is_active;
 if project is null then raise exception '当前项目不可访问' using errcode='42501'; end if;
 select jsonb_build_object('project',project,'total',count(*),
  'statuses',jsonb_build_object('pending',count(*) filter(where status='pending'),
    'completed',count(*) filter(where status='completed'),'rejected',count(*) filter(where status='rejected')),
  'pendingSeverities',jsonb_build_object(
    'minor',count(*) filter(where status='pending' and severity='minor'),
    'normal',count(*) filter(where status='pending' and severity='normal'),
    'major',count(*) filter(where status='pending' and severity='major'),
    'urgent',count(*) filter(where status='pending' and severity='urgent')),
  'pendingUrgent',count(*) filter(where status='pending' and severity='urgent')) into result
 from public.work_orders where project_id=target_project;
 return result;
end $$;
revoke all on function public.get_admin_dashboard() from public,anon,authenticated;
grant execute on function public.get_admin_dashboard() to authenticated;
