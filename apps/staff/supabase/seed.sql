-- Minimal bootstrap seed. Task / content / location seeds belong to later phases.
-- auth_user_id stays null until each person links their account after first
-- magic-link login (see supabase/README.md).

insert into public.staff (id, name, role, shift_label, auth_user_id)
values
  ('00000000-0000-0000-0000-000000000001', 'ルッコロー', 'owner', null, null),
  ('00000000-0000-0000-0000-000000000002', 'モーリー', 'staff', null, null),
  ('00000000-0000-0000-0000-000000000003', '日中スタッフ', 'staff', null, null)
on conflict (id) do nothing;

insert into public.device (id, mode, label)
values
  ('00000000-0000-0000-0000-0000000000d1', 'shared', '受付iPad')
on conflict (id) do nothing;

insert into public.daily_reset (id, last_reset_date)
values
  (
    '00000000-0000-0000-0000-0000000000a1',
    to_char((now() at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD')
  )
on conflict (id) do nothing;
