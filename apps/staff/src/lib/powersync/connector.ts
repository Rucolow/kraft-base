import {
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
  UpdateType,
} from '@powersync/web';
import { supabase } from '../supabase/client';
import { recordSyncAlert } from '../syncAlerts';
import { serializeForServer } from './serialize';

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
      // Convert local SQLite representation (int booleans, JSON-text arrays) to the
      // Postgres column types, otherwise PostgREST rejects array/boolean writes and
      // they get silently discarded below.
      const data = serializeForServer(op.table, op.opData ?? {});
      const result =
        op.op === UpdateType.PUT
          ? await table.upsert({ ...data, id: op.id })
          : op.op === UpdateType.PATCH
            ? await table.update(data).eq('id', op.id)
            : await table.delete().eq('id', op.id);

      if (result.error) {
        // Postgres permission (class 42, incl. RLS 42501), integrity (23) and
        // data (22) errors will never succeed on retry. Discarding the op lets
        // the transaction complete so a single rejected write can't block all
        // sync forever. Transient errors (network, 5xx) still throw to retry.
        const code = result.error.code ?? '';
        if (/^(22|23|42)/.test(code)) {
          console.error('Discarding rejected change', op.table, op.op, op.id, result.error);
          // Surface it: a silent discard is exactly the failure mode that stalls
          // staff (the write reflects locally, then vanishes) with no trace.
          recordSyncAlert({
            table: op.table,
            op: String(op.op),
            code,
            message: result.error.message ?? '',
          });
          continue;
        }
        throw result.error;
      }
    }

    await transaction.complete();
  }
}

export const canConnect = (): boolean => Boolean(supabase && powersyncUrl);
