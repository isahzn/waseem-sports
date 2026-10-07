-- 0003_publish_page.sql — Phase 02 task 3.
-- Promotes a page's section drafts (draft_content -> content). Did not exist
-- in 0001 (verified 2026-10-06), so it lands here as a new file — 0001/0002
-- are applied and must never be edited.

create or replace function public.publish_page(p_page_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.page_sections
     set content = draft_content, draft_content = null
   where page_id = p_page_id and draft_content is not null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.publish_page(uuid) from public, anon, authenticated;
grant execute on function public.publish_page(uuid) to service_role;
