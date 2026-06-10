import { useQuery } from '@powersync/react';
import { AlertTriangle, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { BackButton, EmptyState, PrimaryButton } from '../components/ui';
import { useOpenFollowups, useTimeline } from '../data/queries';
import { formatClock } from '../lib/date';
import type { ShiftSessionRow, StaffRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';
import { deriveDigest } from '../lib/shift';
import { startShift } from '../lib/shiftOps';

export function ShiftGate() {
  const navigate = useNavigate();
  const { device, staff, currentStaff } = useSession();
  const { data: timeline } = useTimeline();
  const { data: followups } = useOpenFollowups();
  const { data: previous } = useQuery<ShiftSessionRow>(
    `SELECT * FROM shift_session WHERE device_id = ? AND ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT 1`,
    [device?.deviceId ?? ''],
  );

  const personalStaff =
    device?.mode === 'personal'
      ? (staff.find((member) => member.id === device.boundStaffId) ?? null)
      : null;
  const [picked, setPicked] = useState<StaffRow | null>(null);
  const selected = picked ?? personalStaff;

  const digest = useMemo(
    () => deriveDigest(previous[0] ?? null, timeline, followups),
    [previous, timeline, followups],
  );

  async function start() {
    if (!selected || !device) {
      return;
    }
    await startShift({ staffId: selected.id, deviceId: device.deviceId });
    navigate('/');
  }

  if (!device) {
    return <EmptyState>端末の設定が必要です。</EmptyState>;
  }

  if (!selected) {
    return (
      <div className="mx-auto flex h-dvh max-w-[480px] md:max-w-xl flex-col overflow-y-auto bg-paper px-6 pt-9 pb-8">
        <div className="font-heading text-[1.5rem] tracking-[0.22em] text-green">KRAFT BASE</div>
        <h1 className="mt-8 font-bold text-[1.15rem]">シフトを始めますか？</h1>
        <p className="mt-1 mb-5 text-[0.84rem] text-ink-light">
          あなたの名前を選んでください。交代は「引き継ぎを受け取る」ことから始まります。
        </p>
        {staff.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => setPicked(member)}
            className="mb-3 flex w-full items-center gap-3 rounded-[15px] border border-line bg-paper p-4 text-left shadow-kb-sm active:scale-[0.985]"
          >
            <Avatar staff={member} size={42} />
            <span className="flex-1">
              <span className="block font-bold text-[1rem]">{member.name}</span>
              <span className="block text-[0.76rem] text-ink-light">
                {member.role === 'owner' ? 'オーナー' : 'スタッフ'}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] md:max-w-xl flex-col overflow-y-auto bg-paper px-6 pt-9 pb-8">
      {device.mode === 'shared' ? (
        <BackButton onClick={() => setPicked(null)}>戻る</BackButton>
      ) : null}
      <h1 className="mt-2 font-bold text-[1.15rem]">引き継ぎを確認</h1>
      <p className="mt-1 mb-4 text-[0.84rem] text-ink-light">
        {selected.name} さん、始める前に前のシフトが残したものを確認してください。
      </p>

      <div className="mb-2 font-heading text-[0.7rem] uppercase tracking-[0.22em] text-ink-mute">
        未完・申し送り
      </div>
      {digest.followups.length === 0 ? (
        <EmptyState>未完の申し送りはありません。</EmptyState>
      ) : (
        digest.followups.map((followup) => (
          <div
            key={followup.id}
            className="mb-2 flex items-start gap-2.5 rounded-[13px] border-orange border-l-[3px] bg-orange/[0.07] px-3.5 py-3"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange" />
            <span className="text-[0.86rem]">{followup.body}</span>
          </div>
        ))
      )}

      <div className="mt-3 mb-2 font-heading text-[0.7rem] uppercase tracking-[0.22em] text-ink-mute">
        前シフトの記録
      </div>
      {digest.entries.length === 0 ? (
        <EmptyState>新しい記録はありません。</EmptyState>
      ) : (
        <div className="mb-2 rounded-[13px] border border-line bg-cream px-3.5 py-2">
          {digest.entries.slice(0, 6).map((entry) => (
            <div
              key={entry.id}
              className="border-line border-b py-2 text-[0.84rem] last:border-none"
            >
              <span className="mr-2 font-semibold text-[0.74rem] text-wood tabular-nums">
                {entry.created_at ? formatClock(entry.created_at) : ''}
              </span>
              {entry.body}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 mb-2 flex items-center justify-center gap-1.5 text-[0.74rem] text-ink-mute">
        <AlertTriangle size={13} /> 確認しないとシフトを始められません
      </div>
      <PrimaryButton onClick={start}>
        <Check size={18} /> 確認しました — シフトを開始
      </PrimaryButton>
      {currentStaff ? (
        <p className="mt-3 text-center text-[0.72rem] text-ink-mute">
          現在のシフト：{currentStaff.name}
        </p>
      ) : null}
    </div>
  );
}
