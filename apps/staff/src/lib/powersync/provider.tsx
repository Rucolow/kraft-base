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

export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const boot = useCallback(() => {
    setFailed(null);
    startPowerSync()
      .then(() => setReady(true))
      .catch((error: unknown) => {
        // Local DB init failed (e.g. storage edge cases). Without this the app
        // was a permanent blank screen with no message and no way out.
        console.error('PowerSync init failed', error);
        setFailed(error instanceof Error ? error.message : String(error));
      });
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

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
