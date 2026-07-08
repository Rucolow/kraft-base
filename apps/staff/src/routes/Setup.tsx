import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { PrimaryButton, TextField } from '../components/ui';
import { type DeviceMode, readDeviceConfig, saveDevice } from '../lib/device';
import { useSession } from '../lib/session';

export function Setup() {
  const navigate = useNavigate();
  const { staff, setDevice } = useSession();
  // Re-configuration (via the "端末の設定を変更" link) pre-fills the current
  // values; first-time setup starts with mode unchosen so nobody silently ends
  // up on the "shared reception iPad" default (which also arms a 5-min auto-lock)
  // on a personal Mac or phone.
  const existing = readDeviceConfig();
  const [mode, setMode] = useState<DeviceMode | null>(existing?.mode ?? null);
  const [boundStaffId, setBoundStaffId] = useState<string | null>(existing?.boundStaffId ?? null);
  const [label, setLabel] = useState(existing?.label ?? '');

  async function submit() {
    if (mode === null || (mode === 'personal' && !boundStaffId)) {
      return;
    }
    const config = await saveDevice({
      mode,
      label: label.trim() || (mode === 'shared' ? '受付iPad' : '個人端末'),
      boundStaffId: mode === 'personal' ? boundStaffId : null,
      autoLockMin: mode === 'shared' ? 5 : 0,
    });
    setDevice(config);
    navigate('/shift');
  }

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] md:max-w-xl flex-col overflow-y-auto bg-paper px-6 pt-10 pb-8">
      <div className="font-heading text-[1.5rem] tracking-[0.22em] text-orange">KRAFT BASE</div>
      <h1 className="mt-6 font-bold text-[1.15rem]">この端末の設定</h1>
      <p className="mt-1 mb-5 text-[0.84rem] text-ink-light">
        端末ごとに一度だけ設定します。あとから変更できます。
      </p>

      <div className="mb-4 flex gap-2">
        {(['shared', 'personal'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`min-h-[60px] flex-1 rounded-[14px] border text-[0.9rem] ${mode === option ? 'border-orange bg-orange/15 text-orange' : 'border-line text-ink-light'}`}
          >
            <span className="block font-bold">
              {option === 'shared' ? '共有（受付iPad）' : '個人端末'}
            </span>
            <span className="block text-[0.72rem]">
              {option === 'shared' ? '受付に置く共有端末・自動ロックあり' : '自分専用のスマホ・PC'}
            </span>
          </button>
        ))}
      </div>

      {mode === null ? (
        <p className="mt-1 mb-2 text-[0.82rem] text-ink-mute">上のどちらかを選んでください。</p>
      ) : mode === 'personal' ? (
        <>
          <div className="mb-2 text-[0.78rem] text-ink-light">この端末の本人</div>
          {staff
            .filter((member) => !member.is_device)
            .map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setBoundStaffId(member.id)}
                className={`mb-2 flex w-full items-center gap-3 rounded-[14px] border p-3 text-left ${boundStaffId === member.id ? 'border-orange bg-orange/15' : 'border-line'}`}
              >
                <Avatar staff={member} size={36} />
                <span className="font-bold text-[0.92rem]">{member.name}</span>
              </button>
            ))}
        </>
      ) : (
        <TextField
          label="端末名（任意）"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="受付iPad"
        />
      )}

      {mode !== null ? (
        <div className="mt-4">
          <PrimaryButton onClick={submit} disabled={mode === 'personal' && !boundStaffId}>
            この設定で始める
          </PrimaryButton>
        </div>
      ) : null}

      <div className="mt-6 text-center text-[0.68rem] text-ink-mute">build {__APP_BUILD__}</div>
    </div>
  );
}
