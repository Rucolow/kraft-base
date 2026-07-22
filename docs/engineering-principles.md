# エンジニアリング原則 — KRAFT BASE スタッフアプリ

**読者**: このリポジトリで実装を行うAI/人間（特に Opus 4.8 での実装セッション）。
**目的**: 本セッションで実バグとして踏んだ地雷を成文化し、二度と踏ませない。
ここにある規則は好みではなく、**破ると本番で壊れた実績のある不変条件**。

---

## 0. プロダクト前提（設計判断の物差し）
- 利用者は**3人の宿（熊野古道のゲストハウス）**。非ITスタッフ・古いiPad・不安定な宿wifi。
- したがって: 単純 > 巧妙。オフラインで動くことが根幹公約。日本語UI。1画面1目的。
- 検証の哲学: **「AIが自分でブラウザを操作して確かめる」**。demoモード（env空）＋
  `apps/staff/e2e/` が正規の検証ループ。マージ前にコンソールエラー0を確認する。

## 1. シフト日 = 04:00→04:00 JST（暦日ではない）
- 業務上の「今日」は `shiftDate()` / `shiftBoundaryIso()`（`lib/date.ts`）。
  **業務データに `jstDate()` を使うと深夜0-4時に壊れる**（実績: 夜勤がシフト開始不能になった）。
- 境界値を **mount時に固定してはならない**。受付iPadは何日も開きっぱなし
  （実績: `useMemo(()=>shiftBoundaryIso(),[])` で日次リセットが永久に走らなかった。
  現在は `session.tsx` がタイマー+focus で進める）。
- 回帰テスト: `lib/date.test.ts` が 03:59/04:00 境界・月跨ぎを固定済み。日付ロジックを
  触ったら必ず通すこと。

## 2. ローカルファースト書き込みの三律
PowerSync は書き込みを即ローカル反映→非同期アップロードする。ゆえに:
1. **書いた直後のデータを前提に遷移しない**。監視クエリ(useQuery)の反映は一拍遅れる。
   遷移は「クエリに現れたら」を effect で待つ（実績: シフト開始が /shift に弾き返された）。
   ルーティング判定は `isLoading` 中に行わない（実績: リロードで弾かれた）。
2. **UIの権限ゲートは RLS と寸分違わず一致させる**。サーバーが拒否した書き込みは
   コネクタが破棄し、**黙って巻き戻る**（実績: daily_reset 403 で同期全停止→破棄方式に変更、
   以降は「UIが許すのにRLSが拒む」書き込み＝サイレント消失。受付iPadの device 行が
   これで永久に同期されない疑いが現在も残る→ 0016 待ち）。
   **新しい書き込み経路を作ったら、必ず migrations の grant + policy を目視確認**すること。
3. **複数行の初期化/一括書き込みは `db.writeTransaction`**。個別 execute はコミット境界が
   ないため監視クエリに見えないことがある（実績: demoシードが全画面で不可視だった）。

## 3. 型インピーダンス表（ローカルSQLite ⇄ Postgres）
| 種別 | ローカル | Postgres | 変換箇所 |
|---|---|---|---|
| 真偽値 | integer 0/1 | boolean | `lib/powersync/serialize.ts`（本番適用済み） |
| 配列 | JSON文字列 `'["a"]'` | uuid[] / text[] | 同上 |
- 対象列の正本は `serialize.ts` の `BOOLEAN_COLUMNS` / `ARRAY_COLUMNS`＋`serialize.test.ts`。
- **マイグレーションで boolean/配列列を足したら、このマップとテストを必ず更新**。
  忘れるとその列だけサイレント同期失敗が再発する。

## 4. RLS↔UI 対応表（2026-07 時点の正）
| テーブル/操作 | RLS | UI側ゲート |
|---|---|---|
| guest INSERT/DELETE | owner | 追加/削除UIは isOwner |
| guest UPDATE | **org member**（0014でstatus変更のため開放） | 編集フォームは isOwner（UIのみの絞り） |
| task INSERT | org member (0013) | 全員追加可 |
| task UPDATE | org member・**列grantは done/done_at のみ** (0006) | チェックのみ。タイトル編集UIを作るならgrant拡張が先 |
| task DELETE | owner | 削除ボタンは isOwner |
| checkin_record INSERT | org member | 誰でも記入可（再入力含む） |
| checkin_record UPDATE/DELETE | owner | 修正UIは未実装（再入力=新規INSERTで代替） |
| device INSERT/UPDATE | **owner（受付iPadが書けない問題→0016で org へ、未適用）** | Setupは無ゲート |
| staff 自己claim | 未claim行なら誰でも (0011)。0015で「owner行は初回のみ」に封鎖したが**この宿はオーナーが2人**（ルッコロー＋モーリー）→2人目がclaim不能になり誤爆。**0017で0011に戻した**（許容リスク：owner行は既存ownerしか作れず、招待メールがなければこの画面にすら到達しない） | LinkAccountのUIガードも撤去（同PR） |
| content INSERT/UPDATE | org member。**DELETEポリシーなし** | 削除UIを作るならRLS追加が先 |
| shift_plan SELECT | org member (0018) | シフトビューは全員閲覧可 |
| shift_plan INSERT/UPDATE/DELETE | **owner** (0018) | 追加/削除/期間一括/前週コピーのUIは isOwner のみ表示（GuestCalendar） |
| bento_order SELECT | org member (0019) | 弁当パネルは全員閲覧可 |
| bento_order UPDATE | org member・**列grantは guest_id/match のみ** (0019)。他列は koguchi の bento_writer ロール専用＋stale-writeガードトリガー | 照合UI（BentoOrders）のみ。INSERT/DELETE はクライアントから不可 |

## 5. キオスク（/checkin）の聖域規則
ゲストがiPadを持っている画面。**いかなる自動遷移もここでは起こしてはならない**:
- auto-lock は /checkin でアームしない（実装済み・App.tsx）
- SW更新チェック/リロードは /checkin 中スキップ（実装済み・SWUpdater）
- スタッフ画面への出口は長押しのみ（実装済み）。**未解決: ブラウザ/PWAの戻る操作**（W3）。
- 新しいグローバル副作用（トースト、モーダル、タイマー遷移）を足すときは必ず
  「/checkin中はどうなるか」を確認すること。

## 6. PWA/SW の規則
- `registerType:'autoUpdate'` ＋ `SWUpdater`（1時間毎+復帰時に update()）が正。
  受付iPadはナビゲーションが起きないため**ブラウザ任せでは更新が来ない**（実績: 旧ビルド居座り事件）。
- precache は**実行時に読まれる資産のみ**（wa-sqlite は sync 変種1本。`globIgnores` 済み。
  依存更新でファイル名が変わったら `e2e` の起動が壊れてないかと sw.js のマニフェストを確認）。
- 外部オリジン（フォント等）は render-blocking にしない＋runtimeCaching。
  **オフラインファーストのアプリに、描画を止める外部依存を足さない**（実績: 初回描画13秒）。
- Setup画面の `build __APP_BUILD__` で稼働ビルドを確認できる。

## 7. 認証ライフサイクル
- PowerSync 再接続は **SIGNED_IN イベントのみ**（INITIAL_SESSION/TOKEN_REFRESHED で
  張り直すと毎時同期が切断される）。
- SIGNED_OUT で `wipePowerSync()`（共有端末に名簿PIIを残さない）。
- オフライン冷起動は `offlineGrace`（保存セッションあり＋更新失敗）でローカルに通す。
  この経路を壊すと「圏外でアプリが開けない」が再発する。

## 8. デプロイ/変更管理プロトコル
1. ゲート: `pnpm format && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全通過。
2. demo検証: `pnpm e2e`（全スイート一括・CIでも実行）。個別は `node apps/staff/e2e/<suite>.cjs`。
3. **フロントのみ**の変更 → PR→CI緑→master マージ（Vercelが本番 `kraft-base-staff` を自動デプロイ）。
4. **同期/RLS/認証層** → demo/e2e では検証しきれない層。常設ステージングは作らない方針
   （2026-07決定）。`docs/plan-verification-system.md` §2 の規約に従う: L1/L2 に加え、
   デプロイ後に **L3本番観測**（拒否バッジ・「同期されなかった変更」表示・Supabase API の 4xx ログ）と、
   次回の **L4実機テスト**（オーナーのiPadチェックリスト）で確認。テーブル追加や同期方式変更などの
   大規模変更のときだけ **L5 の使い捨て検証環境**を立てる。
   本番DBへのSQL適用はオーナーの手で（AIは本番DBに触れない）。マイグレーションは連番で
   `apps/staff/supabase/migrations/` に置き、PR本文に適用SQLと L5要否を明記。
5. バグ修正には回帰テストを同梱（純ロジック=vitest、フロー=e2e）。
6. コミット規約: 末尾に Co-Authored-By / Claude-Session 行（リポジトリ慣行）。

## 9. React/実装の地雷リスト（全て実績あり）
- **フックは早期returnより前に**（実績: CheckInが白画面クラッシュ）。biomeは検出しない。
- 監視クエリ結果に依存する effect 内でそのテーブルへ書くと書き込みループの芽（GuestDetail既読処理は要注意箇所）。
- `Number.parseInt(x)||0` は空文字を0にする（実績: 価格が0円化→draft+blur方式に修正済み。同型を作らない）。
- 同一 `created_at` の ORDER BY は不定（実績: 複数名名簿の順序が逆転→1msずつずらす）。
- Biome `organizeImports` / `useExhaustiveDependencies` はビルドを落とす。ignoreは理由コメント必須。
- 検証環境では `Date.now()` 等の非決定要素・外部フォント・SWがベンチを歪める（e2e/README参照）。

## 10. 二重管理ポイント（片方だけ更新すると腐る場所）
| 変えるもの | 連動して更新するもの |
|---|---|
| migrations に boolean/配列列 | `serialize.ts` のマップ＋`serialize.test.ts` |
| migrations 追加全般 | `supabase/staging/schema.sql`（**L5使い捨て環境用**の結合を再生成）。常設の適用先は無し |
| 権限（RLS）変更 | 上の §4 対応表＋UIゲート |
| BEDS/弁当などのプリセット | GuestEdit のパース/保存は**非プリセット値を破壊しない**実装を維持 |
| 新ルート追加 | AppShell タブ設計（モバイル6タブ上限）＋ e2e/sweep.cjs の巡回対象 |
