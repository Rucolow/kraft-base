-- R11: スタッフの「出勤できない日」申請（休み希望）。
-- shift_plan（オーナーが組む予定）とは別テーブルで、こちらは本人が自分の分を書く。
--
-- `date` は shift_plan と同じ「シフト日」（'YYYY-MM-DD'・04:00→04:00 JST 境界）。
-- v1 は終日のみ（午前／午後の区別なし）。
--
-- 信頼モデル: 誰の申請かは **クライアントの currentStaff**（受付iPadで名前をタップして
-- 開始中の人）で決まる。共有iPadの auth はデバイス用アカウントなので、RLS で
-- `staff_id = auth.uid()` を強制することはできない。shift_session と同じ信頼モデル
-- （宿の小さなチーム・端末は宿内）で、select/insert/delete を org member に開放し、
-- UI 側で「自分の行だけ書く」を担保する。update は用途が無いので付与しない。
--
-- unique 制約は付けない: PowerSync は PK での upsert を行うため (date, staff_id) の
-- unique があるとアップロードが衝突で詰まる（shift_plan と同じ判断）。同日同人の
-- 重複はクライアント側で排除する（toggleUnavailable が既存行を全削除する）。

create table if not exists public.shift_unavailable (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  staff_id uuid not null references public.staff (id),
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);

create index if not exists shift_unavailable_date_idx on public.shift_unavailable (date);

alter table public.shift_unavailable enable row level security;

revoke all on table public.shift_unavailable from anon;
grant select, insert, delete on table public.shift_unavailable to authenticated;

drop policy if exists shift_unavailable_select on public.shift_unavailable;
create policy shift_unavailable_select on public.shift_unavailable
  for select to authenticated using (public.is_org_member());
drop policy if exists shift_unavailable_insert on public.shift_unavailable;
create policy shift_unavailable_insert on public.shift_unavailable
  for insert to authenticated with check (public.is_org_member());
drop policy if exists shift_unavailable_delete on public.shift_unavailable;
create policy shift_unavailable_delete on public.shift_unavailable
  for delete to authenticated using (public.is_org_member());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and tablename = 'shift_unavailable'
  ) then
    alter publication powersync add table public.shift_unavailable;
  end if;
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.shift_unavailable to powersync_role;
  end if;
end
$$;
