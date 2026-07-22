-- Bento-order mirror synced FROM koguchi-bento (Rucolow/koguchi-bento, Neon).
-- koguchi writes via the dedicated bento_writer role (event push + watermark
-- cron); staff read and link orders to guests (guest_id/match) — nothing else.
-- Contract: docs/plan-bento-integration.md §6. Conventions per 0002: dates as
-- text 'YYYY-MM-DD', enums as text.

create table if not exists public.bento_order (
  id text primary key,               -- koguchi Order.id (cuid)
  status text not null,              -- external enum, intentionally no check (accept future values)
  channel text,
  delivery_date text not null,       -- 'YYYY-MM-DD' (JST calendar day)
  customer_name text,                -- for matching/display; email/phone deliberately NOT mirrored
  items_label text,                  -- display snapshot "焼肉弁当 ×2"
  items_json text,                   -- [{"slug","name","qty","unitPriceYen"}]; aggregate by slug
  total_yen integer,
  refunded_yen integer not null default 0,  -- surfaces post-deadline partial refunds
  note text,                         -- requests/allergies — staff must see this
  payment_method text,               -- manual-entry tag ONSITE/CASH/BANK/OTHER (online = null)
  fulfilled_at timestamptz,
  source_updated_at timestamptz,     -- koguchi updatedAt; stale-write guard below
  synced_at timestamptz not null default now(),  -- advanced on update by the trigger
  guest_id uuid references public.guest (id) on delete set null,
  match text not null default 'none' check (match in ('none','manual','excluded'))
);
create index if not exists bento_order_date_idx on public.bento_order (delivery_date);

-- Dedicated writer role (no service key handed out). A leak is contained to this
-- one table, and the matching columns are unwritable at the privilege level.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bento_writer') then
    create role bento_writer nologin;
  end if;
end $$;
grant bento_writer to authenticator;
grant usage on schema public to bento_writer;
grant select on public.bento_order to bento_writer;
grant insert (id, status, channel, delivery_date, customer_name, items_label,
              items_json, total_yen, refunded_yen, note, payment_method,
              fulfilled_at, source_updated_at)
  on public.bento_order to bento_writer;
grant update (status, channel, delivery_date, customer_name, items_label,
              items_json, total_yen, refunded_yen, note, payment_method,
              fulfilled_at, source_updated_at)
  on public.bento_order to bento_writer;

-- Defense-in-depth trigger:
--  (1) drop stale writes (source_updated_at going backwards — late push vs cron)
--  (2) keep the writer role from ever touching the matching columns
--  (3) advance synced_at on every update (default only covers inserts)
create or replace function public.bento_order_guard()
returns trigger language plpgsql as $$
begin
  if new.source_updated_at is not null and old.source_updated_at is not null
     and new.source_updated_at < old.source_updated_at then
    return null; -- stale write: skip
  end if;
  if current_user = 'bento_writer' then
    new.guest_id := old.guest_id;
    new.match := old.match;
  end if;
  new.synced_at := now();
  return new;
end $$;
drop trigger if exists bento_order_guard on public.bento_order;
create trigger bento_order_guard before update on public.bento_order
  for each row execute function public.bento_order_guard();

alter table public.bento_order enable row level security;
revoke all on table public.bento_order from anon;
-- Staff: read + update ONLY the matching columns (0006 column-grant pattern).
grant select on public.bento_order to authenticated;
grant update (guest_id, match) on public.bento_order to authenticated;
drop policy if exists bento_order_select on public.bento_order;
create policy bento_order_select on public.bento_order
  for select to authenticated using (public.is_org_member());
drop policy if exists bento_order_update on public.bento_order;
create policy bento_order_update on public.bento_order
  for update to authenticated
  using (public.is_org_member()) with check (public.is_org_member());
-- RLS default-denies roles with no applicable policy — without this, every
-- bento_writer request would 42501 and the mirror would stay empty. Row-level
-- allow-all is safe: the real protection is the column grants + guard trigger.
drop policy if exists bento_order_writer on public.bento_order;
create policy bento_order_writer on public.bento_order
  for all to bento_writer using (true) with check (true);

-- publication + powersync_role (0010/0018 template)
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'powersync' and tablename = 'bento_order') then
    alter publication powersync add table public.bento_order;
  end if;
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.bento_order to powersync_role;
  end if;
end $$;
