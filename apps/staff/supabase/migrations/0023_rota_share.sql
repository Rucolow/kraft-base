-- R9: スタッフ向けシフト表の共有リンク（ログイン不要・トークンURL）。
--
-- 設計:
--  - トークンは staff 本体ではなく別表 rota_token に置く。staff は PowerSync で
--    全端末に SELECT * 同期されるため、列を足すと全スタッフが互いのトークンを
--    読めてしまう。別表は publication に加えず、RLS で authenticated からも直接
--    読めない（SECURITY DEFINER 関数だけが触る）。
--  - 公開関数 rota_feed(token, from, to) は anon で呼べる。返すのは
--    「日付・スタッフ名・色・ラベル」のみ（ゲスト情報ゼロ）。hidden の旧行は除外。
--  - オーナー専用関数 rota_links() / rota_reset_token() でリンクの取得と再発行。
--    再発行すると旧リンクは即無効（漏洩時の取り消し手段）。

create table if not exists public.rota_token (
  staff_id uuid primary key references public.staff (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.rota_token enable row level security;
revoke all on table public.rota_token from anon, authenticated;
-- 意図的にポリシー無し: 直接アクセスは全ロール拒否。関数経由のみ。

-- 公開: トークンが有効ならシフト表を返す。
create or replace function public.rota_feed(p_token uuid, p_from text, p_to text)
returns table (date text, staff_name text, accent text, label text)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.date, s.name, s.accent, sp.label
    from public.shift_plan sp
    join public.staff s on s.id = sp.staff_id
   where exists (
           select 1 from public.rota_token t
             join public.staff ts on ts.id = t.staff_id
            where t.token = p_token and ts.hidden = false
         )
     and s.hidden = false
     and sp.date >= p_from and sp.date <= p_to
   order by sp.date, sp.created_at;
$$;
revoke all on function public.rota_feed(uuid, text, text) from public;
grant execute on function public.rota_feed(uuid, text, text) to anon, authenticated;

-- オーナー専用: 名簿メンバー全員のリンク用トークン（無ければ発行）。
create or replace function public.rota_links()
returns table (staff_id uuid, name text, token uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  insert into public.rota_token (staff_id)
    select s.id from public.staff s
     where s.is_device = false and s.hidden = false
       and not exists (select 1 from public.rota_token t where t.staff_id = s.id);
  return query
    select s.id, s.name, t.token
      from public.staff s
      join public.rota_token t on t.staff_id = s.id
     where s.is_device = false and s.hidden = false
     order by s.role, s.name;
end $$;
revoke all on function public.rota_links() from public;
grant execute on function public.rota_links() to authenticated;

-- オーナー専用: 再発行（旧リンクは即無効）。
create or replace function public.rota_reset_token(p_staff uuid)
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
  insert into public.rota_token (staff_id) values (p_staff)
    on conflict (staff_id) do update set token = gen_random_uuid(), created_at = now()
    returning token into v;
  return v;
end $$;
revoke all on function public.rota_reset_token(uuid) from public;
grant execute on function public.rota_reset_token(uuid) to authenticated;
