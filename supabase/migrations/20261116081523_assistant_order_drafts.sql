create table public.assistant_order_drafts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assistant_sessions(id) on delete cascade,
  membership_id uuid not null,
  project_id uuid not null,
  creator_id uuid not null,
  source_message_id text not null check (length(source_message_id) between 1 and 200),
  description text not null check (length(btrim(description)) > 0),
  location text not null check (length(btrim(location)) > 0),
  severity text not null check (severity in ('minor','normal','major','urgent')),
  discipline text not null check (discipline in ('architecture','structure','plumbing')),
  details text,
  assignee_id uuid,
  candidate_upload_ids uuid[] not null default '{}',
  selected_upload_ids uuid[] not null default '{}',
  selected_photo_ids uuid[] not null default '{}',
  revision integer not null default 0 check (revision >= 0),
  status text not null default 'editing' check (status in ('editing','cancelled','expired','created')),
  work_order_id uuid unique references public.work_orders(id),
  receipt_message_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,source_message_id),
  check (cardinality(selected_upload_ids)+cardinality(selected_photo_ids)<=9),
  check ((status='created')=(work_order_id is not null and receipt_message_id is not null))
);
create unique index assistant_one_editing_draft on public.assistant_order_drafts(session_id) where status='editing';
alter table public.assistant_order_drafts enable row level security;
revoke all on public.assistant_order_drafts from public,anon,authenticated;
grant select on public.assistant_order_drafts to authenticated;
create policy assistant_drafts_read on public.assistant_order_drafts for select to authenticated
using (membership_id=private.current_membership() and creator_id=auth.uid()
  and private.current_role() in ('admin','inspector')
  and exists(select 1 from public.assistant_sessions s where s.id=session_id));

create table public.assistant_draft_photos (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.assistant_order_drafts(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check(size_bytes between 1 and 10485760),
  original_name text not null,
  source_upload_id uuid,
  state text not null default 'staged' check(state in ('staged','attached','removed')),
  created_at timestamptz not null default now(),
  unique(draft_id,source_upload_id)
);
alter table public.assistant_draft_photos enable row level security;
revoke all on public.assistant_draft_photos from public,anon,authenticated;
grant select on public.assistant_draft_photos to authenticated;
create policy assistant_draft_photos_read on public.assistant_draft_photos for select to authenticated
using (state='staged' and exists(select 1 from public.assistant_order_drafts d where d.id=draft_id and d.status='editing'));
create policy assistant_draft_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='work-order-photos' and exists(select 1 from public.assistant_draft_photos p where p.object_path=name));
create policy assistant_draft_objects_read on storage.objects for select to authenticated
using (bucket_id='work-order-photos' and exists(select 1 from public.assistant_draft_photos p where p.object_path=name));

create function private.expire_assistant_drafts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.assistant_order_drafts d set status='expired',revision=d.revision+1,updated_at=now()
  where d.session_id=new.id and d.status='editing' and
    (new.closed or not exists(select 1 from jsonb_array_elements(new.messages) m
      where m->>'role'='user' and m->>'id'=d.source_message_id));
  return new;
end $$;
revoke all on function private.expire_assistant_drafts() from public,anon,authenticated;
create trigger expire_assistant_drafts after update of messages,closed on public.assistant_sessions
for each row execute function private.expire_assistant_drafts();

create function private.assistant_draft(p_op text,p_session uuid,p_draft uuid,p_values jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  s public.assistant_sessions; d public.assistant_order_drafts; w public.work_orders;
  file_row public.assistant_draft_photos; source_row public.assistant_uploads;
  uid uuid:=auth.uid(); project uuid:=private.current_project();
  source_id uuid; file_id uuid; targets uuid[]; uploads uuid[]; files uuid[];
  payload jsonb:=coalesce(p_values,'{}'::jsonb); receipt uuid;
  assignee uuid; meta jsonb; pos integer:=0;
begin
  select * into s from public.assistant_sessions where id=p_session for update;
  if uid is null or s.id is null or s.closed or s.user_id<>uid
    or s.auth_session_id is distinct from private.valid_session()
    or s.membership_id is distinct from private.current_membership()
    or project is null or coalesce(private.current_role(),'') not in ('admin','inspector')
  then raise exception 'FORBIDDEN' using errcode='42501'; end if;

  if p_op='prepare' then
    if s.revision is distinct from (payload->>'sessionRevision')::integer
    then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
    select * into d from public.assistant_order_drafts
    where session_id=s.id and source_message_id=payload->>'sourceMessageId';
    if d.id is not null then return jsonb_build_object('draftId',d.id,'status',d.status,'revision',d.revision); end if;
    select * into d from public.assistant_order_drafts where session_id=s.id and status='editing';
    if d.id is not null then
      if exists(select 1 from jsonb_array_elements(s.messages) m where m->>'role'='user' and m->>'id'=d.source_message_id)
      then return jsonb_build_object('draftId',d.id,'status',d.status,'revision',d.revision); end if;
      update public.assistant_order_drafts set status='expired',revision=revision+1,updated_at=now() where id=d.id;
    end if;
    insert into public.assistant_order_drafts(session_id,membership_id,project_id,creator_id,source_message_id,
      description,location,severity,discipline,details,candidate_upload_ids,selected_upload_ids)
    values(s.id,s.membership_id,project,uid,payload->>'sourceMessageId',btrim(payload->>'description'),
      btrim(payload->>'location'),payload->>'severity',payload->>'discipline',nullif(btrim(payload->>'details'),''),
      array(select id from public.assistant_uploads u where u.session_id=s.id
        and u.id in(select value::uuid from jsonb_array_elements_text(payload->'uploadIds')) order by u.created_at limit 9),'{}')
    returning * into d;
    return jsonb_build_object('draftId',d.id,'status',d.status,'revision',d.revision);
  end if;

  select * into d from public.assistant_order_drafts where id=p_draft and session_id=s.id
    and membership_id=s.membership_id and project_id=project and creator_id=uid for update;
  if d.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if d.status='created' and p_op in ('read','confirm') then
    select * into w from public.work_orders where id=d.work_order_id;
    if not coalesce(private.can_read_work_order(w.id),false)
    then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    return jsonb_build_object('draft',to_jsonb(d),'workOrderNumber',w.number,'receiptMessageId',d.receipt_message_id,
      'sessionRevision',s.revision,'messages',case when p_op='confirm' then s.messages else null end);
  end if;
  if p_op='read' then
    return jsonb_build_object('draft',to_jsonb(d),
      'assignees',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name)
        from public.profiles p where exists(select 1 from public.project_memberships m
          where m.user_id=p.id and m.project_id=project and m.role='contractor' and m.is_active)), '[]'::jsonb));
  end if;
  if d.status<>'editing' then raise exception 'DRAFT_INACTIVE' using errcode='40001'; end if;

  if p_op='photo' then
    source_id:=nullif(payload->>'sourceUploadId','')::uuid;
    if source_id is not null then
      if not (source_id=any(d.candidate_upload_ids)) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
      select * into file_row from public.assistant_draft_photos where draft_id=d.id and source_upload_id=source_id;
      if file_row.id is not null then return to_jsonb(file_row); end if;
      select * into source_row from public.assistant_uploads where id=source_id and session_id=s.id;
      if source_row.id is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    end if;
    file_id:=gen_random_uuid();
    insert into public.assistant_draft_photos(id,draft_id,object_path,mime_type,size_bytes,original_name,source_upload_id)
    values(file_id,d.id,'drafts/'||d.id||'/'||file_id,
      coalesce(source_row.mime_type,payload->>'mimeType'),
      coalesce(source_row.size_bytes,(payload->>'size')::integer),
      left(coalesce(source_row.original_name,payload->>'name'),180),source_id)
    returning * into file_row;
    return to_jsonb(file_row);
  end if;

  if d.revision is distinct from (payload->>'expectedRevision')::integer
    or not exists(select 1 from jsonb_array_elements(s.messages) m
      where m->>'role'='user' and m->>'id'=d.source_message_id)
  then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  if p_op='cancel' then
    update public.assistant_order_drafts set status='cancelled',revision=revision+1,updated_at=now()
    where id=d.id returning * into d;
    return jsonb_build_object('draft',to_jsonb(d));
  end if;
  if p_op not in ('save','confirm') then raise exception 'INVALID_ACTION' using errcode='22023'; end if;

  assignee:=nullif(payload->>'assigneeId','')::uuid;
  if (p_op='confirm' and assignee is null) or (assignee is not null and not exists(
    select 1 from public.project_memberships m where m.user_id=assignee and m.project_id=project
      and m.role='contractor' and m.is_active for share))
  then raise exception 'INVALID_ASSIGNEE' using errcode='22023'; end if;
  uploads:=array(select value::uuid from jsonb_array_elements_text(payload->'uploadIds'));
  files:=array(select value::uuid from jsonb_array_elements_text(payload->'photoIds'));
  if cardinality(uploads)+cardinality(files)>9 or not (uploads <@ d.candidate_upload_ids) or
    cardinality(uploads)<>(select count(*) from public.assistant_uploads where id=any(uploads) and session_id=s.id) or
    cardinality(files)<>(select count(*) from public.assistant_draft_photos where id=any(files) and draft_id=d.id and source_upload_id is null and state='staged')
  then raise exception 'INVALID_PHOTOS' using errcode='22023'; end if;

  update public.assistant_order_drafts set description=btrim(payload->>'description'),location=btrim(payload->>'location'),
    severity=payload->>'severity',discipline=payload->>'discipline',details=nullif(btrim(payload->>'details'),''),
    assignee_id=assignee,selected_upload_ids=uploads,selected_photo_ids=files,revision=revision+1,updated_at=now()
    where id=d.id returning * into d;
  if p_op='save' then return jsonb_build_object('draft',to_jsonb(d)); end if;
  if s.revision is distinct from (payload->>'sessionRevision')::integer
  then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;

  targets:=array(select p.id from unnest(uploads) with ordinality u(id,position)
    join public.assistant_draft_photos p on p.source_upload_id=u.id and p.draft_id=d.id and p.state='staged'
    order by u.position)||files;
  if cardinality(targets)<>cardinality(uploads)+cardinality(files)
  then raise exception 'INVALID_PHOTOS' using errcode='22023'; end if;
  insert into public.work_orders(project_id,creator_id,assignee_id,severity,discipline,description,location,details)
    values(project,uid,assignee,d.severity,d.discipline,d.description,d.location,d.details) returning * into w;
  insert into public.work_order_records(work_order_id,actor_id,occurred_at,action,changes)
    values(w.id,uid,w.created_at,'created',jsonb_build_object(
      'status',jsonb_build_object('before',null,'after','pending'),
      'assignee_id',jsonb_build_object('before',null,'after',assignee::text)));
  foreach file_id in array targets loop
    select * into file_row from public.assistant_draft_photos where id=file_id;
    select metadata into meta from storage.objects where bucket_id='work-order-photos' and name=file_row.object_path;
    if (meta->>'size')::integer is distinct from file_row.size_bytes or meta->>'mimetype' is distinct from file_row.mime_type
    then raise exception 'INVALID_PHOTOS' using errcode='22023'; end if;
    insert into public.work_order_photos(id,work_order_id,object_path,original_name,mime_type,size_bytes,uploader_id,upload_session_id,state,position)
      values(file_id,w.id,file_row.object_path,file_row.original_name,file_row.mime_type,file_row.size_bytes,uid,s.auth_session_id,'attached',pos);
    update public.assistant_draft_photos set state='attached' where id=file_id;
    pos:=pos+1;
  end loop;
  receipt:=gen_random_uuid();
  update public.assistant_order_drafts set status='created',work_order_id=w.id,receipt_message_id=receipt
    where id=d.id returning * into d;
  update public.assistant_sessions set revision=revision+1,updated_at=now(),
    messages=messages||jsonb_build_array(jsonb_build_object('id',receipt,'role','assistant','parts',
      jsonb_build_array(jsonb_build_object('type','text','text','已创建[工单 #'||w.number||'](/work-orders/'||w.number||')，状态为待处理。'))))
    where id=s.id returning * into s;
  return jsonb_build_object('draft',to_jsonb(d),'workOrderNumber',w.number,
    'receiptMessageId',receipt,'sessionRevision',s.revision,'messages',s.messages);
end $$;
create function public.assistant_draft(p_op text,p_session uuid,p_draft uuid,p_values jsonb) returns jsonb
language sql security invoker set search_path='' as $$
  select private.assistant_draft(p_op,p_session,p_draft,p_values)
$$;
revoke all on function private.assistant_draft(text,uuid,uuid,jsonb),public.assistant_draft(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.assistant_draft(text,uuid,uuid,jsonb),public.assistant_draft(text,uuid,uuid,jsonb) to authenticated;
