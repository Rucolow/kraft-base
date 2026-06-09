# KRAFT BASE スタッフ運営PWA — 実装仕様書

> Claude Code 引き渡し用。`docs/spec.md` として配置し、CLAUDE.md は本書を参照する。
> 設計判断は確定済み。迷う点が出たら推測せず、原則（引き算・取りこぼさない・オフラインで動く・マニュアルを業務に溶かす・運営しながら育てる）に沿って判断するか TODO を残す。
> **「一発ビルド」の範囲＝コード一式（DBスキーマ・同期ルール・全画面・テスト）。クラウドのプロビジョニングと鍵投入は §12 の人間手順。コンテンツの確定はビルドの前提ではない（§3「育てる前提」）。**

---

## 1. WHY（背景と原則）

KRAFT BASE（熊野古道・小口のゲストハウス）のスタッフ運営PWA。既存の Discord 運用とスタッフマニュアルを置き換える、現場の単一ツール。

- **背骨は「時間とシフトに追従する運営の中枢」で、その鼓動が引き継ぎ。** 機能を並べた寄せ集めにしない。ひとつのデータの上に複数のビューを載せる。
- **マニュアルは「読むタブ」に閉じず、日々の業務に溶かす**（§7.0）。定型は本日に生き、手順は文脈で出て、参照はオフラインで開く。
- **運営しながら育てる。** 6月の開業後に実運用で最適解を見つける前提。アプリは「**完成した編集可能な器＋種データ**」として出荷し、未確定は要確認フラグ付きで載せ、運用中にオーナーが随時アプリ内で埋める（コード変更・再デプロイ不要）。
- **設計の規律は引き算。** 迷わず・取りこぼさず・電波が落ちても動く、の一点に寄せる。§2「対象外」を足さない。
- 既存マニュアル（`staff_manual.jsx` v5.2）と周辺追補の内容を初期シードの正とする。

---

## 2. スコープ

**対象**: シフトの引き継ぎ、当日の宿泊者管理（予約情報・メモ・タスク）、忘れ物、設備・備品、非同期コミュニケーション、**編集可能な運営コンテンツ（マニュアル・物の置き場所・手順・周辺/防災・価格・フレーズ）とその「育てる項目」管理**、共有iPad/個人端末の棲み分け。

**対象外（作らない）**:
- 稼働率・売上などのダッシュボード／分析
- ゲスト向け機能（施設案内・OTA の役割）
- リアルタイムのメッセンジャー、SNS的機能、ゲーミフィケーション
- OTA／チャネルマネージャー直結（当日ゲストはオーナーが手入力）
- 予約・決済処理（弁当システムは別アプリ。本アプリは運営のみ。会計操作は手順コンテンツで案内するだけ）

**外部で完結（アプリに持たない）**: 館内販売の決済実行（Square / PayPay）、エリア他宿の弁当一括受け取り（弁当システム）、法定の宿泊者名簿（紙運用。住所・連絡先はアプリに保存しない。アプリは到着状態のみ扱う）。

---

## 3. 主要な設計判断（Key Constraints）

絶対に守る不変条件。詳細は各セクション。

- 引き算：§2 の対象外を足さない。
- **運営しながら育てる**：運営コンテンツは**編集可能データ**。未確定は `needs_input`（要確認）フラグで出荷し、運用で埋める。**コンテンツの確定はビルドの前提条件ではない**。
- **マニュアルは業務に溶ける**：定型は本日コックピットに、手順は文脈に、参照はオフライン閲覧（§7.0）。
- **オフラインで完全動作**（local-first / PowerSync）。編集可能コンテンツも同期されオフラインで開ける。競合は last-write-wins。
- 棲み分けは **端末モード × 権限** の2軸。共有iPadは名前タップ＋無操作自動ロック、**切替PINなし**。
- 引き継ぎは「シフト開始時」に紐づく所作。**確認しないと開始できない**。
- 引き継ぎ＝`timeline_entry` の積み上げ＋未完 `followup`。**二重入力させない**。
- 予約は OTA 連携でなく **オーナー手入力**。
- PII はアプリに保存しない（パスポート画像・法定名簿はアプリ外）。氏名表示は「○○様」。
- 緊急は電話、プッシュは非緊急の気づきのみ。
- 絵文字禁止／アイコンは Lucide（SVG）。

---

## 4. 利用モデル（棲み分け）

### 4.1 端末モード（端末ごとに一度だけ設定）
- **共有モード（受付iPad）**: 組織にログインしたまま据え置き。シフト交代で名前タップ。無操作が一定時間続いたら個人を自動解除し、ゲスト記録を伏せる。
- **個人モード（ルッコロー／モーリーの端末）**: 一度本人認証すれば以後は常に本人。名前選択は出さない。

### 4.2 権限（ロール、2種類）
- **owner（ルッコロー）**: 全閲覧＋オーナー専用操作 — 当日ゲストの登録/編集、お礼/レビュー依頼の管理、タスク作成、**運営コンテンツの編集（§7.11）**、スタッフ・端末・設定の管理。
- **staff（モーリー・日中）**: 当日・引き継ぎ・ゲスト・タスク・忘れ物・設備備品・マニュアルの閲覧と運用。コンテンツは**直接編集せず、写真や注記の添付と「要確認」の起票で育てに参加**（マニュアル §04「勝手に足さない／まず運営に提案」に沿う）。
- モーリーと日中は権限を分けない。違いはシフトの文脈だけ。1人が複数端末に現れてよい。

### 4.3 認証
- 個人端末: Supabase Auth のマジックリンクで一度きり認証、以後永続。`staff` レコードに紐づく。
- 共有iPad: 組織認証を保持。個人識別はシフトセッション＝名前タップで開始。**切替に PIN は要しない**。

### 4.4 シフトセッション（出席・帰属の源）
- **開始**: 引き継ぎ確認後の「シフト開始」で `started_at` と `handover_reviewed_at` をセット。これが無いと開始不可。
- **終了**: 明示「シフト終了」、または同一端末で次の人が開始した時に直前セッションを終了。
- **自動クローズ**: 毎日 04:00 JST に未終了セッションを閉じる（§12）。クライアントも当日04:00より前開始なら終了扱い。
- **複数同時**: 1端末＝1アクティブセッション。副の人は自分の電話を使う。

---

## 5. 技術 / 非機能要件

- **PWA**（インストール可能）、モバイルファースト。共有端末は iPad、個人端末はスマホ。
- **スタック**: React + TypeScript + Vite + Tailwind CSS。バックエンドは **Supabase（PostgreSQL）**、写真は Supabase Storage。
- **ローカルファースト**: 端末に SQLite/IndexedDB ミラーを持ち**完全オフライン動作**、復帰時に同期。同期基盤は **PowerSync Cloud**。**競合は last-write-wins**。
- **運営コンテンツは編集可能データ**: マニュアル・物の置き場所・手順・周辺/防災・価格・フレーズは静的バンドルではなく `content` テーブル（§6）に持ち、local-first で同期されオフラインでも開ける。出荷時に既存 `staff_manual.jsx` ＋ 周辺追補をシードし、未確定は `status=needs_input`。
- **オフラインUI**: 各画面で接続／同期中（控えめなバッジ）／オフライン（キャッシュ表示）／同期失敗（再試行）を扱う。
- **プッシュ通知**: 個人端末のみ（iOS 16.4+はホーム追加前提）。発火は (a) 自分への @メンション、(b) 自分担当の単発タスク新規付与、(c) `requires_owner` の `followup`（オーナーへ）。**緊急は通知でなく電話**。
- **日付**: 不透明な JST 文字列 `'YYYY-MM-DD'`。
- **デイリータスクのリセット**: クライアント起動時に日次判定（`daily_reset.last_reset_date` が今日より前なら `group=daily` を `done=false`）。
- **PII**: パスポート画像・法定名簿はアプリに保存しない。共有iPadは無操作時に機微画面を伏せる。氏名は「○○様」。
- **写真**: 忘れ物・設備不具合・物の置き場所コンテンツの第一級の入力（Storage）。
- **ツール**: TypeScript strict、Lint/Format は **Biome**、ユニットは **Vitest**、E2E は **Playwright**。pnpm。

---

## 6. データモデル

擬似スキーマ。型・命名は実装で調整可。RLS は role と shift_session を前提に設計。

```
staff
  id  uuid / name text / role enum(owner|staff) / shift_label text? / accent text?

device
  id uuid / mode enum(shared|personal) / bound_staff_id uuid? / label text / auto_lock_min int

shift_session
  id uuid / staff_id uuid / device_id uuid
  started_at timestamptz / ended_at timestamptz?
  handover_reviewed_at timestamptz      # 無いと開始不可

guest                           # 当日の宿泊者（OTA からオーナーが確定）
  id uuid / stay_date text('YYYY-MM-DD') / name text / country text / language text
  party_size int / checkin_time text / bed text / bento text
  status enum(expected|arrived|late)
  review_sent_at timestamptz?   # お礼/レビュー依頼の送信済み（OTA経由）
  created_by uuid

guest_note                      # メモ＆スレッド統合
  id uuid / guest_id uuid / author_id uuid?
  body text / pinned bool        # pinned=標準メモ / それ以外=コメント
  mentions uuid[] / read_by uuid[] / created_at timestamptz

timeline_entry                  # 引き継ぎの素。シフト中の行動が積み上がる
  id uuid / author_id uuid? / kind enum(action|note|system) / body text
  ref_type enum?(guest|task|followup|lost_item|equipment_issue) / ref_id uuid?
  created_at timestamptz

followup                        # 未完の申し送り（ピン留め、シフト横断）
  id uuid / body text / guest_id uuid?
  status enum(open|done) / requires_owner bool
  created_by uuid / created_at timestamptz / resolved_at timestamptz?

task                            # 定型チェックリスト＋雑務＋単発。owner が編集可
  id uuid / title text
  group enum(daily|per_checkout|oneoff)
  phase enum?(midday_prep|cleaning|evening_close|morning_prep)   # コックピット表示の文脈
  source enum(manual|adhoc)
  owner_id uuid? / done bool / done_at timestamptz?

content                         # 編集可能な運営コンテンツ（owner が編集、§7.11）
  id uuid
  kind enum                     # manual | location | procedure | area | emergency | price | phrase
  slug text                     # 安定キー（例: manual-checkin, location-linen, proc-bento, area-bus, price-list）
  title text / body text        # markdown
  phase enum?                   # procedure を本日コックピットの文脈に出す場合
  lang text?                    # phrase の言語
  photo_paths text[]
  status enum(ready|needs_input)  # needs_input=要確認（育てる項目に出る）
  updated_by uuid / updated_at timestamptz

lost_item                       # 忘れ物台帳（マニュアル §12 準拠）
  id uuid / item text / found_date text / place text / finder_id uuid / guest_id uuid?
  photo_path text? / status enum(held|contacted|returned|disposed|police) / note text? / created_at timestamptz

equipment_issue                 # 設備不具合・備品の補充/発注
  id uuid / kind enum(fault|restock) / title text / photo_path text?
  status enum(open|ordered|resolved) / reporter_id uuid / created_at timestamptz / resolved_at timestamptz?

daily_reset
  last_reset_date text('YYYY-MM-DD')
```

**導出（テーブルにしない）**
- 「あなた宛て」キュー = `guest_note` で `mentions` に自分を含み `read_by` に自分が無いもの。
- プレゼンス = `shift_session` で `ended_at` が null。
- 引き継ぎダイジェスト = 直前に終了したセッション以降の `timeline_entry` ＋ open の `followup`。
- コックピットの定型チェックリスト = `task` の `source=manual` を現在シフトの `phase` で抽出（§7.0）。
- お礼/レビュー未送信 = チェックアウト済みかつ `review_sent_at` が null のゲスト。
- **育てる項目（要確認）= `content` で `status=needs_input` ＋ open の `followup`。** 運用で埋めるべきものの実行中リスト。

---

## 7. 機能仕様（画面）

視覚・挙動の参照実装はモック `kraftbase_staff_mockup.jsx`。

### 7.0 マニュアルの溶け込ませ方（3層）
マニュアルは独立した「読むタブ」に閉じない。3層に分け、別の出方をする。**いずれも編集可能データで、出荷後に育てる**。
- **定型チェックリスト**（受付準備、清掃、クローズ前、翌朝セット 等）→ `task`（`source=manual`）として**本日コックピットに生き**、`phase` で出し分け、リセット。owner が編集。
- **手順ガイド**（チェックイン、ウェルカムドリンク、シャワー案内、火打石の進行、神棚の作法、決済の使い方、BBQ、クレーム対応、緊急時手順）→ `content`(kind=procedure)。**該当画面・操作の文脈で表示**＋全文へリンク。
- **参照**（コンセプト/接客姿勢、物の置き場所、周辺案内、設備、ルール、価格、フレーズ、連絡先、儀式の背景）→ `content`(kind=manual/location/area/emergency/price/phrase)。**オフライン閲覧**＋文脈表示。

### 7.1 シフト開始・引き継ぎ（中核）
- 共有iPad: 名前タップ → 前任のダイジェスト確認 → 「シフト開始」。個人端末: 本人選択なし → 「シフト開始」 → ダイジェスト確認。
- アカウント交代＝次の人の引き継ぎ確認の起点。帰属は `shift_session` から自動。

### 7.2 本日（時間追従コックピット / ホーム）
現在時刻とシフトで前面を変える。操縦席。定型チェックリストは `task`(`source=manual`) を `phase` で抽出表示。
- 13時台（日中）: 受付準備（midday_prep）・当日チェックイン・オーナーの朝の引き継ぎ
- 17時台（夜）: 弁当配達・到着状況・あなた宛て・夜の火打石
- 20時前（夜・クローズ）: クローズ前（evening_close）・遅着・火打石残り・翌朝セット

### 7.3 宿泊者（ゲストレコード）
- 一覧（当日）＋詳細（予約情報・状態・メモ・スレッド＋既読）。
- 受付で開くとチェックイン手順とウェルカムドリンクの一言を文脈表示（procedure）。
- 遅着対応・連泊清掃希望をメモに反映。`language` に応じた基本フレーズ（TTS）を表示。

### 7.4 ゲスト追加／編集（オーナー専用）
- owner だけの唯一の予約入力経路（9–13に使用）。フィールドは `guest` 準拠。
- チェックアウト済みで `review_sent_at` が null のゲストを提示（お礼/レビュー依頼。送信は OTA、対面・火打石では依頼しない）。

### 7.5 引き継ぎ（タイムライン）
- 上部に open の `followup` をピン留め（`requires_owner` は印）。
- タイムラインは `timeline_entry` の積み上げ。引き継ぎは「これ＋短い自由記述」。端末をまたいで成立。

### 7.6 タスク
- `daily` / `per_checkout` / `oneoff`（@担当付き）。マニュアル由来の定型（`source=manual`）も含む。owner が編集。
- `daily` はクライアント日次リセット。

### 7.7 マニュアル（参照層）
§7.0 の参照層。`content` を内包し**完全オフライン**。緊急連絡先・作法・会話集は電波ゼロで開く。フレーズは TTS 付き基本セットを当日ゲストの言語で文脈表示、込み入った会話は受付iPadの翻訳アプリで対応。

### 7.8 コミュニケーション（非同期）
- リアルタイムチャットは作らない。タイムライン＋レコードごとのスレッド＋@メンション「あなた宛て」キュー＋既読＋プレゼンス。
- 個人端末のルッコロー・モーリーには差分ダイジェスト＋プッシュ。緊急は電話、雑談は既存 LINE。

### 7.9 忘れ物
- 台帳（写真＋発見日＋場所＋発見者＋推定の持ち主）。held→contacted→returned/disposed、貴重品は police。

### 7.10 設備・備品
- 不具合（fault）と補充/発注（restock）を写真付きで起票、open→ordered→resolved。

### 7.11 コンテンツ編集（オーナー）と「育てる項目」
- **コンテンツ編集（owner）**: `content` の追加・編集・写真添付・`status` 切替を行うオーナー専用画面。マニュアル本文、物の置き場所、手順、周辺/防災、価格、フレーズをアプリ内で更新（再デプロイ不要）。
- **育てる項目（全員）**: `status=needs_input` の `content` ＋ open の `followup` を一覧する実行中リスト（既存マニュアルの PENDING_ITEMS を生きた形にしたもの）。staff は「ここが分からない／空」を起票して育てに参加、owner が埋めて `ready` にする。

### 7.12 物の置き場所（館内リファレンス）
- `content`(kind=location) を写真付きで一覧（リネン棚・清掃用具・アメニティ補充・ウェルカムドリンク・コーヒー/朝食在庫・救急箱・消火器・Wi-Fiルーター・ロッカー・名簿用紙・施設案内・ゴミ集積/収集 等）。
- 出荷時は項目だけを `needs_input` でシードし、開業後にオーナーが実物の写真と場所を入れて育てる（新人が「探して止まる」を解消する主要面）。

---

## 8. デザイン制約

- 既存マニュアルのトークンを流用: teal `#2D4A3E`、orange `#C8703C`、cream `#F5F0E6`、wood `#8B6914` 系。
- フォント: 見出し Cormorant Garamond、本文 Zen Kaku Gothic New。
- セマンティックトークン。タッチターゲット ≥44px。入力16px以上。`100dvh`、safe-area。
- ローディングはスケルトン。空／エラー／オフライン／`needs_input`（要確認バッジ）状態を用意。
- 絵文字禁止／Lucide。マニュアル §04「勝手に足さない」を UI でも体現。

---

## 9. 実装上の禁止事項（Don'ts）

- 後方互換の名目で削除予定・未使用コードを残さない。
- 未使用の変数・引数・関数・コメントアウトを残さない。
- コメントやREADMEに「実装した／完了」等の進捗宣言を書かない。
- コード・コメントに日付や相対時制を書かない。
- 実装状況チェックリストやステータス表を作らない。
- リンター/フォーマッタで強制できることは設定に任せ、文章で書かない。

---

## 10. 検証（How to verify）

- 型: `pnpm typecheck` ／ Lint/Format: `pnpm lint`・`pnpm format` ／ ユニット: `pnpm test` ／ ビルド: `pnpm build`
- E2E（`pnpm e2e`）核フロー必須 —
  - シフト開始：引き継ぎ未確認では開始不可／確認後に開始でき帰属が残る。交代＝再引き継ぎ。
  - オフライン：機内モードで当日ゲスト・マニュアル・物の置き場所が読め、メモ追加が書込キューに入り復帰後に同期。
  - @メンション → 相手の「あなた宛て」に出て既読が反映。
  - 定型チェックリストが `phase` で正しいシフトに出る／`daily` が日跨ぎでリセット。
  - 忘れ物・設備不具合が写真付きで起票され状態遷移。
  - **コンテンツ：owner が `content` を編集して `status` を `needs_input`→`ready` にでき、`needs_input` が「育てる項目」と要確認バッジに反映される。**

---

## 11. 参照資産

- `staff_manual.jsx`（v5.2）— 本文・配色・フォント・フレーズ集・TTS実装の出所。本文は §7.0 の3層に分類し、`content`/`task` の**初期シード**として投入（再執筆しない）。フレーズは基本セットのみ（英語中心）、込み入った会話は受付iPadの翻訳アプリ。
- `kraftbase_area_safety_addendum.md` — 周辺案内・防災・火打石作法の調査結果。`content`(area/emergency/procedure) の初期シード。未確定は `needs_input` で投入。
- `kraftbase_staff_mockup.jsx` — 各画面の視覚・操作の参照。
- 既存の弁当システム（Postgres）— スタック整合の参考。

---

## 12. 人間の手順（プロビジョニング・コード外）

`.env.example` を同梱し、以下を README に記載する。

- Supabase: プロジェクト作成、マイグレーション適用、Storage バケット `photos` 作成、RLS ポリシー適用。
- PowerSync Cloud: インスタンス作成、Supabase 接続、同期ルール適用。
- Auth: マジックリンク設定、初期 owner（ルッコロー）の登録。
- プッシュ: VAPID 鍵生成、サービスワーカー登録。
- スケジュール: 04:00 JST のセッション自動クローズ（Supabase scheduled function）。
- **シード**: `staff` 3件、共有端末を shared 登録、マニュアル由来の定型 `task`（`source=manual`）、`staff_manual.jsx`＋追補から `content`（既知は `ready`、未確定は `needs_input`）。`lost_item`/`equipment_issue` は空。物の置き場所（§7.12）は項目だけ `needs_input` でシード。
- env: Supabase URL / anon key、PowerSync URL / token endpoint。

> 開業後に運営で埋める主な `needs_input`：物の置き場所、決済の使い方、館内販売の価格、弁当の受け取り/見分け、火打石の固有手順、BBQ運用、正式な指定避難場所、最新バス時刻表、最寄り店舗、タクシー、川遊びスポット、熊野川診療所の詳細、AED、法定名簿の保管場所。

---

## 13. 実装順の目安（依存順。完成目標は本仕様の全機能）

1. データモデル＋認証／端末モード／RLS
2. シフトセッション＋引き継ぎ確認（背骨）
3. 本日コックピット（時間追従、マニュアル定型の `phase` 表示）
4. ゲストレコード／追加編集／タイムライン／タスク／忘れ物／設備備品
5. `content`＋コンテンツ編集（オーナー）＋育てる項目＋物の置き場所（3層の手順・参照を内包）
6. 非同期通知（@メンション・プレゼンス・既読）＋プッシュ
7. オフライン同期（PowerSync）の作り込みと E2E
