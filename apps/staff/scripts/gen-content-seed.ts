// Emits supabase/seed_content.sql from the single seed source (src/content/seed.ts).
// Run: node --experimental-strip-types scripts/gen-content-seed.ts
//
// --migration prints (to stdout, nothing written) the DELETE→INSERT block for a
// migration that re-seeds the routine task list, e.g. 0026. Paste the output into
// the migration file. R12: the task list lives in ONE place (content/seed.ts) and
// both the fresh-install seed and the re-seed migration are generated from it.
// Run: node --experimental-strip-types scripts/gen-content-seed.ts --migration

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedContent, seedTasks } from '../src/content/seed.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'supabase', 'seed_content.sql');

const q = (value: string | null): string =>
  value === null ? 'null' : `'${value.replace(/'/g, "''")}'`;

// created_at is nudged 1ms per row so ORDER BY sort, created_at is stable even
// if two rows ever share a sort (now() is identical for the whole statement).
const createdAt = (index: number) => `now() + interval '${index + 1} milliseconds'`;

const taskValues = seedTasks
  .map(
    (task, index) =>
      `    (gen_random_uuid(), ${q(task.title)}, 'daily', null, ${q(task.slot)}, ${task.sort}, 'manual', false, ${createdAt(index)})`,
  )
  .join(',\n');

const contentValues = seedContent
  .map(
    (item) =>
      `  (gen_random_uuid(), ${q(item.kind)}, ${q(item.slug)}, ${q(item.title)}, ${q(item.body)}, ${q(item.phase)}, ${q(item.lang)}, '{}', ${q(item.status)}, now())`,
  )
  .join(',\n');

if (process.argv.includes('--migration')) {
  process.stdout.write(`-- 生成物: scripts/gen-content-seed.ts --migration（src/content/seed.ts が正本）
delete from public.task where source = 'manual';

insert into public.task (id, title, "group", phase, slot, sort, source, done, created_at) values
${taskValues.replace(/^ {4}/gm, '  ')};
`);
  process.exit(0);
}

const sql = `-- Generated from src/content/seed.ts (scripts/gen-content-seed.ts). Do not edit by hand.
-- Manual-derived content and checklists (spec §7.0/§11). Apply after seed.sql.

do $$
begin
  if not exists (select 1 from public.task where source = 'manual') then
    insert into public.task (id, title, "group", phase, slot, sort, source, done, created_at) values
${taskValues};
  end if;
end $$;

insert into public.content (id, kind, slug, title, body, phase, lang, photo_paths, status, updated_at) values
${contentValues}
on conflict (slug) do nothing;
`;

writeFileSync(out, sql);
process.stdout.write(`wrote ${out}\n`);
