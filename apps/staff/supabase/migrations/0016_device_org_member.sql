-- CONDITIONAL — apply only after confirming the shared-iPad sync issue (see the
-- staging verification plan). Pairs with the "device row never syncs" finding.
--
-- device_insert/device_update were is_owner()-only, but the shared reception iPad
-- runs as a staff-role device account. So its Setup INSERT (and later edits) were
-- rejected by RLS and silently discarded, the device row never reached Postgres,
-- and every shift_session that FKs to that device failed too (23503) — which can
-- present as "start a shift, bounce back to the roster" and missing work-time on
-- the owner's device. Relaxing insert/update to org members lets the iPad persist
-- and sync its own device. SELECT stays org-member; DELETE stays owner-only.

drop policy if exists device_insert on public.device;
create policy device_insert on public.device
  for insert to authenticated with check (public.is_org_member());

drop policy if exists device_update on public.device;
create policy device_update on public.device
  for update to authenticated
  using (public.is_org_member())
  with check (public.is_org_member());
