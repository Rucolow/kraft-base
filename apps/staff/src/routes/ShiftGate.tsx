import { useQuery } from '@powersync/react';
import { AlertTriangle, Check, LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { SyncAlertNotice } from '../components/SyncAlertList';
import { BackButton, EmptyState, PrimaryButton } from '../components/ui';
import { useOpenFollowups, useTimeline } from '../data/queries';
import { formatClock, shiftDate } from '../lib/date';
import type { ShiftSessionRow, StaffRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';
import { deriveDigest } from '../lib/shift';
import { endShift, startShift } from '../lib/shiftOps';

export function ShiftGate() {
  const navigate = useNavigate();
  const { device, staff, currentStaff, activeSession } = useSession();
  const [starting, setStarting] = useState(false);
  const { data: timeline } = useTimeline();
  const { data: followups } = useOpenFollowups();
  const { data: previous } = useQuery<ShiftSessionRow>(
    `SELECT * FROM shift_session WHERE device_id = ? AND ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT 1`,
    [device?.deviceId ?? ''],
  );
  // Deliberate 退勤 markers. endShift stamps a timeline entry at the exact instant
  // it sets the session's ended_at; the 04:00 auto-close (closeStaleSessions)
  // writes none. Matching on that instant is what tells a real clock-out apart
  // from a forgotten shift, so the celebratory card can't fire for the latter.
  const { data: clockOutMarks } = useQuery<{ created_at: string }>(
    `SELECT created_at FROM timeline_entry
       WHERE kind = 'system' AND body LIKE '退勤%'
       ORDER BY created_at DESC LIMIT 20`,
  );

  // The shift roster lists everyone who works a shift. At this 3-person guest-
  // house 2 of the 3 are owners, so owners MUST be tappable here — filtering to
  // role==='staff' left them with no way to start a shift and stranded them on
  // this screen. Only the synthetic device account is excluded.
  const people = staff.filter((member) => !member.is_device);
  const personalStaff =
    device?.mode === 'personal'
      ? (staff.find((member) => member.id === device.boundStaffId) ?? null)
      : null;
  const [picked, setPicked] = useState<StaffRow | null>(null);
  const [ending, setEnding] = useState(false);
  const selected = picked ?? personalStaff;

  const digest = useMemo(
    () => deriveDigest(previous[0] ?? null, timeline, followups),
    [previous, timeline, followups],
  );

  // "Clocked out today": show the お疲れさま card while this device's most recent
  // ended session is within the current shift-day AND was ended deliberately (a
  // matching 退勤 marker), so it survives a reload but never celebrates a shift
  // that was merely auto-closed at 04:00 because someone forgot to press 退勤.
  const lastEnded = previous[0] ?? null;
  const clockedOutToday =
    !!lastEnded?.ended_at &&
    shiftDate(new Date(lastEnded.ended_at)) === shiftDate() &&
    clockOutMarks.some((mark) => mark.created_at === lastEnded.ended_at);
  const lastEndedStaff = staff.find((member) => member.id === lastEnded?.staff_id) ?? null;

  async function end() {
    if (!device || !activeSession || ending) {
      return;
    }
    if (!window.confirm(`${currentStaff?.name ?? ''} さんのシフトを終了しますか？`)) {
      return;
    }
    setEnding(true);
    await endShift(device.deviceId);
    setEnding(false);
  }

  const statusCards = activeSession ? (
    <div className="mb-4 rounded-[15px] border border-line bg-cream px-4 py-4">
      <div className="text-[0.78rem] text-ink-light">現在のシフト</div>
      <div className="font-bold text-[1.05rem]">{currentStaff?.name ?? ''}</div>
      <button
        type="button"
        onClick={end}
        disabled={ending}
        className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-orange font-bold text-[1rem] text-onaccent disabled:opacity-50"
      >
        <LogOut size={18} /> シフトを終了する（退勤）
      </button>
      <p className="mt-2 text-[0.72rem] text-ink-mute">
        ※終了するとチェックイン画面も閉じます。遅着対応が残っている間は終了しないでください。
      </p>
    </div>
  ) : clockedOutToday ? (
    <div className="mb-4 rounded-[15px] border-2 border-orange bg-orange/10 px-4 py-5 text-center">
      <div className="font-bold text-[1.25rem] text-orange">お疲れさまでした！終了！！</div>
      {lastEnded?.ended_at ? (
        <div className="mt-1 text-[0.82rem] text-ink-light">
          {formatClock(lastEnded.ended_at)} 退勤：{lastEndedStaff?.name ?? ''}
        </div>
      ) : null}
    </div>
  ) : null;

  // Starting a shift inserts a shift_session row, but RequireApp gates the app on
  // `activeSession`, which is a PowerSync watched query and updates a tick later.
  // Navigating immediately races that update and bounces back here. Instead, flag
  // the start and navigate from an effect once the new session is visible in
  // context, so the app router sees it and lets us in.
  useEffect(() => {
    if (starting && activeSession) {
      navigate('/');
    }
  }, [starting, activeSession, navigate]);

  async function start() {
    if (!selected || !device) {
      return;
    }
    setStarting(true);
    await startShift({ staffId: selected.id, deviceId: device.deviceId });
  }

  if (!device) {
    return <EmptyState>端末の設定が必要です。</EmptyState>;
  }

  if (!selected) {
    return (
      <div className="mx-auto flex h-dvh max-w-[480px] md:max-w-xl flex-col overflow-y-auto bg-paper px-6 pt-9 pb-8">
        <div className="font-heading text-[1.5rem] tracking-[0.22em] text-orange">KRAFT BASE</div>
        {statusCards}
        <h1 className="mt-6 font-bold text-[1.15rem]">シフトを始めますか？</h1>
        <p className="mt-1 mb-5 text-[0.84rem] text-ink-light">
          あなたの名前を選んでください。交代は「引き継ぎを受け取る」ことから始まります。
        </p>
        {people.length === 0 ? (
          <div className="rounded-kb border border-line bg-paper p-4">
            <div className="font-bold text-[0.95rem] text-ink">
              スタッフがまだ表示されていません
            </div>
            <p className="mt-2 text-[0.8rem] text-ink-light">
              オーナーがスタッフを登録すると、ここに名前が表示されます。同期中の場合は数秒お待ちください。
            </p>
            <div className="mt-3">
              <PrimaryButton onClick={() => window.location.reload()}>再読み込み</PrimaryButton>
            </div>
          </div>
        ) : null}
        {people.map((member) => (
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
        <button
          type="button"
          onClick={() => navigate('/setup')}
          className="mt-3 self-center text-[0.76rem] text-ink-mute underline"
        >
          端末の設定を変更
        </button>
        <SyncAlertNotice />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] md:max-w-xl flex-col overflow-y-auto bg-paper px-6 pt-9 pb-8">
      {device.mode === 'shared' ? (
        <BackButton onClick={() => setPicked(null)}>戻る</BackButton>
      ) : null}
      {statusCards}
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
      <SyncAlertNotice />
    </div>
  );
}
