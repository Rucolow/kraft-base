-- Staff may add ad-hoc tasks (the "noticed it, make it a task" workflow), on top
-- of ticking tasks done (0006). Deletion stays owner-only, and the column-level
-- UPDATE grant still limits non-elevated edits to done/done_at, so titles and
-- structure are not rewritten by staff.

drop policy if exists task_insert on public.task;
create policy task_insert on public.task
  for insert to authenticated with check (public.is_org_member());
