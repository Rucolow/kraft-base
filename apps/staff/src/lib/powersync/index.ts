import { PowerSyncDatabase } from '@powersync/web';
import { SupabaseConnector, canConnect } from './connector';
import { AppSchema } from './schema';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'kraftbase.db' },
});

let started = false;

export async function startPowerSync(): Promise<void> {
  if (started) {
    return;
  }
  started = true;
  await db.init();
  if (canConnect()) {
    await db.connect(new SupabaseConnector());
  }
}

export * from './schema';
