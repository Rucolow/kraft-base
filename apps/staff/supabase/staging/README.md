# 検証（ステージング）環境のセットアップ

> **⚠️ 方針（2026-07 決定）: 常設のステージング環境は作らない。**
> 別Supabase＋PowerSync＋Vercelを常時維持するのは3人の宿には割に合わず、実際に未着工の
> まま陳腐化した。通常の検証は `docs/plan-verification-system.md` の5層モデル（L1ユニット /
> L2デモe2e / L3本番観測 / L4オーナー実機 / L5使い捨て）で回す。
> **この手順書は L5（大規模変更の事前リハーサル）で使い捨て環境を立てるときのレシピ**として
> 残している。作ったら検証後に**プロジェクトごと削除**すること。

本番と**同じコード**を、**架空データの別データ面**で動かす環境。実在の顧客情報には一切触れない。

```
本番:  コード(同じ) → 本番Supabase    → 本番PowerSync    → kraft-base-staff（実顧客）
検証:  コード(同じ) → 検証Supabase    → 検証PowerSync    → 別URL（架空・AI可）
```

コードは共通。違うのは **env（接続先）** だけ。

## 1. 検証用 Supabase プロジェクトを作成
- 新規プロジェクト（例: `kraft-base-staging`）。本番とは別物。
- SQL Editor で **`schema.sql` を実行**（本番マイグレーション 0001〜0014 の結合・全14テーブル＋publication）。
- 続けて **`seed.sql` を実行**（架空のスタッフ・ゲスト・チェックイン記録・タスク・商品・辞書）。
- Project Settings → API から **Project URL** と **anon key** を控える。

## 2. 検証用 PowerSync インスタンスを作成
- 新規インスタンス。Connection は 1 の検証 Supabase を指定。
- **Sync Rules**: 本番と同じ `bucket_definitions: global`（全テーブル `SELECT * FROM ...`）。
- **Client Auth**: 「Use Supabase Auth」＋ JWKS URI
  `https://<検証プロジェクトref>.supabase.co/auth/v1/.well-known/jwks.json`、
  **JWT Audience に `authenticated` を追加**（本番で詰まった点と同じ）。
- インスタンスの **PowerSync URL** を控える。

## 3. 検証用 Vercel プロジェクトを作成
- 同じリポジトリを指す新規プロジェクト（例: `kraft-base-staff-staging`）。Root Directory = `apps/staff`。
- Environment Variables（**検証の値**）:
  - `VITE_SUPABASE_URL` = 検証 Supabase の URL
  - `VITE_SUPABASE_ANON_KEY` = 検証 anon key
  - `VITE_POWERSYNC_URL` = 検証 PowerSync URL
- ドメイン例: `staff-staging.kraft-base.com`（任意。vercel.app のままでも可）。
- 検証 Supabase の Authentication → URL Configuration に、この検証ドメインを Site URL / Redirect URLs として追加。

## 4. ログインして利用
- 検証アプリを開き、任意のメールでログイン（検証 Supabase の Auth）。
- `/link` で名前を選んで紐づけ（または SQL で staff.auth_user_id を設定）。
- これ以降、AI/ブラウザ検証はこの環境に対してのみ行う。**本番（実顧客データ）はエージェント対象外**にする。

## 再作成・リセット
- データを初期化したい時は、検証 Supabase で `seed.sql` の対象行を消して再実行、または対象テーブルを truncate して `seed.sql` を流し直す。
- スキーマを本番に合わせ直す時は、本番に新しいマイグレーションを足したのと同じSQLを検証にも当てる（または `schema.sql` を再生成）。

> `schema.sql` は `migrations/0001〜0014` を結合した自動生成物。マイグレーションを増やしたら結合し直すこと。
