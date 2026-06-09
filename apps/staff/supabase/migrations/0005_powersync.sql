-- PowerSync publication and replication grants.
--
-- Logical replication itself (wal_level = logical) and the dedicated replication
-- role with its password are configured during PowerSync/Supabase setup, not here:
--   create role powersync_role with replication login password '<secret>';
-- This migration only declares the publication and, if that role already exists,
-- grants it read access to the synced tables.

drop publication if exists powersync;
create publication powersync for table
  public.staff,
  public.device,
  public.shift_session,
  public.guest,
  public.guest_note,
  public.timeline_entry,
  public.followup,
  public.task,
  public.content,
  public.lost_item,
  public.equipment_issue,
  public.daily_reset;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant usage on schema public to powersync_role;
    grant select on
      public.staff, public.device, public.shift_session, public.guest,
      public.guest_note, public.timeline_entry, public.followup, public.task,
      public.content, public.lost_item, public.equipment_issue, public.daily_reset
    to powersync_role;
  end if;
end
$$;
