-- Guests can be marked cancelled, and staff (not only owners) may set a guest's
-- operational status. Creation/deletion of guests stay owner-only; the app keeps
-- the full edit form behind the owner gate. This also makes the staff check-in
-- (status -> 'arrived') actually persist.

alter table public.guest drop constraint if exists guest_status_check;
alter table public.guest
  add constraint guest_status_check
  check (status in ('expected', 'arrived', 'late', 'cancelled'));

drop policy if exists guest_update on public.guest;
create policy guest_update on public.guest
  for update to authenticated
  using (public.is_org_member())
  with check (public.is_org_member());
