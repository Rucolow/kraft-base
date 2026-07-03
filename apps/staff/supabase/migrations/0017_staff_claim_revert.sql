-- Revert the owner-claim guard (0015). It assumed a single owner, but KRAFT
-- BASE has two legitimate owners (ルッコロー and モーリー). Once the first owner
-- linked, 0015 made every remaining unclaimed owner row un-claimable — so the
-- second owner could no longer bind their own staff row and was locked out of
-- owner rights. The LinkAccount UI carried the same faulty guard (removed in the
-- same change).
--
-- Restore the permissive self-claim policy from 0011: any signed-in user may
-- claim an unclaimed staff row and bind it to their own uid. This is an accepted
-- risk for a trusted 3-person team — owner rows are only ever created by an
-- existing owner, and a new sign-in must already hold a valid org invite email
-- to reach this screen at all.

drop policy if exists staff_claim on public.staff;
create policy staff_claim on public.staff
  for update to authenticated
  using (auth_user_id is null)
  with check (auth_user_id = auth.uid());

drop function if exists public.owner_is_linked();
