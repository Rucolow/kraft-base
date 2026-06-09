import { useStatus } from '@powersync/react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';

export function SyncBadge() {
  const status = useStatus();

  if (!status.connected) {
    return (
      <span className="flex items-center gap-1 text-[0.62rem] text-ink-mute">
        <CloudOff size={12} /> ローカル保存
      </span>
    );
  }
  if (status.dataFlowStatus.uploading || status.dataFlowStatus.downloading) {
    return (
      <span className="flex items-center gap-1 text-[0.62rem] text-green-light">
        <RefreshCw size={12} className="animate-spin" /> 同期中
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[0.62rem] text-green-light">
      <Cloud size={12} /> 同期済み
    </span>
  );
}
