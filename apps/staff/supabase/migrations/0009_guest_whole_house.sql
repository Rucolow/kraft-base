-- Whether the day's booking takes the whole house (貸切) or shares the dormitory.
alter table public.guest
  add column if not exists whole_house boolean not null default false;
