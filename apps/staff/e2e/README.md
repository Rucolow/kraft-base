# e2e — demoモードのブラウザ検証ハーネス

本番の顧客データに触れず、**envなし（=demoモード、架空データ自動シード、認証スキップ）**で
アプリ全体をヘッドレスブラウザで実操作する検証群。ここにあるスクリプトは実戦投入済みで、
本セッションの本番バグ（04:00境界・データ消失・白画面ほか）はすべてこのループで再現→修正確認した。

## 実行方法

```bash
pnpm --filter @kraft-base/staff build
cd apps/staff && pnpm exec vite preview --port 4173 --strictPort &   # 別プロセスで
node e2e/sweep.cjs          # 全ルート巡回（クラッシュ/コンソールエラー検知）
node e2e/sim_verify.cjs     # 中核回帰: データ消失/キャンセル数/タスク削除/チェックイン再入力
node e2e/checkin_multi.cjs  # 複数名チェックイン（人数分名簿・住所引き継ぎ・再入力復元）
node e2e/minor.cjs          # 辞書遅延作成/商品価格blur/忘れ物終了確認
node e2e/interact.cjs       # 台帳CRUD/辞書ドリルダウン/スタッフ権限
node e2e/roundtrip.cjs      # ゲスト編集ラウンドトリップ（その他入力・ベッド・弁当）
```

- 判定: 各スクリプトが `RESULT: n/n passed` と **console errors 0** を出せば緑。
- Chromium パスは各スクリプト先頭の `CHROME` 定数（クラウド検証環境の
  `/opt/pw-browsers/chromium-1194/...`）。ローカル/CIでは環境に合わせて書き換えるか、
  `playwright-core` を devDependency に足して `chromium.launch()`（executablePathなし）にする。
- `_pw.cjs` が playwright-core をリポジトリ→クラウド環境の順で解決する。

## ハーネスの既知の落とし穴（テストを書く/直す人へ）

1. **ビルド必須**: preview は `dist/` を配る。ソースを変えたら `build` し直さないと古い挙動を検証してしまう。
   （過去に一敗: PR#22 相当の修正が「効かない」ように見えた）
2. **`waitUntil:'networkidle'` は SW/外部フェッチで遅延・不安定**。描画到達は
   `domcontentloaded` + 要素 `waitFor` で測る・待つ。
3. **書き込み直後の遷移はレースする**: ローカル書き込み→監視クエリ反映は一拍遅れる。
   URL遷移は `waitUrl(条件)` ポーリングで待つ（各スクリプトの `wU`/`waitUrl` を使う）。
4. **`getByPlaceholder('自由入力')` は「言語（自由入力）」にも部分一致**する等、
   プレースホルダ・ラベルの部分一致に注意（`{exact:true}` を付ける）。
5. **プレースホルダは innerText に出ない**。表示検証を本文テキストで行うときは実値で。
6. **ボタン名 `編集` は本文の説明文にもヒット**しうる。`getByRole('button',{name,exact:true})`。
7. **demoの3座席**: ルッコロー(owner)/モーリー(staff)/日中スタッフ(staff)。Weber(2名)/Rossi(1名)/
   Schmidt(1名,遅着) がシードゲスト。**複数名チェックインの単体検証に Weber を使うと2人目必須**
   になるので、1名系は Rossi/Schmidt を使う。
8. **良性エラーのフィルタ**: サンドボックスでは Google Fonts が到達不能で
   `net::ERR_FAILED`（fonts.googleapis.com）が出る。これは想定内。フィルタ正規表現に含めるか無視。
9. **OPFS はヘッドレス起動ごとに白紙**（実ブラウザでは永続）。テストは毎回セットアップから入る前提。
   逆に「永続を跨ぐ」挙動（SW更新・OPFS保持）はこのハーネスでは検証できない → L4実機。
10. **時間依存**: 04:00 JST 境界・日付表記はコンテナ時刻に依存。境界近傍(JST 03:30-04:30)の
    実行は結果が揺れるので避けるか明示的に扱う。

## 検証できないもの（＝L3本番観測・L4実機・L5使い捨て環境が必要）
- 実 Supabase/PowerSync への同期（アップロード受理・RLS拒否・配列/bool型変換）
- 認証フロー（OTP・トークン更新・オフライン猶予の実挙動）
- SWの実更新サイクル・iOS(WebKit) 固有挙動
→ 5層の分担は `docs/plan-verification-system.md`。L5手順は `apps/staff/supabase/staging/VERIFY-sync-rls.md`。
