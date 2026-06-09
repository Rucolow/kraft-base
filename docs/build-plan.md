# KRAFT BASE モノレポ — 制作工程と必要ファイル一覧

`docs/build-plan.md` に配置。**A の工程を上から順に Claude Code へ渡す**。各フェーズは「骨組み→機能」の段階分けで、節目ごとに build/lint を通してコミットする。`▲人間` はアカウント操作が要るコード外の手順。

---

## A. 制作工程

### Phase 0 — リポ骨組み
- 作る：pnpm workspaces、`turbo.json`、`biome.json`、`tsconfig.base.json`、`.gitignore`、CI（typecheck/lint/test）、`packages/brand`（トークン・Tailwindプリセット・フォント）、`packages/tsconfig`、`apps/staff` の空シェル（Vite+React+TS+Tailwind+PWA、画面は空）、`apps/site` stub、`.env.example`。
- 確認：`pnpm install` → `pnpm -w build`（staff の空シェルがビルド）→ `pnpm lint`。
- コミット＆プッシュ。

### Phase 1 — データ基盤・認証・端末モード・RLS
- ▲人間：Supabase プロジェクト作成（URL / anon key を取得）。
- 作る：`supabase/migrations`（§6 全テーブル＋RLS）、`seed.sql`、`src/lib/supabase`、`src/lib/powersync`（schema / connector / 初期化）、`powersync/sync-rules.yaml`、認証（マジックリンク）、端末モード（shared / personal）登録、`src/lib/date.ts`（JST不透明文字列）。
- ▲人間：PowerSync Cloud 作成 → Supabase 接続 → sync-rules 投入 → URL / token を `.env` へ。マジックリンク有効化、初期 owner 登録、`seed.sql` 実行。
- 確認：個人端末のログインと端末モード切替が動き、ローカルDBへデータが同期。
- コミット。

### Phase 2 — シフトセッション＋引き継ぎ（背骨）
- 作る：`ShiftGate`（名前タップ／本人 → ダイジェスト確認 → 開始、未確認は開始不可）、`src/lib/shift.ts`（セッション開始・終了・04:00自動クローズ・ダイジェスト導出）、アカウント交代＝再引き継ぎ。
- 確認：E2E「引き継ぎ未確認では開始不可／確認後に開始し帰属が残る／交代＝再引き継ぎ」。
- コミット。

### Phase 3 — 本日コックピット
- 作る：`Today`（現在時刻×シフトで前面を出し分け）、`task`(`source=manual`) を `phase` で抽出する定型チェックリスト表示。
- 確認：13/17/20時前の文脈で正しいカードが出る。
- コミット。

### Phase 4 — ゲスト／タイムライン／タスク／忘れ物／設備備品
- 作る：`Guests` / `GuestDetail` / `GuestEdit`（owner専用、お礼未送信の提示）、`Handover`（`followup` ピン留め＋`timeline_entry`）、`Tasks`（daily日次リセット）、`LostItems`、`Equipment`（写真起票）。
- 確認：E2E「忘れ物・設備が写真付きで起票され状態遷移」「daily が日跨ぎでリセット」。
- コミット。

### Phase 5 — コンテンツ層＋育てる項目＋物の置き場所＋マニュアル3層
- 作る：`content` テーブル運用、`ContentAdmin`（owner編集・写真・status切替）、`Growlist`（`needs_input`＋open `followup`）、`Locations`（物の置き場所・写真）、`Manual`（参照層）。手順(procedure)は該当画面に文脈表示。
- シード：`staff_manual.jsx`＋周辺追補から `content`（既知＝`ready`／未確定＝`needs_input`）、物の置き場所は項目だけ `needs_input`。
- 確認：E2E「owner が `content` を編集し `needs_input`→`ready`、要確認バッジと育てる項目に反映」。
- コミット。

### Phase 6 — 非同期通知＋プッシュ
- ▲人間：VAPID 鍵生成。
- 作る：@メンション「あなた宛て」キュー、既読、プレゼンス、差分ダイジェスト、Web Push 登録（個人端末）。
- 確認：E2E「@メンションが相手のキューに出て既読が反映」。
- コミット。

### Phase 7 — オフライン同期の作り込み＋E2E仕上げ
- 作る：接続／同期中／オフライン／同期失敗の各UI、書込キュー、competition は last-write-wins。
- 確認：E2E「機内モードで当日ゲスト・マニュアル・物の置き場所が読め、メモ追加が復帰後に同期」。全核フロー緑。
- コミット。

### デプロイ（Phase 1 以降いつでも）
- ▲人間：Vercel で `apps/staff` を別プロジェクト化（Root Directory = `apps/staff`）、環境変数を投入。プレビューを確認しながら進める。`apps/site` は将来同様に。

---

## B. 必要ファイル一覧（目標構成）

```
kraft-base/
├─ package.json                 # workspaces / turbo スクリプト
├─ pnpm-workspace.yaml
├─ turbo.json
├─ biome.json                   # Lint/Format（全app共通）
├─ tsconfig.base.json
├─ .gitignore
├─ .env.example
├─ README.md
├─ CLAUDE.md                    # リポ全体の規約（構成・ツール・ブランド）
├─ .github/workflows/ci.yml     # typecheck / lint / test
├─ docs/
│  └─ build-plan.md             # 本書
├─ packages/
│  ├─ brand/
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ tokens.css          # CSS変数（2色パレット・面・影）
│  │     ├─ tailwind-preset.ts  # 色・フォントの Tailwind プリセット
│  │     ├─ fonts.ts            # Cormorant Garamond / Zen Kaku Gothic New
│  │     └─ index.ts
│  └─ tsconfig/
│     ├─ base.json
│     └─ react.json
└─ apps/
   ├─ site/                     # 将来。今は package.json ＋ 最小 index のみ
   └─ staff/
      ├─ index.html
      ├─ package.json
      ├─ vite.config.ts         # React + PWA(vite-plugin-pwa)
      ├─ tsconfig.json          # extends ../../packages/tsconfig
      ├─ vitest.config.ts
      ├─ playwright.config.ts
      ├─ .env.example           # VITE_SUPABASE_URL / ANON_KEY / VITE_POWERSYNC_URL ほか
      ├─ public/icons/          # PWA アイコン各サイズ（manifest は plugin 生成）
      ├─ supabase/
      │  ├─ config.toml
      │  ├─ migrations/         # §6 全テーブル＋RLS
      │  └─ seed.sql            # staff / device / task(manual) / content(seed)
      ├─ powersync/
      │  └─ sync-rules.yaml     # 同期ルールの正本（PowerSync へ投入）
      ├─ docs/
      │  ├─ spec.md
      │  └─ area_safety_addendum.md
      ├─ e2e/                   # Playwright（核フロー）
      └─ src/
         ├─ main.tsx
         ├─ App.tsx             # ルーティング＋端末モード/セッションのガード
         ├─ routes/
         │  ├─ ShiftGate.tsx        # §7.1
         │  ├─ Today.tsx            # §7.2 本日コックピット
         │  ├─ Guests.tsx
         │  ├─ GuestDetail.tsx      # §7.3
         │  ├─ GuestEdit.tsx        # §7.4 owner専用
         │  ├─ Handover.tsx         # §7.5
         │  ├─ Tasks.tsx            # §7.6
         │  ├─ Manual.tsx           # §7.7 参照層
         │  ├─ Comms.tsx            # §7.8（あなた宛て・プレゼンス）
         │  ├─ LostItems.tsx        # §7.9
         │  ├─ Equipment.tsx        # §7.10
         │  ├─ ContentAdmin.tsx     # §7.11 コンテンツ編集（owner）
         │  ├─ Growlist.tsx         # §7.11 育てる項目
         │  └─ Locations.tsx        # §7.12 物の置き場所
         ├─ components/         # 共通カード/シート/チェック等（共通化が進めば packages/ui へ）
         ├─ lib/
         │  ├─ powersync/{schema.ts,connector.ts,index.ts}
         │  ├─ supabase/client.ts
         │  ├─ auth/            # マジックリンク／端末モード／セッション
         │  ├─ shift.ts        # セッション・引き継ぎダイジェスト導出
         │  ├─ date.ts         # JST 'YYYY-MM-DD' 不透明文字列
         │  └─ push/           # Web Push 登録
         ├─ data/              # PowerSync watch のクエリ/ミューテーション
         ├─ content/           # 初期シード元（staff_manual.jsx 由来の本文・フレーズ）
         └─ types/             # 型（Supabase 生成型を含む）
```
