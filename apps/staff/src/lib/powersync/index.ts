import { PowerSyncDatabase } from '@powersync/web';
import { SupabaseConnector, canConnect } from './connector';
import { AppSchema } from './schema';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'kraftbase.db' },
  // Run SQLite on the main thread instead of a dedicated worker. The bundled
  // worker can fail to start on iOS Safari, leaving the client connected but
  // never completing the initial sync. The dataset is small, so the main-thread
  // cost is negligible and this is reliable across browsers.
  flags: { useWebWorker: false },
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
