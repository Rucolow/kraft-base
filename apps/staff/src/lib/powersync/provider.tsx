import { PowerSyncContext } from '@powersync/react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { db, startPowerSync } from './index';

// Minimal branded splash/error shells. Deliberately plain JSX + inline-ish
// classes: this renders before the app (and possibly instead of it), so it must
// not depend on app state or data.
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-paper px-8 text-center">
      <div className="font-heading text-[1.4rem] tracking-[0.22em] text-orange">KRAFT BASE</div>
      {children}
    </div>
  );
}

// Transient OPFS handle contention (the PWA and a Safari tab both open, or a
// crashed instance still holding the lock) usually clears within moments of the
// other holder going away — retry before declaring failure.
const INIT_RETRIES = 2;
const RETRY_DELAY_MS = 1200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function initWithRetry(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= INIT_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await wait(RETRY_DELAY_MS);
      }
      await startPowerSync();
      return;
    } catch (error) {
      lastError = error;
      console.error(`PowerSync init failed (attempt ${attempt + 1})`, error);
    }
  }
  throw lastError;
}

// Last-resort self-recovery: the local DB is a mirror (the server is the source
// of truth), so deleting the OPFS database files and re-syncing is always safe —
// except for writes still waiting to upload, hence the confirm. Before this
// button existed, the only way out of a broken local DB was Safari settings →
// clear site data, which field staff cannot be expected to find (and which
// caused the June owner-lockout saga).
async function wipeLocalDatabase(): Promise<void> {
  try {
    // Belt: PowerSync's own teardown, if the DB is functional enough to run it.
    await db.disconnectAndClear();
  } catch {
    // The broken-DB case — fall through to file-level removal.
  }
  try {
    // Braces: remove the OPFS files directly (kraftbase.db plus any journal/
    // sidecar files the VFS created alongside it).
    const root = await navigator.storage.getDirectory();
    // biome-ignore lint/suspicious/noExplicitAny: OPFS async iteration is not yet in TS lib dom
    const entries = (root as any).keys() as AsyncIterable<string>;
    const names: string[] = [];
    for await (const name of entries) {
      if (name.includes('kraftbase.db')) {
        names.push(name);
      }
    }
    for (const name of names) {
      await root.removeEntry(name, { recursive: true }).catch(() => undefined);
    }
  } catch {
    // OPFS unavailable or removal refused — reload anyway; init may still work.
  }
}

export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);

  const boot = useCallback(() => {
    setFailed(null);
    initWithRetry()
      .then(() => setReady(true))
      .catch((error: unknown) => {
        // Local DB init failed even after retries. Without this the app was a
        // permanent blank screen with no message and no way out.
        setFailed(error instanceof Error ? error.message : String(error));
      });
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  async function resetAndReload() {
    if (wiping) {
      return;
    }
    if (
      !window.confirm(
        'ローカルのデータを削除して、サーバーから取り直します。\n未送信の記録がある場合は失われます。よろしいですか？',
      )
    ) {
      return;
    }
    setWiping(true);
    await wipeLocalDatabase();
    window.location.reload();
  }

  if (failed) {
    return (
      <Shell>
        <p className="mt-4 text-[0.9rem] text-ink-light">
          データの読み込みに失敗しました。再読み込みをお試しください。
        </p>
        <p className="mt-1 text-[0.7rem] text-ink-mute">{failed}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 min-h-[44px] rounded-full bg-orange px-6 font-bold text-[0.9rem] text-onaccent"
        >
          再読み込み
        </button>
        <button
          type="button"
          onClick={resetAndReload}
          disabled={wiping}
          className="mt-3 min-h-[44px] rounded-full border border-line px-6 text-[0.84rem] text-ink-light disabled:opacity-50"
        >
          {wiping ? '初期化中…' : 'データを取り直す（初期化）'}
        </button>
        <p className="mt-2 max-w-[300px] text-[0.68rem] text-ink-mute">
          再読み込みで直らない場合に使ってください。データはサーバーから取り直されます。
        </p>
        <div className="mt-6 text-[0.64rem] text-ink-mute">build {__APP_BUILD__}</div>
      </Shell>
    );
  }

  if (!ready) {
    return (
      <Shell>
        <p className="mt-4 text-[0.84rem] text-ink-mute">読み込み中…</p>
      </Shell>
    );
  }

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}
