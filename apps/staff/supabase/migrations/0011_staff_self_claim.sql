-- Self-service bootstrap: a signed-in user may claim a staff row that is not yet
-- linked, binding it to their own auth uid. Full edits of staff stay owner-only,
-- so no manual SQL is needed for first sign-in.

drop policy if exists staff_claim on public.staff;
create policy staff_claim on public.staff
  for update to authenticated
  using (auth_user_id is null)
  with check (auth_user_id = auth.uid());
