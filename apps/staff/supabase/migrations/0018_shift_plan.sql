-- Staff shift PLAN (rota), distinct from shift_session (actual clock-in history).
-- The owner assigns who works which day; everyone can view. Modeled on 0010.
--
-- `date` is the shift-day ('YYYY-MM-DD', 04:00→04:00 JST boundary), the same
-- attribution WorkTime uses for actuals, so a future "plan vs actual" view lines
-- up. One row per (day, staff) assignment; a multi-day stint is N rows.

create table if not exists public.shift_plan (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  staff_id uuid not null references public.staff (id),
  label text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);

create index if not exists shift_plan_date_idx on public.shift_plan (date);

alter table public.shift_plan enable row level security;

revoke all on table public.shift_plan from anon;
grant select, insert, update, delete on table public.shift_plan to authenticated;

-- Everyone reads the rota; only the owner edits it (UI mirrors this exactly).
drop policy if exists shift_plan_select on public.shift_plan;
create policy shift_plan_select on public.shift_plan
  for select to authenticated using (public.is_org_member());
drop policy if exists shift_plan_insert on public.shift_plan;
create policy shift_plan_insert on public.shift_plan
  for insert to authenticated with check (public.is_owner());
drop policy if exists shift_plan_update on public.shift_plan;
create policy shift_plan_update on public.shift_plan
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists shift_plan_delete on public.shift_plan;
create policy shift_plan_delete on public.shift_plan
  for delete to authenticated using (public.is_owner());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and tablename = 'shift_plan'
  ) then
    alter publication powersync add table public.shift_plan;
  end if;
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.shift_plan to powersync_role;
  end if;
end
$$;
