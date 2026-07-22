# 実装計画: お弁当注文システム（koguchi-bento）連携 v2

ステータス: **計画確定待ち（敵対レビュー3レンズ反映済み。koguchi への追加質問7件と
オーナー確認5件の回答後に実装開始）**。
相手システム: `Rucolow/koguchi-bento`（Next.js/Vercel、DB=Neon Postgres/Prisma、Stripe、
本番 koguchi.nikuda.jp）。v1→v2 の変更根拠は §10 レビュー記録。

## 0. 目的と前提

弁当注文が入ったら**自動でスタッフツールに反映**され、手動照合を無くす。

**成立の前提（運用合意・🔶確認1）**: 電話・直前の注文も**必ず koguchi の管理画面手打ちに
入れる**運用にすること。スタッフツール側の集計・検品の「正」を bento_order に一本化する
ため、koguchi に入らない注文（裏手配）が残ると連携後も食数が合わず、混乱がむしろ増える。

## 1. アーキテクチャ（骨格はv1のまま・防御をDB強制に格上げ）

```
koguchi-bento（イベント時push＋15分毎cron[ウォーターマーク方式]で自己修復）
  → KRAFT BASE Supabase の bento_order ミラー（専用ロール bento_writer で書く）
  → PowerSync（既存基盤）→ 全スタッフ端末
```

- KRAFT BASE 側に新インフラなし（SQL＋sync rules 1行のいつもの手順のみ）。
- 純追加設計: 失敗モードは「注文が表示されない」だけ。既存機能・弁当業務は無傷。
- **v2の要点: 「koguchi が行儀よく書く」前提を捨て、DB側で強制する**（§3 トリガー・専用ロール）。

## 2. スコープ

- 対象: **KRAFT BASE 行きの注文のみ**（他宿INN分は送らない・出さない。🔶確認2）。
- KB側は**閲覧＋手動照合のみ**。**自動照合は v1 に含めない**（根拠: 実名データは
  『Lukas & Anna Weber』型の連名転記 vs Stripe本人入力で完全一致が構造的に成立せず、
  1日数件なら手動1タップで足りる。誤爆＝弁当の渡し間違いのリスクに見合わない。
  customer_name が溜まってヒット率を実測できたら v2 で再検討）。

## 3. KRAFT BASE 側: migration 0019（v2版）

```sql
-- 弁当注文ミラー。書き込みは koguchi（専用ロール bento_writer）のみ。
-- スタッフは閲覧と照合（guest_id/match）のみ。0002規約: 日付はtext、enumはtext。
create table if not exists public.bento_order (
  id text primary key,               -- koguchi Order.id (cuid)
  status text not null,              -- 外部由来のため意図的にcheckなし（将来値の受け入れ）
  channel text,
  delivery_date text not null,       -- 'YYYY-MM-DD'（JST暦日）
  customer_name text,                -- 照合と表示に使用。メール/電話は同期しない（PII最小化）
  items_label text,                  -- 表示用スナップショット "焼肉弁当 ×2"
  items_json text,                   -- [{"productId","name","qty","unitPriceYen"}] 集計はproductIdで
  total_yen integer,
  refunded_yen integer not null default 0,  -- 締切後の部分返金を可視化
  note text,
  payment_method text,               -- 手打ちタグ ONSITE/CASH/BANK/OTHER
  fulfilled_at timestamptz,
  source_updated_at timestamptz,     -- koguchi updatedAt（新旧判定に実使用・下記トリガー）
  synced_at timestamptz not null default now(),  -- トリガーで更新時も進める
  guest_id uuid references public.guest (id) on delete set null,
  match text not null default 'none' check (match in ('none','manual','excluded'))
);
create index if not exists bento_order_date_idx on public.bento_order (delivery_date);

-- 専用書き込みロール（service key は渡さない）。漏洩時の被害を本表1つに限定し、
-- 照合列(guest_id/match)は権限レベルで書けなくする。
create role bento_writer nologin;
grant bento_writer to authenticator;
grant usage on schema public to bento_writer;
grant select on public.bento_order to bento_writer;
grant insert (id, status, channel, delivery_date, customer_name, items_label,
              items_json, total_yen, refunded_yen, note, payment_method,
              fulfilled_at, source_updated_at)
  on public.bento_order to bento_writer;
grant update (status, channel, delivery_date, customer_name, items_label,
              items_json, total_yen, refunded_yen, note, payment_method,
              fulfilled_at, source_updated_at)
  on public.bento_order to bento_writer;

-- 多重防御トリガー:
--  (1) 古い書き込みの追い越し防止（source_updated_at が後退する UPDATE はスキップ）
--  (2) 書き込みロールからの照合列変更を無効化（grantで書けないが、将来の権限変更ミスにも耐える）
--  (3) synced_at を更新時にも進める
create or replace function public.bento_order_guard()
returns trigger language plpgsql as $$
begin
  if new.source_updated_at is not null and old.source_updated_at is not null
     and new.source_updated_at < old.source_updated_at then
    return null; -- stale write: skip
  end if;
  if current_user = 'bento_writer' then
    new.guest_id := old.guest_id;
    new.match := old.match;
  end if;
  new.synced_at := now();
  return new;
end $$;
drop trigger if exists bento_order_guard on public.bento_order;
create trigger bento_order_guard before update on public.bento_order
  for each row execute function public.bento_order_guard();

alter table public.bento_order enable row level security;
revoke all on table public.bento_order from anon;
-- スタッフ: 閲覧＋照合列のみ更新（0006の列grantパターン）
grant select on public.bento_order to authenticated;
grant update (guest_id, match) on public.bento_order to authenticated;
create policy bento_order_select on public.bento_order
  for select to authenticated using (public.is_org_member());
create policy bento_order_update on public.bento_order
  for update to authenticated
  using (public.is_org_member()) with check (public.is_org_member());

-- publication + powersync_role（0010/0018テンプレ）
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'powersync' and tablename = 'bento_order') then
    alter publication powersync add table public.bento_order;
  end if;
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.bento_order to powersync_role;
  end if;
end $$;
```

- 認証: プロジェクトの JWT secret で `role: "bento_writer"` の長期 JWT を1つ発行し
  koguchi のサーバー環境変数へ（発行手順は P2 で私がコマンドを用意）。
- `sync-rules.yaml` に `- SELECT * FROM bento_order`、client `schema.ts`（全列 text/integer）、
  `staging/schema.sql`、principles §4 表を追随。serialize 対象列なし（bool/配列なし）。
- 同期は v1 全量（KB行き注文は小規模。将来肥大したら窓掛けを検討）。

## 4. 照合（v2: 手動のみ）

- **未照合の定義**: `guest_id IS NULL AND match <> 'excluded'`（match列だけに依存しない —
  ゲスト行削除で guest_id が null に戻っても正しく未照合に浮上する）。
- **手動照合UI**: 未照合注文をタップ → **配送日±2日の宿泊者ピッカー**＋「対象外」。
  ±2日は連泊対策（guest は1行=1泊で、連泊2日目の行が無いことがある。その場合は
  初日の行に紐づける）。1タップで `guest_id`＋`match='manual'` / `excluded`。
- **照合の保護（三重）**: ①契約で guest_id/match をペイロードに含めない
  ②`?columns=` で列を明示（含まない列は無視、と公式保証のある唯一の手段）
  ③DBトリガー＋列grantで bento_writer からは書き込み不能。
- 受け入れ基準（P1.5）: **照合済み行に koguchi 相当の upsert を当てても照合が残る**こと。

## 5. UI（v2: 出す場所と量を絞る）

弁当は**17時の業務**（17:00引き継ぎ→17-18時配達受取→引き渡し）。表示は現場動線に一本化:

1. **Guests「今日」タブ上部に1行**: 「🍱 弁当注文 計N食（未照合M件）」— タップで展開:
   その日の注文一覧（品目・数・現地決済等のタグ・note・照合状態）。
   **Homeコックピットには出さない**（午前帯のノイズ化防止）。
   引き継ぎテンプレの「■ 弁当:◯個(注文者)」がこの1画面から転記できることを受け入れ基準とする。
2. **GuestCard / 詳細**: 紐づいた注文チップ「🍱 焼肉×2（現地決済）」＋note表示。
3. **カレンダー日別**: その日の注文合計1行（先の日の見通し用）。
4. **表示規則**:
   - 表示対象: PAID / CONFIRMED / INVOICED（CONFIRMEDは paymentMethod タグ併記）
   - **PENDING は同期するが非表示**（氏名空・行動不能情報。PAID化で現れる）。
     保険: `source_updated_at` が45分超過の PENDING は EXPIRED 推定として扱う
     （EXPIREDイベント喪失・lazy判定対策）
   - CANCELLED/REFUNDED: 照合済みなら打ち消し線表示（作り間違い防止）、未照合なら非表示
   - `refunded_yen > 0 かつ PAID`: 「一部返金あり」バッジ
   - INN由来の行が万一届いても照合対象外・未照合警告に数えない
5. **guest.bento 手入力欄の出口**（二重管理の終わり）:
   - **食数・検品の正は bento_order に一本化**。guest.bento は「注文以外のメモ」
     （『なし（カップ麺案内）』等）専用に役割を縮小。
   - 移行終了基準: 全注文が koguchi 経由で入る運用が**2週間**回ったら、GuestEdit の
     弁当カウンターを撤去して自由テキストメモ欄に置換（別PR）。
   - 移行期に両者が食い違う場合は手入力側をグレー表示。

## 6. koguchi 側への実装依頼（契約 v2）— 相手セッションにこのまま渡す

```
【KRAFT BASE 連携仕様 v2】

■ 書き込み先（upsert・主キーid）:
  POST {KB_SUPABASE_URL}/rest/v1/bento_order?columns=id,status,channel,delivery_date,customer_name,items_label,items_json,total_yen,refunded_yen,note,payment_method,fulfilled_at,source_updated_at
  Headers:
    apikey: {KB_BENTO_WRITER_JWT}
    Authorization: Bearer {KB_BENTO_WRITER_JWT}   ← 専用ロールJWT（こちらで発行して渡す。service keyではない）
    Prefer: resolution=merge-duplicates,return=minimal
    Content-Type: application/json
  Body: 注文オブジェクトの配列。
  【厳守】guest_id / match は絶対に含めない（KB側の照合結果。含めてもDB側で無効化されるが送らないこと）
  【厳守】全オブジェクトが同一のキー集合を持つこと。値が無いフィールドは省略せず JSON null で送る
        （PostgRESTのbulk upsertはキー不一致でバッチ全体が400になる）
  【厳守】1リクエスト最大200行でチャンク分割。非2xxは必ずログ（既存のSlackエラー通知経路推奨）

■ ペイロード（1注文）— 常に「送信時点のDB現在値」を全列送る（イベント差分ではない）:
  {
    "id": Order.id,
    "status": Order.status,
    "channel": Order.channel,
    "delivery_date": ★下記の生成規則を厳守,
    "customer_name": customerName,          // null可
    "items_label": 例 "焼肉弁当 ×2・おむすび弁当 ×1",
    "items_json": JSON.stringify(items.map(i => ({productId, name, qty, unitPriceYen}))),
                                            // productId必須（KB側の集計キー）
    "total_yen": totalYen,
    "refunded_yen": refundedYen,            // 締切後の部分返金の可視化に必須
    "note": note,
    "payment_method": paymentMethod,
    "fulfilled_at": fulfilledAt?.toISOString() ?? null,
    "source_updated_at": updatedAt.toISOString()
  }

■ ★delivery_date 生成規則（1日ズレ防止・厳守）:
  Prisma @db.Date は UTC深夜のDateで返るため、
    deliveryDate.toISOString().slice(0, 10)
  で取り出すこと。toLocaleDateString / date-fns format 等のTZ変換を使ってはならない。
  受け入れテスト: DBに 2026-07-25 の注文 → ペイロードが文字列 "2026-07-25" に一致すること。
  cron等の「today」判定は JST で算出すること（UTCのtodayは 00:00-09:00 JST に1日ズレる）。

■ 送信対象: KRAFT BASE 行きの注文のみ（判定方法は追加質問③④の回答で確定。
  type一致より deliveryPointId のID直指定を推奨）

■ 送信タイミング:
  A. イベント時 push（Slack通知と同パターン・コミット後ベストエフォート）:
     作成 / PAID確定 / EXPIRED / CANCELLED / REFUNDED(部分含む) / deliveryDate変更 /
     fulfilledAt記録 / note編集 / INVOICED / EXPIRED→PAID復旧
  B. Vercel Cron（15分毎・自己修復の正・★ウォーターマーク方式）:
     koguchi DB に kbSyncWatermark（最終成功時刻）を1行持つ。
     毎回 updatedAt >= (watermark - 30分) の対象注文を全件 upsert し、
     バッチ全体が 2xx のときだけ watermark を実行開始時刻へ前進。失敗時は前進させない。
     → cronが何時間止まっても復帰後の1回で全て追いつく（遅延返金・過去日付への変更も拾う）
     ＋1日1回 updatedAt >= now()-90日 の全件洗い替え（保険）
  ※固定窓(now-2h)方式は不可（窓を抜けた遅延イベントが永久欠落するため）

■ 環境分離: 本番koguchi→本番KB、ステージングkoguchi→検証用KB（または送信無効）。
  ステージングから本番ミラーへ書かないこと。

■ 物理削除: 注文行のハードデリートはしない前提（ステータス遷移で表現）。
  もし削除運用があるなら申告してほしい（追加質問⑧）
```

### koguchi セッションへの追加質問（契約確定に必要・8件）

```
① PENDING→EXPIRED は updatedAt を更新する明示的なDB書き込みか？
   それとも参照時に pendingExpiresAt で判定するだけ（lazy）か？
   lazyの場合、連携用に「EXPIRED確定時の書き込み＋push」を追加できるか？
② EXPIRED→PAID 復旧は「PAID確定」pushと同一コードパスを通るか？
③ 本番の DeliveryPoint 一覧のうち type=KRAFTBASE は何件？
   KRAFT BASE 実ポイントの id / type / billingMode は？
④ channel=INN の注文が KRAFTBASE 行きポイントに入るケースはあるか？
⑤ スタッフ手打ち注文の channel には何が入るか？
⑥ 現行3商品の productId と正式表示名は？
   特に「ベジタリアン弁当」— KRAFT BASE側の既存表記は「ヴィーガン弁当」。
   同一商品か？正しい呼称はどちらか（卵・乳の可否に関わるため要確定）
⑦ 返金以外で明細（OrderItem）だけが編集されるケースはあるか？
⑧ 注文行を物理削除する運用・管理機能はあるか？
```

## 7. フェーズ

| フェーズ | 内容 | 検証 |
|---|---|---|
| P0 | koguchi への追加質問8件の回答 → 契約凍結（オーナー確認5件は回答済み） | — |
| P1 (KB) | 0019＋sync rules＋schema.ts＋UI＋手動照合 | demo seed に bento_order 数件。e2e: 今日タブの合計行/展開/1タップ照合/対象外/打ち消し/一部返金バッジ/PENDING非表示。CI緑 |
| P1.5 (配管証明) | オーナー: 0019 SQL＋sync rules 適用 → 下記コピペSQLでテスト1行 | 端末に表示→照合→**照合済み行へupsert相当のUPDATEを当てて照合が残る**→掃除。koguchiには未接続 |
| P2 (koguchi) | 契約v2実装（push＋watermark cron）＋bento_writer JWT設定 | 相手セッションが実装。受け入れテスト（日付文字列一致等）含む |
| P3 (通し) | **koguchi管理画面から手打ち注文（ONSITE）1件**→表示→照合→キャンセル→打ち消し表示→（掃除を兼ねる） | Stripe決済不要・モーリー要望④の経路の通しテストを兼ねる。拒否バッジが出ないこと(L3) |

**P1.5 コピペ用SQL**（オーナー向け・計画の生命線なので本文に掲載）:

```sql
-- テスト注文1行（表示確認用）
insert into public.bento_order (id, status, channel, delivery_date, customer_name,
  items_label, items_json, total_yen, note, source_updated_at)
values ('test-0001', 'PAID', 'GUEST', to_char(now() at time zone 'Asia/Tokyo','YYYY-MM-DD'),
  'テスト 太郎', '焼肉弁当 ×1', '[{"productId":"test","name":"焼肉弁当","qty":1,"unitPriceYen":1000}]',
  1000, 'テスト行です', now());

-- （アプリで表示→照合を確認した後）照合保持テスト: koguchi の上書きを模擬
update public.bento_order set total_yen = 1200, source_updated_at = now()
  where id = 'test-0001';
-- → アプリで金額が1200になり、照合が残っていればOK

-- 後片付け
delete from public.bento_order where id = 'test-0001';
```

## 8. リスク表（v2）

| リスク | 対策 |
|---|---|
| 照合の消失 | 三重防御（契約・?columns・DBトリガー＋grant）＋P1.5で実証 |
| 古い書き込みの追い越し | source_updated_at トリガーでstale skip（push/cron順序競合は≦15分で自己収束） |
| 取りこぼしの恒久化 | ウォーターマークcron（固定窓禁止）＋日次90日洗い替え |
| 認証情報の漏洩 | bento_writer 専用JWT（本表のみ・照合列書き込み不能）。service keyは渡さない |
| 1日ズレ | 契約に生成規則と受け入れテストを明記 |
| 連泊（照合先の行なし） | ピッカー±2日＋初日行への紐づけ運用。根本は連泊コピー機能（improvement-plan既出・別件） |
| 二重管理の混乱 | 正=bento_order宣言＋手入力欄のメモ専用化＋2週間で撤去の出口 |
| 商品名の不一致 | productId集計＋未知IDは「その他」で合計に必ず含める。ベジ/ヴィーガンは⑥で確定 |

## 9. 🔶 オーナー確認（2026-07-22 全件回答済み）

1. 電話・直前注文も必ず koguchi 手打ちに入れる → **Yes**（正の一本化成立）
2. KRAFT BASE 行きのみ表示 → **Yes**
3. 手入力欄はメモ専用化＋2週間後カウンター撤去 → **Yes**
4. 通しテストは手打ち注文1件 → **Yes**
5. 正しい呼称は **「ベジタリアン弁当」**。→ **スタッフツール側の既存表記
   「ヴィーガン弁当」が誤りと確定**。連携と独立の表記修正タスクとして P1 に含める:
   - `GuestEdit.tsx` の BENTO_ITEMS / `devSeed.ts` / `content/products.ts` 等の
     「ヴィーガン弁当」を「ベジタリアン弁当」へ改名（grepで全箇所）
   - 既存の guest.bento 保存値に残る旧表記は自由テキストとして温存される
     （parseBento/bentoToString は非プリセット値を破壊しない実装を確認済み）ため
     データ移行は不要。表示上の混在は移行期のみ

## 10. 敵対レビュー記録（2026-07-22、3レンズ並列・コード/公式Doc裏取り）

成立22件を v2 に反映。主要なもの:
- **技術整合**: PostgREST upsert の「ペイロード列のみ更新」は公式Docに明文保証なし →
  ?columns＋DBトリガーの多重防御へ／source_updated_at の新旧防御が宣言のみ→トリガー実装／
  bulk upsert の同一キー要件／synced_at が更新で進まない／guest削除時の match 残留→
  未照合定義を guest_id IS NULL に／自動照合の端末間レプリカ差による誤爆
- **連携契約**: 固定窓cronの恒久取りこぼし→ウォーターマーク方式／@db.Date の1日ズレ→
  toISOString().slice固定／service key→bento_writer 専用JWT（v1必須に格上げ）／
  refunded_yen 欠落（締切後部分返金が不可視）／productId 必須化／PGRST102対策／
  環境分離／EXPIRED lazy疑義→追加質問＋45分ルール保険
- **運用照合**: 自動照合をv1から削除（連名転記×Stripe入力で完全一致が構造的に不成立・
  連泊で照合先行なし）／未照合UIは Guests今日タブのみ（弁当は17時の業務。Home常設は
  ノイズ訓練になる）／guest.bento の出口定義／PENDING非表示／メール・電話は同期自体を
  廃止（PII最小化）／P1.5のコピペSQL掲載／P3は手打ち注文で（本番Stripe決済不要）

「問題なし」と裏取りされた項目: 型規約（timestamptz⇄text）／serialize非対象／照合PATCHの
列grant整合／demoシードとINSERT権限の関係／0018手順との一致／デプロイ順序。
