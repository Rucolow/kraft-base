# Supabase (staff)

`migrations/` と `seed.sql` を手動で適用する。Supabase プロジェクト設定は
**Data API: ON / 新規テーブル自動公開: OFF / 自動RLS: ON** を前提とする。

## 適用方法

### A. Supabase CLI

```bash
supabase db push        # migrations/ を番号順に適用
psql "$DATABASE_URL" -f apps/staff/supabase/seed.sql
```

### B. SQL Editor（ダッシュボード）

`migrations/` を番号順（`0001` → `0005`）に貼り付けて実行し、最後に `seed.sql` を実行する。

> `0001` の `pg_cron` と `0005` の論理レプリケーション（`wal_level = logical`、
> PowerSync 用ロール作成）はプロジェクト側の設定が必要。PowerSync のセットアップ手順に従う。

## ブートストラップ（各自のアカウント紐づけ）

`staff` 行は `auth_user_id = null` で投入される。各自が初回の magic link でログインした後、
SQL Editor（service role）で自分の `auth.users.id` を該当 `staff` に紐づける。

```sql
-- ログイン済みユーザーの id を確認
select id, email from auth.users order by created_at;

-- owner（ルッコロー）の例
update public.staff
   set auth_user_id = '<auth.users.id>'
 where name = 'ルッコロー';

-- staff（モーリー）の例
update public.staff
   set auth_user_id = '<auth.users.id>'
 where name = 'モーリー';
```

共有iPad は `staff` ロールの受付アカウントで magic link 認証し、`device`（`mode = shared`）に
対応する。日中スタッフの個人識別は `shift_session` の選択（アプリ層）で行うため、共有端末では
個別の `auth_user_id` 紐づけは不要。
