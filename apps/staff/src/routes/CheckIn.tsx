import { useQuery } from '@powersync/react';
import { Check, House, Plane } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BackButton, PrimaryButton } from '../components/ui';
import { useGuest } from '../data/queries';
import { nowIso } from '../lib/date';
import { insertRow, updateRow, uuid } from '../lib/db';
import type { CheckinRecordRow } from '../lib/powersync/schema';

type Residence = 'japan' | 'abroad';

interface Person {
  name: string;
  address: string;
  contact: string;
  nationality: string;
  passport: string;
}
const emptyPerson = (): Person => ({
  name: '',
  address: '',
  contact: '',
  nationality: '',
  passport: '',
});

function Field({
  primary,
  secondary,
  value,
  onChange,
  required,
  wide,
  inputMode,
  placeholder,
}: {
  primary: string;
  secondary: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  wide?: boolean;
  inputMode?: 'text' | 'tel' | 'email';
  placeholder?: string;
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
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[52px] w-full rounded-[12px] border border-line bg-cream px-4 py-3 text-[1.05rem] outline-none focus:border-orange-light"
      />
    </label>
  );
}

export function CheckIn() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: guests, isLoading: guestLoading } = useGuest(id);
  // All register rows for this guest, newest first. Used both to detect an existing
  // registration and to prefill every party member on re-entry.
  const { data: existing } = useQuery<CheckinRecordRow>(
    'SELECT * FROM checkin_record WHERE guest_id = ? ORDER BY created_at DESC',
    [id],
  );
  const guest = guests[0] ?? null;
  const registered = existing.length > 0;
  const partySize = Math.max(1, guest?.party_size ?? 1);

  const [residence, setResidence] = useState<Residence | null>(null);
  const [people, setPeople] = useState<Person[]>([emptyPerson()]);
  const [done, setDone] = useState(false);
  // Re-entry: lets staff correct a mistyped legal register. We insert fresh rows
  // (org-member INSERT is allowed by RLS) and the latest batch wins.
  const [redo, setRedo] = useState(false);
  // Guards against a double-tap creating duplicate legal-register rows.
  const [submitting, setSubmitting] = useState(false);
  // Long-press timer for the kiosk "back to staff" exit (declared with the other
  // hooks, before any early return, to satisfy the Rules of Hooks).
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Size the form to the party once the guest record loads. Re-entry sets `people`
  // directly and won't be clobbered (party_size is unchanged then).
  useEffect(() => {
    setPeople((prev) => {
      if (prev.length === partySize) {
        return prev;
      }
      const next = prev.slice(0, partySize);
      while (next.length < partySize) {
        next.push(emptyPerson());
      }
      return next;
    });
  }, [partySize]);

  if (!guest) {
    // The local query hasn't resolved yet — show the brand splash rather than
    // flashing the invalid-link screen for a guest whose record is about to load.
    if (guestLoading) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6">
          <div className="font-heading text-[1.4rem] text-orange tracking-[0.22em]">KRAFT BASE</div>
        </div>
      );
    }
    // Genuinely not found: a stale QR / old link a guest is holding on the iPad.
    // Guest-facing and bilingual, and — per the kiosk sanctuary rule — no auto-
    // navigation; a staff member takes over from here.
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
        <div className="w-full max-w-xl">
          <div className="font-heading text-[1.4rem] text-orange tracking-[0.22em]">KRAFT BASE</div>
          <h1 className="mt-6 font-bold text-[1.2rem]">このリンクは使えません</h1>
          <p className="mt-2 text-[0.95rem] text-ink-light">
            This check-in link is no longer valid.
          </p>
          <p className="mt-5 text-[0.9rem] text-ink-light">
            お手数ですが、スタッフにお声がけください。
            <br />
            Please ask a member of our staff for help.
          </p>
        </div>
      </div>
    );
  }

  const abroad = residence === 'abroad';
  const setPerson = (index: number, key: keyof Person, value: string) =>
    setPeople((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)));

  // Representative (index 0) needs name + address + contact. Companions need a name
  // (and nationality/passport when from abroad); blank address/contact inherit the
  // representative's so a family isn't retyping the same address N times.
  const complete = people.every((p, i) => {
    const base =
      p.name.trim() !== '' && (i > 0 || (p.address.trim() !== '' && p.contact.trim() !== ''));
    const intl = !abroad || (p.nationality.trim() !== '' && p.passport.trim() !== '');
    return base && intl;
  });

  async function submit() {
    if (!complete || submitting) {
      return;
    }
    setSubmitting(true);
    const rep = people[0];
    const at = nowIso();
    const baseMs = Date.parse(at);
    // Stamp each person 1ms apart so the register order (representative first) is
    // deterministic on re-entry — equal timestamps sort arbitrarily.
    for (const [i, p] of people.entries()) {
      await insertRow('checkin_record', {
        id: uuid(),
        guest_id: id,
        name: p.name.trim(),
        address: p.address.trim() || rep?.address.trim() || '',
        contact: p.contact.trim() || rep?.contact.trim() || '',
        nationality: abroad ? p.nationality.trim() : null,
        passport_number: abroad ? p.passport.trim() : null,
        created_at: new Date(baseMs + i).toISOString(),
      });
    }
    await updateRow('guest', id, { status: 'arrived' });
    await insertRow('timeline_entry', {
      id: uuid(),
      author_id: null,
      kind: 'action',
      body: `チェックイン ${guest?.name ?? ''}様${people.length > 1 ? ` ほか${people.length - 1}名` : ''}（名簿入力）`,
      ref_type: 'guest',
      ref_id: id,
      created_at: at,
    });
    setDone(true);
    setRedo(false);
    setSubmitting(false);
  }

  function reenter() {
    // Prefill from the latest batch of register rows (the most recent partySize).
    const recent = existing.slice(0, partySize).reverse();
    const loaded: Person[] = recent.map((r) => ({
      name: r.name ?? '',
      address: r.address ?? '',
      contact: r.contact ?? '',
      nationality: r.nationality ?? '',
      passport: r.passport_number ?? '',
    }));
    while (loaded.length < partySize) {
      loaded.push(emptyPerson());
    }
    setPeople(loaded);
    setResidence(recent.some((r) => r.nationality) ? 'abroad' : 'japan');
    setDone(false);
    setRedo(true);
  }

  // The completed screen is shown while a guest still holds the iPad (kiosk hand-
  // off). Gate the "back to staff" exit behind a long-press so a guest can't
  // casually tap straight into the staff screens (guest list / other guests' PII);
  // a staff member returning the device just holds the button.
  const startHold = () => {
    holdTimer.current = setTimeout(() => navigate(`/guests/${id}`), 700);
  };
  const cancelHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  if ((done || registered) && !redo) {
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
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          className="mt-8 min-h-[44px] rounded-full border border-line px-6 text-[0.84rem] text-ink-light"
        >
          スタッフ画面へ戻る（長押し）
        </button>
        <button
          type="button"
          onClick={reenter}
          className="mt-3 text-[0.78rem] text-ink-mute underline"
        >
          記入をやり直す / Re-enter
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
              Japanese law requires every guest to be listed. Please fill in all {partySize}{' '}
              guest(s).
              <br />
              法令により宿泊者全員の記入をお願いしています（{partySize}名）。
            </>
          ) : (
            <>
              法令により宿泊者全員の記入をお願いしています（{partySize}名）。
              <br />
              Japanese law requires every guest to be listed.
            </>
          )}
        </p>

        {people.map((person, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length party form, order is stable
            key={index}
            className="mb-5 rounded-[14px] border border-line bg-paper/60 px-4 pt-4 pb-1"
          >
            <div className="mb-2 font-bold text-[0.9rem] text-orange">
              {index === 0
                ? abroad
                  ? 'Guest 1 (representative) / 代表者'
                  : '代表者 / Guest 1'
                : abroad
                  ? `Guest ${index + 1}`
                  : `同行者 ${index}（${index + 1}人目）`}
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-x-5">
              <Field
                primary={abroad ? 'Full name' : '氏名'}
                secondary={abroad ? '氏名' : 'Full name'}
                value={person.name}
                onChange={(v) => setPerson(index, 'name', v)}
                required
                wide
              />
              <Field
                primary={abroad ? 'Home address' : '住所'}
                secondary={abroad ? '住所' : 'Home address'}
                value={person.address}
                onChange={(v) => setPerson(index, 'address', v)}
                required={index === 0}
                wide
                placeholder={index === 0 ? undefined : '代表者と同じ場合は空欄でOK'}
              />
              {index === 0 ? (
                <Field
                  primary={abroad ? 'Phone or email' : '連絡先（電話 or メール）'}
                  secondary={abroad ? '連絡先' : 'Phone or email'}
                  value={person.contact}
                  onChange={(v) => setPerson(index, 'contact', v)}
                  required
                  inputMode="email"
                  wide={!abroad}
                />
              ) : null}
              {abroad ? (
                <>
                  <Field
                    primary="Nationality"
                    secondary="国籍"
                    value={person.nationality}
                    onChange={(v) => setPerson(index, 'nationality', v)}
                    required
                  />
                  <Field
                    primary="Passport number"
                    secondary="旅券番号"
                    value={person.passport}
                    onChange={(v) => setPerson(index, 'passport', v)}
                    required
                    wide
                  />
                </>
              ) : null}
            </div>
          </div>
        ))}

        <PrimaryButton onClick={submit} disabled={!complete || submitting}>
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
