import { PowerSyncContext } from '@powersync/react';
import { type ReactNode, useEffect, useState } from 'react';
import { db, startPowerSync } from './index';

export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startPowerSync().then(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}
