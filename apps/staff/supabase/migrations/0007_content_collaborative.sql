-- Operational content becomes collaboratively editable: any org member may
-- create and update entries (the grow-the-knowledge workflow). Deletion stays
-- owner-only.

drop policy if exists content_insert on public.content;
create policy content_insert on public.content
  for insert to authenticated with check (public.is_org_member());

drop policy if exists content_update on public.content;
create policy content_update on public.content
  for update to authenticated
  using (public.is_org_member())
  with check (public.is_org_member());
