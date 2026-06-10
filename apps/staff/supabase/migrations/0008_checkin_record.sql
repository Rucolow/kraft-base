-- Digital guest register: guests fill the legally required register fields on
-- the reception device instead of paper. Contains PII — staff may read and
-- create entries; correction and deletion stay owner-only. Retention is the
-- owner's responsibility (the register must generally be kept for 3 years).

create table if not exists public.checkin_record (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guest (id) on delete cascade,
  name text not null,
  address text,
  contact text,
  nationality text,
  passport_number text,
  created_at timestamptz not null default now()
);

create index if not exists checkin_record_guest_idx on public.checkin_record (guest_id);

alter table public.checkin_record enable row level security;

revoke all on table public.checkin_record from anon;
grant select, insert, update, delete on table public.checkin_record to authenticated;

drop policy if exists checkin_record_select on public.checkin_record;
create policy checkin_record_select on public.checkin_record
  for select to authenticated using (public.is_org_member());
drop policy if exists checkin_record_insert on public.checkin_record;
create policy checkin_record_insert on public.checkin_record
  for insert to authenticated with check (public.is_org_member());
drop policy if exists checkin_record_update on public.checkin_record;
create policy checkin_record_update on public.checkin_record
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists checkin_record_delete on public.checkin_record;
create policy checkin_record_delete on public.checkin_record
  for delete to authenticated using (public.is_owner());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and tablename = 'checkin_record'
  ) then
    alter publication powersync add table public.checkin_record;
  end if;
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.checkin_record to powersync_role;
  end if;
end
$$;
