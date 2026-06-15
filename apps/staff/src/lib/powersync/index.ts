import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web';
import { SupabaseConnector, canConnect } from './connector';
import { AppSchema } from './schema';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  // OPFS-based storage for Safari/iOS reliability. The default IndexedDB VFS can
  // fail to persist on iOS Safari, leaving the client connected but stuck before
  // the initial sync completes. OPFSCoopSyncVFS works on Safari without needing
  // cross-origin isolation headers.
  database: new WASQLiteOpenFactory({
    dbFilename: 'kraftbase.db',
    vfs: WASQLiteVFS.OPFSCoopSyncVFS,
  }),
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
