import {
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
  UpdateType,
} from '@powersync/web';
import { supabase } from '../supabase/client';
import { recordSyncAlert } from '../syncAlerts';
import { type UploadOp, uploadOp } from './upload';

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
      // Map the PowerSync enum to the plain union upload.ts speaks, so its unit
      // test needs no PowerSync import.
      const type: UploadOp['op'] =
        op.op === UpdateType.PUT ? 'PUT' : op.op === UpdateType.PATCH ? 'PATCH' : 'DELETE';
      const result = await uploadOp(supabase, {
        op: type,
        table: op.table,
        id: op.id,
        opData: op.opData ?? undefined,
      });

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
