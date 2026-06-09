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
