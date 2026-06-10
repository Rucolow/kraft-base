-- In-house sale catalogue (館内販売). Margin is derived (sell_price - cost).
-- Everyone reads; owner manages prices.

create table if not exists public.product (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sell_price integer not null default 0,
  cost integer not null default 0,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product enable row level security;

revoke all on table public.product from anon;
grant select, insert, update, delete on table public.product to authenticated;

drop policy if exists product_select on public.product;
create policy product_select on public.product
  for select to authenticated using (public.is_org_member());
drop policy if exists product_insert on public.product;
create policy product_insert on public.product
  for insert to authenticated with check (public.is_owner());
drop policy if exists product_update on public.product;
create policy product_update on public.product
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists product_delete on public.product;
create policy product_delete on public.product
  for delete to authenticated using (public.is_owner());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and tablename = 'product'
  ) then
    alter publication powersync add table public.product;
  end if;
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.product to powersync_role;
  end if;
end
$$;
