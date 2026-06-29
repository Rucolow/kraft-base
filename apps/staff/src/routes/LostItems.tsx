import { Camera, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useLostItems } from '../data/queries';
import { jstDate, nowIso } from '../lib/date';
import { insertRow, updateRow, uuid } from '../lib/db';
import { useSession } from '../lib/session';
import { photoSrc, storePhoto } from '../lib/storage';

const FLOW: Record<string, string> = {
  held: 'contacted',
  contacted: 'returned',
  returned: 'disposed',
  disposed: 'police',
  police: 'held',
};
const LABEL: Record<string, string> = {
  held: '保管中',
  contacted: '連絡済',
  returned: '返却済',
  disposed: '処分',
  police: '警察',
};

export function LostItems() {
  const navigate = useNavigate();
  const { currentStaff } = useSession();
  const { data: items } = useLostItems();
  const [item, setItem] = useState('');
  const [place, setPlace] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const adding = useRef(false);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoPath(await storePhoto(file));
    }
  }

  // Cycle the lost-item status. 返却済/処分 are closed outcomes; confirm before a
  // single tap re-opens a finished item (and re-bumps the open count).
  function cycle(id: string, status: string | null) {
    const current = status ?? 'held';
    if (
      (current === 'returned' || current === 'disposed') &&
      !window.confirm('終了した忘れ物のステータスを変更しますか？')
    ) {
      return;
    }
    updateRow('lost_item', id, { status: FLOW[current] ?? 'held' });
  }

  async function add() {
    if (!item.trim() || adding.current) {
      return;
    }
    adding.current = true;
    try {
      await insertRow('lost_item', {
        id: uuid(),
        item: item.trim(),
        found_date: jstDate(),
        place: place || null,
        finder_id: currentStaff?.id ?? null,
        guest_id: null,
        photo_path: photoPath,
        status: 'held',
        note: null,
        created_at: nowIso(),
      });
      setItem('');
      setPlace('');
      setPhotoPath(null);
    } finally {
      adding.current = false;
    }
  }

  return (
    <Screen>
      <BackButton onClick={() => navigate('/records')}>台帳</BackButton>
      <SectionLabel>忘れ物を起票</SectionLabel>
      <input
        className="mb-2 min-h-[44px] w-full rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-orange-light"
        placeholder="品名"
        value={item}
        onChange={(event) => setItem(event.target.value)}
      />
      <input
        className="mb-2 min-h-[44px] w-full rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-orange-light"
        placeholder="発見場所"
        value={place}
        onChange={(event) => setPlace(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <label className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[11px] border border-line border-dashed text-[0.84rem] text-ink-light">
          <Camera size={16} /> {photoPath ? '写真を添付済み' : '写真を撮る／選ぶ'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPick}
          />
        </label>
        <button
          type="button"
          aria-label="起票"
          onClick={add}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[11px] bg-orange text-ondark"
        >
          <Plus size={18} />
        </button>
      </div>

      <SectionLabel>一覧</SectionLabel>
      {items.length === 0 ? (
        <EmptyState>忘れ物はありません。</EmptyState>
      ) : (
        items.map((lost) => (
          <Card key={lost.id}>
            <div className="flex items-center gap-2.5">
              {photoSrc(lost.photo_path) ? (
                <img
                  src={photoSrc(lost.photo_path) ?? ''}
                  alt={lost.item ?? ''}
                  className="h-12 w-12 shrink-0 rounded-[9px] border border-line object-cover"
                />
              ) : null}
              <div className="flex-1">
                <div className="font-bold text-[0.92rem]">{lost.item}</div>
                <div className="text-[0.74rem] text-ink-light">
                  {lost.found_date} ／ {lost.place ?? '場所未記入'}
                </div>
              </div>
              <button type="button" onClick={() => cycle(lost.id, lost.status)}>
                <Badge tone={lost.status === 'returned' ? 'ok' : 'warn'}>
                  {LABEL[lost.status ?? 'held']}
                </Badge>
              </button>
            </div>
          </Card>
        ))
      )}
    </Screen>
  );
}
