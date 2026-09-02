-- R9-b: シフト共有リンクを「宿で1本」に。
-- オーナー判断: 全員が同じシフト表を見るのに個別リンクを発行する意味が無い。
-- トレードオフ（漏洩時は全員へ再配布）は少人数運用では許容。
-- あわせて (1) 無効トークンは 403 を返して「無効」と「シフト無し」を区別できるように、
-- (2) 名簿（フィルタ用）と当月シフトを1回の呼び出しで返す jsonb に変更。

drop function if exists public.rota_links();
drop function if exists public.rota_reset_token(uuid);
drop function if exists public.rota_feed(uuid, text, text);
drop table if exists public.rota_token;

create table if not exists public.rota_share (
  id smallint primary key default 1 check (id = 1),
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.rota_share enable row level security;
revoke all on table public.rota_share from anon, authenticated;
insert into public.rota_share (id) values (1) on conflict (id) do nothing;

-- 公開: 有効トークンなら {staff:[...], shifts:[...]}。無効なら 403（28000）。
create or replace function public.rota_feed(p_token uuid, p_from text, p_to text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not exists (select 1 from public.rota_share where token = p_token) then
    raise exception 'invalid rota token' using errcode = '28000';
  end if;
  select jsonb_build_object(
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'accent', s.accent)
                       order by s.role, s.name)
        from public.staff s
       where s.is_device = false and s.hidden = false), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object('date', sp.date, 'staff_id', sp.staff_id, 'label', sp.label)
                       order by sp.date, sp.created_at)
        from public.shift_plan sp
        join public.staff s on s.id = sp.staff_id
       where s.hidden = false and sp.date >= p_from and sp.date <= p_to), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.rota_feed(uuid, text, text) from public;
grant execute on function public.rota_feed(uuid, text, text) to anon, authenticated;

-- オーナー専用: 現在のリンク用トークン。
create or replace function public.rota_link()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v uuid;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  select token into v from public.rota_share where id = 1;
  return v;
end $$;
revoke all on function public.rota_link() from public;
grant execute on function public.rota_link() to authenticated;

-- オーナー専用: 再発行（旧リンクは全員分が即無効・再配布が必要）。
create or replace function public.rota_reset()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v uuid;
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  update public.rota_share set token = gen_random_uuid(), created_at = now()
   where id = 1 returning token into v;
  return v;
end $$;
revoke all on function public.rota_reset() from public;
grant execute on function public.rota_reset() to authenticated;
