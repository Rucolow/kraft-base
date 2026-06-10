-- Initial in-house sale catalogue. Apply after migration 0010. Idempotent on name.
insert into public.product (id, name, sell_price, cost, sort) values
  (gen_random_uuid(), '熊野古道水', 150, 39, 0),
  (gen_random_uuid(), 'アクエリアス', 200, 95, 1),
  (gen_random_uuid(), 'コカ・コーラ', 200, 116, 2),
  (gen_random_uuid(), 'カタカタラムネ', 200, 65, 3),
  (gen_random_uuid(), 'スーパードライ', 400, 188, 4),
  (gen_random_uuid(), 'タコハイ', 300, 115, 5),
  (gen_random_uuid(), 'レモンサワー', 300, 108, 6),
  (gen_random_uuid(), 'カップヌードル', 300, 128, 7),
  (gen_random_uuid(), 'カレーメシ', 400, 198, 8),
  (gen_random_uuid(), 'ポテトチップス', 200, 98, 9),
  (gen_random_uuid(), 'プリッツ', 200, 98, 10),
  (gen_random_uuid(), 'ミックスナッツ', 200, 93, 11),
  (gen_random_uuid(), 'どら焼き', 150, 50, 12)
on conflict (name) do nothing;
