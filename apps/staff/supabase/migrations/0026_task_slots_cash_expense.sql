-- R12: 定型タスクを「先当番（first）／後当番（second）」に再編する。
-- R13: 現金出納（cash_expense）を追加する。
--
-- ■ 適用タイミング: **04:00 JST の直後**に実行すること。
--   日次リセット（runDailyReset）が 04:00 境界で done を全て 0 に戻した直後なら、
--   下の DELETE→INSERT で「その日すでにチェック済みのタスク」を消す事故が起きない。
--
-- ■ なぜ UPDATE ではなく DELETE→INSERT か:
--   旧リスト（16 件・phase 別）と新リスト（先当番 12 件／後当番 7 件）は
--   1 対 1 で対応しない（分割・統合・新設がある）。タイトルで突き合わせて
--   UPDATE すると対応表を人手で維持することになり、seed（content/seed.ts）と
--   二重管理になる。source='manual' の行は「運営が決めた定型リストの写し」で
--   あって履歴を持たないので、まるごと入れ替えるのが最も安全で読みやすい。
--   単発タスク（source='adhoc'）には触れない。
--   1 つの do $$ ブロックに入れてあるので DELETE と INSERT は不可分に適用される。
--
-- ■ 参照の注記: `timeline_entry.ref_type = 'task'` を書くコードは現状どこにも無い
--   （grep 済み）。したがって task 行を作り直しても参照は壊れない。
--
-- ■ phase 列は残す（後方互換のみ・読み手ゼロ）。`group` の 'per_checkout' も
--   CHECK と runDailyReset の対象としては残す（UI からは外れる）。
--
-- ■ INSERT ブロックは手書きではなく
--   `node --experimental-strip-types scripts/gen-content-seed.ts --migration`
--   の出力を貼ったもの。リストを変えるときは src/content/seed.ts を直して
--   再生成する（seed_content.sql と同じ正本）。

-- ===== R12: task =====

alter table public.task add column if not exists slot text check (slot in ('first', 'second'));
alter table public.task add column if not exists sort integer not null default 0;

-- タイトル・当番・並び順をアプリから編集できるようにする（0006 の列 GRANT を拡張）。
-- 信頼モデルは content（0007）と同じ「org member なら編集可」。編集ボタンを
-- オーナーにだけ出すのは UI 側の絞り込み。task_update ポリシー（org member）は据え置き。
revoke update on public.task from authenticated;
grant update (done, done_at, title, slot, sort) on public.task to authenticated;

-- 読み筋が (source, phase) から (slot, sort) に変わったので索引も張り替える。
drop index if exists public.task_source_phase_idx;
create index if not exists task_slot_sort_idx on public.task (slot, sort);

do $$
begin
  -- 生成物: scripts/gen-content-seed.ts --migration（src/content/seed.ts が正本）
  delete from public.task where source = 'manual';

  insert into public.task (id, title, "group", phase, slot, sort, source, done, created_at) values
    (gen_random_uuid(), 'のれんと提灯を準備', 'daily', null, 'first', 10, 'manual', false, now() + interval '1 milliseconds'),
    (gen_random_uuid(), 'ライト類の充電確認', 'daily', null, 'first', 20, 'manual', false, now() + interval '2 milliseconds'),
    (gen_random_uuid(), 'リネン類の洗濯と乾燥', 'daily', null, 'first', 30, 'manual', false, now() + interval '3 milliseconds'),
    (gen_random_uuid(), 'ベッドメイキング', 'daily', null, 'first', 40, 'manual', false, now() + interval '4 milliseconds'),
    (gen_random_uuid(), 'ベッドルームの清掃', 'daily', null, 'first', 50, 'manual', false, now() + interval '5 milliseconds'),
    (gen_random_uuid(), 'キッチンの清掃', 'daily', null, 'first', 60, 'manual', false, now() + interval '6 milliseconds'),
    (gen_random_uuid(), 'トイレとシャワーの清掃', 'daily', null, 'first', 70, 'manual', false, now() + interval '7 milliseconds'),
    (gen_random_uuid(), '共用部の清掃', 'daily', null, 'first', 80, 'manual', false, now() + interval '8 milliseconds'),
    (gen_random_uuid(), 'アメニティ補充', 'daily', null, 'first', 90, 'manual', false, now() + interval '9 milliseconds'),
    (gen_random_uuid(), '食品、ドリンク類の補充', 'daily', null, 'first', 100, 'manual', false, now() + interval '10 milliseconds'),
    (gen_random_uuid(), 'コーヒー退却', 'daily', null, 'first', 110, 'manual', false, now() + interval '11 milliseconds'),
    (gen_random_uuid(), '引き継ぎを記入', 'daily', null, 'first', 120, 'manual', false, now() + interval '12 milliseconds'),
    (gen_random_uuid(), '弁当の配達', 'daily', null, 'second', 10, 'manual', false, now() + interval '13 milliseconds'),
    (gen_random_uuid(), 'コーヒーの補充', 'daily', null, 'second', 20, 'manual', false, now() + interval '14 milliseconds'),
    (gen_random_uuid(), 'バナナの準備', 'daily', null, 'second', 30, 'manual', false, now() + interval '15 milliseconds'),
    (gen_random_uuid(), '火の元の確認', 'daily', null, 'second', 40, 'manual', false, now() + interval '16 milliseconds'),
    (gen_random_uuid(), 'ゴミ出し', 'daily', null, 'second', 50, 'manual', false, now() + interval '17 milliseconds'),
    (gen_random_uuid(), '遅着がある場合はチェックイン記入用紙とウェルカムドリンクを受付に設置', 'daily', null, 'second', 60, 'manual', false, now() + interval '18 milliseconds'),
    (gen_random_uuid(), '引き継ぎを投稿', 'daily', null, 'second', 70, 'manual', false, now() + interval '19 milliseconds');
end
$$;

-- ===== R13: cash_expense =====
--
-- `date` は **暦日**（'YYYY-MM-DD'）であって、この宿の他テーブルが使う
-- 「シフト日（04:00→04:00）」ではない。レシートの日付と帳簿を一致させるため。
-- 10/1 の 01:00 に買ったものを 9/30 に計上してしまうと、月次の突合が狂う。
--
-- `amount_yen` の負数 = 返品・返金（入金も同じ軸で表せるので v1 はこれで足りる）。
-- 0 は意味を持たないので CHECK で弾く。
--
-- 信頼モデル: 誰が記録したか（created_by）は **クライアントの currentStaff**
-- で決まる。共有 iPad の auth はデバイス用アカウントなので RLS で
-- `created_by = auth.uid()` は強制できない（shift_unavailable / 0025 と同じ）。
-- select / insert / update は org member（打ち間違いを本人以外も直せる）、
-- delete だけオーナー。GRANT はテーブル単位（0018 と同型）。

create table if not exists public.cash_expense (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  item text not null,
  amount_yen integer not null check (amount_yen <> 0),
  paid_from text not null check (paid_from in ('house', 'personal')),
  created_by uuid references public.staff (id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cash_expense_date_idx on public.cash_expense (date);

alter table public.cash_expense enable row level security;

revoke all on table public.cash_expense from anon;
grant select, insert, update, delete on table public.cash_expense to authenticated;

drop policy if exists cash_expense_select on public.cash_expense;
create policy cash_expense_select on public.cash_expense
  for select to authenticated using (public.is_org_member());
drop policy if exists cash_expense_insert on public.cash_expense;
create policy cash_expense_insert on public.cash_expense
  for insert to authenticated with check (public.is_org_member());
drop policy if exists cash_expense_update on public.cash_expense;
create policy cash_expense_update on public.cash_expense
  for update to authenticated using (public.is_org_member()) with check (public.is_org_member());
drop policy if exists cash_expense_delete on public.cash_expense;
create policy cash_expense_delete on public.cash_expense
  for delete to authenticated using (public.is_owner());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and tablename = 'cash_expense'
  ) then
    alter publication powersync add table public.cash_expense;
  end if;
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.cash_expense to powersync_role;
  end if;
end
$$;
