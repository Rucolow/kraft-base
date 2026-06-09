import {
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
  UpdateType,
} from '@powersync/web';
import { supabase } from '../supabase/client';

const powersyncUrl = import.meta.env.VITE_POWERSYNC_URL;

// Bridges the local PowerSync queue to Supabase. Connect is only attempted when
// both Supabase and a PowerSync endpoint are configured; otherwise the app stays
// local-only (the local verification path).
export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    if (!supabase || !powersyncUrl) {
      return null;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return null;
    }
    return { endpoint: powersyncUrl, token: session.access_token };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    if (!supabase) {
      return;
    }
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    for (const op of transaction.crud) {
      const table = supabase.from(op.table);
      const data = op.opData ?? {};
      const result =
        op.op === UpdateType.PUT
          ? await table.upsert({ ...data, id: op.id })
          : op.op === UpdateType.PATCH
            ? await table.update(data).eq('id', op.id)
            : await table.delete().eq('id', op.id);

      if (result.error) {
        throw result.error;
      }
    }

    await transaction.complete();
  }
}

export const canConnect = (): boolean => Boolean(supabase && powersyncUrl);
