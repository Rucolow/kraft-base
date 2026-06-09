// Emits supabase/seed_content.sql from the single seed source (src/content/seed.ts).
// Run: node --experimental-strip-types scripts/gen-content-seed.ts

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedContent, seedTasks } from '../src/content/seed.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'supabase', 'seed_content.sql');

const q = (value: string | null): string =>
  value === null ? 'null' : `'${value.replace(/'/g, "''")}'`;

const taskValues = seedTasks
  .map(
    (task) =>
      `    (gen_random_uuid(), ${q(task.title)}, ${q(task.group)}, ${q(task.phase)}, 'manual', false, now())`,
  )
  .join(',\n');

const contentValues = seedContent
  .map(
    (item) =>
      `  (gen_random_uuid(), ${q(item.kind)}, ${q(item.slug)}, ${q(item.title)}, ${q(item.body)}, ${q(item.phase)}, ${q(item.lang)}, '{}', ${q(item.status)}, now())`,
  )
  .join(',\n');

const sql = `-- Generated from src/content/seed.ts (scripts/gen-content-seed.ts). Do not edit by hand.
-- Manual-derived content and checklists (spec §7.0/§11). Apply after seed.sql.

do $$
begin
  if not exists (select 1 from public.task where source = 'manual') then
    insert into public.task (id, title, "group", phase, source, done, created_at) values
${taskValues};
  end if;
end $$;

insert into public.content (id, kind, slug, title, body, phase, lang, photo_paths, status, updated_at) values
${contentValues}
on conflict (slug) do nothing;
`;

writeFileSync(out, sql);
process.stdout.write(`wrote ${out}\n`);
