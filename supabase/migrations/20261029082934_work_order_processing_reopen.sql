create or replace function private.work_order_actions() returns text[] language sql immutable set search_path='' as $$ select array['resolve','reject','reopen']::text[] $$;
