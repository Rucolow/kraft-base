import { useQuery } from '@powersync/react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BackButton,
  Card,
  EmptyState,
  GhostButton,
  PrimaryButton,
  Screen,
  SectionLabel,
  TextField,
} from '../components/ui';
import { useGuest } from '../data/queries';
import { jstDate, nowIso } from '../lib/date';
import { insertRow, updateRow, uuid } from '../lib/db';
import type { GuestRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';

export function GuestEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentStaff, isOwner } = useSession();
  const editing = id !== undefined;
  const { data: guests } = useGuest(id ?? '');
  const existing = guests[0] ?? null;

  const { data: reviewNeeded } = useQuery<GuestRow>(
    'SELECT * FROM guest WHERE stay_date < ? AND review_sent_at IS NULL ORDER BY stay_date DESC LIMIT 20',
    [jstDate()],
  );

  const [form, setForm] = useState({
    stay_date: existing?.stay_date ?? jstDate(),
    name: existing?.name ?? '',
    country: existing?.country ?? '',
    language: existing?.language ?? 'en',
    party_size: String(existing?.party_size ?? 1),
    checkin_time: existing?.checkin_time ?? '',
    bed: existing?.bed ?? '',
    bento: existing?.bento ?? '',
  });

  if (!isOwner) {
    return (
      <Screen>
        <BackButton onClick={() => navigate('/guests')}>本日のゲスト</BackButton>
        <EmptyState>ゲストの登録・編集はオーナー専用です。</EmptyState>
      </Screen>
    );
  }

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function save() {
    if (!form.name.trim()) {
      return;
    }
    const values = {
      stay_date: form.stay_date,
      name: form.name.trim(),
      country: form.country || null,
      language: form.language || null,
      party_size: Number.parseInt(form.party_size, 10) || 1,
      checkin_time: form.checkin_time || null,
      bed: form.bed || null,
      bento: form.bento || null,
    };
    if (editing && existing) {
      await updateRow('guest', existing.id, values);
    } else {
      await insertRow('guest', {
        id: uuid(),
        ...values,
        status: 'expected',
        review_sent_at: null,
        created_by: currentStaff?.id ?? null,
        created_at: nowIso(),
      });
    }
    navigate('/guests');
  }

  return (
    <Screen>
      <BackButton onClick={() => navigate('/guests')}>本日のゲスト</BackButton>
      <SectionLabel>{editing ? 'ゲストを編集' : 'ゲストを追加'}</SectionLabel>

      <TextField
        label="宿泊日"
        value={form.stay_date}
        onChange={set('stay_date')}
        placeholder="YYYY-MM-DD"
      />
      <TextField label="お名前" value={form.name} onChange={set('name')} />
      <TextField label="国" value={form.country} onChange={set('country')} />
      <TextField
        label="言語コード（en / de / it …）"
        value={form.language}
        onChange={set('language')}
      />
      <TextField
        label="人数"
        type="number"
        inputMode="numeric"
        value={form.party_size}
        onChange={set('party_size')}
      />
      <TextField label="チェックイン" value={form.checkin_time} onChange={set('checkin_time')} />
      <TextField label="ベッド" value={form.bed} onChange={set('bed')} />
      <TextField label="弁当" value={form.bento} onChange={set('bento')} />

      <PrimaryButton onClick={save}>{editing ? '保存' : '追加'}</PrimaryButton>
      <div className="mt-2">
        <GhostButton onClick={() => navigate('/guests')}>キャンセル</GhostButton>
      </div>

      {!editing && reviewNeeded.length > 0 ? (
        <>
          <SectionLabel>お礼・レビュー未送信</SectionLabel>
          <div className="mb-2 px-1 text-[0.76rem] text-ink-light">
            送信は予約サイト経由。対面・火打石では依頼しない。
          </div>
          {reviewNeeded.map((guest) => (
            <Card key={guest.id}>
              <div className="flex items-center gap-2.5">
                <div className="flex-1">
                  <div className="font-bold text-[0.92rem]">{guest.name}</div>
                  <div className="text-[0.74rem] text-ink-light">{guest.stay_date}</div>
                </div>
                <button
                  type="button"
                  onClick={() => updateRow('guest', guest.id, { review_sent_at: nowIso() })}
                  className="rounded-full bg-orange px-3 py-1.5 font-bold text-[0.74rem] text-green-deep"
                >
                  送信済みにする
                </button>
              </div>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
