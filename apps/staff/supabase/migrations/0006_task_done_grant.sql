-- Staff (including the shared device account) may tick tasks done; creation,
-- deletion and other columns stay owner-only. Column-level UPDATE limits the
-- authenticated role to done/done_at, and the update policy is opened to org
-- members. Owner edits of other task columns go through elevated access (SQL).

revoke update on public.task from authenticated;
grant update (done, done_at) on public.task to authenticated;

drop policy if exists task_update on public.task;
create policy task_update on public.task
  for update to authenticated
  using (public.is_org_member())
  with check (public.is_org_member());
