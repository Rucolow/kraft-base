-- koguchi-bento contract v3: reservation_name (契約 13 → 14 列).
--
-- The inn-booking name a customer gives when ordering a bento — the missing
-- signal for matching an order to a stay. Free text exactly as the customer
-- typed it (trimmed, <=60 chars): NOT normalised, so 全角/半角 spaces and
-- 漢字/ローマ字 differences survive. null where it was never captured (pre-v3
-- rows, abandoned carts). koguchi's operators may correct it later, which
-- arrives as a normal update.
--
-- Writer-writable like the rest of the mirror; guest_id/match stay off-limits
-- (privilege level + bento_order_guard trigger). Room numbers are deliberately
-- NOT mirrored — they are assigned on the day.
--
-- Idempotent: this was applied to production ahead of the repo, so re-running
-- must be a no-op. Verified live before writing this file — the column exists,
-- and bento_writer holds both select and update on it.

alter table public.bento_order add column if not exists reservation_name text;

grant select on public.bento_order to bento_writer;
grant insert (reservation_name) on public.bento_order to bento_writer;
grant update (reservation_name) on public.bento_order to bento_writer;
