# 実装計画: お弁当注文システム（koguchi-bento）連携 v1

ステータス: **計画（未実装・実装前に敵対レビュー1周を推奨）**。
相手システム: `Rucolow/koguchi-bento`（Next.js/Vercel、DB=Neon Postgres/Prisma、Stripe決済、
本番 koguchi.nikuda.jp）。構成資料は 2026-07-22 に相手セッションから取得済み（本文末尾に要点）。

## 0. 目的

弁当注文が入ったら**自動でスタッフツールに反映**され、「誰がどの弁当か」の手動照合を無くす。

## 1. アーキテクチャ決定

### 決定: 「koguchi 側から KRAFT BASE の Supabase へ直接ミラー書き込み（push＋自己修復cron）」

```
koguchi-bento (Next.js/Vercel, Neon)
  ├─ 注文イベント発生時（作成/決済確定/キャンセル/返金/日付変更/配送完了）
  │    └→ コミット後に KRAFT BASE Supabase REST へ upsert（ベストエフォート）
  └─ Vercel Cron（15分毎）
       └→ 「直近更新分」を一括 upsert（取りこぼし自己修復・正はこちら）
                    ↓
KRAFT BASE Supabase: bento_order ミラーテーブル
                    ↓ PowerSync（既存の同期基盤）
全スタッフ端末に自動反映（オフラインでも閲覧可）
```

**理由**:
- KRAFT BASE 側は「Postgres に入りさえすれば全端末に配る」基盤が既にある。連携の仕事は
  「koguchi → うちの Postgres」の一区間だけ。
- **サーバーコードを持つのは koguchi だけ**（Next.js API＋Vercel Cron が既にある）。
  KRAFT BASE 側に Edge Function 等の新インフラを増やさない＝オーナーの運用負担は
  いつも通り「SQL 1本＋PowerSync sync rules 1行」で済む。
- koguchi 側の推奨（Webhookはリトライ無し→プル併用）を、「push＝即時反映のきっかけ、
  cron＝正・自己修復」として koguchi 内で完結させる。受け口 API を新設しないので
  認証面も Supabase 標準（service key）に乗るだけ。

**採らなかった案**:
- Supabase Edge Function 受け口: KRAFT BASE 側に新しいデプロイ面（CLI/管理）が増える。利点薄。
- 予約番号の共通キー導入（koguchi 案(c)）: 客の入力負担が増える。規模（1日≦70食・
  KRAFT BASE 分はその一部）なら「自動照合＋1タップ手動照合」で足りる。不一致率が
  高ければ将来導入を再検討。
- guest.bento への自動書き込み: 表記ゆれ誤爆でスタッフの手入力を壊すリスク。**ミラー表示
  ＋紐づけ**に留め、既存の手入力欄はそのまま残す（併記）。

## 2. スコープ

- 対象: **deliveryPoint が KRAFTBASE の注文のみ**（他宿 INN 分はスタッフツールに出さない。
  🔶要確認1）。個人注文（GUEST）とスタッフ手打ち注文の両方。
- KRAFT BASE 側は**閲覧＋宿泊者との紐づけのみ**（注文の作成・変更は従来どおり koguchi 管理画面）。

## 3. KRAFT BASE 側: migration 0019 `bento_order`（ミラー）

```sql
create table if not exists public.bento_order (
  id text primary key,               -- koguchi Order.id (cuid) をそのまま
  status text not null,              -- PENDING/PAID/EXPIRED/CONFIRMED/INVOICED/CANCELLED/REFUNDED
  channel text,                      -- GUEST / INN（v1はGUEST系のみ想定）
  delivery_date text not null,       -- 'YYYY-MM-DD'（暦日。配送は一律17-18時なので日付のみ）
  customer_name text,
  customer_email text,
  customer_phone text,
  items_label text,                  -- 表示用 "焼肉弁当 ×2・おむすび弁当 ×1"
  items_json text,                   -- [{"name":"焼肉弁当","qty":2,"unitPriceYen":...}]
  total_yen integer,
  note text,                         -- アレルギー・減塩等 — スタッフが見るべき情報
  payment_method text,               -- 手打ちタグ ONSITE/CASH/BANK/OTHER（オンラインはnull）
  fulfilled_at timestamptz,
  source_updated_at timestamptz,     -- koguchi の updatedAt（新旧判定・自己修復用）
  synced_at timestamptz not null default now(),
  guest_id uuid references public.guest (id) on delete set null,  -- 照合結果
  match text not null default 'none' -- none/auto/manual/excluded
);
create index if not exists bento_order_date_idx on public.bento_order (delivery_date);
```

- RLS: SELECT = org member。**UPDATE = org member・ただし列grantを `guest_id, match` のみに
  制限**（0006 task の実績パターン。照合以外は書けない）。INSERT/DELETE は authenticated に
  出さない（書き込みは koguchi が service key で行い RLS を通らない）。
- publication 追加＋ `grant select to powersync_role`（0010/0018 テンプレ）。
- `sync-rules.yaml`＋クライアント `schema.ts`＋`staging/schema.sql`＋principles §4 表を追随。
- **古い注文の同期窓**: v1 は全量（軽い）。肥大したら sync rules で
  `WHERE delivery_date >= <直近90日>` に絞る（サーバーに正は残る）。

## 4. 照合（マッチング）設計

- **自動照合**（アプリ内・冪等）: `delivery_date == guest.stay_date` かつ
  正規化名の完全一致（小文字化・空白/記号除去）で、**候補が1人に定まる場合のみ**
  `guest_id`＋`match='auto'` を書く。曖昧（同名2人等）なら触らない。
  実装は RootBootstrap の日次処理と同様にクライアント側で実行（org member の UPDATE 権限内）。
- **手動照合**: 未照合注文をゲスト一覧（今日/カレンダー日別）の上部に
  「未照合の弁当注文 N件」として表示 → タップでその日の宿泊者ピッカー＋「対象外」。
  1タップで `guest_id`＋`match='manual'`（または `excluded`）。
- **照合の保護**: koguchi からの upsert は `guest_id`/`match` を**絶対に含めない**
  （PostgREST upsert はペイロードに含む列だけ更新するため、含めなければ照合が保持される）。

## 5. UI（KRAFT BASE 側）

1. **GuestCard / ゲスト詳細**: 紐づいた注文があれば「🍱 注文: 焼肉×2（決済済み）」チップを表示。
   `note`（アレルギー等）があれば詳細に表示。既存の手入力「弁当」欄はそのまま併記
   （出どころが分かるようラベル分け。🔶要確認2）。
- 2. **日別ビュー（今日タブ・カレンダー日別リスト）**: その日の弁当合計
   「弁当注文 計N食（焼肉x・ベジy・おむすびz）」＋未照合があれば警告行。
3. **ステータス表示規則**:
   - PAID / CONFIRMED / INVOICED → 有効注文として表示（CONFIRMED は「現地決済」等の
     paymentMethod タグを併記 — モーリーの当初要望④に対応）
   - PENDING → 「決済待ち」として小さく表示（氏名が空のことがある）
   - CANCELLED / REFUNDED → 紐づけ済みなら打ち消し線で表示（作り間違い防止）、未紐づけなら非表示
   - EXPIRED → 非表示

## 6. koguchi 側への実装依頼（連携契約）— 相手セッションに渡す仕様

```
【KRAFT BASE 連携仕様 v1】
■ 書き込み先: KRAFT BASE の Supabase（PostgREST）
  POST {KB_SUPABASE_URL}/rest/v1/bento_order
  Headers:
    apikey / Authorization: Bearer {KB_SUPABASE_SERVICE_KEY}  ← Vercel環境変数(サーバー専用)
    Prefer: resolution=merge-duplicates
  Body: 注文の配列（upsert・主キー id）

■ ペイロード（1注文）— guest_id / match は絶対に含めないこと:
  {
    "id": Order.id,
    "status": Order.status,
    "channel": Order.channel,
    "delivery_date": deliveryDate を JST 'YYYY-MM-DD' 文字列で,
    "customer_name": customerName,
    "customer_email": customerEmail,
    "customer_phone": customerPhone,
    "items_label": 例 "焼肉弁当 ×2・おむすび弁当 ×1"（商品名は日本語表示名）,
    "items_json": OrderItem[] を [{"name","qty","unitPriceYen"}] でJSON文字列化,
    "total_yen": totalYen,
    "note": note,
    "payment_method": paymentMethod,
    "fulfilled_at": fulfilledAt (ISO/null),
    "source_updated_at": updatedAt (ISO)
  }

■ 送信対象: deliveryPoint.type == KRAFTBASE の注文のみ（INNは送らない）

■ 送信タイミング（両方）:
  A. イベント時 push（既存のSlack通知と同パターン・コミット後ベストエフォート）:
     作成 / PAID確定 / EXPIRED / CANCELLED / REFUNDED(部分含む) /
     deliveryDate変更 / fulfilledAt記録 / note編集 / INVOICED
  B. Vercel Cron（15分毎・自己修復の正）:
     updatedAt >= now()-2h の KRAFTBASE 注文を全件 upsert
     ＋1日1回 delivery_date >= today-7 の全件を洗い替え（日付変更の取り残し対策）

■ ステージング: まず koguchi ステージング → KRAFT BASE 用に用意する
  検証プロジェクト（または本番に流す前の目視確認）で通しテスト
```

## 7. フェーズと受け入れ基準

| フェーズ | 内容 | 検証 |
|---|---|---|
| P1 (KB) | 0019＋sync rules＋schema.ts＋UI（表示・照合）＋自動照合 | demo seed に bento_order を数件入れ e2e: チップ表示/未照合リスト/1タップ照合/打ち消し表示。CI緑 |
| **P1.5 (配管証明)** | オーナーが 0019 SQL＋sync rules 適用後、**SQLで手書きテスト注文1行を INSERT** | スタッフ端末に表示されたら KB側配管は証明完了。**ここまで koguchi には一切触れない**＝問題が出ても切り分け済み |
| P2 (koguchi) | 上記契約の実装（push＋cron） | koguchi側セッションが実装・単体確認 |
| P3 (通し) | koguchi に環境変数設定 → デプロイ | **テスト注文1件** → 数秒でスタッフ端末に出る → 照合 → キャンセル → 打ち消し表示（L3観測・拒否バッジ無し） |

**安全性の根拠（純追加設計）**: bento_order は新テーブルで既存機能に触れない（失敗モードは
「注文が出ない」だけ）。koguchi 側の送信はコミット後ベストエフォートで、**注文・決済業務は
送信失敗でも無傷**（15分cronが後から自己修復）。撤退は sync rules 1行削除で完了。
Neon の設定変更はゼロ（アプリコードに送信処理を足すだけ）。PowerSync のテーブル追加は
0018 で実証済みの同型手順。

デプロイ順序: KB側SQL/sync rules → KBアプリ → koguchi（逆だと upsert が 404/権限エラー）。

## 8. リスクと対応

- **service key の共有**: koguchi（同一オーナーの別アプリ）の Vercel サーバー環境変数に
  KRAFT BASE の service key を置く＝DB全権。同一経営の2システム間なので v1 は許容し、
  硬化オプション（bento_order だけ書ける専用 Postgres ロール＋直接続）を将来課題として明記。
- **氏名の表記ゆれ**: 自動照合は「完全一致・一意」のみ。残りは1タップ手動。不一致率が
  高ければ予約番号キー導入（koguchi 案(c)）を発動。
- **PENDING の氏名空**: 決済待ちは照合対象外（表示のみ）。PAID 化イベントで氏名が届いて
  から自動照合が走る。

## 9. 🔶 オーナー確認（実装前・既定値で進めて良ければ返答不要）

1. スタッフツールに出すのは **KRAFT BASE 行きの注文のみ**（他宿INN分は出さない）→ これで良い？
2. 既存の「弁当」手入力欄は**残して併記**（自動上書きしない）→ これで良い？
3. 通しテストは**本番に少額テスト注文1件**（Stripeテストか手打ち注文）で行う → OK？

## 参考: koguchi-bento 構成要点（2026-07-22 取得）

Neon Postgres（Supabaseではない）/ Prisma / Next.js App Router / Vercel / Stripe。
Order は status 一本で決済状態を表現（PAID=決済済, CONFIRMED=宿月締め or 手打ち,
paymentMethod タグで手打ち判別）。配送は毎日17-18時固定で deliveryDate のみ。
締切は3日前23:59（手打ちはバイパス可）。Webhook はリトライ無し→プル併用推奨、が先方見解。
