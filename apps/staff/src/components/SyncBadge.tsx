import { useQuery, useStatus } from '@powersync/react';
import { AlertTriangle, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { formatClock } from '../lib/date';
import { canConnect } from '../lib/powersync/connector';

// Sync health at a glance. The critical case this must surface: writes that
// exist locally but have not reached the server (ps_crud queue) — previously the
// badge said 同期済み while uploads were pending or the connection was down,
// so nobody could tell sync was broken.
export function SyncBadge() {
  const status = useStatus();
  const { data: pending } = useQuery<{ n: number }>('SELECT count(*) AS n FROM ps_crud');
  const pendingCount = pending[0]?.n ?? 0;

  // Local-only mode (no backend configured): being offline is by design.
  if (!canConnect()) {
    return (
      <span className="flex items-center gap-1 text-[0.62rem] text-ink-mute">
        <CloudOff size={12} /> ローカル保存
      </span>
    );
  }

  if (!status.connected) {
    // Configured but not connected. With queued writes this needs attention —
    // staff edits are only on this device until the connection returns.
    return (
      <span className="flex items-center gap-1 text-[0.62rem] text-orange-deep">
        <AlertTriangle size={12} />
        {pendingCount > 0 ? `未同期 ${pendingCount}件` : 'オフライン'}
      </span>
    );
  }

  if (pendingCount > 0 || status.dataFlowStatus.uploading || status.dataFlowStatus.downloading) {
    return (
      <span className="flex items-center gap-1 text-[0.62rem] text-orange-light">
        <RefreshCw size={12} className="animate-spin" />
        同期中{pendingCount > 0 ? ` ${pendingCount}件` : ''}
      </span>
    );
  }

  const last = status.lastSyncedAt ? formatClock(status.lastSyncedAt.toISOString()) : null;
  return (
    <span className="flex items-center gap-1 text-[0.62rem] text-orange-light">
      <Cloud size={12} /> 同期済み{last ? ` ${last}` : ''}
    </span>
  );
}
