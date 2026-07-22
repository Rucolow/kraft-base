import { useQuery } from '@powersync/react';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { nowIso, shiftDate } from '../lib/date';
import { boolToInt, insertRow, updateRow, uuid } from '../lib/db';
import type { GuestRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';

const FIELD =
  'min-h-[48px] w-full rounded-[11px] border border-line bg-cream px-3 py-3 text-base text-ink outline-none focus:border-orange-light';
const OTHER = '__other__';

// checkin_time can hold a HH:MM time, the sentinel '未定' (undecided), or legacy
// free text (e.g. '遅着 ~19:30'). Only real times may be fed to <input type="time">
// — it silently drops anything else, which used to wipe free-text times on any
// unrelated save.
const isHHMM = (value: string | null | undefined): boolean =>
  typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value);
const UNDECIDED = '未定';

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
// 「ベジタリアン弁当」が正式名称（2026年6月に koguchi 側で意図改名。旧称ヴィーガン弁当）。
const BENTO_ITEMS = ['焼肉弁当', 'ベジタリアン弁当', 'おむすび弁当'];
const TIMES = ['15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'];

// Opens the native date/time picker wherever the field is tapped.
function openPicker(event: React.SyntheticEvent<HTMLInputElement>) {
  const element = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
  try {
    element.showPicker?.();
  } catch {
    /* showPicker throws without user activation; ignore */
  }
}

function parseBento(value: string | null): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!value) {
    return counts;
  }
  for (const part of value.split('・')) {
    const match = part.match(/^(.*?)\s*×\s*(\d+)$/);
    if (match?.[1]) {
      counts[match[1].trim()] = Number.parseInt(match[2] ?? '0', 10);
    }
  }
  return counts;
}

function bentoToString(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([item, n]) => `${item} ×${n}`)
    .join('・');
}

function parseBeds(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split('・')
    .map((part) => part.trim())
    .filter(Boolean);
}

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
  const inOptions = options.includes(value);
  // "Other" is active when the user picked it, or the loaded value isn't a preset.
  const [otherMode, setOtherMode] = useState(false);
  const showInput = otherMode || (value !== '' && !inOptions);
  const selectValue = showInput ? OTHER : value;
  return (
    <Labeled label={label}>
      <select
        className={FIELD}
        value={selectValue}
        onChange={(event) => {
          if (event.target.value === OTHER) {
            setOtherMode(true);
            onChange('');
          } else {
            setOtherMode(false);
            onChange(event.target.value);
          }
        }}
      >
        <option value="">選択してください</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER}>その他（自由入力）</option>
      </select>
      {showInput ? (
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
    [shiftDate()],
  );

  const [form, setForm] = useState({
    stay_date: existing?.stay_date ?? shiftDate(),
    name: existing?.name ?? '',
    country: existing?.country ?? '',
    language: existing?.language ?? 'en',
    party_size: String(existing?.party_size ?? 1),
    // Only a real HH:MM feeds the time input; '未定'/free-text are held elsewhere.
    checkin_time: isHHMM(existing?.checkin_time) ? (existing?.checkin_time ?? '') : '',
  });
  const [undecided, setUndecided] = useState(existing?.checkin_time === UNDECIDED);
  // Whether the time field (or the 未定 toggle) was touched this session, so an
  // unrelated edit preserves a loaded free-text time instead of wiping it.
  const [checkinTouched, setCheckinTouched] = useState(false);
  const [beds, setBeds] = useState<string[]>(() => parseBeds(existing?.bed ?? null));
  const [wholeHouse, setWholeHouse] = useState(existing?.whole_house === 1);
  const [bento, setBento] = useState<Record<string, number>>(() =>
    parseBento(existing?.bento ?? null),
  );
  // The bento control only models the preset "item ×N" form. Track whether the
  // user actually touched it so an unrelated edit doesn't destroy a free-form
  // bento note (e.g. "なし（カップ麺を案内）") that the counters can't represent.
  const [bentoTouched, setBentoTouched] = useState(false);
  const [langOther, setLangOther] = useState(false);

  // The guest record loads asynchronously; populate the form once it arrives so
  // editing shows the saved values rather than a blank (new-looking) form.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sync only when the loaded record changes
  useEffect(() => {
    if (!existing) {
      return;
    }
    setForm({
      stay_date: existing.stay_date ?? shiftDate(),
      name: existing.name ?? '',
      country: existing.country ?? '',
      // Don't coerce an unknown/blank language to 'en' on edit (would silently
      // mutate the record); only new guests default to 'en' via useState above.
      language: existing.language ?? '',
      party_size: String(existing.party_size ?? 1),
      checkin_time: isHHMM(existing.checkin_time) ? (existing.checkin_time ?? '') : '',
    });
    setUndecided(existing.checkin_time === UNDECIDED);
    setCheckinTouched(false);
    setBeds(parseBeds(existing.bed ?? null));
    setWholeHouse(existing.whole_house === 1);
    setBento(parseBento(existing.bento ?? null));
    setBentoTouched(false);
  }, [existing?.id]);

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

  const bumpBento = (item: string, delta: number) => {
    setBentoTouched(true);
    setBento((prev) => {
      const next = Math.max(0, (prev[item] ?? 0) + delta);
      return { ...prev, [item]: next };
    });
  };

  const toggleBed = (bed: string) =>
    setBeds((prev) => (prev.includes(bed) ? prev.filter((b) => b !== bed) : [...prev, bed]));

  const langKnown = form.language in LANG_LABEL;
  const showLangInput = langOther || (form.language !== '' && !langKnown);

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
      // '未定' when toggled; a typed time when touched; otherwise keep the loaded
      // value verbatim so a legacy free-text time survives an unrelated edit.
      checkin_time: undecided
        ? UNDECIDED
        : checkinTouched
          ? form.checkin_time.trim() || null
          : (existing?.checkin_time ?? null),
      // Preserve whatever bed tokens are present (including non-preset/legacy
      // values like "1・2番（下段）"); the old preset-only filter silently wiped them.
      bed: beds.length > 0 ? beds.join('・') : null,
      // Keep a non-preset bento note unless the counters were actually edited.
      bento: bentoTouched ? bentoToString(bento) || null : (existing?.bento ?? null),
      whole_house: boolToInt(wholeHouse),
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

  const partyCount = Number.parseInt(form.party_size, 10) || 1;

  return (
    <Screen>
      <BackButton onClick={() => navigate('/guests')}>本日のゲスト</BackButton>
      <SectionLabel>{editing ? 'ゲストを編集' : 'ゲストを追加'}</SectionLabel>

      <span className="mb-1 block text-[0.82rem] text-ink-light">予約タイプ</span>
      <div className="mb-4 flex gap-2">
        {[
          { value: false, label: '相部屋' },
          { value: true, label: '貸切' },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => setWholeHouse(option.value)}
            className={`min-h-[52px] flex-1 rounded-[12px] border font-bold text-[0.95rem] ${
              wholeHouse === option.value
                ? 'border-orange bg-orange/15 text-orange'
                : 'border-line text-ink-light'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-x-4">
        <Labeled label="宿泊日">
          <input
            type="date"
            className={FIELD}
            value={form.stay_date}
            onFocus={openPicker}
            onClick={openPicker}
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
            value={showLangInput ? OTHER : form.language}
            onChange={(event) => {
              if (event.target.value === OTHER) {
                setLangOther(true);
                set('language')('');
              } else {
                setLangOther(false);
                set('language')(event.target.value);
              }
            }}
          >
            {Object.entries(LANG_LABEL).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
            <option value={OTHER}>その他（自由入力）</option>
          </select>
          {showLangInput ? (
            <input
              className={`mt-2 ${FIELD}`}
              placeholder="言語（自由入力）"
              value={form.language}
              onChange={(event) => set('language')(event.target.value)}
            />
          ) : null}
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
          <div className="flex gap-2">
            <input
              type="time"
              list="checkin-times"
              className={`flex-1 ${FIELD} ${undecided ? 'opacity-40' : ''}`}
              value={form.checkin_time}
              disabled={undecided}
              onFocus={openPicker}
              onClick={openPicker}
              onChange={(event) => {
                setCheckinTouched(true);
                set('checkin_time')(event.target.value);
              }}
            />
            <button
              type="button"
              onClick={() => {
                setCheckinTouched(true);
                setUndecided((prev) => {
                  if (!prev) {
                    set('checkin_time')('');
                  }
                  return !prev;
                });
              }}
              className={`min-h-[48px] shrink-0 rounded-[11px] border px-4 font-bold text-[0.9rem] ${
                undecided ? 'border-orange bg-orange/15 text-orange' : 'border-line text-ink-light'
              }`}
            >
              未定
            </button>
          </div>
          <datalist id="checkin-times">
            {TIMES.map((time) => (
              <option key={time} value={time} />
            ))}
          </datalist>
        </Labeled>

        <Labeled label={`ベッド（${partyCount}名分・複数選択可：${beds.length}件選択中）`}>
          <div className="flex flex-wrap gap-2">
            {BEDS.map((bed) => {
              const on = beds.includes(bed);
              return (
                <button
                  key={bed}
                  type="button"
                  onClick={() => toggleBed(bed)}
                  className={`min-h-[44px] rounded-[11px] border px-4 font-bold text-[0.9rem] ${
                    on ? 'border-orange bg-orange/15 text-orange' : 'border-line text-ink-light'
                  }`}
                >
                  {bed}
                </button>
              );
            })}
          </div>
        </Labeled>

        <Labeled label="弁当（必要な数だけ）">
          <div className="rounded-[11px] border border-line">
            {[
              ...BENTO_ITEMS,
              // Legacy names in stored data (e.g. 旧称 ヴィーガン弁当) get their own
              // visible row so staff can see and decrement them; previously they were
              // preserved but invisible.
              ...Object.keys(bento).filter(
                (name) => !BENTO_ITEMS.includes(name) && (bento[name] ?? 0) > 0,
              ),
            ].map((item, index) => {
              const count = bento[item] ?? 0;
              return (
                <div
                  key={item}
                  className={`flex items-center gap-2 px-3 py-2.5 ${index > 0 ? 'border-line border-t' : ''}`}
                >
                  <span className={`flex-1 text-[0.92rem] ${count > 0 ? 'font-bold' : ''}`}>
                    {item}
                  </span>
                  <button
                    type="button"
                    aria-label={`${item}を減らす`}
                    onClick={() => bumpBento(item, -1)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink disabled:opacity-40"
                    disabled={count === 0}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-6 text-center font-bold text-[1rem] tabular-nums">
                    {count}
                  </span>
                  <button
                    type="button"
                    aria-label={`${item}を増やす`}
                    onClick={() => bumpBento(item, 1)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-orange text-onaccent"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </Labeled>
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
                  className="rounded-full bg-orange px-3 py-1.5 font-bold text-[0.74rem] text-onaccent"
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
