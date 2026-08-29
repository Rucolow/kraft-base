-- 名簿から旧行を隠す（welcome@ 事件のフォローアップ）。
-- スタッフ一覧には歴史的な重複行（例: 旧「モーリー」staff行 — 現行は
-- 「モーリー（オーナー）」）が残っており、①シフト開始の名前選択で押し間違えると
-- 勤怠が別人格に記録される ②アカウント紐づけ(LinkAccount)で誤って旧行を
-- claim できてしまう。行の削除は過去の shift_session / guest.created_by が
-- 参照しているため不可（履歴が壊れる）。hidden で前向きの選択肢からだけ外す。
-- 勤怠集計（WorkTime）は履歴の完全性のため hidden を無視して全行を見る。

alter table public.staff
  add column if not exists hidden boolean not null default false;

-- 適用後にオーナーが実行する整理（行の中身を確認してから）:
--   update public.staff set hidden = true
--     where name = 'モーリー' and auth_user_id is null and is_device = false;
