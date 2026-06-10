import { useQuery } from '@powersync/react';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState, PrimaryButton } from '../components/ui';
import { useGuest } from '../data/queries';
import { nowIso } from '../lib/date';
import { insertRow, updateRow, uuid } from '../lib/db';
import type { CheckinRecordRow } from '../lib/powersync/schema';

function Field({
  labelJa,
  labelEn,
  value,
  onChange,
  required,
}: {
  labelJa: string;
  labelEn: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-[0.92rem]">
        <span className="font-bold">{labelJa}</span>
        <span className="ml-2 text-[0.8rem] text-ink-light">{labelEn}</span>
        {required ? <span className="ml-1 text-orange-deep">*</span> : null}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[52px] w-full rounded-[12px] border border-line bg-cream px-4 py-3 text-[1.05rem] outline-none focus:border-green-light"
      />
    </label>
  );
}

export function CheckIn() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: guests } = useGuest(id);
  const { data: existing } = useQuery<CheckinRecordRow>(
    'SELECT * FROM checkin_record WHERE guest_id = ? ORDER BY created_at DESC LIMIT 1',
    [id],
  );
  const guest = guests[0] ?? null;
  const record = existing[0] ?? null;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [nationality, setNationality] = useState('');
  const [passport, setPassport] = useState('');
  const [done, setDone] = useState(false);

  if (!guest) {
    return (
      <div className="mx-auto flex h-dvh max-w-xl flex-col justify-center bg-paper px-6">
        <EmptyState>ゲストが見つかりません。</EmptyState>
      </div>
    );
  }

  async function submit() {
    if (!name.trim()) {
      return;
    }
    await insertRow('checkin_record', {
      id: uuid(),
      guest_id: id,
      name: name.trim(),
      address: address.trim() || null,
      occupation: occupation.trim() || null,
      nationality: nationality.trim() || null,
      passport_number: passport.trim() || null,
      created_at: nowIso(),
    });
    await updateRow('guest', id, { status: 'arrived' });
    await insertRow('timeline_entry', {
      id: uuid(),
      author_id: null,
      kind: 'action',
      body: `チェックイン ${guest?.name ?? ''}様（名簿入力）`,
      ref_type: 'guest',
      ref_id: id,
      created_at: nowIso(),
    });
    setDone(true);
  }

  if (done || record) {
    return (
      <div className="mx-auto flex h-dvh max-w-xl flex-col items-center justify-center bg-paper px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-green/10 text-green">
          <Check size={32} />
        </span>
        <h1 className="mt-5 font-bold text-[1.3rem]">ありがとうございました</h1>
        <p className="mt-1 text-[0.95rem] text-ink-light">Thank you! You're all checked in.</p>
        <p className="mt-5 text-[0.88rem] text-ink-light">
          端末をスタッフにお返しください。
          <br />
          Please hand the device back to our staff.
        </p>
        <button
          type="button"
          onClick={() => navigate(`/guests/${id}`)}
          className="mt-8 min-h-[44px] rounded-full border border-line px-6 text-[0.84rem] text-ink-light"
        >
          スタッフ画面へ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col overflow-y-auto bg-paper px-6 pt-9 pb-10">
      <div className="font-heading text-[1.4rem] tracking-[0.22em] text-green">KRAFT BASE</div>
      <h1 className="mt-5 font-bold text-[1.25rem]">チェックイン / Check-in</h1>
      <p className="mt-1 mb-6 text-[0.86rem] text-ink-light">
        法令により宿泊者名簿への記入をお願いしています。
        <br />
        Japanese law requires guests to fill in the registration form below.
      </p>

      <Field labelJa="氏名" labelEn="Full name" value={name} onChange={setName} required />
      <Field labelJa="住所" labelEn="Home address" value={address} onChange={setAddress} />
      <Field labelJa="職業" labelEn="Occupation" value={occupation} onChange={setOccupation} />
      <Field labelJa="国籍" labelEn="Nationality" value={nationality} onChange={setNationality} />
      <Field
        labelJa="旅券番号"
        labelEn="Passport number (required for foreign guests)"
        value={passport}
        onChange={setPassport}
      />

      <PrimaryButton onClick={submit} disabled={!name.trim()}>
        <Check size={18} /> 記入を完了 / Complete
      </PrimaryButton>
      <p className="mt-3 text-center text-[0.72rem] text-ink-mute">
        記入内容は宿泊者名簿としてのみ利用します。 / Used only for the legal guest register.
      </p>
    </div>
  );
}
