create function private.assistant_stale_draft_photo_paths()
returns setof text language sql stable security definer set search_path='' as $$
  select p.object_path from public.assistant_draft_photos p
  join public.assistant_order_drafts d on d.id=p.draft_id
  join storage.objects o on o.bucket_id='work-order-photos' and o.name=p.object_path
  where d.status in ('cancelled','expired','created') and p.state in ('staged','removed')
    and greatest(d.updated_at,p.created_at)<now()-interval '24 hours'
    and not exists(select 1 from public.work_order_photos w where w.object_path=p.object_path)
  order by p.created_at limit 1000
$$;
create function public.assistant_stale_draft_photo_paths()
returns setof text language sql stable security invoker set search_path='' as $$
  select * from private.assistant_stale_draft_photo_paths()
$$;
revoke all on function private.assistant_stale_draft_photo_paths(),public.assistant_stale_draft_photo_paths()
  from public,anon,authenticated;
grant execute on function private.assistant_stale_draft_photo_paths(),public.assistant_stale_draft_photo_paths()
  to service_role;
