-- KRAFT BASE 使い捨て検証環境(L5)用スキーマ。新規Supabaseプロジェクトに1回貼って実行する。
-- 本番マイグレーション 0001〜0019 を順に結合したもの（手動再生成）。
-- 方針: 常設ステージングは作らない（docs/plan-verification-system.md）。大規模変更の
-- 事前リハーサルでのみ使い捨て環境を立てる用。migrations を増やしたら末尾に追記すること。

-- ===== 0001_extensions.sql =====
-- Extensions
-- pgcrypto: gen_random_uuid()
-- pg_cron: scheduled jobs (shift session auto-close)

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ===== 0002_tables.sql =====
-- Schema (spec.md §6)
-- Conventions: id uuid (gen_random_uuid), timestamptz default now(),
-- dates as text 'YYYY-MM-DD', enums as text + check constraints.

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('owner', 'staff')),
  shift_label text,
  accent text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.device (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('shared', 'personal')),
  bound_staff_id uuid references public.staff (id) on delete set null,
  label text not null,
  auto_lock_min int,
  created_at timestamptz not null default now()
);

create table if not exists public.shift_session (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  device_id uuid references public.device (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  handover_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shift_session_staff_idx on public.shift_session (staff_id);
create index if not exists shift_session_open_idx on public.shift_session (started_at)
  where ended_at is null;

create table if not exists public.guest (
  id uuid primary key default gen_random_uuid(),
  stay_date text not null,
  name text not null,
  country text,
  language text,
  party_size int,
  checkin_time text,
  bed text,
  bento text,
  status text not null default 'expected' check (status in ('expected', 'arrived', 'late')),
  review_sent_at timestamptz,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);

create index if not exists guest_stay_date_idx on public.guest (stay_date);

create table if not exists public.guest_note (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guest (id) on delete cascade,
  author_id uuid references public.staff (id),
  body text not null,
  pinned boolean not null default false,
  mentions uuid[] not null default '{}',
  read_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists guest_note_guest_idx on public.guest_note (guest_id);
create index if not exists guest_note_mentions_idx on public.guest_note using gin (mentions);

create table if not exists public.timeline_entry (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.staff (id),
  kind text not null check (kind in ('action', 'note', 'system')),
  body text not null,
  ref_type text check (ref_type in ('guest', 'task', 'followup', 'lost_item', 'equipment_issue')),
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists timeline_entry_created_idx on public.timeline_entry (created_at);

create table if not exists public.followup (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  guest_id uuid references public.guest (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'done')),
  requires_owner boolean not null default false,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists followup_open_idx on public.followup (created_at)
  where status = 'open';

create table if not exists public.task (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  "group" text not null check ("group" in ('daily', 'per_checkout', 'oneoff')),
  phase text check (phase in ('midday_prep', 'cleaning', 'evening_close', 'morning_prep')),
  source text not null default 'manual' check (source in ('manual', 'adhoc')),
  owner_id uuid references public.staff (id),
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists task_source_phase_idx on public.task (source, phase);

create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in ('manual', 'location', 'procedure', 'area', 'emergency', 'price', 'phrase')
  ),
  slug text not null unique,
  title text not null,
  body text,
  phase text check (phase in ('midday_prep', 'cleaning', 'evening_close', 'morning_prep')),
  lang text,
  photo_paths text[] not null default '{}',
  status text not null default 'needs_input' check (status in ('ready', 'needs_input')),
  updated_by uuid references public.staff (id),
  updated_at timestamptz not null default now()
);

create index if not exists content_kind_idx on public.content (kind);
create index if not exists content_needs_input_idx on public.content (updated_at)
  where status = 'needs_input';

create table if not exists public.lost_item (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  found_date text,
  place text,
  finder_id uuid references public.staff (id),
  guest_id uuid references public.guest (id) on delete set null,
  photo_path text,
  status text not null default 'held'
    check (status in ('held', 'contacted', 'returned', 'disposed', 'police')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_issue (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('fault', 'restock')),
  title text not null,
  photo_path text,
  status text not null default 'open' check (status in ('open', 'ordered', 'resolved')),
  reporter_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.daily_reset (
  id uuid primary key default gen_random_uuid(),
  last_reset_date text not null,
  created_at timestamptz not null default now()
);

-- ===== 0003_rls.sql =====
-- RLS, helper functions, and grants.
-- Model: organisation members (staff/owner) authenticate via magic link and are
-- linked through staff.auth_user_id. Shared iPad authenticates as a staff-role
-- reception account; per-person attribution during the day is an app-layer concern
-- (shift_session selection, author_id), not RLS.

-- Helpers -------------------------------------------------------------------

create or replace function public.is_org_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s where s.auth_user_id = auth.uid()
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.auth_user_id = auth.uid() and s.role = 'owner'
  );
$$;

grant execute on function public.is_org_member() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- Enable RLS ----------------------------------------------------------------

alter table public.staff enable row level security;
alter table public.device enable row level security;
alter table public.shift_session enable row level security;
alter table public.guest enable row level security;
alter table public.guest_note enable row level security;
alter table public.timeline_entry enable row level security;
alter table public.followup enable row level security;
alter table public.task enable row level security;
alter table public.content enable row level security;
alter table public.lost_item enable row level security;
alter table public.equipment_issue enable row level security;
alter table public.daily_reset enable row level security;

-- Grants (Data API auto-expose is OFF, so grant explicitly; anon gets nothing) -

revoke all on table
  public.staff, public.device, public.shift_session, public.guest,
  public.guest_note, public.timeline_entry, public.followup, public.task,
  public.content, public.lost_item, public.equipment_issue, public.daily_reset
from anon;

grant select, insert, update, delete on table
  public.staff, public.device, public.shift_session, public.guest,
  public.guest_note, public.timeline_entry, public.followup, public.task,
  public.content, public.lost_item, public.equipment_issue, public.daily_reset
to authenticated;

-- Policies ------------------------------------------------------------------
-- Read: any authenticated org member. Write: authenticated org member, except
-- owner-only tables (guest, content, task, staff, device).

-- staff (owner-managed)
drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  for select to authenticated using (public.is_org_member());
drop policy if exists staff_insert on public.staff;
create policy staff_insert on public.staff
  for insert to authenticated with check (public.is_owner());
drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists staff_delete on public.staff;
create policy staff_delete on public.staff
  for delete to authenticated using (public.is_owner());

-- device (owner-managed)
drop policy if exists device_select on public.device;
create policy device_select on public.device
  for select to authenticated using (public.is_org_member());
drop policy if exists device_insert on public.device;
create policy device_insert on public.device
  for insert to authenticated with check (public.is_owner());
drop policy if exists device_update on public.device;
create policy device_update on public.device
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists device_delete on public.device;
create policy device_delete on public.device
  for delete to authenticated using (public.is_owner());

-- shift_session (org member)
drop policy if exists shift_session_select on public.shift_session;
create policy shift_session_select on public.shift_session
  for select to authenticated using (public.is_org_member());
drop policy if exists shift_session_insert on public.shift_session;
create policy shift_session_insert on public.shift_session
  for insert to authenticated with check (public.is_org_member());
drop policy if exists shift_session_update on public.shift_session;
create policy shift_session_update on public.shift_session
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists shift_session_delete on public.shift_session;
create policy shift_session_delete on public.shift_session
  for delete to authenticated using (public.is_org_member());

-- guest (owner-managed)
drop policy if exists guest_select on public.guest;
create policy guest_select on public.guest
  for select to authenticated using (public.is_org_member());
drop policy if exists guest_insert on public.guest;
create policy guest_insert on public.guest
  for insert to authenticated with check (public.is_owner());
drop policy if exists guest_update on public.guest;
create policy guest_update on public.guest
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists guest_delete on public.guest;
create policy guest_delete on public.guest
  for delete to authenticated using (public.is_owner());

-- guest_note (org member)
drop policy if exists guest_note_select on public.guest_note;
create policy guest_note_select on public.guest_note
  for select to authenticated using (public.is_org_member());
drop policy if exists guest_note_insert on public.guest_note;
create policy guest_note_insert on public.guest_note
  for insert to authenticated with check (public.is_org_member());
drop policy if exists guest_note_update on public.guest_note;
create policy guest_note_update on public.guest_note
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists guest_note_delete on public.guest_note;
create policy guest_note_delete on public.guest_note
  for delete to authenticated using (public.is_org_member());

-- timeline_entry (org member)
drop policy if exists timeline_entry_select on public.timeline_entry;
create policy timeline_entry_select on public.timeline_entry
  for select to authenticated using (public.is_org_member());
drop policy if exists timeline_entry_insert on public.timeline_entry;
create policy timeline_entry_insert on public.timeline_entry
  for insert to authenticated with check (public.is_org_member());
drop policy if exists timeline_entry_update on public.timeline_entry;
create policy timeline_entry_update on public.timeline_entry
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists timeline_entry_delete on public.timeline_entry;
create policy timeline_entry_delete on public.timeline_entry
  for delete to authenticated using (public.is_org_member());

-- followup (org member)
drop policy if exists followup_select on public.followup;
create policy followup_select on public.followup
  for select to authenticated using (public.is_org_member());
drop policy if exists followup_insert on public.followup;
create policy followup_insert on public.followup
  for insert to authenticated with check (public.is_org_member());
drop policy if exists followup_update on public.followup;
create policy followup_update on public.followup
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists followup_delete on public.followup;
create policy followup_delete on public.followup
  for delete to authenticated using (public.is_org_member());

-- task (owner-managed)
drop policy if exists task_select on public.task;
create policy task_select on public.task
  for select to authenticated using (public.is_org_member());
drop policy if exists task_insert on public.task;
create policy task_insert on public.task
  for insert to authenticated with check (public.is_owner());
drop policy if exists task_update on public.task;
create policy task_update on public.task
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists task_delete on public.task;
create policy task_delete on public.task
  for delete to authenticated using (public.is_owner());

-- content (owner-managed)
drop policy if exists content_select on public.content;
create policy content_select on public.content
  for select to authenticated using (public.is_org_member());
drop policy if exists content_insert on public.content;
create policy content_insert on public.content
  for insert to authenticated with check (public.is_owner());
drop policy if exists content_update on public.content;
create policy content_update on public.content
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists content_delete on public.content;
create policy content_delete on public.content
  for delete to authenticated using (public.is_owner());

-- lost_item (org member)
drop policy if exists lost_item_select on public.lost_item;
create policy lost_item_select on public.lost_item
  for select to authenticated using (public.is_org_member());
drop policy if exists lost_item_insert on public.lost_item;
create policy lost_item_insert on public.lost_item
  for insert to authenticated with check (public.is_org_member());
drop policy if exists lost_item_update on public.lost_item;
create policy lost_item_update on public.lost_item
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists lost_item_delete on public.lost_item;
create policy lost_item_delete on public.lost_item
  for delete to authenticated using (public.is_org_member());

-- equipment_issue (org member)
drop policy if exists equipment_issue_select on public.equipment_issue;
create policy equipment_issue_select on public.equipment_issue
  for select to authenticated using (public.is_org_member());
drop policy if exists equipment_issue_insert on public.equipment_issue;
create policy equipment_issue_insert on public.equipment_issue
  for insert to authenticated with check (public.is_org_member());
drop policy if exists equipment_issue_update on public.equipment_issue;
create policy equipment_issue_update on public.equipment_issue
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists equipment_issue_delete on public.equipment_issue;
create policy equipment_issue_delete on public.equipment_issue
  for delete to authenticated using (public.is_org_member());

-- daily_reset (org member)
drop policy if exists daily_reset_select on public.daily_reset;
create policy daily_reset_select on public.daily_reset
  for select to authenticated using (public.is_org_member());
drop policy if exists daily_reset_insert on public.daily_reset;
create policy daily_reset_insert on public.daily_reset
  for insert to authenticated with check (public.is_org_member());
drop policy if exists daily_reset_update on public.daily_reset;
create policy daily_reset_update on public.daily_reset
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists daily_reset_delete on public.daily_reset;
create policy daily_reset_delete on public.daily_reset
  for delete to authenticated using (public.is_org_member());

-- ===== 0004_functions_cron.sql =====
-- Shift session auto-close.
-- Closes any session still open at 04:00 JST: ended_at is null and started_at is
-- before today's 04:00 JST boundary. pg_cron runs in UTC, so 04:00 JST == 19:00 UTC.

create or replace function public.close_stale_shift_sessions()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.shift_session
     set ended_at = now()
   where ended_at is null
     and started_at <
       ((date_trunc('day', now() at time zone 'Asia/Tokyo') + interval '4 hours')
        at time zone 'Asia/Tokyo');
$$;

select cron.unschedule(jobid)
  from cron.job
 where jobname = 'close-stale-shift-sessions';

select cron.schedule(
  'close-stale-shift-sessions',
  '0 19 * * *',
  $$select public.close_stale_shift_sessions();$$
);

-- ===== 0005_powersync.sql =====
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

-- ===== 0006_task_done_grant.sql =====
-- Staff (including the shared device account) may tick tasks done; creation,
-- deletion and other columns stay owner-only. Column-level UPDATE limits the
-- authenticated role to done/done_at, and the update policy is opened to org
-- members. Owner edits of other task columns go through elevated access (SQL).

revoke update on public.task from authenticated;
grant update (done, done_at) on public.task to authenticated;

drop policy if exists task_update on public.task;
create policy task_update on public.task
  for update to authenticated
  using (public.is_org_member())
  with check (public.is_org_member());

-- ===== 0007_content_collaborative.sql =====
-- Operational content becomes collaboratively editable: any org member may
-- create and update entries (the grow-the-knowledge workflow). Deletion stays
-- owner-only.

drop policy if exists content_insert on public.content;
create policy content_insert on public.content
  for insert to authenticated with check (public.is_org_member());

drop policy if exists content_update on public.content;
create policy content_update on public.content
  for update to authenticated
  using (public.is_org_member())
  with check (public.is_org_member());

-- ===== 0008_checkin_record.sql =====
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

-- ===== 0009_guest_whole_house.sql =====
-- Whether the day's booking takes the whole house (貸切) or shares the dormitory.
alter table public.guest
  add column if not exists whole_house boolean not null default false;

-- ===== 0010_product.sql =====
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

-- ===== 0011_staff_self_claim.sql =====
-- Self-service bootstrap: a signed-in user may claim a staff row that is not yet
-- linked, binding it to their own auth uid. Full edits of staff stay owner-only,
-- so no manual SQL is needed for first sign-in.

drop policy if exists staff_claim on public.staff;
create policy staff_claim on public.staff
  for update to authenticated
  using (auth_user_id is null)
  with check (auth_user_id = auth.uid());

-- ===== 0012_staff_device_account.sql =====
-- Device (reception) accounts. A shared iPad signs in once with its own
-- staff-role account so the device carries staff-level permissions, not the
-- owner's. Such an account is the device's auth identity, not a person who
-- works shifts, so it is flagged is_device and hidden from the people pickers
-- (shift selection, personal-device binding, account linking).

alter table public.staff
  add column if not exists is_device boolean not null default false;

-- ===== 0013_task_staff_add.sql =====
-- Staff may add ad-hoc tasks (the "noticed it, make it a task" workflow), on top
-- of ticking tasks done (0006). Deletion stays owner-only, and the column-level
-- UPDATE grant still limits non-elevated edits to done/done_at, so titles and
-- structure are not rewritten by staff.

drop policy if exists task_insert on public.task;
create policy task_insert on public.task
  for insert to authenticated with check (public.is_org_member());

-- ===== 0014_guest_status_cancel.sql =====
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


-- ===== 0015_staff_claim_guard.sql =====
-- NOTE: 0015 was reverted by 0017 (KRAFT BASE has two legitimate owners). Kept in
-- sequence so a fresh combined apply reproduces the true final state.
-- Harden the self-claim path (0011) so it can't be used to escalate to owner.

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

-- ===== 0016_device_org_member.sql =====
-- device_insert/update relaxed from owner-only to org-member (shared iPad sync).
-- SELECT stays org-member; DELETE stays owner-only.

drop policy if exists device_insert on public.device;
create policy device_insert on public.device
  for insert to authenticated with check (public.is_org_member());

drop policy if exists device_update on public.device;
create policy device_update on public.device
  for update to authenticated
  using (public.is_org_member())
  with check (public.is_org_member());

-- ===== 0017_staff_claim_revert.sql =====
-- Revert 0015: restore the permissive self-claim policy (two legitimate owners),
-- drop the owner_is_linked() helper.

drop policy if exists staff_claim on public.staff;
create policy staff_claim on public.staff
  for update to authenticated
  using (auth_user_id is null)
  with check (auth_user_id = auth.uid());

drop function if exists public.owner_is_linked();

-- ===== 0018_shift_plan.sql =====
-- Staff shift plan (rota). date = shift-day; owner edits, everyone reads.

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
  if not exists (select 1 from pg_publication_tables where pubname = 'powersync' and tablename = 'shift_plan') then
    alter publication powersync add table public.shift_plan;
  end if;
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.shift_plan to powersync_role;
  end if;
end
$$;

-- ===== 0019_bento_order.sql =====

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
