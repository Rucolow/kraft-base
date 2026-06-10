import { useQuery } from '@powersync/react';
import { Check, House, Plane } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BackButton, EmptyState, PrimaryButton } from '../components/ui';
import { useGuest } from '../data/queries';
import { nowIso } from '../lib/date';
import { insertRow, updateRow, uuid } from '../lib/db';
import type { CheckinRecordRow } from '../lib/powersync/schema';

type Residence = 'japan' | 'abroad';

function Field({
  primary,
  secondary,
  value,
  onChange,
  required,
  wide,
  inputMode,
}: {
  primary: string;
  secondary: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  wide?: boolean;
  inputMode?: 'text' | 'tel' | 'email';
}) {
  return (
    <label className={`mb-4 block ${wide ? 'md:col-span-2' : ''}`}>
      <span className="mb-1 block text-[0.92rem]">
        <span className="font-bold">{primary}</span>
        <span className="ml-2 text-[0.8rem] text-ink-light">{secondary}</span>
        {required ? <span className="ml-1 text-orange-deep">*</span> : null}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[52px] w-full rounded-[12px] border border-line bg-cream px-4 py-3 text-[1.05rem] outline-none focus:border-orange-light"
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

  const [residence, setResidence] = useState<Residence | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
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

  const abroad = residence === 'abroad';
  const complete =
    name.trim() !== '' &&
    address.trim() !== '' &&
    contact.trim() !== '' &&
    (!abroad || (nationality.trim() !== '' && passport.trim() !== ''));

  async function submit() {
    if (!complete) {
      return;
    }
    await insertRow('checkin_record', {
      id: uuid(),
      guest_id: id,
      name: name.trim(),
      address: address.trim(),
      contact: contact.trim(),
      nationality: abroad ? nationality.trim() : null,
      passport_number: abroad ? passport.trim() : null,
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
        <span className="grid h-16 w-16 place-items-center rounded-full bg-orange/15 text-orange">
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

  if (residence === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6">
        <div className="w-full max-w-xl text-center">
          <div className="font-heading text-[1.4rem] tracking-[0.22em] text-orange">KRAFT BASE</div>
          <h1 className="mt-5 font-bold text-[1.25rem]">チェックイン / Check-in</h1>
          <p className="mt-1 mb-8 text-[0.86rem] text-ink-light">
            ようこそ。あてはまる方を選んでください。
            <br />
            Welcome! Please choose one.
          </p>
          <button
            type="button"
            onClick={() => setResidence('japan')}
            className="mb-3.5 flex min-h-[76px] w-full items-center gap-4 rounded-[16px] border border-line bg-paper px-5 text-left shadow-kb-sm active:scale-[0.985]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange/15 text-orange">
              <House size={22} />
            </span>
            <span>
              <span className="block font-bold text-[1.05rem]">日本にお住まいの方</span>
              <span className="block text-[0.8rem] text-ink-light">I live in Japan</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setResidence('abroad')}
            className="flex min-h-[76px] w-full items-center gap-4 rounded-[16px] border border-line bg-paper px-5 text-left shadow-kb-sm active:scale-[0.985]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange/10 text-orange">
              <Plane size={22} />
            </span>
            <span>
              <span className="block font-bold text-[1.05rem]">Visiting from abroad</span>
              <span className="block text-[0.8rem] text-ink-light">海外からお越しの方</span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center overflow-y-auto bg-paper">
      <div className="w-full max-w-xl px-6 pt-9 pb-10 md:max-w-3xl md:pt-12">
        <div className="font-heading text-[1.4rem] tracking-[0.22em] text-orange">KRAFT BASE</div>
        <div className="mt-4">
          <BackButton onClick={() => setResidence(null)}>{abroad ? 'Back' : '戻る'}</BackButton>
        </div>
        <h1 className="mt-1 font-bold text-[1.25rem] md:text-[1.4rem]">
          {abroad ? 'Check-in / チェックイン' : 'チェックイン / Check-in'}
        </h1>
        <p className="mt-1 mb-6 text-[0.86rem] text-ink-light">
          {abroad ? (
            <>
              Japanese law requires guests to fill in the registration form below.
              <br />
              法令により宿泊者名簿への記入をお願いしています。
            </>
          ) : (
            <>
              法令により宿泊者名簿への記入をお願いしています。
              <br />
              Japanese law requires guests to fill in the registration form below.
            </>
          )}
        </p>

        <div className="md:grid md:grid-cols-2 md:gap-x-5">
          <Field
            primary={abroad ? 'Full name' : '氏名'}
            secondary={abroad ? '氏名' : 'Full name'}
            value={name}
            onChange={setName}
            required
            wide
          />
          <Field
            primary={abroad ? 'Home address' : '住所'}
            secondary={abroad ? '住所' : 'Home address'}
            value={address}
            onChange={setAddress}
            required
            wide
          />
          <Field
            primary={abroad ? 'Phone or email' : '連絡先（電話 or メール）'}
            secondary={abroad ? '連絡先' : 'Phone or email'}
            value={contact}
            onChange={setContact}
            required
            inputMode="email"
            wide={!abroad}
          />
          {abroad ? (
            <>
              <Field
                primary="Nationality"
                secondary="国籍"
                value={nationality}
                onChange={setNationality}
                required
              />
              <Field
                primary="Passport number"
                secondary="旅券番号"
                value={passport}
                onChange={setPassport}
                required
                wide
              />
            </>
          ) : null}
        </div>

        <PrimaryButton onClick={submit} disabled={!complete}>
          <Check size={18} /> {abroad ? 'Complete / 記入を完了' : '記入を完了 / Complete'}
        </PrimaryButton>
        <p className="mt-3 text-center text-[0.72rem] text-ink-mute">
          {abroad
            ? 'Used only for the legal guest register. / 記入内容は宿泊者名簿としてのみ利用します。'
            : '記入内容は宿泊者名簿としてのみ利用します。 / Used only for the legal guest register.'}
        </p>
      </div>
    </div>
  );
}
