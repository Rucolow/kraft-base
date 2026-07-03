# 実装ロードマップ — 設計判断済みプレイブック集

**読者**: 実装セッション（Opus 4.8 想定）とオーナー。
**前提**: 先に `docs/engineering-principles.md` を読むこと（不変条件・地雷・プロトコル）。
背景の指摘一覧は `docs/improvement-plan.md`（84指摘の統合）。
**状態凡例**: ✅本番済 / 🟡ブランチ済(検証待ち) / ⬜未着手 / 🔶オーナー判断待ち

## 現在地（2026-07-02）
- ✅ バグ修正一式＋オフライン信頼性/a11yバッチ（PR #23-#27）
- 🟡 `claude/nifty-euler-mqj76p` に温存: コネクタ型変換(serialize)・LinkAccountガード・
  migrations 0015/0016・境界テスト → **W1のステージング実証を通してから本番へ**
- ⏳ 外部待ち: モーリーの実機4チェック（結果がW1の 0016 要否を確定する）

## 着工順序（依存関係）
```
W1(同期/RLS実証) ──→ W2(名簿ライフサイクル)  ※W2はserialize到達が前提ではないが同時期が効率的
W3(キオスク堅牢化) … 独立・いつでも
W4(現場UXパック) … 独立・いつでも（小粒の集合）
W5(E2E CI化) … 独立・最初にやると以降の全WSが安全になる ★推奨着手順1位
W6(運用) … W1後が効率的（ステージング環境が温まっているため）
W7(コンテンツ/通知) … 独立・大きい・急がない
```

---

## W5. E2EのCI化 ★最初にやる（他の全部を安全にする）
**状態** ⬜ / 規模 S-M / 全てフロント＋CI
**設計（決定済み）**
- `apps/staff/e2e/` は導入済み（実戦スクリプト6本＋README）。
- devDependency に `playwright-core` を追加し、スクリプトの `CHROME` 定数を
  `process.env.E2E_CHROME ?? '(クラウド既定パス)'` に変更。CIでは
  `npx playwright-core install chromium --with-deps` 相当ではなく、GH Actions の
  `microsoft/playwright-github-action` か `npx playwright install chromium` を使う
  （playwright-core単体はinstallコマンドを持たない点に注意。素直に `playwright` を
  devDepにする方が簡単。判断は実装時、READMEに追記）。
- `.github/workflows/ci.yml` に job 追加: build → `vite preview --port 4173 &` →
  `node e2e/sweep.cjs && node e2e/sim_verify.cjs && node e2e/checkin_multi.cjs && node e2e/minor.cjs`。
- スクリプトの console-error フィルタに `fonts.googleapis` 由来の失敗を良性として追加。
**受け入れ基準**: GH Actions 上で e2e job が緑。わざと `GuestEdit` の保存を壊すと落ちる（1回試す）。
**リスク**: CI マシンでの headless 差異。→ `--no-sandbox` 維持、失敗時スクショをartifact化。

## W1. 同期/RLS層のステージング実証 → 本番反映
**状態** 🟡（コード/SQL準備済み） / 規模 M / **要ステージング＋オーナーのSQL実行**
**手順書**: `apps/staff/supabase/staging/VERIFY-sync-rls.md`（A/B/C試験・ロールバック込み）
**内容**: serialize.ts（配列/bool変換）/ 0015(claim封鎖) / 0016(device→org、**条件付き**)
**判断ポイント**: モーリー4チェックで「シフト即戻り」or「勤務時間が出ない」が残存 → 0016必須。
**受け入れ基準**: ステージングで (a)メンション既読・写真が2台目に残存 (b)guest_note.mentions が
  Postgres上で配列型 (c)claim封鎖動作 (d)(0016時) device行とshift_sessionがサーバー到達。
**本番反映順**: SQL(0015→必要なら0016) → コードPR（serialize＋LinkAccountガード）。
**注意**: 本番反映後、**過去にサイレント消失した書き込みは自動復元されない**。
  既存メンション既読等の不整合は「気にしない」で運用可（軽微）。device行は Setup やり直しで再生成。

## W2. 法定宿泊者名簿のライフサイクル（法令・P0-3）
**状態** ⬜ / 規模 L / フロント＋**マイグレーション＋PowerSync同期ルール変更**
**設計（決定済み）**
1. **マイグレーション 0017**:
   - `checkin_record` に `stay_date date`・`batch_id uuid` を追加（既存行は guest join で backfill、
     joinできない行は created_at::date）。
   - `guest_id` の FK を `on delete cascade` → `on delete set null` に変更（**名簿はゲスト削除より長生き**）。
     guest_id nullable 化に伴い、CheckIn 側は従来どおり guest_id を書く（削除時のみ null になる）。
2. **CheckIn 送信変更**: 1回の記入バッチに同一 `batch_id` を採番（再入力の「最新バッチ」判定が
   確実になり、現行の“直近partySize行”ヒューリスティックを置換）。`stay_date` はゲストの stay_date。
3. **オーナー用名簿ビュー** `/register`（owner-only route）: 月切替一覧（stay_date基準）＋
   CSVエクスポート（client-side Blob、UTF-8 BOM付き＝Excel対応）。列: 宿泊日/氏名/住所/連絡先/
   国籍/旅券番号/記入日時。**表示・出力ともowner限定**（RLSは checkin_record SELECT が
   org member なので、まずUI限定。厳格化するなら SELECT を owner に絞る 0018 を検討 → 🔶）。
4. **同期ウィンドウ化**（別PR・慎重に）: PowerSync ダッシュボードの sync rules で
   checkin_record を `WHERE created_at > now() - interval '90 days'` 相当のバケットに
   （classicルールの記法は要確認）。**サーバーには全量が残る**＝法定3年保存はPostgres側の責務。
   ローカルは直近だけ。→ ステージングで download 挙動を必ず確認。
**受け入れ基準**: e2e: 記入→/registerに出る→CSVがダウンロードされ全員分の行がある。
  ゲスト削除しても名簿行が残る（demoで検証可）。再入力で旧バッチと新バッチが区別される。
**リスク**: FK変更はデータ移行を伴う→ステージングで0017を先に流す。同期ルール変更は
  re-snapshot を誘発しうる（過去に staff の publication 変更で詰まった前例）→営業時間外に。

## W3. キオスク堅牢化（戻る操作の封鎖）
**状態** ⬜ / 規模 S-M / フロントのみ・demoで検証可
**設計（決定済み・シンプル案）**
- CheckIn マウント時に `history.pushState` でダミーエントリを1枚積み、`popstate` で
  即 `history.forward()`（または再push）して**戻る操作を打ち消す**。アンマウントでリスナ解除。
- スタッフ導線（長押し）は `navigate(..., {replace:true})` にして履歴を汚さない。
- iOSのエッジスワイプは完全には殺せない（PWA standalone では発生しにくい）。
  **完全隔離（ガイデッドアクセス案内 or PIN）は🔶オーナー判断**（運用でiOSガイデッドアクセスを
  使うのが最も確実、という案内文を ops-runbook に入れる）。
**受け入れ基準**: e2e で checkin へ遷移→`page.goBack()`→URLが /checkin のまま。
  長押し退出→ゲスト詳細。二重pushでUIが固まらない。

## W4. 現場UXパック（小粒の高価値集合・独立に出荷可）
**状態** ⬜ / 規模 各S / フロントのみ・demoで検証可。**1項目=1コミット**で進める。
1. **過去ゲスト検索**: Guests に「過去」タブ（`stay_date < shiftDate()` DESC LIMIT 50）＋
   名前部分一致の検索ボックス（全期間対象）。
2. **シフト終了ボタン**: TopBar のアバターメニュー or /shift に「シフトを終了」。
   `endActiveSession(deviceId)` を呼び /shift へ。**勤務時間の правда化**（現状は翌04:00まで水増し）。
   確認ダイアログ付き。
3. **OTA連続入力**: GuestEdit(新規)に「保存して次を追加」ボタン → 保存後 stay_date と
   whole_house を保持したまま他フィールドをリセットして同画面に留まる。
4. **ベッド重複警告**: GuestEdit で同一 stay_date・キャンセル以外のゲストの bed トークンと
   突合し、選択チップに「⚠︎山田様と重複」を表示（保存は妨げない=警告のみ）。
5. **コックピット未着表示の修正**: 現行は late のみ判定で「全員到着済み」誤表示。
   `notArrived = active.filter(s!=='arrived')` が残っていれば「未着：names」、0なら全員到着済み。
6. **レビュー依頼リストからキャンセル除外**: GuestEdit の reviewNeeded クエリに
   `AND status != 'cancelled'`。
7. **申し送りの完了痕跡**: followup resolve 時に `resolved_at`（列あり）を必ず書き、
   Handover で「済（HH:MM 名前）」表示。resolved_by 列が無ければ 0017 に相乗り。
8. **写真圧縮を本番経路にも**: storage.ts の Supabase 分岐でも `compressToDataUrl` 相当の
   canvas 圧縮を通してから upload（Blob化）。＋ onPick の try/catch とエラートースト。
**受け入れ基準**: 各項目に e2e ケースを1本追加（sim_verify へ追記 or 新スクリプト）。

## W6. 運用（ops）最小セット
**状態** ⬜ / 規模 S-M / 主にドキュメント＋外部サービス設定（🔶オーナー作業を含む）
1. **`docs/ops-runbook.md`**（1ページ）: 症状→対処の表:
   同期が止まった(SyncBadge未同期n件が減らない)/白画面/古いビルド疑い(Setupのbuild表記確認)/
   iPad紛失(Supabaseでauthユーザー無効化→wipe手順)/名簿エクスポート/ステージング検証のやり方/
   ロールバック(Vercelで前デプロイをPromote)。
2. **監視** 🔶: UptimeRobot(無料)で本番URLとSupabase REST の死活。Supabaseの
   一時停止(無料枠アイドル)対策として週1のkeep-alive ping（GitHub Actions cron で
   `select 1`相当のRESTを叩く）を推奨提案。
3. **バックアップ** 🔶: 推奨=GitHub Actions cron で週次 `pg_dump`（接続文字列はSecrets、
   出力は private repo artifact 30日保持）。名簿=法定データなのでオーナーに方式承認を取る。
4. **schema.sql 再生成スクリプト**: `apps/staff/supabase/staging/regen.sh`
   （migrations/*.sql を連結するだけ）＋ドリフト検知をCIに（連結結果とschema.sqlのdiffが
   非空なら警告）。
**受け入れ基準**: ランブックがrepoにあり、オーナーが監視/バックアップ方式を承認済み。

## W7. コンテンツ協働・通知（大玉・急がない）
**状態** ⬜ / 規模 L
1. **同時編集の後勝ち上書き対策**: 保存時に `updated_at` 楽観チェック（開いた時点と違えば
   「他の人が更新しました」で再読込を促す）。完全マージはしない（規模に不釣り合い）。
2. **手順レイヤ配線**: `useProcedureForPhase`（デッドコード）を Today/GuestDetail に接続。
3. **Web Push（build-plan Phase6）**: 仕様の3トリガー。VAPID＋Supabase Edge Function 構成案を
   別設計書に起こしてから（🔶 やるか自体をオーナー判断。LINE通知等の代替も検討価値あり）。

---

## 🔶 オーナー判断待ちリスト（実装前に決める）
| # | 論点 | 選択肢（推奨=太字） |
|---|---|---|
| 1 | 0016 device RLS 開放 | モーリー4チェックの結果次第（**残存なら適用**） |
| 2 | 名簿の閲覧権限 | **UIでowner限定のみ**（現RLS維持） / RLSもownerに絞る(0018) |
| 3 | 名簿のローカル保持期間 | **90日** / 30日 / 全量継続 |
| 4 | キオスク完全隔離 | **popstate封鎖＋iOSガイデッドアクセス運用** / PIN実装 |
| 5 | バックアップ方式 | **週次pg_dump(GH Actions)** / Supabase有償PITR |
| 6 | 監視 | **UptimeRobot＋keep-alive cron** / なし |
| 7 | キオスク多言語 | **独仏伊西を追加**（静的辞書） / 日英のまま |
| 8 | スタッフUIの英語化 | **しない**（英語話者スタッフ雇用時に再検討） |
| 9 | Web Push | 実装 / **保留**（LINE運用で代替中なら） |

## 実装セッションの型（毎回この順で）
1. `docs/engineering-principles.md` を読む → 該当WSの本章を読む
2. ブランチ確認（`claude/nifty-euler-mqj76p` に🟡が残っている点に注意。
   **フロントのみを出荷する場合は cherry-pick で分離**した前例あり: PR #27 方式）
3. 実装 → ゲート（format/typecheck/lint/test/build）→ e2e（sweep＋該当スイート、エラー0）
4. バグを見つけたら回帰テスト同梱
5. PR（内容にSQL適用の有無を明記）→ CI緑 → ユーザー承認 → merge
