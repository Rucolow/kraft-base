-- R14: 定型タスクに 1 段のサブタスク（親子）を持たせる。
--
-- ■ 適用タイミングは不問（04:00 制約なし）。既存行のデータを一切書き換えず、
--   NULL 許容の列を 1 本足すだけ。`add column if not exists` なので再実行も安全。
--
-- ■ sync-rules の変更もフル再同期も不要: PowerSync のクエリは `SELECT *` なので
--   新しい列はそのまま流れてくる。クライアント側は schema.ts に列を宣言すれば
--   既存行に NULL として現れる（`serialize.ts` は触らない）。
--
-- ■ 列 GRANT は据え置き（0026 の done/done_at/title/slot/sort のまま）。
--   再ペアレンティング（親の付け替え）は R14 のスコープ外なので `parent_id` を
--   UPDATE 可能にしない。子は INSERT 時に親が決まり、変えたければ消して作り直す。
--
-- ■ ON DELETE CASCADE は**サーバ側のバックストップ**。クライアントは
--   `removeTaskTree` で自分の手で子 → 親の順に消す（ローカル SQLite に FK CASCADE は
--   無く、デモ／e2e はサーバ無しで動くため）。
--
-- ■ 自己参照の防止だけ CHECK で固定する（孫を作らないのは UI 側の責任）。

alter table public.task
  add column if not exists parent_id uuid references public.task (id) on delete cascade;

alter table public.task drop constraint if exists task_parent_not_self;
alter table public.task add constraint task_parent_not_self
  check (parent_id is null or parent_id <> id);

create index if not exists task_parent_idx on public.task (parent_id);
