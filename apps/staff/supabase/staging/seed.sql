-- KRAFT BASE 検証(ステージング)環境の架空データ。
-- schema.sql を流したあと、新規Supabaseプロジェクトで1回実行する。
-- 全て架空。実在の顧客情報は含めないこと（このファイルにも入れない）。
-- 日付は実行時点の日本時間を基準に「本日・翌日・過去」を自動計算する。

-- スタッフ ----------------------------------------------------------------
insert into public.staff (id, name, role, accent, auth_user_id, is_device) values
  ('11111111-0000-0000-0000-000000000001', 'テスト・オーナー', 'owner', '#9a7416', null, false),
  ('11111111-0000-0000-0000-000000000002', '田中（テスト）', 'staff', '#e08a2e', null, false),
  ('11111111-0000-0000-0000-000000000003', '鈴木（テスト）', 'staff', '#0f3d36', null, false),
  ('11111111-0000-0000-0000-000000000004', '佐藤（テスト）', 'staff', '#8b6914', null, false),
  ('11111111-0000-0000-0000-0000000000d1', '受付端末', 'staff', null, null, true)
on conflict (id) do nothing;

-- 端末（共有・受付iPad） --------------------------------------------------
insert into public.device (id, mode, bound_staff_id, label, auto_lock_min) values
  ('11111111-0000-0000-0000-0000000000e1', 'shared', null, '受付iPad（検証）', 5)
on conflict (id) do nothing;

-- 当日リセット基準 --------------------------------------------------------
insert into public.daily_reset (id, last_reset_date) values
  ('11111111-0000-0000-0000-0000000000a1',
   to_char((now() at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD'))
on conflict (id) do nothing;

-- ゲスト（本日・翌日・先・過去、各ステータス） ----------------------------
insert into public.guest
  (id, stay_date, name, country, language, party_size, checkin_time, bed, bento, status, review_sent_at, whole_house, created_by)
values
  ('22222222-0000-0000-0000-000000000001',
   to_char((now() at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
   '山田 太郎（テスト）', '日本', 'ja', 2, '15:00', '1番・2番', 'おむすび弁当 ×2', 'arrived', null, false,
   '11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000002',
   to_char((now() at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
   'John Smith (TEST)', 'アメリカ', 'en', 1, '18:30', '3番', '焼肉弁当 ×1', 'expected', null, false,
   '11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000003',
   to_char(((now() at time zone 'Asia/Tokyo')::date + 1), 'YYYY-MM-DD'),
   'Anna Weber (TEST)', 'ドイツ', 'de', 2, '16:00', '4番・5番', 'ベジタリアン弁当 ×2', 'expected', null, true,
   '11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000004',
   to_char(((now() at time zone 'Asia/Tokyo')::date + 3), 'YYYY-MM-DD'),
   'Marco Rossi (TEST)', 'イタリア', 'it', 1, '17:00', '6番', null, 'cancelled', null, false,
   '11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000005',
   to_char(((now() at time zone 'Asia/Tokyo')::date - 2), 'YYYY-MM-DD'),
   'Lukas Müller (TEST)', 'ドイツ', 'de', 1, '19:00', '1番', null, 'arrived', null, false,
   '11111111-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- チェックイン記録（架空のPII。パスポート/住所はダミー） ------------------
insert into public.checkin_record
  (id, guest_id, name, address, contact, nationality, passport_number)
values
  ('33333333-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000002',
   'John Smith', 'TEST 1-2-3, Test City, USA', 'test@example.com', 'United States', 'TEST123456')
on conflict (id) do nothing;

-- 申し送り（引き継ぎ画面用） ----------------------------------------------
insert into public.followup (id, body, guest_id, status, requires_owner, created_by) values
  ('44444444-0000-0000-0000-000000000001',
   '【検証】John Smith様 18:30到着予定。パスポート確認済み。', '22222222-0000-0000-0000-000000000002',
   'open', false, '11111111-0000-0000-0000-000000000002')
on conflict (id) do nothing;

-- ゲストへのメモ／メンション（あなた宛て画面用） --------------------------
insert into public.guest_note (id, guest_id, author_id, body, pinned, mentions, read_by) values
  ('55555555-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002',
   '【検証】山田様、川遊び希望。タオル貸出済み。', true, '{}', '{}'),
  ('55555555-0000-0000-0000-000000000002',
   '22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
   '【検証】鈴木さん確認お願いします。', false,
   '{11111111-0000-0000-0000-000000000003}', '{}')
on conflict (id) do nothing;

-- タイムライン ------------------------------------------------------------
insert into public.timeline_entry (id, author_id, kind, body) values
  ('66666666-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'action', '【検証】山田様チェックイン'),
  ('66666666-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'system', '【検証】本日のゲストを確定')
on conflict (id) do nothing;

-- タスク（本日コックピット／タスク画面用） --------------------------------
insert into public.task (id, title, "group", phase, source, owner_id, done) values
  ('77777777-0000-0000-0000-000000000001', '【検証】受付の準備（鍵・弁当確認）', 'daily', 'midday_prep', 'manual', null, false),
  ('77777777-0000-0000-0000-000000000002', '【検証】共用部の清掃', 'daily', 'cleaning', 'manual', null, false),
  ('77777777-0000-0000-0000-000000000003', '【検証】火の元・戸締まり確認', 'daily', 'evening_close', 'manual', null, false),
  ('77777777-0000-0000-0000-000000000004', '【検証】翌朝のバナナ・コーヒー補充', 'daily', 'morning_prep', 'manual', null, false),
  ('77777777-0000-0000-0000-000000000005', '【検証】電球を1つ交換する', 'oneoff', null, 'adhoc', null, false)
on conflict (id) do nothing;

-- 商品（館内販売） --------------------------------------------------------
insert into public.product (id, name, sell_price, cost, sort) values
  ('88888888-0000-0000-0000-000000000001', '【検証】地ビール', 700, 400, 0),
  ('88888888-0000-0000-0000-000000000002', '【検証】Tシャツ', 2500, 1200, 1),
  ('88888888-0000-0000-0000-000000000003', '【検証】カップ麺', 300, 150, 2)
on conflict (id) do nothing;

-- 辞書（マニュアル画面の最小サンプル。kind は許可値 manual を使用） --------
insert into public.content (id, kind, slug, title, body, phase, lang, status, updated_by) values
  ('99999999-0000-0000-0000-000000000001', 'manual', 'test-wifi', 'Wi-Fiの使い方（検証）',
   'SSID: KRAFT-TEST / パスワード: test1234', null, null, 'ready',
   '11111111-0000-0000-0000-000000000001'),
  ('99999999-0000-0000-0000-000000000002', 'manual', 'test-bath', 'お風呂の時間（検証）',
   '16:00〜23:00。要確認の項目です。', null, null, 'needs_input',
   '11111111-0000-0000-0000-000000000001')
on conflict (id) do nothing;
