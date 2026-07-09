import { AlertTriangle } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { formatClock } from '../lib/date';
import { canConnect } from '../lib/powersync/connector';
import {
  type SyncAlert,
  clearSyncAlerts,
  getSyncAlerts,
  subscribeSyncAlerts,
} from '../lib/syncAlerts';

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
  timeline_entry: '記録',
};

// The list of discarded writes. Shared between the header badge (SyncBadge) and
// the shift-start notice below.
export function SyncAlertList({ alerts }: { alerts: SyncAlert[] }) {
  return (
    <ul className="max-h-56 space-y-1 overflow-y-auto">
      {alerts.map((alert, index) => (
        <li
          key={`${alert.at}-${index}`}
          className="border-line border-b pb-1 text-[0.7rem] last:border-none"
        >
          <span className="font-semibold text-ink">{TABLE_LABELS[alert.table] ?? alert.table}</span>
          <span className="text-ink-mute"> ・ {formatClock(alert.at)}</span>
          <span className="block text-[0.6rem] text-ink-mute">コード {alert.code}</span>
        </li>
      ))}
    </ul>
  );
}

// A self-contained notice for screens OUTSIDE the app shell — above all the shift
// gate. The header badge is invisible to anyone stuck in the "start a shift →
// bounce back to the roster" loop (they never stay on a shell screen), which is
// exactly the person who needs to see that their writes are being rejected.
export function SyncAlertNotice() {
  const alerts = useSyncExternalStore(subscribeSyncAlerts, getSyncAlerts);
  const [open, setOpen] = useState(false);

  // Local-only mode never uploads, so there is nothing to reject there.
  if (!canConnect() || alerts.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[13px] border border-orange-deep/40 bg-orange/[0.07] px-3.5 py-3 text-left">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-[0.82rem] text-orange-deep"
      >
        <AlertTriangle size={15} className="shrink-0" />
        <span className="flex-1 font-semibold">
          同期されなかった変更が {alerts.length}件あります
        </span>
        <span className="text-[0.7rem]">{open ? '閉じる' : '詳細'}</span>
      </button>
      {open ? (
        <div className="mt-2">
          <p className="mb-2 text-[0.68rem] text-ink-light">
            サーバーに拒否され、端末から取り消された変更です。繰り返す場合は管理者に共有してください。
          </p>
          <SyncAlertList alerts={alerts} />
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
