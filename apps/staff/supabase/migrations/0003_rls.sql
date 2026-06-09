-- RLS, helper functions, and grants.
-- Model: organisation members (staff/owner) authenticate via magic link and are
-- linked through staff.auth_user_id. Shared iPad authenticates as a staff-role
-- reception account; per-person attribution during the day is an app-layer concern
-- (shift_session selection, author_id), not RLS.

-- Helpers -------------------------------------------------------------------

create or replace function public.is_org_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s where s.auth_user_id = auth.uid()
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.auth_user_id = auth.uid() and s.role = 'owner'
  );
$$;

grant execute on function public.is_org_member() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- Enable RLS ----------------------------------------------------------------

alter table public.staff enable row level security;
alter table public.device enable row level security;
alter table public.shift_session enable row level security;
alter table public.guest enable row level security;
alter table public.guest_note enable row level security;
alter table public.timeline_entry enable row level security;
alter table public.followup enable row level security;
alter table public.task enable row level security;
alter table public.content enable row level security;
alter table public.lost_item enable row level security;
alter table public.equipment_issue enable row level security;
alter table public.daily_reset enable row level security;

-- Grants (Data API auto-expose is OFF, so grant explicitly; anon gets nothing) -

revoke all on table
  public.staff, public.device, public.shift_session, public.guest,
  public.guest_note, public.timeline_entry, public.followup, public.task,
  public.content, public.lost_item, public.equipment_issue, public.daily_reset
from anon;

grant select, insert, update, delete on table
  public.staff, public.device, public.shift_session, public.guest,
  public.guest_note, public.timeline_entry, public.followup, public.task,
  public.content, public.lost_item, public.equipment_issue, public.daily_reset
to authenticated;

-- Policies ------------------------------------------------------------------
-- Read: any authenticated org member. Write: authenticated org member, except
-- owner-only tables (guest, content, task, staff, device).

-- staff (owner-managed)
drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  for select to authenticated using (public.is_org_member());
drop policy if exists staff_insert on public.staff;
create policy staff_insert on public.staff
  for insert to authenticated with check (public.is_owner());
drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists staff_delete on public.staff;
create policy staff_delete on public.staff
  for delete to authenticated using (public.is_owner());

-- device (owner-managed)
drop policy if exists device_select on public.device;
create policy device_select on public.device
  for select to authenticated using (public.is_org_member());
drop policy if exists device_insert on public.device;
create policy device_insert on public.device
  for insert to authenticated with check (public.is_owner());
drop policy if exists device_update on public.device;
create policy device_update on public.device
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists device_delete on public.device;
create policy device_delete on public.device
  for delete to authenticated using (public.is_owner());

-- shift_session (org member)
drop policy if exists shift_session_select on public.shift_session;
create policy shift_session_select on public.shift_session
  for select to authenticated using (public.is_org_member());
drop policy if exists shift_session_insert on public.shift_session;
create policy shift_session_insert on public.shift_session
  for insert to authenticated with check (public.is_org_member());
drop policy if exists shift_session_update on public.shift_session;
create policy shift_session_update on public.shift_session
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists shift_session_delete on public.shift_session;
create policy shift_session_delete on public.shift_session
  for delete to authenticated using (public.is_org_member());

-- guest (owner-managed)
drop policy if exists guest_select on public.guest;
create policy guest_select on public.guest
  for select to authenticated using (public.is_org_member());
drop policy if exists guest_insert on public.guest;
create policy guest_insert on public.guest
  for insert to authenticated with check (public.is_owner());
drop policy if exists guest_update on public.guest;
create policy guest_update on public.guest
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists guest_delete on public.guest;
create policy guest_delete on public.guest
  for delete to authenticated using (public.is_owner());

-- guest_note (org member)
drop policy if exists guest_note_select on public.guest_note;
create policy guest_note_select on public.guest_note
  for select to authenticated using (public.is_org_member());
drop policy if exists guest_note_insert on public.guest_note;
create policy guest_note_insert on public.guest_note
  for insert to authenticated with check (public.is_org_member());
drop policy if exists guest_note_update on public.guest_note;
create policy guest_note_update on public.guest_note
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists guest_note_delete on public.guest_note;
create policy guest_note_delete on public.guest_note
  for delete to authenticated using (public.is_org_member());

-- timeline_entry (org member)
drop policy if exists timeline_entry_select on public.timeline_entry;
create policy timeline_entry_select on public.timeline_entry
  for select to authenticated using (public.is_org_member());
drop policy if exists timeline_entry_insert on public.timeline_entry;
create policy timeline_entry_insert on public.timeline_entry
  for insert to authenticated with check (public.is_org_member());
drop policy if exists timeline_entry_update on public.timeline_entry;
create policy timeline_entry_update on public.timeline_entry
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists timeline_entry_delete on public.timeline_entry;
create policy timeline_entry_delete on public.timeline_entry
  for delete to authenticated using (public.is_org_member());

-- followup (org member)
drop policy if exists followup_select on public.followup;
create policy followup_select on public.followup
  for select to authenticated using (public.is_org_member());
drop policy if exists followup_insert on public.followup;
create policy followup_insert on public.followup
  for insert to authenticated with check (public.is_org_member());
drop policy if exists followup_update on public.followup;
create policy followup_update on public.followup
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists followup_delete on public.followup;
create policy followup_delete on public.followup
  for delete to authenticated using (public.is_org_member());

-- task (owner-managed)
drop policy if exists task_select on public.task;
create policy task_select on public.task
  for select to authenticated using (public.is_org_member());
drop policy if exists task_insert on public.task;
create policy task_insert on public.task
  for insert to authenticated with check (public.is_owner());
drop policy if exists task_update on public.task;
create policy task_update on public.task
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists task_delete on public.task;
create policy task_delete on public.task
  for delete to authenticated using (public.is_owner());

-- content (owner-managed)
drop policy if exists content_select on public.content;
create policy content_select on public.content
  for select to authenticated using (public.is_org_member());
drop policy if exists content_insert on public.content;
create policy content_insert on public.content
  for insert to authenticated with check (public.is_owner());
drop policy if exists content_update on public.content;
create policy content_update on public.content
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists content_delete on public.content;
create policy content_delete on public.content
  for delete to authenticated using (public.is_owner());

-- lost_item (org member)
drop policy if exists lost_item_select on public.lost_item;
create policy lost_item_select on public.lost_item
  for select to authenticated using (public.is_org_member());
drop policy if exists lost_item_insert on public.lost_item;
create policy lost_item_insert on public.lost_item
  for insert to authenticated with check (public.is_org_member());
drop policy if exists lost_item_update on public.lost_item;
create policy lost_item_update on public.lost_item
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists lost_item_delete on public.lost_item;
create policy lost_item_delete on public.lost_item
  for delete to authenticated using (public.is_org_member());

-- equipment_issue (org member)
drop policy if exists equipment_issue_select on public.equipment_issue;
create policy equipment_issue_select on public.equipment_issue
  for select to authenticated using (public.is_org_member());
drop policy if exists equipment_issue_insert on public.equipment_issue;
create policy equipment_issue_insert on public.equipment_issue
  for insert to authenticated with check (public.is_org_member());
drop policy if exists equipment_issue_update on public.equipment_issue;
create policy equipment_issue_update on public.equipment_issue
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists equipment_issue_delete on public.equipment_issue;
create policy equipment_issue_delete on public.equipment_issue
  for delete to authenticated using (public.is_org_member());

-- daily_reset (org member)
drop policy if exists daily_reset_select on public.daily_reset;
create policy daily_reset_select on public.daily_reset
  for select to authenticated using (public.is_org_member());
drop policy if exists daily_reset_insert on public.daily_reset;
create policy daily_reset_insert on public.daily_reset
  for insert to authenticated with check (public.is_org_member());
drop policy if exists daily_reset_update on public.daily_reset;
create policy daily_reset_update on public.daily_reset
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists daily_reset_delete on public.daily_reset;
create policy daily_reset_delete on public.daily_reset
  for delete to authenticated using (public.is_org_member());
