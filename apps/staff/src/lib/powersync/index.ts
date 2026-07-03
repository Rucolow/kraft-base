import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web';
import { supabase } from '../supabase/client';
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
let connecting = false;
let connector: SupabaseConnector | null = null;
const getConnector = (): SupabaseConnector => {
  connector ??= new SupabaseConnector();
  return connector;
};

// Connect the sync stream — but ONLY when a session exists. Connecting without
// credentials (fetchCredentials -> null) put the stream into a retry/backoff
// state that a subsequent post-login connect didn't reliably recover from; on the
// real iPad this looked like "first login never syncs, relaunching the app fixes
// it". One live connection per auth session; sign-out resets the latch.
export async function connectPowerSync(): Promise<void> {
  if (!canConnect() || !supabase || connecting) {
    return;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return;
  }
  connecting = true;
  // Local-first: never hold the UI on the network handshake — the local data is
  // already on disk; sync catches up in the background.
  db.connect(getConnector()).catch((error) => {
    connecting = false;
    console.error('PowerSync connect failed (will retry on next sign-in)', error);
  });
}

export async function startPowerSync(): Promise<void> {
  if (started) {
    return;
  }
  started = true;
  await db.init();
  void connectPowerSync();
}

export async function disconnectPowerSync(): Promise<void> {
  connecting = false;
  await db.disconnect();
}

// Sign-out on a shared device must not leave the guest register (passports,
// addresses) sitting in local storage. disconnectAndClear wipes the local DB;
// data re-syncs on the next sign-in.
export async function wipePowerSync(): Promise<void> {
  connecting = false;
  await db.disconnectAndClear();
}

export * from './schema';
