# 検証システム計画 — 「実機はオーナー、それ以外はAI」の恒久化（2026-07）

対象実装者: opus4.8（§3の実装タスク）。オーナーの運用手順は §4。
方針決定の背景: 常設ステージング環境（別Supabase＋PowerSync＋Vercel）は**作らない**。
維持コスト（3サービスの重複管理・スキーマ追随）が3人の宿の運営に見合わず、実際に
計画のまま未着工で `staging/schema.sql` は 0014 で陳腐化していた。代わりに
**5層の検証レイヤ**を定義し、各層の担当と発動条件を固定する。

## 1. 5層モデル（責任分界の正本）

| 層 | 何を検証 | 担当 | いつ |
|---|---|---|---|
| **L1 ユニット** (vitest) | 純ロジック（日付境界・serialize・エラー変換・シフト計算） | AI | 毎PR（CI強制） |
| **L2 デモe2e** (Playwright＋demoモード) | 画面フロー・ローカルDB・権限UI出し分け | AI | 毎PR（CI強制へ→§3-1） |
| **L3 本番観測** | 同期・RLS・認証の実挙動（デプロイ後） | AI＋オーナー | 同期/RLS/認証を触ったデプロイ後 |
| **L4 実機テスト** | iOS実機・PWA・オフライン・複数端末反映 | **オーナー**（iPad） | リスクの高いデプロイ後＋月1定期 |
| **L5 使い捨て検証環境** | 大規模なスキーマ/同期変更の事前リハーサル | AI手順書＋オーナー作成 | 稀（発動条件は§2） |

原則: **L1/L2で検証できる形に設計する**のが最優先（例: serialize を純関数に切り出して
L1 に落とした前例）。上の層ほど高コスト・低頻度。

## 2. 変更種別ごとの必要レイヤ（リリース規約）

| 変更の種類 | 必要な検証 |
|---|---|
| UIのみ（表示・文言・画面フロー） | L1＋L2 |
| ローカルロジック（シフト計算・日付・保存形式） | L1（テスト同梱必須）＋L2 |
| **同期・RLS・認証・migrations** | L1＋L2＋**デプロイ後L3チェック（§4-A）**＋**次回L4で該当項目** |
| 大規模（テーブル追加・同期方式変更・PowerSync設定） | 上に加えて **L5 を検討**（使い捨てSupabaseでリハ→即削除） |

## 3. 実装タスク（opus4.8）

### 3-1. e2e をワンコマンド化して CI に組み込む（最重要）

現状: e2e 8スイートは手動起動（preview起動→node 個別実行）。CI は typecheck/lint/
test/build のみで**ブラウザ検証ゼロ**。AIセッション外では誰も回さない。

- `apps/staff/e2e/run-all.cjs` を新設: `vite preview --port 4173` を child_process で
  起動→ポート待ち→全スイート（sweep, sim_verify, checkin_multi, minor, interact,
  roundtrip, owner_shift, login_stamp）を順に実行→preview を kill→結果集計を
  `RESULT: n/n suites passed` で出す。既存スクリプトは無改造で呼ぶ。
  - Chromium パス解決を `_pw.cjs` に寄せる: `process.env.KB_CHROME` →
    `/opt/pw-browsers/...`（クラウド）→ `playwright-core` 同梱解決の順で試す関数
    `resolveChrome()` をエクスポートし、各スイートの `const CHROME = ...` を置換。
- ルート `package.json` に `"e2e": "pnpm --filter @kraft-base/staff build && node apps/staff/e2e/run-all.cjs"`。
- `.github/workflows/ci.yml` に e2e ジョブを追加（既存 ci ジョブとは**別ジョブ**にして
  本体ゲートを遅くしない）:
  ```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright-core install chromium 2>/dev/null || npx playwright@1.44.0 install --with-deps chromium
      - run: pnpm e2e
        env: { KB_CHROME_FROM_PW: '1' }
  ```
  ※ playwright-core はブラウザDLコマンドを持たないため、CI では `playwright@1.44.0`
  （バージョンは devDependency の playwright-core と一致させる）で chromium を入れ、
  `resolveChrome()` が `~/.cache/ms-playwright` を探す分岐を持つこと。
  playwright-core を `apps/staff` の devDependency に追加する（現状 /tmp 頼みで
  コンテナ再生成のたびに消えている — 今セッションで2回再インストールした実績）。
- **受け入れ条件**: ローカル/クラウド/GitHub Actions の3環境で `pnpm e2e` が緑。
  CI で e2e ジョブが PR 必須チェックに並ぶ。

### 3-1b（追補 2026-07-14）: CI初回実走のトリアージ結果と修正

CIのe2eジョブは基盤として完動（8スイート実行・集計・失敗検知まで）。初回実走で
4件fail → トリアージ済み。内訳と修正:

1. **本物のプロダクト欠陥（sweep検知）**: `/checkin/<存在しないID>` が本文12文字の
   ほぼ白画面。古いQR/URLを開いたゲストが無言の白画面を見る。
   → **CheckIn.tsx**: ゲストが見つからない場合のフォールバック表示
   「このリンクは無効です。お手数ですがスタッフにお声がけください。」
   （キオスク聖域規則 §5 に従い**自動遷移はしない**。表示のみ）。
   sweep の checkin-badid は修正後 NEAR-BLANK でなくなることを確認。
2. **テストのタイミング競合（CI環境差・3件）**: いずれも固定 `waitForTimeout` 直後の
   即時判定で、隣接するリトライ付きチェックは成功している。
   - `interact.cjs`「products: edit mode shows 商品名 add field」→ 編集押下後、
     商品名入力欄を `waitFor`（〜3s）してから判定。
   - `interact.cjs`「STAFF products: NO 編集 button」→ 先に products ページの
     読み込み完了マーカー（見出し等）を待ち、その後 編集ボタン数=0 を判定。
   - `roundtrip.cjs`「edit: country prefilled」→ 入力値が非空になるまで最大3秒
     ポーリングしてから判定（prefill は監視クエリの1拍後に入る）。
3. **e2e/README の地雷リストに追記**: 「CI ランナーはタイミングが違う。固定waitで
   なく要素wait/値ポーリングで判定する」。
- **受け入れ条件**: CI の e2e ジョブが 8/8 で緑。

### 3-2. 実機テスト用チェックリストを作る（L4の道具）

`docs/testing/device-checklist.md` を新設。オーナーが iPad で**10分で流せる**定型
コース。各項目は「操作→期待結果→NGならどのスクショを撮るか」の3点セット:

1. 起動: ログイン画面下の **build 番号がPRの値と一致**（化石検知）
2. ログイン: コード入力→自動でアプリ内へ（/loginに留まらない）
3. 端末設定→シフト開始→**1分後もシフト中のまま**（巻き戻し検知）＋ヘッダーに「拒否」バッジが**無い**こと
4. ゲスト追加→2台目端末（Mac）で数十秒内に反映
5. チェックイン1件（記入→完了→再入力で復元）
6. **機内モード**で記録を1件書く→復帰→同期される（オフライン耐性）
7. サインアウト→ローカルデータが消えている（共有端末衛生）
- 末尾に「報告テンプレ」: NG項目番号＋スクショ（build番号が写る全画面）を貼るだけの形式。
- **受け入れ条件**: ドキュメントのみ。オーナーが初回実走して所要時間と詰まりを
  フィードバック→改訂。

### 3-3. ドキュメントの整合（方針転換の記録）

- `docs/engineering-principles.md` §8-4 を書き換え: 「同期/RLS/認証層→必ずステージングで
  実証」→「本計画 §2 の規約に従う（L3観測＋L4実機。L5は大規模時のみ）」。§10 の
  「migrations追加→ステージングにも適用」行も L5 の文脈に修正。
- `apps/staff/supabase/staging/README.md` 冒頭に注記: 「**常設環境は作らない方針
  （2026-07決定）**。これは大規模変更時に使い捨て環境を立てるためのレシピ」。
- `staging/schema.sql` を 0001〜0017 の結合に再生成（L5発動時に即使えるように）。
- `docs/roadmap.md` の該当項目（ステージング構築）を本計画参照に差し替え。
- **受け入れ条件**: `docs/` 内に「常設ステージング」を前提とする記述が残っていない
  （grep で確認）。

### 3-4. L3観測の仕上げ（小粒・任意）

- デプロイ後に AI が外から実行できる確認スクリプト `apps/staff/e2e/prod-probe.cjs`:
  本番URLの index.html と JS バンドルを fetch し、**期待するビルド刻印/マーカー文字列**
  （例: 新機能の一意な文言）が配信されているかを判定（今セッションで手動 curl で
  やったことの定型化。**読み取り専用**・ログイン不要）。
- **受け入れ条件**: `node e2e/prod-probe.cjs https://staff.kraft-base.com 'マーカー文字列'`
  が PASS/FAIL を返す。

## 4. オーナーの運用手順（コード外）

### A. 同期/RLS/認証を触ったデプロイ後の5分チェック（L3）
1. アプリを再読み込みし、ログイン画面の build 番号が新しいこと
2. 時計を見て対象操作を1回実行
3. 画面に「拒否 N件」/「同期されなかった変更」が出ないこと
4. 出た場合: バッジを開いてスクショ→AIに貼る（テーブル名とコードで即特定できる）
5. 必要なら Supabase → Logs → API でその時刻の 4xx を確認

### B. iPad 到着後の初回（L4の立ち上げ）
1. §3-2 のチェックリストを初回実走（所要時間を計る）
2. 詰まった項目・分かりにくい項目をAIにフィードバック→チェックリスト改訂
3. 以後、**同期/RLS/認証系のデプロイ後**と**月1**で実走

### C. L5 の発動判断
「テーブル追加・PowerSync設定変更・認証方式変更」をAIが提案した時、AIは PR に
**L5推奨/不要**を明記する。推奨時のみ `staging/README.md` の手順で使い捨て環境を
作成（30分）→検証→**プロジェクトごと削除**。

## 5. やらないこと

- 常設ステージング環境（本計画の主決定）
- 本番への書き込みを伴うAI自動テスト（テストデータ汚染。読み取り専用 probe まで）
- iOS シミュレータ/実機の自動化（Appium等）— L4はオーナーの手動10分で十分小さい

## 6. 着手順

1. **3-1**（e2e CI組み込み）— 検証の自動化はここが本体
2. **3-3**（ドキュメント整合）— 方針の食い違いを残さない
3. **3-2**（実機チェックリスト）— iPad 到着（来週）までに用意
4. **3-4**（prod-probe）— 余力があれば
