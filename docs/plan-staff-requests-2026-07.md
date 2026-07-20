# 実装計画: モーリーの改善依頼3件（退勤ボタン・チェックイン時間未定・カレンダー）

対象実装者: opus4.8。ステータス: **計画のみ（未実装）**。敵対レビュー済み（§6）。
関連: `docs/engineering-principles.md`（§2 ローカルファースト法則・§4 RLS↔UI表・§5 キオスク聖域）、
`docs/plan-verification-system.md`（検証5層）。

## 0. 依頼原文（2026-07-14 モーリー）

> ①スタッフの退勤をボタンで行うことできますか？僕にラインを送ってくるのが区切りみたいに
> なっているので仕事終了ボタンで「終了！！」にできると良いなと思っています。
> ②チェックイン時間を入力するところに未定を記入することできますか？（ゲストを登録するところで）
> ③今8月までのゲストがうち終わっているのですが、カレンダー表記でも見ることできますか？
> そこでスタッフのシフト管理などもできると嬉しいです。

## R1. 退勤ボタン（規模S・FEのみ・最優先）

### 現状と実害
`endActiveSession` の呼び出しは (a) 同一端末で別の人がシフト開始したとき（置換）、
(b) 04:00境界越えの自動クローズ（`closeStaleSessions`、**次回アプリ起動時**に発火）のみ。
**明示的に退勤する手段が存在しない**。結果:
- スタッフは「終わった」をLINEで伝えるしかない（依頼の背景）。
- 勤怠（WorkTime）が膨張する: 誰も交代しない日は ended_at が翌日の起動時刻になり、
  実働と乖離する。**R1は機能追加であると同時に勤怠データの正確性修正**。

### 設計
1. `lib/shiftOps.ts` に `endShift(deviceId, staffId, staffName)` を追加:
   `endActiveSession(deviceId)` ＋ timeline_entry INSERT
   `{kind:'system', body:'退勤 {staffName}（終了！！）', author_id: staffId}`。
   「終了！！」はモーリーの希望表現をそのまま採用（引き継ぎ/タイムラインで彼が見る）。
2. UI: **ShiftGate** に配置。ヘッダーの名前タップ→/shift が既存導線なのでそこが自然。
   - 共有端末（roster画面）: `activeSession` があるとき、名簿の上に
     「現在のシフト: {name}」カード＋**「シフトを終了する（退勤）」**ボタン。
   - 個人端末（digest画面）: 同様に activeSession があるときボタンを表示。
   - タップ → `window.confirm('シフトを終了しますか？')` → endShift →
     その場に「お疲れさまでした！終了！！」の完了表示（rosterに戻れる）。
3. 二重タップガード（busy state）。
4. RLS: shift_session UPDATE = org member ✓ / timeline_entry INSERT = org member ✓
   → **サーバー作業ゼロ**。

### 受け入れ条件
- demo e2e（owner_shift.cjs 拡張）: シフト開始 → /shift → 退勤 → activeSession 消滅
  → RequireApp が /shift へ →再度開始できる。timeline（/handover）に「退勤」行。
- 勤怠: 退勤した日の WorkTime の分数が start→end 実時間になる。
- キオスク聖域: /checkin には一切触れない ✓（変更ファイルが ShiftGate/shiftOps のみ）。

## R2. チェックイン時間「未定」（規模S・FEのみ）

### 現状
`guest.checkin_time` は text・null可。全使用箇所が文字列扱いで、時刻としての
パースは無い（確認済み: 一覧は `IN {time・bed}` 連結、詳細は raw 表示、ソートは
`COALESCE(checkin_time,'~~')` の文字列ソート）。null は「未入力」として表示省略。

### 設計（サンチネル方式・DB変更なし）
1. GuestEdit の時間入力の横に**「未定」トグルボタン**（BEDSボタンと同トーン）。
   - ON: `checkin_time = '未定'` として保存。時間 input は無効化＆クリア。
   - ロード時 `checkin_time === '未定'` → トグルON。
   - OFF に戻す → input 再有効化（null保存に戻る）。
2. 表示は既存ロジックのまま自然に動く: 一覧「IN 未定・3番」、詳細「未定」。
3. ソート: '未定'（UTF-8で '~~' より大）は**その日の末尾**に落ちる。時刻あり→未入力
   →未定 の順。運用上妥当（時刻確定ゲストを上に）なので許容し、ここに明記。

### 採らなかった案
- **boolean列追加**（migration＋serialize＋オーナーSQL）: 表示ニュアンスのために
  重すぎる。却下。
- **null をそのまま「未定」と表示**: 「聞いたが未定」と「まだ聞いてない」の区別が
  消える。3人運用でも一覧の情報価値が下がるため却下。

### 受け入れ条件
- e2e（roundtrip.cjs 拡張）: 未定ONで作成→一覧に「IN 未定」→編集で
  トグルON状態が復元→OFFにして時刻入力→通常動作に戻る。

## R3. カレンダー（③）— 2段階に分割

### R3a. ゲストの月カレンダー表示（規模M・FEのみ・先行）

**根拠**: 8月分まで入力済みのデータが既にあり、`stay_date`（'YYYY-MM-DD' text）で
全件同期済み（global bucket）。**純フロントで実現可能**。

1. /guests に第3のタブ **「カレンダー」**を追加（今日/これから先/カレンダー）。
2. 月グリッド（月〜日 7列）。各セル: 日付＋**組数バッジ**＋先頭ゲスト名（430px幅では
   組数のみ、md以上で名前も）。キャンセルは組数から除外（既存 isActive 流用）。
3. セルをタップ → その日のゲスト一覧（既存の「これから先」の日別グルーピング表示を
   流用したリスト）へスクロール or 下部に展開。
4. 月ナビ（前月/翌月、初期値=今月）。WorkTime の addMonth/monthLabel を共通化
   （`lib/month.ts` に抽出）して再利用。
5. 過去月も stay_date クエリで表示可能（同期済み範囲）。

**受け入れ条件**: demo e2e 新設: カレンダータブ→シードゲストの日にバッジ→タップで
名前が見える。既存タブの回帰なし（sweep 巡回対象に追加）。

### R3b. スタッフのシフト予定管理（規模L・DB＋インフラ・オーナー判断待ち 🔶）

「予定シフト」（rota）は既存の shift_session（**実績**）とは別物。新ドメインになる:

1. **新テーブル** `shift_plan`:
   `id uuid PK / date text 'YYYY-MM-DD' / staff_id uuid FK staff / note text /
    created_by uuid / created_at timestamptz`。
2. **RLS**: SELECT = org member。INSERT/UPDATE/DELETE = 🔶要オーナー判断
   （オーナーのみが組むか、スタッフも自分の希望を置けるか）。
3. **インフラ（ここが重い）**: publication への追加＋**PowerSync ダッシュボードの
   sync rules へのテーブル追加＋Deploy**。sync rules 変更は re-snapshot を誘発し得る
   → 営業時間外に実施、`docs/plan-verification-system.md` の L5（使い捨てリハ）または
   L3（デプロイ後観測）で確認。クライアント schema.ts / staging/schema.sql も追随。
4. **UI**: R3a のカレンダーセルにスタッフ名チップを重ねる。編集はセル タップ→
   その日のシート（ゲスト一覧＋シフト割当）で名前を選ぶ。
5. serialize: 対象列は text/uuid のみ→変換マップ変更なし（配列・boolを足さないこと）。

**🔶 オーナー判断事項（実装前に確定）**:
- 誰がシフト予定を編集できるか（owner only / 全員）
- 1日に複数人・時間帯ラベル（早番/遅番等）は必要か、名前だけでよいか
- LINE等への通知連携は不要でよいか（本計画では通知なし＝アプリ内表示のみ）

### 実装順序
R1 → R2 → R3a（ここまで一括PR可、全てFEのみ）→ 🔶回答後に R3b（別PR＋オーナーSQL＋
PowerSyncダッシュボード作業）。

## 5. 検証
- 各Rの受け入れ条件（上記）＋ CI e2e 8スイート緑維持。
- R3b のみ L3/L5 プロトコル対象。R1/R2/R3a はサーバー無関係（L1+L2で完結）。

## 6. 敵対レビュー結果と反映

（レビュー実施後に追記）
