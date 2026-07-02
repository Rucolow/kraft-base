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
let connector: SupabaseConnector | null = null;
const getConnector = (): SupabaseConnector => {
  connector ??= new SupabaseConnector();
  return connector;
};

export async function startPowerSync(): Promise<void> {
  if (started) {
    return;
  }
  started = true;
  await db.init();
  if (canConnect()) {
    // Local-first: don't hold the UI hostage to the network handshake. The local
    // data is already on disk; sync catches up in the background. Errors here are
    // connection-level (PowerSync retries internally), not fatal to the app.
    db.connect(getConnector()).catch((error) => {
      console.error('PowerSync connect failed (will retry in background)', error);
    });
  }
}

// Re-establish the sync connection with fresh credentials. Called when a session
// appears (after login) so the first sign-in syncs immediately instead of the
// user having to kill and relaunch the app for it to pick up the new token.
export async function connectPowerSync(): Promise<void> {
  if (!canConnect()) {
    return;
  }
  await db.connect(getConnector());
}

export async function disconnectPowerSync(): Promise<void> {
  await db.disconnect();
}

// Sign-out on a shared device must not leave the guest register (passports,
// addresses) sitting in local storage. disconnectAndClear wipes the local DB;
// data re-syncs on the next sign-in.
export async function wipePowerSync(): Promise<void> {
  await db.disconnectAndClear();
}

export * from './schema';
