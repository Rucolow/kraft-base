import { useQuery, useStatus } from '@powersync/react';
import { AlertTriangle, Cloud, CloudOff, RefreshCw, X } from 'lucide-react';
import { type ReactNode, useState, useSyncExternalStore } from 'react';
import { formatClock } from '../lib/date';
import { canConnect } from '../lib/powersync/connector';
import { clearSyncAlerts, getSyncAlerts, subscribeSyncAlerts } from '../lib/syncAlerts';

// Postgres table names → words the innkeepers use, for the discard list.
const TABLE_LABELS: Record<string, string> = {
  device: '端末',
  shift_session: 'シフト',
  guest: 'ゲスト',
  guest_note: 'ゲストのメモ',
  task: 'タスク',
  followup: '申し送り',
  content: '記録',
  staff: 'スタッフ',
  checkin_record: 'チェックイン',
};

// Sync health at a glance. The critical case this must surface: writes that
// exist locally but have not reached the server (ps_crud queue) — previously the
// badge said 同期済み while uploads were pending or the connection was down,
// so nobody could tell sync was broken.
export function SyncBadge() {
  const status = useStatus();
  const { data: pending } = useQuery<{ n: number }>('SELECT count(*) AS n FROM ps_crud');
  const pendingCount = pending[0]?.n ?? 0;
  const alerts = useSyncExternalStore(subscribeSyncAlerts, getSyncAlerts);
  const [open, setOpen] = useState(false);

  // Local-only mode (no backend configured): being offline is by design, and
  // uploads never run so there are no discards to show.
  if (!canConnect()) {
    return (
      <span className="flex items-center gap-1 text-[0.62rem] text-ink-mute">
        <CloudOff size={12} /> ローカル保存
      </span>
    );
  }

  let statusEl: ReactNode;
  if (!status.connected) {
    // Configured but not connected. With queued writes this needs attention —
    // staff edits are only on this device until the connection returns.
    statusEl = (
      <span className="flex items-center gap-1 text-[0.62rem] text-orange-deep">
        <AlertTriangle size={12} />
        {pendingCount > 0 ? `未同期 ${pendingCount}件` : 'オフライン'}
      </span>
    );
  } else if (
    pendingCount > 0 ||
    status.dataFlowStatus.uploading ||
    status.dataFlowStatus.downloading
  ) {
    statusEl = (
      <span className="flex items-center gap-1 text-[0.62rem] text-orange-light">
        <RefreshCw size={12} className="animate-spin" />
        同期中{pendingCount > 0 ? ` ${pendingCount}件` : ''}
      </span>
    );
  } else {
    const last = status.lastSyncedAt ? formatClock(status.lastSyncedAt.toISOString()) : null;
    statusEl = (
      <span className="flex items-center gap-1 text-[0.62rem] text-orange-light">
        <Cloud size={12} /> 同期済み{last ? ` ${last}` : ''}
      </span>
    );
  }

  return (
    <div className="relative flex items-center gap-2">
      {statusEl}
      {alerts.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1 rounded-full border border-orange-deep/40 px-1.5 py-0.5 text-[0.62rem] text-orange-deep"
        >
          <AlertTriangle size={12} /> 拒否 {alerts.length}件
        </button>
      ) : null}
      {open && alerts.length > 0 ? (
        <div className="absolute top-[calc(100%+6px)] right-0 z-50 w-64 rounded-kb border border-line bg-paper p-3 text-left shadow-kb">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-bold text-[0.78rem] text-ink">同期されなかった変更</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="閉じる">
              <X size={14} className="text-ink-mute" />
            </button>
          </div>
          <p className="mb-2 text-[0.66rem] text-ink-light">
            サーバーに拒否され、端末から取り消された変更です。繰り返す場合は管理者に共有してください。
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {alerts.map((alert, index) => (
              <li
                key={`${alert.at}-${index}`}
                className="border-line border-b pb-1 text-[0.7rem] last:border-none"
              >
                <span className="font-semibold text-ink">
                  {TABLE_LABELS[alert.table] ?? alert.table}
                </span>
                <span className="text-ink-mute"> ・ {formatClock(alert.at)}</span>
                <span className="block text-[0.6rem] text-ink-mute">コード {alert.code}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              clearSyncAlerts();
              setOpen(false);
            }}
            className="mt-2 text-[0.68rem] text-ink-mute underline"
          >
            履歴を消す
          </button>
        </div>
      ) : null}
    </div>
  );
}
