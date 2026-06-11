-- Device (reception) accounts. A shared iPad signs in once with its own
-- staff-role account so the device carries staff-level permissions, not the
-- owner's. Such an account is the device's auth identity, not a person who
-- works shifts, so it is flagged is_device and hidden from the people pickers
-- (shift selection, personal-device binding, account linking).

alter table public.staff
  add column if not exists is_device boolean not null default false;
