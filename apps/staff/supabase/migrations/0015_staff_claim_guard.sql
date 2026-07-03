-- Harden the self-claim path (0011) so it can't be used to escalate to owner.
--
-- staff_claim let any signed-in user bind ANY unclaimed staff row to their uid,
-- with no role check — so an unclaimed owner row could be claimed by anyone,
-- granting is_owner() rights. This restricts claiming an owner row to the
-- bootstrap case (no owner linked yet); after that, owner rows are not claimable.
-- The UI (LinkAccount) enforces the same, this is the server-side guarantee.
--
-- Uses a SECURITY DEFINER helper so the policy doesn't run a self-referential
-- subquery on public.staff under RLS.

create or replace function public.owner_is_linked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff where role = 'owner' and auth_user_id is not null
  );
$$;

grant execute on function public.owner_is_linked() to authenticated;

drop policy if exists staff_claim on public.staff;
create policy staff_claim on public.staff
  for update to authenticated
  using (auth_user_id is null and (role <> 'owner' or not public.owner_is_linked()))
  with check (auth_user_id = auth.uid());
