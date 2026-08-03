-- 写真のSNS掲載可否（R7）。キオスク（本人）またはスタッフ（口頭確認）が記録する。
-- null = 未確認。運用の既定は「ok が付いた組以外は掲載しない」なので、表示上の
-- 行動シグナルは ok のみ（GuestCard は 📷OK バッジだけを出す）。
--
-- 権限追加は不要: guest_update は 0014 で org member に緩和済み（キオスクが
-- status='arrived' を書いているのと同じ経路）。sync-rules も SELECT * のため不要。
-- クライアント側は schema.ts への列宣言が必須（reservation_name の教訓）。

alter table public.guest
  add column if not exists photo_consent text
  check (photo_consent in ('ok', 'ng'));
