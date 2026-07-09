# 実装計画: オーナーのログイン〜シフト開始経路の修復（2026-07）

対象実装者: opus4.8。この文書だけで実装が完結するよう、原因分析・変更箇所・受け入れ条件・検証手順まで書く。
関連: `docs/engineering-principles.md`（特に §2 ローカルファースト書き込みの法則、§4 RLS↔UI 対応表）。

## 0. 事象と診断（確定事項）

モーリー（オーナー、okuda@nikuda.jp、Mac Safari）が履歴消去後に再ログインした際の症状:

1. **OTPエラー「Token has expired or is invalid」** — 一度ページを閉じて開き直すと通過した。
   複数回コード送信すると古いコードが無効になる仕様＋英語エラーで、ユーザーには
   「壊れている」ようにしか見えない。
2. **シフト開始画面（「あなたの名前を選んでください」）から先に進めない。**

### 2 の根本原因（コードで確認済み）

`apps/staff/src/routes/ShiftGate.tsx:28`:

```ts
const people = staff.filter((member) => !member.is_device && member.role === 'staff');
```

シフト開始の名前リストは **role='staff' のみ**。この宿は 3 人中 2 人（ルッコロー・モーリー）が
owner なので、**オーナーは自分の名前を選べず詰む**。コメントに「Owners manage from their own
device, so they are not tappable shift identities here」とあるが、これは誤った前提。
0015（オーナー1人前提）と同じ轍: **「一般的な組織像」の前提を3人の宿に持ち込んだ設計ミス**。

### 過去の「メイン画面に入った直後に戻される」現象の説明（参考）

Setup の device INSERT は、紐づけ（staff claim）UPDATE より前にアップロードされると
`is_owner()`/`is_org_member()` が false で RLS 拒否 → 破棄 → チェックポイントで device 行が
ローカルからも消える → それを FK 参照する shift_session も 23503 で破棄・巻き戻し →
ShiftGate に戻される。次回起動時は `ensureDeviceRow`（App.tsx / device.ts）が自己修復する。
0016 適用でスタッフ端末も同経路が塞がる。**この巻き戻しクラスの恒久対策は P1-3 の可視化。**

## 1. 即時ワークアラウンド（コード変更なし・ユーザー向け、実装者は読み飛ばし可）

`/setup` は認証ガード外のルートなので、URL 直打ちで端末を再設定できる:
アプリの URL の末尾に `/setup` を付けて開く → 「個人端末」→ 自分（モーリー（オーナー））を
選ぶ → この設定で始める。Setup の個人端末ピッカーは owner を除外していない
（`Setup.tsx:59` は `!member.is_device` のみ）ので、これで ShiftGate は
`personalStaff` 経路（`ShiftGate.tsx:29-34`）に入り、引き継ぎ確認 → シフト開始まで通る。

## 2. P0 — 実装タスク

### P0-1: ShiftGate のシフト担当リストにオーナーを含める

- `apps/staff/src/routes/ShiftGate.tsx:28` のフィルタを `!member.is_device` のみにする。
- 誤前提を書いたコメント（26-27行）を削除し、正しい理由を書く:
  「3人の宿ではオーナーもシフトに入る。is_device アカウントだけ除外」。
- 表示は既存の role ラベル（96-97行: オーナー/スタッフ）がそのまま効くので追加UI不要。
- **受け入れ条件**: デモモードで、共有モード端末の ShiftGate にオーナー行が表示され、
  タップ → 引き継ぎ確認 → シフト開始 → メイン画面に入れる。

### P0-2: ログイン（OTP）の UX 修復

`apps/staff/src/routes/Login.tsx`:

1. **エラーの日本語化マッピング**。`verifyCode`/`signInWithEmail` の error.message を
   そのまま出さず、既知パターンを変換:
   - `Token has expired or is invalid` →
     「コードが正しくないか、期限切れです。**最後に届いたメールのコード**を入力してください。
     （新しいコードを送ると、前のコードは無効になります）」
   - `Email rate limit exceeded` / `over_email_send_rate_limit` →
     「送信回数の上限に達しました。数分待ってからもう一度お試しください。」
   - その他 → 「ログインに失敗しました。」＋原文を小さく併記（サポート用）。
2. **「コードを再送する」ボタン**をコード入力画面に追加（60秒クールダウン、
   `useState` + `setTimeout` で十分。再送成功時に「新しいコードを送りました。
   以前のコードは使えません」と表示）。
3. 入力欄の説明文に「最新のメールのコードのみ有効です」を常設。
- **受け入れ条件**: デモモードでは auth 画面は出ないため、この画面のみ
  `pnpm --filter @kraft-base/staff dev` + 手動で `configured` 状態を再現するか、
  ユニットテスト（エラーマッピング関数を純関数に切り出して vitest）で担保。
  マッピング関数は `src/lib/authErrors.ts` として切り出し、テストを書く。

### P0-3: Setup の初期値の罠を除去

`apps/staff/src/routes/Setup.tsx:11` — `useState<DeviceMode>('shared')` により、個人の
Mac/スマホでも無自覚に「共有（受付iPad）」で作られ、autoLockMin=5 の自動ロックまで付く。

- 初期値を `useState<DeviceMode | null>(null)` にし、**どちらかを明示的に選ぶまで**
  下のフォームと開始ボタンを出さない（`disabled={mode === null || ...}`）。
- 選択肢の説明文を補強: 共有=「受付に置く端末（自動ロックあり）」、
  個人=「自分専用のスマホ/PC」。
- **受け入れ条件**: 初期表示でどちらも未選択・ボタン無効。選ぶと進める。
  typecheck が null 分岐を強制するので既存 submit の null ガードを追加。

### P0-4: 端末設定への導線（「あとから変更できます」を本当にする）

現状 `/setup` への UI 導線が無い（Setup.tsx:34 の文言が嘘になっている）。

- ShiftGate の名前選択画面の最下部に控えめなリンク「端末の設定を変更」→ `navigate('/setup')`。
- Setup は既存 config があれば現行値を初期値にする（`readDeviceConfig()` を初期 state に使う。
  この場合 P0-3 の「未選択」初期値は**新規設定時のみ**適用）。
- 再設定時は deviceId を維持する（`registerDevice` は毎回 `uuid()` を振るので、
  既存 config がある場合は同じ deviceId で device 行を UPDATE する分岐を `lib/device.ts` に足す —
  `upsertDevice(config)` として registerDevice と共通化）。deviceId が変わると過去の
  shift_session/worktime との紐付きが切れるため。
- **受け入れ条件**: デモモードで 共有→個人 に切り替えても deviceId が変わらず、
  worktime 集計が引き継がれる。

## 3. P1 — 同期巻き戻しの可視化（silent revert 対策の本丸）

`connector.ts:56-59` は恒久エラー(22/23/42)を console.error だけで破棄する。ユーザーには
「操作が勝手に消えた」ようにしか見えず、今回のような調査が毎回難航する。

- `src/lib/syncAlerts.ts` を新設: 破棄発生時に `{table, op, code, message, at}` を
  in-memory ストア（+ localStorage に直近20件リングバッファ）へ push、簡単な
  subscribe/notify（useSyncExternalStore で購読）。
- connector の破棄分岐からこれを呼ぶ。
- `SyncBadge` に破棄件数バッジを追加。タップで直近の破棄一覧（テーブル名と時刻だけの
  シンプルなリスト）を表示 → スクショ1枚で原因調査が可能になる。
- **受け入れ条件**: vitest で syncAlerts の push/subscribe/リングバッファを担保。
  デモモードは upload 自体が走らないため UI はモック挿入で確認。

### P1-2（追補 2026-07-09）: 拒否バッジを ShiftGate にも表示する

実戦で判明した穴: バッジは AppShell ヘッダー（メイン画面）にしか出ないため、
「シフト開始→巻き戻し」ループに嵌っている本人は**バッジに到達できない**
（メイン画面に入った一瞬しか見えない）。まさに調査が必要な人が見られない配置。

- ShiftGate の名前選択画面と引き継ぎ確認画面の下部に、syncAlerts が非空のとき
  だけ出る小さな警告行（「同期されなかった変更が N件あります」＋展開で一覧）を追加。
  SyncBadge から一覧部分を切り出して共用（`SyncAlertList` コンポーネント化）するのが素直。
- **受け入れ条件**: モックで alerts を注入した状態で ShiftGate に一覧が出る。
  demo モード（canConnect false）では表示ロジックごと出ない。

### P0-5（追補 2026-07-09）: ビルド番号を Login 画面にも常時表示

実戦の教訓: オーナーのMacが **6/15以前の化石ビルド**（SW未更新）を動かし続けており、
「修正が効かない」報告の正体だった。スクショから年代を特定するのに、廃止済み文言の
git 考古学が必要になった。ビルド番号が全画面スクショに写っていれば一瞬だった。

- Setup 最下部の `build {__APP_BUILD__}` 表示（Setup.tsx:96 相当）と同じものを
  Login 画面の最下部にも置く。控えめに `text-[0.68rem] text-ink-mute` センタリング。
- **受け入れ条件**: /login のスクショに必ずビルド番号が写る。
- 備考: SW自動更新（SWUpdater）は導入済みのため、全端末が一度現行ビルドに乗れば
  化石化は再発しない。これは「乗ったことの確認手段」の恒久化。

## 4. オーナー（人間）の作業 — コードと独立

1. **0016 を本番 Supabase で実行**（未実行なら。受付iPad の device 書き込み許可）。
2. **Supabase Auth 設定の確認**（ダッシュボード → Authentication）:
   - Email OTP の有効期限（Email OTP Expiration）が短すぎないか（3600秒推奨）。
   - メールテンプレートに `{{ .Token }}`（数字コード）が含まれているか。
   - **独自 SMTP（Resend 等）の設定を強く推奨** — Supabase 標準メールは遅延・不達が多く、
     モーリーの「メールが届かない」ログイン問題の温床。設定手順は Supabase docs
     「Custom SMTP」。※予約サイトの注文確認メール（モーリー③）は別システムなので対象外。

## 5. 検証ゲート

1. `pnpm format && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全green。
2. デモモード e2e（`apps/staff/e2e/` の既存ハーネス）:
   - 新規シナリオ: 共有端末で**オーナー名**を選んでシフト開始 → Today 表示（P0-1）。
   - 既存シナリオ回帰: スタッフ名でのシフト開始、キオスク経路。
3. Login のエラーマッピングは vitest（`authErrors.test.ts`）。
4. デプロイは PR → CI green → master マージ（Vercel 自動）。

## 6. やらないこと（スコープ外）

- オーナー専用の「シフトなし管理モード」（RequireApp の activeSession ゲート緩和）は
  今回見送り。オーナーもシフトを開始すれば全機能に届くため。roadmap 検討事項として残す。
- 配達/注文/決済系（モーリー①〜④の②③④）は別システム。本リポジトリの対象外。
