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
import { LANG_LABEL } from '../content/kinds';
import { useGuest } from '../data/queries';
import { jstDate, nowIso } from '../lib/date';
import { insertRow, updateRow, uuid } from '../lib/db';
import type { GuestRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';

const FIELD =
  'min-h-[48px] w-full rounded-[11px] border border-line bg-cream px-3 py-3 text-base text-ink outline-none focus:border-orange-light';
const OTHER = '__other__';

const COUNTRIES = [
  '日本',
  'ドイツ',
  'イタリア',
  'フランス',
  'イギリス',
  'アメリカ',
  'オーストラリア',
  'スペイン',
  '中国',
  '韓国',
  '台湾',
];
const BEDS = ['1番', '2番', '3番', '4番', '5番', '6番', '和室'];
const BENTO = ['焼肉弁当', 'ヴィーガン弁当', 'なし'];
const TIMES = ['15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'];

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 block">
      <span className="mb-1 block text-[0.82rem] text-ink-light">{label}</span>
      {children}
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: string[];
}) {
  const known = value === '' || options.includes(value);
  return (
    <Labeled label={label}>
      <select
        className={FIELD}
        value={known ? value : OTHER}
        onChange={(event) => onChange(event.target.value === OTHER ? '' : event.target.value)}
      >
        <option value="">選択してください</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER}>その他（自由入力）</option>
      </select>
      {!known ? (
        <input
          className={`mt-2 ${FIELD}`}
          placeholder="自由入力"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </Labeled>
  );
}

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

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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

      <div className="md:grid md:grid-cols-2 md:gap-x-4">
        <Labeled label="宿泊日">
          <input
            type="date"
            className={FIELD}
            value={form.stay_date}
            onChange={(event) => set('stay_date')(event.target.value)}
          />
        </Labeled>

        <TextField
          label="お名前"
          value={form.name}
          onChange={(event) => set('name')(event.target.value)}
        />

        <Choice label="国" value={form.country} onChange={set('country')} options={COUNTRIES} />

        <Labeled label="言語">
          <select
            className={FIELD}
            value={form.language}
            onChange={(event) => set('language')(event.target.value)}
          >
            {Object.entries(LANG_LABEL).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Labeled>

        <Labeled label="人数">
          <select
            className={FIELD}
            value={form.party_size}
            onChange={(event) => set('party_size')(event.target.value)}
          >
            {Array.from({ length: 8 }, (_, index) => String(index + 1)).map((value) => (
              <option key={value} value={value}>
                {value}名
              </option>
            ))}
          </select>
        </Labeled>

        <Labeled label="チェックイン予定">
          <input
            type="time"
            list="checkin-times"
            className={FIELD}
            value={form.checkin_time}
            onChange={(event) => set('checkin_time')(event.target.value)}
          />
          <datalist id="checkin-times">
            {TIMES.map((time) => (
              <option key={time} value={time} />
            ))}
          </datalist>
        </Labeled>

        <Choice label="ベッド" value={form.bed} onChange={set('bed')} options={BEDS} />
        <Choice label="弁当" value={form.bento} onChange={set('bento')} options={BENTO} />
      </div>

      <div className="mt-2">
        <PrimaryButton onClick={save} disabled={!form.name.trim()}>
          {editing ? '保存' : '追加'}
        </PrimaryButton>
      </div>
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
                  className="rounded-full bg-orange px-3 py-1.5 font-bold text-[0.74rem] text-ondark"
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
